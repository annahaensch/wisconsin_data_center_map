// ---------------------------------------------------------------------------
// Map init — custom panes ensure correct z-order regardless of load timing
// ---------------------------------------------------------------------------
const map = L.map('map', { zoomControl: true }).setView([44.5, -89.5], 7);

map.createPane('waterbodies');  map.getPane('waterbodies').style.zIndex  = 250;
map.createPane('counties');    map.getPane('counties').style.zIndex    = 200;
map.createPane('moratoriums'); map.getPane('moratoriums').style.zIndex = 220;
map.createPane('powerlines');  map.getPane('powerlines').style.zIndex  = 300;
map.createPane('centers');     map.getPane('centers').style.zIndex     = 400;

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
// County boundaries + moratoriums
// ---------------------------------------------------------------------------
let moratoriumLayer = null;

Promise.all([
  fetch('data/County_Boundaries_24K/County_Boundaries_24K.geojson').then(r => r.json()),
  fetch('data/moratoriums.csv').then(r => r.text()),
]).then(([counties, moratoriumsCsv]) => {
  L.geoJSON(counties, {
    pane: 'counties',
    style: {
      color: '#8a9bb0',
      weight: 0.8,
      fillColor: '#f5f5f0',
      fillOpacity: 0.3,
    }
  }).addTo(map);

  // County-level moratorium status, keyed by county name.
  const enacted = new Map();
  Papa.parse(moratoriumsCsv, { header: true, skipEmptyLines: true }).data.forEach(row => {
    if ((row['Status'] || '').trim() === 'Enacted') {
      enacted.set((row['County'] || '').trim(), row);
    }
  });

  const moratoriumFeatures = counties.features.filter(f => enacted.has(f.properties.COUNTY_NAME));

  moratoriumLayer = L.geoJSON({ type: 'FeatureCollection', features: moratoriumFeatures }, {
    pane: 'moratoriums',
    style: {
      color: '#b30000',
      weight: 1.2,
      fillColor: '#e34a33',
      fillOpacity: 0.4,
    },
    onEachFeature: (feature, layer) => {
      const row   = enacted.get(feature.properties.COUNTY_NAME);
      const notes = (row['Notes'] || '').trim();
      const link  = (row['Link']  || '').trim();
      const linkHtml = link ? ` <a href="${link}" target="_blank" rel="noopener noreferrer">(link)</a>` : '';

      layer.bindPopup(`
        <div class="dc-tooltip">
          <div class="owner">${feature.properties.COUNTY_NAME} County</div>
          <div class="notes">${notes ? ` &mdash; ${notes}` : ''}${linkHtml}</div>
        </div>
      `);
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

      const entries = group.map(r => {
        const name    = r['Name']  || '';
        const owner   = r['Owner'] || '—';
        const heading = name ? `${owner} - ${name}` : owner;
        const address = r['Address'] || '';
        const town    = r['Town']    || '';
        const addressLine = [address, town ? `${town}, WI` : ''].filter(Boolean).join(', ');

        const notes = (r['Notes'] || '').trim();
        const link  = (r['Links'] || '').split(',').map(s => s.trim()).filter(Boolean)[0];
        const linkHtml = link ? ` <a href="${link}" target="_blank" rel="noopener noreferrer">(link)</a>` : '';

        return `
          <div class="dc-entry">
            <div class="owner">${heading}</div>
            ${addressLine ? `<div class="address">${addressLine}</div>` : ''}
            ${notes ? `<div class="notes">${notes}${linkHtml}</div>` : ''}
          </div>`;
      }).join('<hr class="dc-divider">');

      // Remove tooltip for now.
      // marker.bindTooltip(
      //  `<div class="dc-tooltip">${entries}</div>`,
      //  { sticky: true, opacity: 1, className: '', interactive: true }
      //);

      // Tooltips can't be clicked into (the cursor must leave the marker
      // to reach a link, which closes the tooltip), so also bind a popup
      // with the same content for clicking through to notes links.
      marker.bindPopup(`<div class="dc-tooltip">${entries}</div>`);
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
    <div id="legend-header">
      <h4>Legend</h4>
      <button id="legend-toggle" title="Toggle legend">−</button>
    </div>
    <div id="legend-body">
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
      <h4>County Moratoriums</h4>
      <div class="legend-row">
        <span class="legend-swatch" style="background:#e34a33;border-color:#b30000"></span>
        Enacted
      </div>
      <hr class="legend-sep">
      <h4>Layers</h4>
      <div class="legend-row">
        <input type="checkbox" id="toggle-water" checked>
        <label for="toggle-water">Water bodies</label>
      </div>
      <div class="legend-row">
        <input type="checkbox" id="toggle-moratorium" checked>
        <label for="toggle-moratorium">County moratoriums</label>
      </div>
    </div>
  `;
  return div;
};
legend.addTo(map);

// Collapse legend by default on mobile
if (window.innerWidth <= 600) {
  document.getElementById('legend').classList.add('collapsed');
  document.getElementById('legend-toggle').textContent = '+';
}

document.getElementById('legend-toggle').addEventListener('click', () => {
  const el  = document.getElementById('legend');
  const btn = document.getElementById('legend-toggle');
  el.classList.toggle('collapsed');
  btn.textContent = el.classList.contains('collapsed') ? '+' : '−';
});

document.getElementById('toggle-water').addEventListener('change', e => {
  if (waterbodiesLayer) {
    e.target.checked ? waterbodiesLayer.addTo(map) : map.removeLayer(waterbodiesLayer);
  }
});

document.getElementById('toggle-moratorium').addEventListener('change', e => {
  if (moratoriumLayer) {
    e.target.checked ? moratoriumLayer.addTo(map) : map.removeLayer(moratoriumLayer);
  }
});
