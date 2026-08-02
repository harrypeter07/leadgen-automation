# 10. API Routes, Services, Utilities & Third-Party Integrations

This document documents every backend service, utility function, API route, server handler, animation primitive, and third-party integration across the codebase.

---

## 1. Backend Service Layer Catalog (`backend/services/`)

### 1. AI Service (`backend/services/aiService.js`)
- **Purpose**: Generates personalized outreach copy (WhatsApp messages, Email subject lines, Email HTML bodies) using Google Gemini API (`@google/generative-ai`).
- **Input Parameters**: `leadName`, `category`, `city`, `rating`, `reviewCount`, `notes`.
- **Output**: JSON object `{ whatsappMessage, emailSubject, emailBody }`.
- **Fallback**: If Gemini API quota limit is reached or fails, returns pre-templated outreach text.

### 2. Outreach Service (`backend/services/outreachService.js`)
- **Purpose**: Orchestrates automated message dispatch across WhatsApp and Email channels.
- **Methods**:
  - `sendWhatsAppOutreach(leadId)`: Retrieves lead record, verifies `ai_message_whatsapp`, invokes `POST /send` on `whatsapp-service`, updates lead status to `'whatsapp_sent'` and sets timestamp `whatsapp_sent_at`.
  - `sendEmailOutreach(leadId)`: Reads SMTP config from `meta_config`, instantiates Nodemailer transport, dispatches email, updates status to `'email_sent'`.

### 3. Intelligence Service (`backend/services/intelligenceService.js`)
- **Purpose**: Consolidates lead enrichment intelligence collected from website audits, Instagram profile scrapes, and Google search.
- **Output**: Calculates composite `confidence_score` (0-100) and constructs `enrichment_fields` JSON payload for the lead.

### 4. ChatGPT Browser Service (`backend/services/chatgptBrowserService.js`)
- **Purpose**: Uses Playwright to automate ChatGPT browser interface for deep lead research when direct API keys are unconfigured.

### 5. WhatsApp Scan Service (`backend/services/whatsappScanService.js`)
- **Purpose**: Interrogates `whatsapp-service` endpoint `POST /on-whatsapp` to pre-validate whether scraped phone numbers possess active WhatsApp accounts prior to message dispatch.

---

## 2. Utilities Catalog

### 1. Country Corrector Utility (`backend/modules/countryCorrector.js`)
- **Purpose**: Standardizes scraped phone numbers to international E.164 format based on city context (e.g. converting Indian 10-digit numbers to `+91...`).

### 2. Error Handling & Boom Middleware (`backend/modules/errors.js`)
- **Purpose**: Wraps Express errors using `@hapi/boom` to return standardized JSON error responses `{ statusCode, error, message }`.

### 3. Tracing Middleware (`backend/modules/middleware.js`)
- **Purpose**: Attaches unique `x-trace-id` UUID to every incoming HTTP request header and logs request duration.

---

## 3. Styling, Animations & UI Effects

- **Tailwind Utility Merging**: Components use `clsx` + `tailwind-merge` (`cn(...)`) for conditional styling.
- **CSS Transitions**: Micro-interactions rely on CSS transitions (`transition-all duration-200 ease-in-out`).
- **Loading Spinners**: Rendered via animated Lucide React icons (`<Loader2 className="animate-spin" />`).
- **Status Indicators**: Pulsing green/yellow/red status indicators on `/whatsapp` and `/dashboard` using Tailwind absolute positioning and `animate-ping`.

---

## 4. File & Media Storage Architecture

- **Static Media Assets**: Public dashboard logo (`stratnentlogo.jpeg`), app icon (`icon.jpg`) served directly from `dashboard/public/`.
- **Generated QR Codes**:
  - `whatsapp-service/index.js` writes raw QR string to `/app/qr.txt`.
  - Served as raw text via `GET /qr` or HTML image data URL via `GET /qr-image`.
- **Scraper Output Backups**: Local Python CLI scraper writes backup CSV files (`nagpur_cafes.csv`, `stockholm_consultants.csv`, `leads.csv`) directly to disk in `scraper/`.

---

## 5. Third-Party Integrations Directory

1. **Meta Graph API**: Facebook Pages, Instagram Business, Webhooks (`dashboard/src/lib/meta/`).
2. **WhatsApp Web (Baileys WS)**: WhatsApp multi-device client microservice (`whatsapp-service/`).
3. **Google Gemini AI**: Automated personalized sales copy generation (`@google/generative-ai`).
4. **n8n Automation Engine**: Self-hosted workflow orchestrator (`n8n-workflows/`).
5. **TinyFish Scraping API**: Specialized web scraping API fallback for deep site audits.
6. **Supabase PostgreSQL**: Database, Auth, Storage, and Realtime service provider.
7. **Railway Application Cloud**: Host environment for Playwright Scraper Backend (`12c6`), WhatsApp microservice, and n8n engine.
8. **Vercel Cloud Platform**: Host environment for Next.js 14 frontend Dashboard.
