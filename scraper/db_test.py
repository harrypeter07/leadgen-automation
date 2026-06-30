# -*- coding: utf-8 -*-
"""
scraper/db_test.py
------------------
Tests the Supabase REST API connection using only the `requests` library.

Usage:
    1. Copy scraper/.env.example -> scraper/.env
    2. Fill in SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
    3. Run:  python db_test.py
"""

import os
import sys
import requests
from dotenv import load_dotenv

# Load .env from the same directory as this script
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

SUPABASE_URL             = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")


def main():
    # ── Validate config ────────────────────────────────────────────────────
    if not SUPABASE_URL:
        print("[ERROR] SUPABASE_URL is not set in .env")
        sys.exit(1)
    if not SUPABASE_SERVICE_ROLE_KEY:
        print("[ERROR] SUPABASE_SERVICE_ROLE_KEY is not set in .env")
        sys.exit(1)

    endpoint = f"{SUPABASE_URL}/rest/v1/leads"

    headers = {
        "apikey":        SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type":  "application/json",
    }

    params = {
        "select": "id",
        "limit":  "1",
    }

    # ── HEAD request to get total count via Content-Range ──────────────────
    # Supabase returns Content-Range: 0-0/N when Prefer: count=exact is set
    count_headers = {
        **headers,
        "Prefer": "count=exact",
    }
    count_params = {"select": "id"}

    try:
        resp = requests.get(
            endpoint,
            headers=count_headers,
            params=count_params,
            timeout=10,
        )
        resp.raise_for_status()

        # Content-Range header looks like: "0-0/42" or "*/0" when empty
        content_range = resp.headers.get("Content-Range", "")
        if "/" in content_range:
            total = content_range.split("/")[1]
        else:
            total = str(len(resp.json()))

        print(f"[OK] Supabase connected. Leads count so far: {total}")

    except requests.exceptions.HTTPError as e:
        print(f"[ERROR] HTTP {e.response.status_code}: {e.response.text}")
        sys.exit(1)
    except requests.exceptions.ConnectionError:
        print(f"[ERROR] Could not connect to {SUPABASE_URL}")
        print("        Check that SUPABASE_URL is correct and you have internet access.")
        sys.exit(1)
    except requests.exceptions.Timeout:
        print("[ERROR] Request timed out. Supabase may be unavailable.")
        sys.exit(1)
    except Exception as exc:
        print(f"[ERROR] Unexpected error: {exc}")
        sys.exit(1)


if __name__ == "__main__":
    main()
