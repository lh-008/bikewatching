// Set your Mapbox access token
mapboxgl.accessToken = 'pk.eyJ1IjoibG9sMDA4IiwiYSI6ImNtN2NkMWo3YzBuanMybXB3OHIxaHF5M3EifQ.l3t2WZjb7XIK7lySSYacow';

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

    d3.json(jsonUrl).then(jsonData => {
        console.log('Loaded JSON Data:', jsonData);
        const stations = jsonData.data.stations;
        console.log('Stations Array:', stations);
    }).catch(error => {
        console.error('Error loading JSON:', error);
    });
});
