# Wisconsin Data Center Map

An interactive web map of data centers in Wisconsin, served via GitHub Pages.

## Project Structure

```
├── index.html              # Main page
├── css/style.css           # Styles
├── js/map.js               # Leaflet map initialization and layer loading
└── data/                   # Spatial data layers
    ├── County_Boundaries_24K/          # WI county boundary shapefiles
    └── US_Electric_Power_Transmission_Lines/  # National transmission line data
```

## Data References

### County Boundaries 24K

Wisconsin Department of Natural Resources, Bureau of Technology Services. *County Boundaries 24K*. Wisconsin DNR Open Data Portal. Retrieved April 2026. [https://data-wi-dnr.opendata.arcgis.com/datasets/8b8a0896378449538cf1138a969afbc6_3](https://data-wi-dnr.opendata.arcgis.com/datasets/8b8a0896378449538cf1138a969afbc6_3)

- **License:** [CC BY-SA](https://creativecommons.org/licenses/by-sa/4.0/)
- **Coordinate system:** Wisconsin Transverse Mercator (WTM83/NAD83), EPSG:3071
- **Contact:** DNRCHERWELL@wisconsin.gov

### US Electric Power Transmission Lines

U.S. Fish and Wildlife Service. *US Electric Power Transmission Lines*. USFWS Open Data Portal. Last modified June 2025. Retrieved April 2026. [https://gis-fws.opendata.arcgis.com/datasets/fws::us-electric-power-transmission-lines](https://gis-fws.opendata.arcgis.com/datasets/fws::us-electric-power-transmission-lines)

- **License:** U.S. federal government public domain data
- **Contact:** fwsgis@fws.gov
