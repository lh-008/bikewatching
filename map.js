mapboxgl.accessToken = 'pk.eyJ1IjoibG9sMDA4IiwiYSI6ImNtN2NkMWo3YzBuanMybXB3OHIxaHF5M3EifQ.l3t2WZjb7XIK7lySSYacow';

//global helper functions
function getCoords(station) {
    const point = map.project(new mapboxgl.LngLat(+station.lon, +station.lat));
    return { cx: point.x, cy: point.y };
}

function minutesSinceMidnight(date) {
    return date.getHours() * 60 + date.getMinutes();
 }

 function filterByMinute(tripsByMinute, minute) {
    let minMinute = (minute - 60 + 1440) % 1440;
    let maxMinute = (minute + 60) % 1440;
  
    if (minMinute > maxMinute) {
      let beforeMidnight = tripsByMinute.slice(minMinute);
      let afterMidnight = tripsByMinute.slice(0, maxMinute);
      return beforeMidnight.concat(afterMidnight).flat();
    } else {
      return tripsByMinute.slice(minMinute, maxMinute).flat();
    }
}

function formatTime(minutes) {
    const date = new Date(0, 0, 0, 0, minutes);
    return date.toLocaleString('en-US', { timeStyle: 'short' });
}

// slider variables
let timeFilter = -1;
const timeSlider = document.getElementById('time-slider');
const selectedTime = document.getElementById('selected-time');
const anyTimeLabel = document.getElementById('any-time');

// Initialize the map
const map = new mapboxgl.Map({
  container: 'map', // ID of the div where the map will render
  style: 'mapbox://styles/mapbox/streets-v12', // Map style
  center: [-71.09415, 42.36027], // [longitude, latitude]
  zoom: 12, // Initial zoom level
  minZoom: 5, // Minimum allowed zoom
  maxZoom: 18 // Maximum allowed zoom
});

map.on('load', () => { 
    map.addSource('boston_route', {
        type: 'geojson',
        data: 'https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson?...'
    });

    map.addLayer({
        id: 'boston-bike-lanes',
        type: 'line',
        source: 'boston_route',
        paint: {
            'line-color': '#32D400',  
            'line-width': 3,          
            'line-opacity': 0.6       
        }
    });

    map.addSource('cambridge_route', {
        type: 'geojson',
        data: 'https://raw.githubusercontent.com/cambridgegis/cambridgegis_data/main/Recreation/Bike_Facilities/RECREATION_BikeFacilities.geojson'
    });

    map.addLayer({
        id: 'cambridge-bike-lanes',
        type: 'line',
        source: 'cambridge_route',
        paint: {
            'line-color': '#32D400',  
            'line-width': 3,          
            'line-opacity': 0.6       
        }
    });

    
    let stationFlow = d3.scaleQuantize().domain([0, 1]).range([0, 0.5, 1]);
    const jsonUrl = 'https://dsc106.com/labs/lab07/data/bluebikes-stations.json';
    d3.json(jsonUrl).then(jsonData => {
        let stations = jsonData.data.stations;
        const svg = d3.select('#map').select('svg');
        
        const circles = svg.selectAll('circle')
            .data(stations)
            .enter()
            .append('circle')
            .attr('fill', 'steelblue')
            .attr('stroke', 'white')
            .attr('stroke-width', 1)
            .attr('opacity', 0.8)
            .style("--departure-ratio", d => stationFlow(d.departures / d.totalTraffic)) ;

        // Function to update circle positions when the map moves/zooms
        function updatePositions() {
            circles
            .attr('cx', d => getCoords(d).cx)  // Set the x-position using projected coordinates
            .attr('cy', d => getCoords(d).cy); // Set the y-position using projected coordinates
        }   
  
        // Initial position update when map loads
        updatePositions();
        map.on('move', updatePositions);
        map.on('zoom', updatePositions);
        map.on('resize', updatePositions);
        map.on('moveend', updatePositions);

        const csvUrl = 'https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv';
        d3.csv(csvUrl).then(csvData => {
            let trips = csvData;

            let departures = d3.rollup(
                trips, 
                v => v.length, 
                d => d.start_station_id
            );
            let departuresByMinute = Array.from({ length: 1440 }, () => []);
            let arrivals = d3.rollup(
                trips, 
                v => v.length, 
                d => d.end_station_id
            );
            let arrivalsByMinute = Array.from({ length: 1440 }, () => []); 

            for (let trip of trips) {
                trip.started_at = new Date(trip.started_at);
                trip.ended_at = new Date(trip.ended_at);

                let startedMinutes = minutesSinceMidnight(trip.started_at);
                departuresByMinute[startedMinutes].push(trip);

                let endedMinutes = minutesSinceMidnight(trip.ended_at);
                arrivalsByMinute[endedMinutes].push(trip);
            }

            stations.forEach(station => {
                let id = station.short_name;
                station.arrivals = arrivals.get(id) ?? 0;
                station.departures = departures.get(id) ?? 0;
                station.totalTraffic = station.arrivals + station.departures;
            });

            const radiusScale = d3.scaleSqrt()
                .domain([0, d3.max(stations, d => d.totalTraffic)])
                .range([3, 25]);

            circles
                .attr('r', d => radiusScale(d.totalTraffic))
                .style("--departure-ratio", d => stationFlow(d.departures / d.totalTraffic)) 
                .each(function(d) {
                    d3.select(this)
                        .append('title')
                        .text(`${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`);
                });

            function filterTripsByTime() {
                filteredArrivals = d3.rollup(
                    filterByMinute(arrivalsByMinute, timeFilter), 
                    v => v.length, 
                    d => d.start_station_id
                );
                filteredDepartures = d3.rollup(
                    filterByMinute(departuresByMinute, timeFilter),
                     v => v.length,
                     d => d.end_station_id
                );

                filteredStations = stations.map(station => {
                    let newStation = { ...station };
                    let id = newStation.short_name;
                    newStation.arrivals = filteredArrivals.get(id) ?? 0;
                    newStation.departures = filteredDepartures.get(id) ?? 0;
                    newStation.totalTraffic = newStation.arrivals + newStation.departures;
                    return newStation;
                });

                const radiusScale = d3.scaleSqrt()
                    .domain([0, d3.max(stations, d => d.totalTraffic)])
                    .range(timeFilter === -1 ? [3, 25] : [3, 50]);

                circles
                    .data(filteredStations)
                    .attr('r', d => radiusScale(d.totalTraffic))
                    .style("--departure-ratio", d => stationFlow(d.departures / d.totalTraffic))
                    .each(function(d) {
                        d3.select(this)
                            .append('title')
                            .text(`${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`);
                    });
            }

            function updateTimeDisplay() {
                timeFilter = Number(timeSlider.value);
                if (timeFilter === -1) {
                    selectedTime.textContent = '';
                    anyTimeLabel.style.display = 'block';
                } else {
                    selectedTime.textContent = formatTime(timeFilter);
                    anyTimeLabel.style.display = 'none';
                }
                filterTripsByTime();
            }

            timeSlider.addEventListener('input', updateTimeDisplay);
            updateTimeDisplay();

        }).catch(error => {
            console.error('Error loading CSV:', error);
        });

    }).catch(error => {
        console.error('Error loading JSON:', error);
    });
});