// Set your Mapbox access token here
mapboxgl.accessToken = 'pk.eyJ1IjoibG9sMDA4IiwiYSI6ImNtN2NkMWo3YzBuanMybXB3OHIxaHF5M3EifQ.l3t2WZjb7XIK7lySSYacow';

const map = new mapboxgl.Map({
    container: 'map', // ID of the div where the map will render
    style: 'mapbox://styles/mapbox/streets-v12', // Map style
    center: [-71.09415, 42.36027], // [longitude, latitude]
    zoom: 12, // Initial zoom level
    minZoom: 5, // Minimum allowed zoom
    maxZoom: 18 // Maximum allowed zoom
});

map.on('load', () => {
    const lineStyle = {
        'line-color': '#32D400',
        'line-width': 5,         
        'line-opacity': 0.6  
    };

    map.addSource('boston_route', {
        type: 'geojson',
        data: 'https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson?...'
    });

    map.addLayer({
        id: 'boston-bike-lanes',
        type: 'line',
        source: 'boston_route',
        paint: lineStyle
    });

    map.addSource('cambridge_route', {
        type: 'geojson',
        data: 'https://data.cambridgema.gov/resource/your_cambridge_bike_lane_data.geojson'
    });

    map.addLayer({
        id: 'cambridge-bike-lanes',
        type: 'line',
        source: 'cambridge_route',
        paint: lineStyle
    });
});
