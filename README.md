# LeadGen — Zero-Cost Lead Generation Automation System

## What This Project Does

LeadGen is an end-to-end, zero-cost lead generation pipeline that scrapes business listings from Google Maps, enriches each lead with a personalised AI-written WhatsApp message and email (powered by Gemini), stores all leads in a Supabase PostgreSQL database, and automatically reaches out via WhatsApp (whatsapp-web.js) and email (Resend). A Next.js 14 dashboard gives you a real-time view of every lead and its conversion status. The entire orchestration layer runs on self-hosted n8n deployed to Railway, keeping ongoing costs at zero.

---

## Folder Structure

```
leadgen/
├── scraper/              # Python 3.11 Playwright scraper — pulls business data from Google Maps and POSTs to the n8n webhook
├── whatsapp-service/     # Node 20 microservice — receives HTTP requests from n8n and sends WhatsApp messages via whatsapp-web.js
├── dashboard/            # Next.js 14 (App Router, TypeScript, Tailwind) — displays leads, statuses, and analytics
├── n8n-workflows/        # Exported n8n workflow JSON files + setup instructions
├── supabase/             # All database migrations (schema.sql) for Supabase / PostgreSQL
├── .gitignore
└── README.md             # ← You are here
```

### Component Details

| Folder | Language / Runtime | Purpose |
|---|---|---|
| `scraper/` | Python 3.11, Playwright | Scrapes Google Maps and sends leads to n8n |
| `whatsapp-service/` | Node.js 20, whatsapp-web.js | WhatsApp sender microservice |
| `dashboard/` | Next.js 14, TypeScript, Tailwind | Lead management UI |
| `n8n-workflows/` | JSON | n8n automation workflows |
| `supabase/` | SQL | Database schema & migrations |

---

## Prerequisites

Before you start, make sure you have the following installed and/or available:

| Requirement | Version / Notes |
|---|---|
| **Python** | 3.11 or higher |
| **Node.js** | 20 LTS |
| **Supabase project** | Free tier works — grab your URL and anon key from the Supabase dashboard |
| **Gemini API key** | [Google AI Studio](https://aistudio.google.com/) — free tier available |
| **Resend account** | [resend.com](https://resend.com) — free tier sends up to 3,000 emails/month |
| **Railway account** | [railway.app](https://railway.app) — used to host n8n; free starter plan available |

---

## Start Here → STEP 2

Once you have verified the folder structure (STEP 1 ✅), proceed to **STEP 2**: configuring and running the **Python Google Maps scraper** located in `scraper/`.

Refer to `scraper/README.md` (created in STEP 2) for detailed setup instructions.
