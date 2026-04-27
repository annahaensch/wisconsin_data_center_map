// ---------------------------------------------------------------------------
// Map init — custom panes ensure correct z-order regardless of load timing
// ---------------------------------------------------------------------------
const map = L.map('map', { zoomControl: true }).setView([44.5, -89.5], 7);

map.createPane('waterbodies'); map.getPane('waterbodies').style.zIndex = 150;
map.createPane('counties');   map.getPane('counties').style.zIndex   = 200;
map.createPane('powerlines'); map.getPane('powerlines').style.zIndex = 300;
map.createPane('centers');    map.getPane('centers').style.zIndex    = 400;

L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
  subdomains: 'abcd',
  maxZoom: 19,
}).addTo(map);

// ---------------------------------------------------------------------------
// Status styling
// ---------------------------------------------------------------------------
const STATUS = {
  'Operational':         { fill: '#404040', stroke: '#404040' },
  'Under Construction':  { fill: '#fdb863', stroke: '#e66101' },
  'Planned':             { fill: '#b2abd2', stroke: '#5e3c99' },
  'Permitting':          { fill: '#b2abd2', stroke: '#5e3c99' },
  'Paused':              { fill: 'pink',    stroke: 'crimson'  },
  'Canceled':            { fill: 'pink',    stroke: 'crimson'  },
};

function statusStyle(status) {
  return STATUS[status] || { fill: '#999', stroke: '#555' };
}

// ---------------------------------------------------------------------------
// Last updated
// ---------------------------------------------------------------------------
fetch('data/last_updated.txt')
  .then(r => r.text())
  .then(date => {
    const el = document.getElementById('last-updated');
    if (el) el.textContent = `Data last updated: ${date.trim()}`;
  });

// ---------------------------------------------------------------------------
// Waterbodies
// ---------------------------------------------------------------------------
let waterbodiesLayer = null;

fetch('data/wi_waterbodies.geojson')
  .then(r => r.json())
  .then(data => {
    waterbodiesLayer = L.geoJSON(data, {
      pane: 'waterbodies',
      style: {
        color: '#7ab8d4',
        weight: 0.5,
        fillColor: '#a8d4e8',
        fillOpacity: 0.6,
      }
    }).addTo(map);
  });

// ---------------------------------------------------------------------------
// County boundaries
// ---------------------------------------------------------------------------
fetch('data/County_Boundaries_24K/County_Boundaries_24K.geojson')
  .then(r => r.json())
  .then(data => {
    L.geoJSON(data, {
      pane: 'counties',
      style: {
        color: '#8a9bb0',
        weight: 0.8,
        fillColor: '#f5f5f0',
        fillOpacity: 0.3,
      }
    }).addTo(map);
  });

// ---------------------------------------------------------------------------
// Power lines
// ---------------------------------------------------------------------------
const VOLT_COLORS = {
  '345':       '#1b7837',
  '220-287':   '#4dac26',
  '100-161':   '#a6d96a',
  'UNDER 100': '#d9ef8b',
};

const VOLT_WEIGHT = {
  '345':       2.2,
  '220-287':   1.6,
  '100-161':   1.1,
  'UNDER 100': 0.7,
};

fetch('data/wi_power_lines.geojson')
  .then(r => r.json())
  .then(data => {
    L.geoJSON(data, {
      pane: 'powerlines',
      style: f => ({
        color:   VOLT_COLORS[f.properties.VOLT_CLASS] || '#ccc',
        weight:  VOLT_WEIGHT[f.properties.VOLT_CLASS] || 0.7,
        opacity: 0.75,
      })
    }).addTo(map);
  });

// ---------------------------------------------------------------------------
// Acreage → radius
// ---------------------------------------------------------------------------
function acreRadius(acres) {
  const a = parseFloat(acres);
  if (isNaN(a) || a === 0) return 5;  // unknown
  if (a >= 100) return 14;            // mega
  if (a >= 10)  return 9;             // large
  if (a >= 1)   return 6;             // small
  return 4;                           // micro
}

// ---------------------------------------------------------------------------
// Data centers
// ---------------------------------------------------------------------------
const STATUS_ORDER = ['Operational', 'Paused', 'Canceled', 'Under Construction', 'Permitting', 'Planned'];

Papa.parse('data/data_centers.csv', {
  download: true,
  header: true,
  skipEmptyLines: true,
  complete: ({ data }) => {
    const sorted = [...data].sort((a, b) => {
      const ai = STATUS_ORDER.indexOf(a['Status']);
      const bi = STATUS_ORDER.indexOf(b['Status']);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });

    // Group co-located rows (same lat/lon) into a single marker.
    const groups = {};
    const groupOrder = [];
    sorted.forEach(row => {
      const lat = parseFloat(row['Latitude']);
      const lng = parseFloat(row['Longitude']);
      if (isNaN(lat) || isNaN(lng)) return;
      const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
      if (!groups[key]) { groups[key] = []; groupOrder.push(key); }
      groups[key].push(row);
    });

    groupOrder.forEach(key => {
      const group  = groups[key];
      const first  = group[0]; // highest-priority status after sort
      const lat    = parseFloat(first['Latitude']);
      const lng    = parseFloat(first['Longitude']);

      const { fill, stroke } = statusStyle(first['Status']);

      // Use the largest known acreage in the group for the marker size.
      const acres = group.map(r => parseFloat(r['Acres'])).filter(a => a > 0);
      const maxAcres = acres.length ? Math.max(...acres) : NaN;

      const marker = L.circleMarker([lat, lng], {
        pane: 'centers',
        radius: acreRadius(maxAcres),
        fillColor: fill,
        color: stroke,
        weight: 1.5,
        fillOpacity: 0.9,
      }).addTo(map);

      const owners  = group.map(r => r['Owner'] || '—').join('<br>');
      const address = first['Address'] || '—';
      const town    = first['Town']    || '—';

      marker.bindTooltip(
        `<div class="dc-tooltip">
           <div class="owner">${owners}</div>
           <div class="town">${town}</div>
           <div class="address">${address}</div>
         </div>`,
        { sticky: true, opacity: 1, className: '' }
      );
    });
  }
});

// ---------------------------------------------------------------------------
// Legend
// ---------------------------------------------------------------------------
const legend = L.control({ position: 'bottomright' });
legend.onAdd = () => {
  const div = L.DomUtil.create('div', '');
  div.id = 'legend';

  const STATUS_LEGEND = [
    { label: 'Operational',        fill: '#404040', stroke: '#404040' },
    { label: 'Under Construction', fill: '#fdb863', stroke: '#e66101' },
    { label: 'Planned/Permitting', fill: '#b2abd2', stroke: '#5e3c99' },
    { label: 'Paused/Canceled',    fill: 'pink',    stroke: 'crimson'  },
  ];

  const SIZES = [
    { r: 14, label: '≥ 100 acres' },
    { r: 9,  label: '10–100 acres' },
    { r: 6,  label: '1–10 acres' },
    { r: 4,  label: '< 1 acre' },
  ];

  div.innerHTML = `
    <h4>Status</h4>
    ${STATUS_LEGEND.map(({ label, fill, stroke }) => `
      <div class="legend-row">
        <span class="legend-dot" style="background:${fill};border-color:${stroke}"></span>
        ${label}
      </div>`).join('')}
    <hr class="legend-sep">
    <h4>Size</h4>
    ${SIZES.map(({ r, label }) => `
      <div class="legend-row" style="align-items:center;min-height:${r * 2 + 4}px">
        <span style="display:flex;align-items:center;justify-content:center;width:28px;flex-shrink:0">
          <span style="display:inline-block;width:${r * 2}px;height:${r * 2}px;border-radius:50%;background:#999;border:1.5px solid #555"></span>
        </span>
        ${label}
      </div>`).join('')}
    <hr class="legend-sep">
    <h4>Transmission (kV)</h4>
    ${Object.entries(VOLT_COLORS).map(([label, color]) => `
      <div class="legend-row">
        <span class="legend-line" style="background:${color}"></span>
        ${label}
      </div>`).join('')}
    <hr class="legend-sep">
    <h4>Layers</h4>
    <div class="legend-row">
      <input type="checkbox" id="toggle-water" checked>
      <label for="toggle-water">Water bodies</label>
    </div>
  `;
  return div;
};
legend.addTo(map);

document.getElementById('toggle-water').addEventListener('change', e => {
  if (waterbodiesLayer) {
    e.target.checked ? waterbodiesLayer.addTo(map) : map.removeLayer(waterbodiesLayer);
  }
});
