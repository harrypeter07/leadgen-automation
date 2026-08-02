# 01. Project Overview & System Architecture

This document provides a comprehensive technical overview of the **WHSoftec Lead Gen Automation** monorepo system.

---

## 1. Monorepo Folder Structure

The repository is structured as a multi-package monorepo containing frontend dashboards, scrapers, background services, database definitions, and automation engines.

```
leadgen/
├── backend/                        # Express.js Scraping & Job Orchestration Service (Node.js 22+)
│   ├── api/                        # Express route definitions (jobs, enrich, metrics, outreach, etc.)
│   ├── config/                     # Service configuration settings
│   ├── controllers/                # Outreach & pipeline business logic controllers
│   ├── database/                   # Supabase client instantiation & connection manager
│   ├── modules/                    # Middleware, caching, constants, error handling, context
│   ├── providers/                  # Third-party integrations (Facebook, Instagram, LinkedIn, TinyFish, etc.)
│   ├── repositories/               # Data access layer abstractions
│   ├── services/                   # AI, Browser automation, Intelligence, Outreach services
│   ├── worker/                     # Job queues, workers, session & browser pool management
│   ├── Dockerfile                  # Container build recipe
│   ├── index.js                    # Service entry point & HTTP listener
│   ├── package.json                # Dependencies for backend service
│   └── railway.toml                # Railway deployment configuration
├── dashboard/                      # Next.js 14 Web UI & Management Dashboard (TypeScript)
│   ├── public/                     # Static media assets & logos
│   ├── src/
│   │   ├── app/                    # Next.js App Router pages and API route handlers
│   │   ├── automation/             # Client/Server automation orchestration domain
│   │   ├── components/             # Reusable UI component library (Shadcn/Radix-inspired vanilla CSS/Tailwind)
│   │   ├── instrumentation.ts      # Next.js telemetry & server instrumentation hook
│   │   ├── lib/                    # Supabase, Meta Graph API, Gemini AI SDK wrappers
│   │   ├── middleware.ts           # Authentication session guard & whitelist proxy rule engine
│   │   ├── types/                  # TypeScript interfaces and domain type models
│   │   └── utils/                  # Helper utilities for formatting and validation
│   ├── next.config.mjs             # Next.js runtime configuration & asset domains
│   ├── package.json                # Dashboard dependencies
│   └── tailwind.config.ts          # Tailwind design tokens & UI utility rules
├── scraper/                        # Python CLI Google Maps Lead Extraction Tool
│   ├── main.py                     # Playwright-driven Google Maps scraping script
│   ├── send_csv.py                 # CSV lead ingestion & webhook dispatch script
│   ├── db_test.py                  # Database connection verification test script
│   ├── requirements.txt            # Python package dependencies (Playwright, requests, dotenv)
│   └── USAGE.md                    # CLI execution guide
├── whatsapp-service/               # Standalone WhatsApp Web Automation microservice (Baileys WS)
│   ├── index.js                    # Express + Baileys socket connection state machine
│   ├── nixpacks.toml               # Railway Nixpacks build environment recipe
│   ├── package.json                # Microservice dependencies
│   └── railway.toml                # Railway deployment configuration
├── supabase/                       # Supabase Database Schema & Migration Scripts
│   ├── schema.sql                  # Primary PostgreSQL schema (leads table, indexes, RLS policies)
│   └── migrations/                 # Sequential SQL migration scripts (jobs, audits, enrichment)
├── n8n-workflows/                  # Automated Workflow Pipeline JSON Definitions
│   ├── lead-intake.json            # Webhook intake & deduplication pipeline
│   ├── ai-personalise.json         # Gemini outreach customization pipeline
│   ├── outreach.json               # Email & WhatsApp execution pipeline
│   ├── master-orchestrator.json    # Workflow orchestrator definition
│   └── meta-social-integration/    # Meta Graph API event listeners & handlers
├── agent-brain/                    # Autonomous Gemini Agent Execution Microservice
│   ├── src/                        # Express server, agent router, Gemini tool calling engine
│   └── package.json                # Microservice dependencies
├── docs/                           # System Architecture & Technical Documentation
├── scripts/                        # Repository maintenance & utility scripts
├── .env                            # Monorepo top-level environment configuration
└── project_context.md              # Historical context, URL maps, known quirks
```

---

## 2. Technology Stack

### Frontend & Control Panel (`dashboard/`)
- **Framework**: Next.js 14.2 (App Router)
- **Language**: TypeScript 5.x
- **UI & Styling**: React 18, Tailwind CSS, Lucide Icons, Class Variance Authority (CVA), clsx, tailwind-merge
- **Data & Auth**: Supabase JS SDK v2, HTTP-only cookie auth (`zarss_session`)
- **Notifications**: `react-hot-toast`
- **QR Code Rendering**: `qrcode.react`

### Primary Backend Service (`backend/`)
- **Runtime**: Node.js (v22+)
- **HTTP Framework**: Express.js 4.19
- **Browser Automation**: Playwright 1.40 (Chromium headless engine)
- **Logging**: Pino 10.3
- **Error Handling**: `@hapi/boom`
- **Database Client**: `@supabase/supabase-js` v2.43
- **HTTP Requests**: Axios 1.18

### WhatsApp Microservice (`whatsapp-service/`)
- **Runtime**: Node.js (v22+)
- **HTTP Framework**: Express.js 4.19
- **WhatsApp Engine**: `@whiskeysockets/baileys` v7.0 (Multi-device WebSocket implementation)
- **QR Engine**: `qrcode`, `qrcode-terminal`
- **Logging**: Pino 10.3

### Scraping Engine (`scraper/`)
- **Language**: Python 3.11+
- **Browser Engine**: Playwright Sync API
- **HTTP Engine**: `requests`
- **Configuration**: `python-dotenv`

### Agent Microservice (`agent-brain/`)
- **Framework**: Express.js
- **AI Model**: Google Gemini API via `@google/generative-ai` SDK v0.21

### Database & Storage (`supabase/`)
- **Database Engine**: PostgreSQL 15+ (Hosted on Supabase)
- **Security**: Row-Level Security (RLS) policies for `service_role` and `anon`
- **Extensions**: `pgcrypto` (UUID generation, AES encryption)

### Automation & Workflows (`n8n-workflows/`)
- **Engine**: n8n Automation Engine (Self-hosted on Railway)

---

## 3. Package Inventory & List

1. `dashboard` (`Next.js 14`): User interface, API proxying, Meta SDK client handlers, settings administration.
2. `lead-intelligence-backend` (`Express.js`): Playwright scraping worker management, lead enrichment pipeline, AI generation, background execution queue.
3. `whatsapp-service` (`Express.js + Baileys`): Web-session socket maintainer, QR code generation, message dispatch, connection state machine.
4. `agent-brain` (`Express.js + Gemini SDK`): Autonomous agentic workflow engine executing tool-assisted lead enrichment.
5. `scraper` (`Python`): Headless Google Maps lead scraper outputting structured CSV / posting to n8n intake webhooks.

---

## 4. Runtime Architecture & Infrastructure Topology

```
                  ┌─────────────────────────────────────────┐
                  │          Browser / Admin User           │
                  └────────────────────┬────────────────────┘
                                       │ HTTPS
                                       ▼
                  ┌─────────────────────────────────────────┐
                  │    Next.js 14 Dashboard (Vercel)        │
                  │        https://leadgen-auto...          │
                  └──────┬─────────────┬──────────────┬─────┘
                         │             │              │
        Proxy /api/v3/*  │             │ Proxy /api/* │ Direct DB Access
                         ▼             │              ▼
┌──────────────────────────────────┐   │   ┌──────────────────────────────────┐
│ Primary Scraper Backend (12c6)   │   │   │  Supabase PostgreSQL Database    │
│ Railway (Node 22 + Playwright)   │   │   │  https://nefgezqgrfvqegmduzce... │
└──────────────────────────────────┘   │   └──────────────────────────────────┘
                         │             │              ▲
                         │ Auth / Msg  ▼              │ Log/Status Sync
                         │ ┌──────────────────────┐   │
                         └─► WhatsApp Service     ├───┘
                           │ Railway (Baileys WS) │
                           └──────────────────────┘
                                       ▲
                                       │ POST Intake
                           ┌───────────┴──────────┐
                           │ Python Maps Scraper  │
                           └──────────────────────┘
```

---

## 5. Build Process & Execution Commands

### Dashboard (`dashboard/`)
- **Development**: `npm run dev` (Starts Next.js dev server on `http://localhost:3000`)
- **Production Build**: `npm run build` (Executes Next.js static and server compilation)
- **Production Run**: `npm run start`

### Backend (`backend/`)
- **Development**: `npm run dev` (`node --watch index.js` on port `3001`)
- **Production Run**: `npm run start` (`node index.js`)
- **Container Build**: Docker build using provided `Dockerfile`

### WhatsApp Service (`whatsapp-service/`)
- **Development**: `npm run dev` (`node --watch index.js` on port `3000`)
- **Production Run**: `npm run start` (`node index.js`)

### Scraper (`scraper/`)
- **CLI Execution**:
  ```bash
  python main.py --keyword "restaurant" --city "Mumbai" --max 50 --send
  ```

---

## 6. Environment Variables Reference

| Environment Variable | Package Scope | Purpose / Function |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | `dashboard`, `agent-brain` | Public API URL for Supabase instance |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `dashboard` | Public Anonymous Key for Supabase client queries |
| `SUPABASE_SERVICE_ROLE_KEY` | `dashboard`, `backend`, `agent-brain` | Admin secret key for bypassing Row Level Security |
| `SUPABASE_URL` | `backend` | Backend database connection URL |
| `WHATSAPP_SERVICE_URL` | `dashboard`, `backend` | Base HTTP URL for the active Railway WhatsApp service |
| `WHATSAPP_API_SECRET` / `API_SECRET` | `dashboard`, `backend`, `whatsapp-service` | Bearer/Header secret for authenticating requests to microservices |
| `V3_BACKEND_URL` | `dashboard` | Primary endpoint for Railway Playwright Scraper Backend (`12c6`) |
| `V3_BACKEND_URL_SECONDARY` | `dashboard` | Fallback endpoint for Railway Playwright Scraper Backend (`scraper-auto`) |
| `DASHBOARD_PASSWORD` | `dashboard` | Admin password for logging into Next.js control panel |
| `N8N_WEBHOOK_BASE_URL` | `dashboard`, `scraper` | Base HTTP endpoint for n8n workflow intake webhooks |
| `TINYFISH_API_KEY` | `dashboard`, `backend` | Third-party web scraping API token |
| `GEMINI_API_KEY` | `dashboard`, `backend`, `agent-brain` | Google Gemini API secret key for AI prompt generation |
| `PORT` | `backend`, `whatsapp-service`, `agent-brain` | HTTP port assignment for Express servers |

---

## 7. External Services & Third-Party Integrations

1. **Meta Graph API (Facebook & Instagram)**: OAuth token management, Page post publishing, profile analysis, webhooks.
2. **Google Maps**: Target data source scraped via Playwright.
3. **n8n Automation Cloud**: Workflow orchestration engine executing lead ingestion and multi-channel outreach pipelines.
4. **Railway Cloud Application Platform**: Hosting provider for `backend`, `whatsapp-service`, and `n8n`.
5. **Vercel Cloud Platform**: Hosting provider for Next.js 14 frontend `dashboard`.
6. **TinyFish Web Scraping API**: Specialized scraper fallback service.
7. **Nodemailer / SMTP Providers**: Email dispatch integration for lead outreach.

---

## 8. Background Jobs & Queue Architecture

- **Job Storage**: Scrape and enrichment jobs are tracked in the Supabase PostgreSQL table `scrape_jobs`.
- **Job Orchestration**: The Express backend (`backend/worker/jobManager.js`) polls for queued jobs and executes them via worker pools (`workerManager.js`).
- **Browser Lifecycle Management**: `backend/worker/browserManager.js` maintains a pooled Playwright browser instance, launching context instances for individual worker tasks and enforcing memory cleanups.
- **WebSocket State Machine**: `whatsapp-service/index.js` manages persistent WebSocket auth state (`/app/.wwebjs_auth`) and handles auto-reconnection with exponential backoff on disconnect.
