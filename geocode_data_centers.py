#!/usr/bin/env python3
"""
Fetch data_centers CSV from Google Sheets, geocode any rows missing lat/lon
using "Address, Town, Wisconsin, USA" via Nominatim, and write the result to
data/data_centers.csv.

Geocodes are cached from the existing CSV so each address is only looked up
once. For addresses that can't be resolved, falls back to the town centroid.

Run by the GitHub Actions workflow. Can also be run locally.
"""

import csv
import io
import sys
import time
import urllib.request

from geopy.geocoders import Nominatim

SHEET_URL = (
    "https://docs.google.com/spreadsheets/d/"
    "1j_A4BvCEKeB9IVvAbkyLEdOE3UKiVoPjt_s4WmaWaCo"
    "/gviz/tq?tqx=out:csv&sheet=Sheet1"
)
CSV_PATH = "data/data_centers.csv"
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


def load_cache(path: str) -> dict:
    """Load existing geocoded lat/lon keyed by (address, town)."""
    cache = {}
    try:
        with open(path, newline="", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                addr = row.get("Address", "").strip()
                town = row.get("Town", "").strip()
                lat  = row.get("Latitude", "").strip()
                lon  = row.get("Longitude", "").strip()
                if lat and lon:
                    try:
                        float(lat), float(lon)
                        cache[(addr, town)] = (lat, lon)
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
        key  = (addr, town)

        if key in cache:
            row["Latitude"], row["Longitude"] = cache[key]
            continue

        # Need to geocode this address.
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
            cache[key] = (row["Latitude"], row["Longitude"])
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

    fieldnames = list(rows[0].keys())
    with open(CSV_PATH, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f"Wrote {len(rows)} rows to {CSV_PATH}.")


if __name__ == "__main__":
    main()
