# -*- coding: utf-8 -*-
"""
LeadGen -- Google Maps Scraper
Step 2 of 8

Usage:
    python main.py --keyword "restaurant" --city "Mumbai" --max 10
    python main.py --keyword "dentist"    --city "Nagpur"  --max 50 --send
"""

import argparse
import csv
import os
import re
import sys
import time
from urllib.parse import quote_plus

import requests
from dotenv import load_dotenv
from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
SCROLL_PAUSE   = 1.5   # seconds between sidebar scrolls
RESULT_PAUSE   = 0.8   # seconds between result clicks (rate limiting)
POST_PAUSE     = 0.5   # seconds between webhook POSTs
MAX_STALE      = 2     # consecutive no-new-results scrolls before stopping

# CSV columns match Supabase schema
CSV_HEADERS = [
    "name", "phone", "email", "address", "city",
    "category", "website", "rating", "review_count", "source", "notes",
]

# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_args():
    parser = argparse.ArgumentParser(
        description="Scrape Google Maps business leads and optionally POST to n8n webhook."
    )
    parser.add_argument("--keyword", required=True,
                        help='Search keyword, e.g. "restaurant" or "dentist"')
    parser.add_argument("--city",    required=True,
                        help='City to search in, e.g. "Mumbai"')
    parser.add_argument("--max",     type=int, default=50,
                        help="Maximum number of leads to collect (default: 50)")
    parser.add_argument("--output",  default="leads.csv",
                        help="CSV file path for backup output (default: leads.csv)")
    parser.add_argument("--send",    action="store_true",
                        help="If set, POST each lead as JSON to the WEBHOOK_URL in .env")
    return parser.parse_args()


# ---------------------------------------------------------------------------
# Data cleaning helpers
# ---------------------------------------------------------------------------

def clean_str(value):
    """Strip whitespace; return None for empty strings."""
    if value is None:
        return None
    v = str(value).strip()
    return v if v else None


def clean_phone(value):
    """Keep only digits and leading +."""
    if not value:
        return None
    # Remove "Phone: " prefix from aria-label
    value = re.sub(r"^Phone:\s*", "", value, flags=re.IGNORECASE)
    cleaned = re.sub(r"[^\d+]", "", value)
    return cleaned if cleaned else None


def clean_website(value):
    """Accept only well-formed http(s) URLs."""
    if not value:
        return None
    v = value.strip()
    return v if v.startswith("http") else None


def clean_rating(value):
    """Parse float; must be in [1.0, 5.0]."""
    if value is None:
        return None
    try:
        f = float(value)
        return f if 1.0 <= f <= 5.0 else None
    except (ValueError, TypeError):
        return None


def clean_review_count(value):
    """Parse positive integer from strings like '1,234 reviews'."""
    if value is None:
        return None
    digits = re.sub(r"[^\d]", "", str(value))
    try:
        n = int(digits)
        return n if n > 0 else None
    except ValueError:
        return None


# ---------------------------------------------------------------------------
# Scraping helpers
# ---------------------------------------------------------------------------

def extract_field(fn):
    """Call fn(); return None instead of raising."""
    try:
        return fn()
    except Exception:
        return None


def parse_rating_from_aria(label: str):
    """
    Google Maps aria-label: '4.5 stars' or '4.5 stars 1,234 reviews'
    Returns (rating_float_or_None, review_count_int_or_None)
    """
    if not label:
        return None, None
    rating = None
    reviews = None
    m = re.search(r"([\d.]+)\s+star", label, re.IGNORECASE)
    if m:
        rating = clean_rating(m.group(1))
    m2 = re.search(r"([\d,]+)\s+review", label, re.IGNORECASE)
    if m2:
        reviews = clean_review_count(m2.group(1))
    return rating, reviews


def scrape_lead(page, city: str) -> dict | None:
    """
    Extract all fields from the currently-open place detail panel.
    Uses the page title as a name fallback since class names change often.
    Returns a dict or None if name could not be found.
    """
    lead = {k: None for k in CSV_HEADERS}
    lead["city"]   = city
    lead["source"] = "google_maps"
    lead["email"]  = None  # Google Maps doesn't expose email publicly

    # --- name: try multiple selectors in priority order ---
    # Modern Maps uses different obfuscated class names, so we try many
    name = None
    for sel in [
        "h1.DUwDvf",
        ".DUwDvf",
        ".fontHeadlineLarge",
        ".lMbq3e h1",
        "h1",
    ]:
        name = extract_field(
            lambda s=sel: page.locator(s).first.inner_text(timeout=2000)
        )
        if name and name.strip() and name.strip().lower() not in ("results", "google maps"):
            break
        name = None

    # Last resort: strip " - Google Maps" from page title
    if not name:
        title = page.title()
        if " - Google Maps" in title:
            name = title.replace(" - Google Maps", "").strip()

    lead["name"] = clean_str(name)
    if not lead["name"]:
        return None

    # --- address ---
    # Try multiple selector forms; Google Maps uses aria-label on the button
    addr = None
    for sel in [
        '[data-item-id="address"]',
        'button[data-item-id="address"]',
        '[aria-label*="Address:"]',
        'button[aria-label*="ddress"]',
    ]:
        addr = extract_field(
            lambda s=sel: page.locator(s).first.get_attribute("aria-label", timeout=3000)
        )
        if addr:
            # Strip "Address: " prefix
            addr = re.sub(r"^Address:\s*", "", addr, flags=re.IGNORECASE).strip()
            break
        addr = None
    lead["address"] = clean_str(addr)

    # --- phone ---
    phone = None
    for sel in [
        '[data-item-id^="phone"]',
        'button[data-item-id^="phone"]',
        '[aria-label*="Phone:"]',
        'button[aria-label*="hone"]',
    ]:
        phone = extract_field(
            lambda s=sel: page.locator(s).first.get_attribute("aria-label", timeout=3000)
        )
        if phone:
            break
        phone = None
    lead["phone"] = clean_phone(phone)

    # --- website ---
    website = None
    for sel in [
        'a[data-item-id="authority"]',
        '[data-item-id="authority"]',
        'a[aria-label*="website"]',
        'a[aria-label*="Website"]',
    ]:
        website = extract_field(
            lambda s=sel: page.locator(s).first.get_attribute("href", timeout=3000)
        )
        if website:
            break
        website = None
    lead["website"] = clean_website(website)

    # --- rating + review_count ---
    rating_label = None
    for sel in [
        'span[aria-label*="star"]',
        '[aria-label*="stars"]',
        'div[aria-label*="stars"]',
    ]:
        rating_label = extract_field(
            lambda s=sel: page.locator(s).first.get_attribute("aria-label", timeout=2000)
        )
        if rating_label:
            break
        rating_label = None

    if rating_label:
        lead["rating"], lead["review_count"] = parse_rating_from_aria(rating_label)
    else:
        # Fallback: look for review count separately
        review_text = extract_field(
            lambda: page.locator('[aria-label*="review"]').first.get_attribute("aria-label", timeout=2000)
        )
        if review_text:
            lead["review_count"] = clean_review_count(review_text)

    # --- category ---
    cat = None
    for sel in [
        "button.DkEaL",
        ".DkEaL",
        "button.fontBodyMedium",
        '[jsaction*="category"]',
    ]:
        cat = extract_field(
            lambda s=sel: page.locator(s).first.inner_text(timeout=2000)
        )
        if cat and cat.strip():
            break
        cat = None
    lead["category"] = clean_str(cat)

    # --- editorial description ---
    desc = None
    for sel in [
        "div.PYv55",
        "span.PYv55",
        "div.WErco",
        ".PYv55",
    ]:
        desc = extract_field(
            lambda s=sel: page.locator(s).first.inner_text(timeout=2000)
        )
        if desc and desc.strip():
            break
        desc = None
    lead["notes"] = clean_str(desc)

    return lead


# ---------------------------------------------------------------------------
# Scrolling
# ---------------------------------------------------------------------------

def scroll_sidebar(page, feed_locator) -> int:
    """Scroll the results feed 800px and return the new card count."""
    feed_locator.evaluate("el => el.scrollTop += 800")
    time.sleep(SCROLL_PAUSE)
    return page.locator('a[href*="/maps/place/"]').count()


# ---------------------------------------------------------------------------
# Webhook
# ---------------------------------------------------------------------------

def post_lead(webhook_url: str, lead: dict) -> bool:
    """POST a single lead dict to the n8n webhook. Returns True on success."""
    try:
        resp = requests.post(webhook_url, json={"lead": lead}, timeout=10)
        return resp.status_code < 400
    except requests.RequestException:
        return False


# ---------------------------------------------------------------------------
# CSV
# ---------------------------------------------------------------------------

def save_csv(leads: list[dict], output_path: str):
    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_HEADERS, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(leads)
    print(f"\n[CSV] Saved {len(leads)} lead(s) -> {output_path}")


# ---------------------------------------------------------------------------
# Main scrape
# ---------------------------------------------------------------------------

def run_scrape(args) -> list[dict]:
    load_dotenv()
    webhook_url = os.getenv("WEBHOOK_URL", "")

    query = f"{args.keyword} in {args.city}"
    encoded = quote_plus(query)
    maps_url = f"https://www.google.com/maps/search/{encoded}"

    leads: list[dict] = []

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
            locale="en-US",
            viewport={"width": 1280, "height": 900},
        )
        page = context.new_page()

        try:
            print(f"\n[>>] Navigating to: {maps_url}")
            page.goto(maps_url, timeout=30000)

            # CAPTCHA check
            title = page.title()
            if "unusual traffic" in title.lower():
                print("[!] Google detected unusual traffic (CAPTCHA). Exiting.")
                return leads

            # Wait for results feed
            try:
                page.wait_for_selector('div[role="feed"]', timeout=15000)
            except PWTimeout:
                print("[!] Results feed not found. Exiting.")
                return leads

            feed = page.locator('div[role="feed"]')

            # --- Scroll loop ---
            print(f"[>>] Scrolling to load up to {args.max} results...")
            stale_count = 0
            prev_count  = 0

            while True:
                current_count = page.locator('a[href*="/maps/place/"]').count()
                if current_count >= args.max:
                    break
                new_count = scroll_sidebar(page, feed)
                if new_count <= prev_count:
                    stale_count += 1
                    if stale_count >= MAX_STALE:
                        print(f"[>>] No new results after {MAX_STALE} scrolls. Stopping.")
                        break
                else:
                    stale_count = 0
                prev_count = new_count

            # Collect hrefs first to avoid stale element refs
            card_hrefs = page.eval_on_selector_all(
                'a[href*="/maps/place/"]',
                "els => els.map(e => e.href)"
            )
            total = min(len(card_hrefs), args.max)
            print(f"[>>] Found {len(card_hrefs)} result cards; collecting up to {total}...\n")

            for i, href in enumerate(card_hrefs[:total]):
                try:
                    # Navigate directly to the place URL — more reliable than clicking
                    page.goto(href, timeout=15000, wait_until="domcontentloaded")
                    # Wait for the address element OR the page title to change
                    try:
                        page.wait_for_selector(
                            '[data-item-id="address"], [data-item-id^="phone"], h1',
                            timeout=8000
                        )
                    except PWTimeout:
                        pass  # Try extraction anyway
                    time.sleep(0.5)  # Small extra settle time
                except Exception:
                    continue

                lead = scrape_lead(page, args.city)
                if lead is None:
                    continue

                leads.append(lead)
                print(
                    f"  [+] {lead['name']} | "
                    f"{lead['phone'] or 'no phone'} | "
                    f"{lead['city']}"
                )

                # --- Send to webhook ---
                if args.send and webhook_url:
                    ok = post_lead(webhook_url, lead)
                    print(f"      [SENT]   {lead['name']}" if ok else f"      [FAILED] {lead['name']}")
                    time.sleep(POST_PAUSE)
                elif args.send and not webhook_url:
                    print("  [!] --send flag set but WEBHOOK_URL is empty in .env")
                    args.send = False

                time.sleep(RESULT_PAUSE)

                # Navigate back to search results for next iteration
                page.goto(maps_url, timeout=20000, wait_until="domcontentloaded")
                try:
                    page.wait_for_selector('div[role="feed"]', timeout=10000)
                except PWTimeout:
                    pass

        except Exception as exc:
            print(f"\n[ERROR] Unexpected error: {exc}")
        finally:
            browser.close()

    return leads


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main():
    args = parse_args()
    leads = run_scrape(args)

    if not leads:
        print("\n[!] No leads collected.")
        sys.exit(0)

    save_csv(leads, args.output)

    # Preview first 3 rows
    print("\n--- First 3 leads preview ---")
    preview_fields = ["name", "phone", "address", "rating", "category"]
    for lead in leads[:3]:
        row = " | ".join(f"{k}: {lead.get(k) or '-'}" for k in preview_fields)
        print(f"  {row}")
    print(f"\n[DONE] Collected {len(leads)} lead(s) total.")


if __name__ == "__main__":
    main()
