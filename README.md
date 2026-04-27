# Wisconsin Data Center Map

This is an interactive web map of data centers in Wisconsin based on information I've been collecting personally. If you see something wrong or missing, please email me anna.haensch@wisc.edu.

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

### Wisconsin Data Centers

Haensch, Anna. *Wisconsin Data Centers*. UW–Madison Data Science Institute. April 2026. [https://docs.google.com/spreadsheets/d/1j_A4BvCEKeB9IVvAbkyLEdOE3UKiVoPjt_s4WmaWaCo](https://docs.google.com/spreadsheets/d/1j_A4BvCEKeB9IVvAbkyLEdOE3UKiVoPjt_s4WmaWaCo)

### County Boundaries 24K

Wisconsin Department of Natural Resources, Bureau of Technology Services. *County Boundaries 24K*. Wisconsin DNR Open Data Portal. Retrieved April 2026. [https://data-wi-dnr.opendata.arcgis.com/datasets/8b8a0896378449538cf1138a969afbc6_3](https://data-wi-dnr.opendata.arcgis.com/datasets/8b8a0896378449538cf1138a969afbc6_3)

- **License:** [CC BY-SA](https://creativecommons.org/licenses/by-sa/4.0/)

### US Electric Power Transmission Lines

U.S. Fish and Wildlife Service. *US Electric Power Transmission Lines*. USFWS Open Data Portal. Last modified June 2025. Retrieved April 2026. [https://gis-fws.opendata.arcgis.com/datasets/fws::us-electric-power-transmission-lines](https://gis-fws.opendata.arcgis.com/datasets/fws::us-electric-power-transmission-lines)

- **License:** U.S. federal government public domain data
