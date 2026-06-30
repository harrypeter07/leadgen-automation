# Scraper Usage Guide

The LeadGen scraper pulls business listings from Google Maps and optionally sends them to your n8n webhook for intake into Supabase.

---

## Prerequisites

1. Python 3.11+
2. Dependencies installed:

```bash
cd scraper
pip install -r requirements.txt
playwright install chromium
```

3. Configure `.env` (copy from `.env.example`):

```bash
WEBHOOK_URL=https://your-n8n-service.up.railway.app/webhook/leads
```

---

## Basic usage

### Search and save to CSV only

```bash
python main.py --keyword "restaurant" --city "Nagpur" --max 100 --output nagpur_restaurants.csv
```

This scrapes up to 100 restaurants in Nagpur and saves them to `nagpur_restaurants.csv`. Nothing is sent to n8n.

### Search and send directly to n8n

```bash
python main.py --keyword "dentist" --city "Pune" --max 30 --send
```

Each lead is POSTed to your n8n webhook as it is scraped. Leads appear in Supabase with `status='new'`.

### Custom output file

```bash
python main.py --keyword "gym" --city "Mumbai" --max 50 --output mumbai_gyms.csv --send
```

Saves a CSV backup **and** sends to n8n.

---

## CLI arguments

| Argument | Required | Default | Description |
|---|---|---|---|
| `--keyword` | Yes | — | Search term, e.g. `"dentist"`, `"restaurant"`, `"gym"` |
| `--city` | Yes | — | City to search in, e.g. `"Pune"`, `"Nagpur"` |
| `--max` | No | `50` | Maximum number of leads to collect |
| `--output` | No | `leads.csv` | CSV file path for backup |
| `--send` | No | off | POST each lead to `WEBHOOK_URL` in `.env` |

---

## Send a CSV file manually

If you scraped leads to CSV without `--send`, use `send_csv.py` to POST them later:

```bash
python send_csv.py --file nagpur_restaurants.csv --delay 0.5
```

Output:

```
[1/100] Sent: Business Name
[2/100] Sent: Another Business
...
[DONE] Sent 98/100 leads (2 failed)
```

### send_csv.py arguments

| Argument | Required | Default | Description |
|---|---|---|---|
| `--file` | Yes | — | Path to CSV file |
| `--delay` | No | `0.5` | Seconds between webhook POSTs |

---

## Typical workflow

```bash
# 1. Scrape and send 3 test leads
python main.py --keyword "gym" --city "Nagpur" --max 3 --send

# 2. Wait for n8n AI personalisation (or trigger manually in n8n)
# 3. Trigger outreach workflow in n8n
# 4. Check dashboard at http://localhost:3000 (or your Vercel URL)
```

---

## CSV columns

The CSV matches the Supabase `leads` table:

`name`, `phone`, `email`, `address`, `city`, `category`, `website`, `rating`, `review_count`, `source`

---

## Troubleshooting

| Problem | Fix |
|---|---|
| CAPTCHA / "unusual traffic" | Wait and retry; reduce `--max`; use a different IP |
| `--send` but nothing in Supabase | Check `WEBHOOK_URL` in `.env`; confirm n8n lead-intake workflow is **Active** |
| Empty phone/email fields | Normal for many Google Maps listings — outreach skips empty emails |
| Playwright not found | Run `playwright install chromium` |
