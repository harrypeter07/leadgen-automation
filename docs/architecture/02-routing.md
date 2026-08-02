# 02. Routing Architecture & Endpoint Directory

This document details every user-facing page route and backend API endpoint across the Next.js Dashboard and Express services.

---

## 1. Next.js Dashboard App Router Pages (`dashboard/src/app`)

### 1. Root / Home (`/`)
- **Route**: `/`
- **File**: `dashboard/src/app/page.tsx`
- **Purpose**: Root application landing route. Immediately redirects to `/dashboard`.
- **Component Type**: Server Component
- **Layout**: Default Root Layout (`layout.tsx`)
- **Redirect Logic**: `redirect('/dashboard')`
- **Permissions**: Public / Protected via Middleware (redirects to `/login` if unauthenticated).

### 2. Main Analytics Dashboard (`/dashboard`)
- **Route**: `/dashboard`
- **File**: `dashboard/src/app/dashboard/page.tsx`
- **Purpose**: Displays system KPI metric cards (Total Leads, Active Workflows, WhatsApp Status, Scraping Jobs), lead status charts, and recent activity streams.
- **Component Type**: Client Component (`'use client'`)
- **Layout**: Authenticated App Layout (`layout-client.tsx` containing sidebar & header)
- **APIs Called**:
  - `GET /api/stats` (fetches counts from `leads` table and scraper job statuses)
  - `GET /api/whatsapp/status` (fetches connection state from `whatsapp-service`)
- **Database Queries**: Supabase `leads` aggregate counts (`SELECT count(*) FROM leads WHERE status = ...`)
- **Loading Flow**: Renders skeleton card loaders while fetching initial metrics.

### 3. Lead Directory & Management (`/leads`)
- **Route**: `/leads`
- **File**: `dashboard/src/app/leads/page.tsx`
- **Purpose**: Grid/Table view of scraped leads with filtering (city, category, status), AI copy inspection, and manual outreach triggers.
- **Component Type**: Client Component
- **APIs Called**:
  - `GET /api/leads` (paginated lead retrieval with search/filter params)
  - `POST /api/whatsapp/send` (triggers individual WhatsApp outreach)
  - `POST /api/email/send` (triggers individual SMTP outreach)
- **State Dependencies**: React `useState` for search filter query, selected status pill, current page index.

### 4. Google Maps Scraper Controller (`/scraper`)
- **Route**: `/scraper`
- **File**: `dashboard/src/app/scraper/page.tsx`
- **Purpose**: Interactive control panel to trigger, pause, resume, stop, and monitor live Google Maps lead scraping jobs.
- **Component Type**: Client Component
- **APIs Called**:
  - `POST /api/scraper/scraper/start`
  - `POST /api/scraper/scraper/pause`
  - `POST /api/scraper/scraper/resume`
  - `POST /api/scraper/scraper/stop`
  - `GET /api/scraper/scraper/status`
- **Headers Sent**: Passes target backend URLs via custom headers: `x-backend-primary`, `x-backend-secondary`.

### 5. Instagram Analyzer (`/instagram-analyzer`)
- **Route**: `/instagram-analyzer`
- **File**: `dashboard/src/app/instagram-analyzer/page.tsx`
- **Purpose**: Audits public Instagram profiles using Playwright, extracting bio, follower count, engagement metrics, and health scores.
- **Component Type**: Client Component
- **APIs Called**:
  - `POST /api/instagram-audit` (Submits username target)
  - `GET /api/instagram-logs` (Polls every 1s for real-time backend log streaming during active scrape)
- **Execution Latency**: ~22-25 seconds per audit due to Playwright DOM loading.

### 6. Website Analyzer (`/website-analyzer`)
- **Route**: `/website-analyzer`
- **File**: `dashboard/src/app/website-analyzer/page.tsx`
- **Purpose**: Performs technical SEO, performance, UX, tech-stack, and email/phone extraction audits for business website URLs.
- **APIs Called**: `POST /api/backend-v3/api/enrich/website`

### 7. WhatsApp Connection Manager (`/whatsapp`)
- **Route**: `/whatsapp`
- **File**: `dashboard/src/app/whatsapp/page.tsx`
- **Purpose**: Displays real-time WhatsApp Web QR code for authentication, status badges, log viewer, and manual reconnect/disconnect actions.
- **APIs Called**:
  - `GET /api/whatsapp/status`
  - `GET /api/whatsapp/qr`
  - `POST /api/whatsapp/connect`
  - `POST /api/whatsapp/disconnect`
  - `POST /api/whatsapp/reconnect`

### 8. Workflows & Automations (`/workflows`, `/automation`)
- **Route**: `/workflows` and `/automation`
- **File**: `dashboard/src/app/workflows/page.tsx`, `dashboard/src/app/automation/page.tsx`
- **Purpose**: Interface for viewing n8n pipeline states, scheduling cron triggers, and configuring multi-step outreach rules.

### 9. Metrics & System Diagnostics (`/metrics`)
- **Route**: `/metrics`
- **File**: `dashboard/src/app/metrics/page.tsx`
- **Purpose**: Real-time worker pool utilization metrics, database latency metrics, and API error rates.

### 10. System Settings & Meta Credentials (`/settings`)
- **Route**: `/settings`
- **File**: `dashboard/src/app/settings/page.tsx`
- **Purpose**: Administration interface for modifying `meta_config` key-value pairs (Meta Tokens, API Keys, Backend URLs, SMTP Config).

### 11. Authentication Login (`/login`)
- **Route**: `/login`
- **File**: `dashboard/src/app/login/page.tsx`
- **Purpose**: Admin login page prompting for `DASHBOARD_PASSWORD`.
- **Component Type**: Client Component
- **APIs Called**: `POST /api/login`

---

## 2. API Endpoints Directory

### Dashboard API Routes (`dashboard/src/app/api`)

| Endpoint | Method | File Location | Purpose & Downstream Target |
| :--- | :--- | :--- | :--- |
| `/api/login` | `POST` | `app/api/login/route.ts` | Validates password, sets HTTP-only `zarss_session` cookie |
| `/api/logout` | `POST` | `app/api/logout/route.ts` | Deletes `zarss_session` cookie |
| `/api/stats` | `GET` | `app/api/stats/route.ts` | Aggregates DB counts for leads and scraping jobs |
| `/api/leads` | `GET`, `POST` | `app/api/leads/route.ts` | Queries/creates leads in Supabase |
| `/api/instagram-audit` | `POST` | `app/api/instagram-audit/route.ts` | Proxies to V3 Backend `12c6/api/test/instagram` |
| `/api/instagram-logs` | `GET` | `app/api/instagram-logs/route.ts` | Fetches live Playwright logs from V3 Backend |
| `/api/scraper/[...path]` | `ALL` | `app/api/scraper/[...path]/route.ts` | Dynamic proxy to V3 backend scraper endpoints |
| `/api/whatsapp/[...path]` | `ALL` | `app/api/whatsapp/[...path]/route.ts` | Proxies requests to Railway `whatsapp-service` |
| `/api/meta/[...path]` | `ALL` | `app/api/meta/[...path]/route.ts` | Handlers for Meta Graph API & OAuth webhooks |

### Express Backend Endpoints (`backend/api`)

| Endpoint | Method | Handled By | Description |
| :--- | :--- | :--- | :--- |
| `/api/jobs` | `GET`, `POST` | `backend/api/jobs.js` | Create, list, pause, resume, stop scrape jobs |
| `/api/enrich` | `POST` | `backend/api/enrich.js` | Trigger lead enrichment (Website/Instagram audit) |
| `/api/metrics` | `GET` | `backend/api/metrics.js` | Returns system memory, queue, and worker pool stats |
| `/api/health` | `GET` | `backend/api/health.js` | Comprehensive system health probe |
| `/api/test/instagram`| `POST` | `backend/api/testing.js` | Playwright Instagram profile scraper execution |
| `/api/outreach` | `POST` | `backend/api/outreach.js` | Direct email/WhatsApp outreach dispatch controller |

### WhatsApp Service Microservice Endpoints (`whatsapp-service/index.js`)

| Endpoint | Method | Purpose | Auth Required |
| :--- | :--- | :--- | :--- |
| `/health` | `GET` | Returns connection status `{ whatsapp_ready: boolean }` | No |
| `/status` | `GET` | Returns state machine diagnostics and timestamps | No |
| `/qr` | `GET` | Returns raw text content of generated QR code | No |
| `/qr-image` | `GET` | Returns HTML rendered QR code image | No |
| `/connect` | `POST` | Initiates fresh Baileys WebSocket instance | Yes (`x-api-secret`) |
| `/reconnect` | `POST` | Closes socket and re-executes startup sequence | Yes (`x-api-secret`) |
| `/disconnect` | `POST` | Purges `/app/.wwebjs_auth` session credentials | Yes (`x-api-secret`) |
| `/send` | `POST` | Sends WhatsApp text message to target phone JID | Yes (`x-api-secret`) |
