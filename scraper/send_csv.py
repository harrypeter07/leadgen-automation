#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
POST leads from a CSV file to the n8n webhook.

Usage:
    python send_csv.py --file leads.csv --delay 0.5
"""

import argparse
import csv
import os
import sys
import time

import requests
from dotenv import load_dotenv

CSV_HEADERS = [
    "name", "phone", "email", "address", "city",
    "category", "website", "rating", "review_count", "source",
]


def parse_args():
    parser = argparse.ArgumentParser(
        description="Send leads from a CSV file to the n8n webhook."
    )
    parser.add_argument("--file", required=True, help="Path to CSV file")
    parser.add_argument(
        "--delay",
        type=float,
        default=0.5,
        help="Seconds between POST requests (default: 0.5)",
    )
    return parser.parse_args()


def post_lead(webhook_url: str, lead: dict) -> bool:
    try:
        resp = requests.post(webhook_url, json={"lead": lead}, timeout=10)
        return resp.status_code < 400
    except requests.RequestException:
        return False


def main():
    load_dotenv()
    args = parse_args()

    webhook_url = os.getenv("WEBHOOK_URL", "")
    if not webhook_url:
        print("[!] WEBHOOK_URL is not set in .env")
        sys.exit(1)

    if not os.path.isfile(args.file):
        print(f"[!] File not found: {args.file}")
        sys.exit(1)

    with open(args.file, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    if not rows:
        print("[!] CSV file is empty.")
        sys.exit(0)

    total = len(rows)
    sent = 0
    failed = 0

    for i, row in enumerate(rows, start=1):
        lead = {k: (row.get(k) or None) for k in CSV_HEADERS}
        if not lead.get("name"):
            print(f"[{i}/{total}] Skipped: missing name")
            failed += 1
            continue

        if not lead.get("source"):
            lead["source"] = "google_maps"

        ok = post_lead(webhook_url, lead)
        name = lead["name"]
        if ok:
            sent += 1
            print(f"[{i}/{total}] Sent: {name}")
        else:
            failed += 1
            print(f"[{i}/{total}] Failed: {name}")

        if i < total:
            time.sleep(args.delay)

    print(f"\n[DONE] Sent {sent}/{total} leads ({failed} failed)")


if __name__ == "__main__":
    main()
