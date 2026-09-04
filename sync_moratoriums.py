#!/usr/bin/env python3
"""
Fetch county moratorium status from Google Sheets and write it to
data/moratoriums.csv.

Run by the GitHub Actions workflow. Can also be run locally.
"""

import csv
import io
import sys
import urllib.request
from datetime import datetime, timezone

SHEET_URL = (
    "https://docs.google.com/spreadsheets/d/"
    "1vixC64yfaMviMknDl6Rg5BiistKyOqyghjMkzCKu20Q"
    "/export?format=csv&gid=0"
)
CSV_PATH = "data/moratoriums.csv"
LAST_UPDATED_PATH = "data/last_updated.txt"


def fetch_sheet() -> list[dict]:
    """Download the Google Sheet as CSV and return a list of row dicts."""
    with urllib.request.urlopen(SHEET_URL) as resp:
        raw = resp.read().decode("utf-8")
    return list(csv.DictReader(io.StringIO(raw)))


def main():
    rows = fetch_sheet()
    print(f"Fetched {len(rows)} rows from Google Sheets.")

    if not rows:
        print("No rows fetched — aborting write.", file=sys.stderr)
        sys.exit(1)

    fieldnames = list(rows[0].keys())
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(rows)
    new_content = buf.getvalue()

    old_content = None
    try:
        with open(CSV_PATH, encoding="utf-8", newline="") as f:
            old_content = f.read()
    except FileNotFoundError:
        pass

    if new_content == old_content:
        print("No changes detected — leaving CSV and last_updated.txt untouched.")
        return

    with open(CSV_PATH, "w", newline="", encoding="utf-8") as f:
        f.write(new_content)
    print(f"Wrote {len(rows)} rows to {CSV_PATH}.")

    with open(LAST_UPDATED_PATH, "w", encoding="utf-8") as f:
        f.write(datetime.now(timezone.utc).strftime("%B %-d, %Y") + "\n")


if __name__ == "__main__":
    main()
