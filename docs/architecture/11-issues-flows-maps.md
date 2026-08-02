# 11. Known Technical Issues, Feature Map, User Flows & Dependency Matrix

This document provides a comprehensive log of known issues/quirks, a hierarchical system feature tree, step-by-step end-to-end user flows, and an inter-module dependency matrix.

---

## 1. Known Technical Issues & System Quirks (Unmodified)

> [!WARNING]
> Per explicit instructions, these issues are documented **exactly as they exist** in the repository without performing any bug fixes, code changes, or optimizations.

### Issue 1: Instagram Report `followers_count` Returns `undefined`
- **Location**: `dashboard/src/app/instagram-analyzer/page.tsx`
- **Current Behavior**: The Instagram profile report UI renders `undefined` for follower count.
- **Root Cause / Expected Behavior**: The V3 Scraper Backend API response keys follower count as `report.followers` or `report.followers_count`, but the frontend UI reads a mismatched property key name.
- **Reproduction Steps**: Navigate to `/instagram-analyzer`, submit username `smritifyp`, wait 25 seconds for report to finish.

### Issue 2: `scraper-auto` Railway Backend Session Expiration
- **Location**: `https://scraper-auto.up.railway.app`
- **Current Behavior**: Scraper requests routed to `scraper-auto` periodically fail with error status `session_expired`.
- **Expected Behavior**: Browser session should auto-renew or failover seamlessly to primary `12c6` backend instance (`https://leadgen-automation-production-12c6.up.railway.app`).
- **Reproduction Steps**: Execute scraper job using `scraper-auto` as primary backend when session token has lapsed (> 24h idle).

### Issue 3: Missing Environment Variables in Vercel Production Environment
- **Location**: Vercel Environment Configuration (`dashboard/`)
- **Current Behavior**: `V3_BACKEND_URL` and `WHATSAPP_API_SECRET` are not set in the Vercel dashboard environment dashboard.
- **Fallback Impact**: System falls back to querying Supabase `meta_config` table. If database connection drops, system uses hardcoded fallback `12c6` URL.
- **Reproduction Steps**: Deploy dashboard to Vercel without setting env vars; observe runtime network logs falling back to database query.

### Issue 4: WhatsApp Socket Initial State `whatsapp_ready: false`
- **Location**: `whatsapp-service/index.js`
- **Current Behavior**: When `whatsapp-service` restarts on Railway, connection state defaults to `idle` with `whatsapp_ready: false`.
- **Expected Behavior**: WhatsApp client requires manual trigger via `/connect` or scanning QR code to authenticate and open WebSocket session.
- **Reproduction Steps**: Restart Railway `whatsapp-service` container; query `GET /health` immediately to observe `{ whatsapp_ready: false }`.

---

## 2. Hierarchical Feature Map

```
WHSoftec Lead Gen Automation Platform
│
├── 1. Lead Generation & Scraping Engine
│   ├── 1.1 Google Maps Headless Scraping (Playwright)
│   ├── 1.2 Python Maps CLI Scraper (`main.py`)
│   ├── 1.3 Local CSV Ingestion & Webhook Dispatch (`send_csv.py`)
│   └── 1.4 Scrape Job Queue Controller (`scrape_jobs` table)
│
├── 2. Lead Intelligence & Auditing
│   ├── 2.1 Instagram Profile Analyzer (`/instagram-analyzer`)
│   ├── 2.2 Website Technical & SEO Analyzer (`/website-analyzer`)
│   ├── 2.3 AI Copy Generation (Google Gemini SDK)
│   └── 2.4 Lead Scoring & Confidence Calculation
│
├── 3. Multi-Channel Outreach Automation
│   ├── 3.1 WhatsApp Web Automation (Baileys WS Service)
│   │   ├── QR Code Authentication & Streamer
│   │   ├── Phone Number WhatsApp Pre-Validation (`/on-whatsapp`)
│   │   └── Direct Message Dispatch (`/send`)
│   ├── 3.2 Automated SMTP Email Dispatcher
│   └── 3.3 n8n Multi-Step Orchestration Workflows
│
├── 4. Meta Social Media Integrations
│   ├── 4.1 Meta OAuth 2.0 Token Management & Long-Lived Renewal
│   ├── 4.2 Facebook Page Post Publishing
│   ├── 4.3 Instagram Business Media Container Publishing
│   ├── 4.4 Real-time Webhook Verification & Event Listener
│   └── 4.5 Multi-Account Connected Account Switching (`connected_accounts`)
│
└── 5. System Administration & Control Panel
    ├── 5.1 Cookie-based Auth Guard (`zarss_session`)
    ├── 5.2 Dynamic Backend API Proxy Engine (`/api/backend-v3`, `/api/scraper`, `/api/whatsapp`)
    ├── 5.3 KPI Analytics Dashboard (`/dashboard`)
    ├── 5.4 System Worker Metrics (`/metrics`)
    └── 5.5 Database-backed Configuration Administration (`/settings`)
```

---

## 3. Step-by-Step User Flows

### Flow 1: Lead Scraping & Ingestion Flow
1. User navigates to `/scraper` on Next.js Dashboard.
2. User enters Keyword (e.g. `"restaurant"`), City (e.g. `"Mumbai"`), and Max Leads (`50`).
3. User clicks "Start Scraper".
4. Dashboard sends `POST /api/scraper/scraper/start` with job payload.
5. Next.js API proxy routes request to V3 Backend (`12c6`).
6. V3 Backend creates record in `scrape_jobs` with status `'queued'` and returns `jobId`.
7. Backend `jobManager.js` picks up job, launches Playwright Chromium context via `browserManager.js`.
8. Playwright opens Google Maps, executes search, scrolls result sidebar, clicks each listing, and extracts name, phone, address, website, rating, reviews.
9. Extracted lead records are upserted into Supabase table `leads` (deduplicated by unique phone index `leads_phone_unique_idx`).
10. `scrape_jobs` progress counter updates and status transitions to `'completed'`.

### Flow 2: Instagram Profile Audit Flow
1. User navigates to `/instagram-analyzer`.
2. User enters Instagram username target (e.g. `"smritifyp"`) and clicks "Analyze Profile".
3. UI sends `POST /api/instagram-audit` and begins polling `GET /api/instagram-logs` every 1000ms.
4. Proxy handler forwards payload to V3 Backend `12c6/api/test/instagram`.
5. V3 Backend allocates Playwright browser page, navigates to target Instagram profile URL.
6. Playwright extracts biography, follower count, post count, profile picture, and external URL.
7. Result payload saved to Supabase table `instagram_audits`.
8. Report object returned to Dashboard UI; log polling interval terminates and report card renders.

### Flow 3: WhatsApp Web Connection & Outreach Flow
1. User navigates to `/whatsapp`.
2. UI polls `GET /api/whatsapp/status`. If state is `qr_waiting`, UI calls `GET /api/whatsapp/qr` and renders QR code.
3. User opens WhatsApp mobile app, scans displayed QR code.
4. Baileys socket in `whatsapp-service` receives connection state update `connection === 'open'`.
5. Service saves session credentials to disk (`/app/.wwebjs_auth`) and updates state to `connected`.
6. Admin selects lead on `/leads` and clicks "Send WhatsApp Message".
7. Request posts to `POST /api/whatsapp/send` with lead phone and AI-generated message.
8. `whatsapp-service` formats target JID (`phone@s.whatsapp.net`), verifies socket is stable, and calls `sock.sendMessage()`.
9. Upon successful delivery, lead record status in Supabase updates to `'whatsapp_sent'`.

---

## 4. Inter-Module Dependency Matrix

```
┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐
│   dashboard      ├─────►│     backend      ├─────►│  supabase (DB)   │
└────────┬─────────┘      └────────┬─────────┘      └──────────────────┘
         │                         │                         ▲
         │ Proxy /api/whatsapp     │ Call /send              │
         ▼                         ▼                         │ Log/Status Sync
┌──────────────────┐      ┌──────────────────┐               │
│ whatsapp-service ├─────►│ n8n-workflows    ├───────────────┘
└──────────────────┘      └──────────────────┘
```

| Source Module | Dependent Module | Communication Protocol / Interface | Dependency Purpose |
| :--- | :--- | :--- | :--- |
| `dashboard` | `backend` (V3 `12c6`) | HTTP REST Proxy (`/api/backend-v3/*`, `/api/scraper/*`) | Scraping job control, Instagram audits, Playwright workers |
| `dashboard` | `whatsapp-service` | HTTP REST Proxy (`/api/whatsapp/*`) | Status checks, QR code retrieval, message dispatches |
| `dashboard` | `supabase` | PostgreSQL / Supabase JS SDK (`@supabase/supabase-js`) | Lead management, metrics aggregation, settings CRUD |
| `backend` | `supabase` | PostgreSQL Connection (`backend/database/connection.js`) | Scrape job queue polling, lead upserts, log streaming |
| `backend` | `whatsapp-service` | HTTP POST (`/send`) | Outreach message execution |
| `scraper` (Python) | `n8n-workflows` | HTTP POST Webhooks (`N8N_WEBHOOK_BASE_URL`) | Raw scraped CSV lead ingestion and pipeline triggers |
| `agent-brain` | `supabase` | Supabase JS SDK | Agentic state tracking, lead enrichment scratchpad updates |
