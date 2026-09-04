#!/usr/bin/env python3
"""
Fetch data_centers CSV from Google Sheets, geocode any rows missing lat/lon
using "Address, Town, Wisconsin, USA" via Nominatim, and write the result to
data/data_centers.csv.

Rows with both Approx_Lat and Approx_Lon filled in use those coordinates
directly instead of geocoding (for sites known only by bounding roads).
Approx_Lat, Approx_Lon, and LinksOld are dropped from the output CSV since
they aren't used by the map.

Geocodes are cached from the existing CSV so each address is only looked up
once. For addresses that can't be resolved, falls back to the town centroid.

Run by the GitHub Actions workflow. Can also be run locally.
"""

import csv
import hashlib
import io
import sys
import time
import urllib.request
from datetime import datetime, timezone

from geopy.geocoders import Nominatim

# Fields excluded from the row fingerprint used for cache invalidation.
_SKIP = {"Latitude", "Longitude", "Approx_Lat", "Approx_Lon", "LinksOld"}

# Columns fetched from the sheet that aren't useful for the map and are
# dropped before writing the output CSV.
_DROP_COLUMNS = {"Approx_Lat", "Approx_Lon", "LinksOld"}

SHEET_URL = (
    "https://docs.google.com/spreadsheets/d/"
    "1j_A4BvCEKeB9IVvAbkyLEdOE3UKiVoPjt_s4WmaWaCo"
    "/gviz/tq?tqx=out:csv&sheet=Sheet1"
)
CSV_PATH = "data/data_centers.csv"
LAST_UPDATED_PATH = "data/last_updated.txt"
GEOCODER = Nominatim(user_agent="wi_data_center_map_geocoder/1.0")


def geocode(query: str):
    """Return (lat, lon) for query, or (None, None) if not found."""
    time.sleep(1.1)  # Nominatim rate limit: 1 req/s
    try:
        loc = GEOCODER.geocode(query, country_codes="us")
        if loc:
            return loc.latitude, loc.longitude
    except Exception as e:
        print(f"  Geocoding error for '{query}': {e}", file=sys.stderr)
    return None, None


def row_fingerprint(row: dict) -> str:
    """MD5 of all non-lat/lon fields. Cache is invalidated when any other
    field changes, triggering a fresh geocode for that row."""
    content = "|".join(
        f"{k}={row.get(k, '').strip()}"
        for k in sorted(row.keys())
        if k not in _SKIP
    )
    return hashlib.md5(content.encode()).hexdigest()


def load_cache(path: str) -> dict:
    """Load existing geocoded lat/lon keyed by row fingerprint."""
    cache = {}
    try:
        with open(path, newline="", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                lat = row.get("Latitude", "").strip()
                lon = row.get("Longitude", "").strip()
                if lat and lon:
                    try:
                        float(lat), float(lon)
                        cache[row_fingerprint(row)] = (lat, lon)
                    except ValueError:
                        pass
    except FileNotFoundError:
        pass
    return cache


def fetch_sheet() -> list[dict]:
    """Download the Google Sheet as CSV and return a list of row dicts."""
    with urllib.request.urlopen(SHEET_URL) as resp:
        raw = resp.read().decode("utf-8")
    return list(csv.DictReader(io.StringIO(raw)))


def main():
    cache = load_cache(CSV_PATH)
    print(f"Loaded {len(cache)} cached geocodes from existing CSV.")

    rows = fetch_sheet()
    print(f"Fetched {len(rows)} rows from Google Sheets.")

    new_geocodes = 0
    failed = 0

    for row in rows:
        addr = row.get("Address", "").strip()
        town = row.get("Town", "").strip()

        # Manual lat/lon override (for sites known only by bounding roads)
        # always takes precedence and is checked before the cache so edits
        # to it take effect even though it's excluded from the fingerprint.
        approx_lat = row.get("Approx_Lat", "").strip()
        approx_lon = row.get("Approx_Lon", "").strip()
        if approx_lat and approx_lon:
            try:
                lat, lon = float(approx_lat), float(approx_lon)
                row["Latitude"]  = str(round(lat, 4))
                row["Longitude"] = str(round(lon, 4))
                print(f"  Using manual override: {row['Latitude']}, {row['Longitude']}")
                continue
            except ValueError:
                print(f"  WARNING: Bad Approx_Lat/Approx_Lon for '{addr}, {town}'", file=sys.stderr)

        fp = row_fingerprint(row)
        if fp in cache:
            row["Latitude"], row["Longitude"] = cache[fp]
            continue

        # Row is new or changed — geocode it.
        lat = lon = None

        if addr and addr.lower() != "unknown":
            query = f"{addr}, {town}, Wisconsin, USA"
            print(f"  Geocoding: {query}")
            lat, lon = geocode(query)

        if lat is None and town:
            query = f"{town}, Wisconsin, USA"
            print(f"  Falling back to town centroid: {query}")
            lat, lon = geocode(query)

        if lat is not None:
            row["Latitude"]  = str(round(lat, 4))
            row["Longitude"] = str(round(lon, 4))
            cache[fp] = (row["Latitude"], row["Longitude"])
            new_geocodes += 1
        else:
            row["Latitude"]  = ""
            row["Longitude"] = ""
            print(f"  WARNING: Could not geocode '{addr}, {town}'", file=sys.stderr)
            failed += 1

    print(f"Geocoded {new_geocodes} new addresses; {failed} failed.")

    if not rows:
        print("No rows fetched — aborting write.", file=sys.stderr)
        sys.exit(1)

    fieldnames = [k for k in rows[0].keys() if k not in _DROP_COLUMNS]
    with open(CSV_PATH, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)

    print(f"Wrote {len(rows)} rows to {CSV_PATH}.")

    with open(LAST_UPDATED_PATH, "w", encoding="utf-8") as f:
        f.write(datetime.now(timezone.utc).strftime("%B %-d, %Y") + "\n")


if __name__ == "__main__":
    main()
