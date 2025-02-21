mapboxgl.accessToken = 'pk.eyJ1IjoibG9sMDA4IiwiYSI6ImNtN2NkMWo3YzBuanMybXB3OHIxaHF5M3EifQ.l3t2WZjb7XIK7lySSYacow';

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v12',
  center: [-71.09415, 42.36027],
  zoom: 12,
  minZoom: 5,
  maxZoom: 18
});

let stationFlow = d3.scaleQuantize().domain([0, 1]).range([0, 0.5, 1]);
const container = d3.select(map.getCanvasContainer());
let svg = d3.select(map.getCanvasContainer()).select('svg');
if (svg.empty()) {
  svg = container.append('svg')
    .attr('width', '100%')
    .attr('height', '100%')
    .style('position', 'absolute')
    .style('top', '0')
    .style('left', '0');
}

let timeFilter = -1;
const timeSlider = document.getElementById('time-slider');
const selectedTime = document.getElementById('selected-time');
const anyTimeLabel = document.getElementById('any-time');
let stations = [];
let trips = [];
let filteredTrips = [];
let filteredArrivals = new Map();
let filteredDepartures = new Map();
let filteredStations = [];

function formatTime(minutes) {
  const date = new Date(0, 0, 0, 0, minutes);
  return date.toLocaleString('en-US', { timeStyle: 'short' });
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

function getCoords(station) {
  const point = map.project(new mapboxgl.LngLat(+station.lon, +station.lat));
  return { cx: point.x, cy: point.y };
}

function minutesSinceMidnight(date) {
  return date.getHours() * 60 + date.getMinutes();
}

function filterTripsByTime() {
  filteredTrips = (timeFilter === -1)
    ? trips
    : trips.filter(trip => {
        const startedMinutes = minutesSinceMidnight(new Date(trip.started_at));
        const endedMinutes = minutesSinceMidnight(new Date(trip.ended_at));
        return (Math.abs(startedMinutes - timeFilter) <= 60 ||
                Math.abs(endedMinutes - timeFilter) <= 60);
      });

  filteredArrivals = d3.rollup(filteredTrips, v => v.length, d => d.end_station_id);
  filteredDepartures = d3.rollup(filteredTrips, v => v.length, d => d.start_station_id);

  filteredStations = stations.map(station => {
    let newStation = { ...station };
    let id = newStation.short_name;
    newStation.arrivals = filteredArrivals.get(id) ?? 0;
    newStation.departures = filteredDepartures.get(id) ?? 0;
    newStation.totalTraffic = newStation.arrivals + newStation.departures;
    return newStation;
  });

  const maxTraffic = d3.max(filteredStations, d => d.totalTraffic) || 0;
  const radiusScale = d3.scaleSqrt()
    .domain([0, maxTraffic])
    .range(timeFilter === -1 ? [0, 25] : [3, 25]);
  let circles = svg.selectAll('circle')
    .data(filteredStations, d => d.short_name);

  circles.enter()
    .append('circle')
    .attr('fill', 'steelblue')
    .attr('stroke', 'white')
    .attr('stroke-width', 1)
    .attr('opacity', 0.6)
    .each(function(d) {
      d3.select(this)
        .append('title')
        .text(`${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`);
    })
    .merge(circles)
    .attr('r', d => radiusScale(d.totalTraffic))
    .attr('cx', d => getCoords(d).cx)
    .attr('cy', d => getCoords(d).cy)
    .attr('visibility', d => d.totalTraffic > 0 ? 'visible' : 'hidden')
    .style("--departure-ratio", d => stationFlow(d.departures / d.totalTraffic)) ;

  circles.exit().remove();
}

map.on('load', () => {
  map.addSource('boston_route', {
    type: 'geojson',
    data: 'https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson?...'
  });
  map.addSource('cambridge_route', {
    type: 'geojson',
    data: 'https://raw.githubusercontent.com/cambridgegis/cambridgegis_data/main/Recreation/Bike_Facilities/RECREATION_BikeFacilities.geojson'
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

  const jsonUrl = 'https://dsc106.com/labs/lab07/data/bluebikes-stations.json';
  const csvUrl = 'https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv';

  d3.json(jsonUrl).then(jsonData => {
    stations = jsonData.data.stations;
    console.log('Stations:', stations);

    d3.csv(csvUrl).then(csvData => {
      trips = csvData;

      for (let trip of trips) {
        trip.started_at = new Date(trip.started_at);
        trip.ended_at = new Date(trip.ended_at);
      }

      const departures = d3.rollup(trips, v => v.length, d => d.start_station_id);
      const arrivals = d3.rollup(trips, v => v.length, d => d.end_station_id);

      stations = stations.map(station => {
        let id = station.short_name;
        station.arrivals = arrivals.get(id) ?? 0;
        station.departures = departures.get(id) ?? 0;
        station.totalTraffic = station.arrivals + station.departures;
        return station;
      });

      filterTripsByTime();
      map.on('move', update);
      map.on('zoom', filterTripsByTime);
      map.on('resize', filterTripsByTime);
      map.on('moveend', filterTripsByTime);
    });
  });
});
