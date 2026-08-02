# 09. Dashboards & System Settings Architecture

This document documents every settings panel, configuration field, analytics metric, and refresh loop across the Next.js Dashboard.

---

## 1. Analytics & Metrics Dashboard (`/dashboard`, `/metrics`)

### 1. Key Performance Indicators (KPI Cards)
The main analytics dashboard (`dashboard/src/app/dashboard/page.tsx`) renders live metrics fetched from `GET /api/stats`:

| Metric Card | Calculation / Data Source | Query Logic |
| :--- | :--- | :--- |
| **Total Scraped Leads** | Count of all records in `leads` table | `SELECT count(*) FROM leads;` |
| **Outreach Sent (WhatsApp)** | Count of leads with status `'whatsapp_sent'` | `SELECT count(*) FROM leads WHERE status = 'whatsapp_sent';` |
| **Outreach Sent (Email)** | Count of leads with status `'email_sent'` | `SELECT count(*) FROM leads WHERE status = 'email_sent';` |
| **Response / Converted Rate** | Percentage of contacted leads with status `'replied'` or `'converted'` | `(replied + converted) / (whatsapp_sent + email_sent) * 100` |
| **Active Scraping Jobs** | Count of jobs in `scrape_jobs` with status `'running'` | `SELECT count(*) FROM scrape_jobs WHERE status = 'running';` |
| **WhatsApp Client Health** | Status payload from `whatsapp-service` | `GET /api/whatsapp/status` (`state === 'connected'`) |

### 2. Metrics Refresh Loop
- **Client Polling**: Component initiates an auto-refresh timer every 5000ms to poll `/api/stats` and `/api/whatsapp/status`.
- **State Management**: Updates React state `stats` object without forcing full page re-renders.

---

## 2. System Settings & Configuration Panel (`/settings`)

The settings interface (`dashboard/src/app/settings/page.tsx`) provides administration controls for modifying database-backed configuration key-value pairs stored in Supabase table `meta_config`.

```
[ Admin User on /settings ] ──► Form Inputs ──► POST /api/meta/settings ──► Upsert into `meta_config`
                                                                                │
                                                                                ▼
                                                                 Calls `invalidateMetaConfig()`
                                                                                │
                                                                                ▼
                                                                 Next request calls `ensureMetaConfig()`
```

---

## 3. Comprehensive Settings Field Catalog

### 1. Meta & Instagram API Credentials

| Field Name / Key | Sensitive | Storage Encryption | Purpose / Description |
| :--- | :--- | :--- | :--- |
| `META_APP_ID` | No | Plaintext | Meta Developer Application ID |
| `META_APP_SECRET` | **Yes** | AES-256-CBC | Meta Application Secret Key |
| `META_PAGE_ID` | No | Plaintext | Primary Facebook Page ID |
| `META_PAGE_ACCESS_TOKEN` | **Yes** | AES-256-CBC | Facebook Page Access Token |
| `INSTAGRAM_BUSINESS_ACCOUNT_ID` | No | Plaintext | Linked Instagram Business Account ID |
| `INSTAGRAM_ACCESS_TOKEN` | **Yes** | AES-256-CBC | Instagram Access Token |
| `META_VERIFY_TOKEN` | **Yes** | AES-256-CBC | Webhook verification secret token |
| `META_WEBHOOK_SECRET` | **Yes** | AES-256-CBC | HMAC SHA-256 webhook payload signing secret |

### 2. Service Endpoints & Microservice Routing

| Field Name / Key | Purpose / Description | Default Fallback Value |
| :--- | :--- | :--- |
| `V3_BACKEND_URL` | Primary Railway Playwright Scraper Backend | `https://leadgen-automation-production-12c6.up.railway.app` |
| `V3_BACKEND_URL_SECONDARY` | Secondary Railway Scraper Backend | `https://scraper-auto.up.railway.app` |
| `WHATSAPP_SERVICE_URL` | Railway WhatsApp Baileys Microservice | `https://leadgen-automation-production.up.railway.app` |
| `WHATSAPP_API_SECRET` | Microservice Bearer Secret Header | `27pwgfjvq491aircy8lh6nz3eb5mkus0` |
| `N8N_WEBHOOK_BASE_URL` | Base URL for n8n automation engine | `https://n8n-production-4cbd.up.railway.app` |

### 3. SMTP Email Outreach Settings

| Field Name / Key | Sensitive | Purpose / Description |
| :--- | :--- | :--- |
| `SMTP_HOST` | No | SMTP Mail Host (e.g. `smtp.gmail.com`) |
| `SMTP_PORT` | No | SMTP Port (`587` or `465`) |
| `SMTP_USER` | No | SMTP Username / Sender email address |
| `SMTP_PASS` | **Yes** | SMTP Password / App-specific password |
| `SMTP_FROM_NAME` | No | Display Name for outbound outreach emails |

---

## 4. Setting Update & Credential Hydration Mechanics

1. Admin submits form on `/settings`.
2. Handler sends payload to `POST /api/meta/settings`.
3. Handler iterates keys:
   - Checks if key is present in `ENCRYPTED_KEYS` set (`META_APP_SECRET`, `INSTAGRAM_ACCESS_TOKEN`, `SMTP_PASS`, etc.).
   - If encrypted, prefixes string with `enc:` and encrypts payload using AES-256-CBC with key derived from `SUPABASE_SERVICE_ROLE_KEY`.
   - Executes Supabase upsert:
     ```sql
     INSERT INTO meta_config (key, value, encrypted, updated_at)
     VALUES (:key, :value, :encrypted, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
     ```
4. Invokes `invalidateMetaConfig()` in `runtime-config.ts`.
5. Future API calls detect `hydrated === false` and reload fresh configuration values into `process.env`.
