// Initialize map centered on Wisconsin
const map = L.map('map').setView([44.5, -89.5], 7);

// Base tile layer
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  maxZoom: 19,
}).addTo(map);

// Data layers will be loaded here
// Example: fetch('data/data_centers.geojson').then(r => r.json()).then(data => L.geoJSON(data).addTo(map));
