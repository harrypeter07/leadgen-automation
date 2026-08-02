# 08. Automation Engine & Worker Pool Architecture

This document documents the automation engine, background queues, worker managers, job schedulers, and Playwright pool management in `dashboard/src/automation/` and `backend/worker/`.

---

## 1. Automation Architecture Overview

The system runs an asynchronous job queue and worker pool capable of processing lead scraping, AI message generation, website audits, and multi-channel outreach without blocking HTTP threads.

```
┌────────────────────────┐
│  Scrape / Enrich Job   │
└───────────┬────────────┘
            │ Insert into Database
            ▼
┌────────────────────────┐      Polls queued jobs      ┌─────────────────────────┐
│ Supabase `scrape_jobs` ├────────────────────────────►│ Job Manager             │
└────────────────────────┘                             │ (backend/worker/job.js) │
                                                       └────────────┬────────────┘
                                                                    │ Spawns task
                                                                    ▼
                                                       ┌─────────────────────────┐
                                                       │ Worker Manager Pool     │
                                                       │ (workerManager.js)      │
                                                       └────────────┬────────────┘
                                                                    │ Allocates context
                                                                    ▼
                                                       ┌─────────────────────────┐
                                                       │ Playwright Browser Pool │
                                                       │ (browserManager.js)     │
                                                       └─────────────────────────┘
```

---

## 2. Background Worker Pool Modules (`backend/worker/`)

### 1. Bootstrap Manager (`backend/worker/bootstrapManager.js`)
- **Purpose**: Initializes system singletons upon Express startup.
- **Boot Sequence**:
  1. Checks Supabase PostgreSQL database connectivity.
  2. Launches headless Playwright Chromium instance via `browserManager.js`.
  3. Initializes `workerManager.js` worker pools.
  4. Exposes `getSystemStatus()` for `/health/system` health diagnostic probes.

### 2. Browser Pool Manager (`backend/worker/browserManager.js`)
- **Purpose**: Manages single Chromium browser process to conserve memory on Railway container instances.
- **Resource Controls**:
  - `launchBrowser()`: Spawns Playwright Chromium with flags `--no-sandbox`, `--disable-setuid-sandbox`, `--disable-dev-shm-usage`.
  - `createContext()`: Generates isolated Incognito Browser Contexts per scraping task, setting custom User-Agents and viewports.
  - `shutdown()`: Closes all active contexts and terminates Chromium process gracefully on SIGTERM/SIGINT.

### 3. Worker Manager (`backend/worker/workerManager.js`)
- **Purpose**: Controls concurrent worker execution threads.
- **Capabilities**:
  - `maxConcurrency`: Limits parallel active scraping tasks (default: 2 per node instance).
  - `activeWorkers`: Map tracking worker IDs to job execution metadata.
  - Enforces execution timeouts (default: 120 seconds per scraping iteration) to kill hung tasks.

### 4. Job Queue Manager (`backend/worker/jobManager.js`)
- **Purpose**: Controls `scrape_jobs` table state transitions (`queued` -> `running` -> `completed` / `failed`).
- **Core Methods**:
  - `processQueue()`: Queries database for oldest job with `status = 'queued'`. Updates status to `'running'` and assigns worker.
  - `pauseJob(jobId)`: Updates job status to `'paused'` and halts worker loop.
  - `resumeJob(jobId)`: Restores job status to `'queued'` for execution re-pickup.
  - `stopJob(jobId)`: Updates job status to `'stopped'` and terminates associated Playwright context.

---

## 3. Automation Domain (`dashboard/src/automation/`)

Inside Next.js `dashboard/src/automation/`, domain-driven modules organize automation business logic:

- **`domain/`**: Type definitions and entity contracts for automation campaigns, trigger rules, and action nodes.
- **`events/`**: Event emitter logic broadcasting job progress updates to UI sockets.
- **`jobs/`**: Client-side job construction helpers and payload validators.
- **`observability/`**: Telemetry and execution time metrics.
- **`providers/`**: Integrations with external execution engines (QStash, n8n, TinyFish).
- **`services/`**: High-level workflow orchestration services.

---

## 4. External Orchestration Engines

### 1. n8n Workflow Pipelines (`n8n-workflows/`)
- **Intake Pipeline (`lead-intake.json`)**: Accepts HTTP POST from Python CLI scraper or webhooks, normalizes payload fields, performs phone/email deduplication, and upserts into Supabase `leads`.
- **AI Personalization (`ai-personalise.json`)**: Listens for `leads` with status `'new'`, calls Google Gemini API to write custom outreach copy based on business category and reviews, updates `ai_message_*` columns.
- **Outreach Execution (`outreach.json`)**: Reads leads with generated AI copy, posts payload to `whatsapp-service` (`/send`) or SMTP endpoint, updates status to `'whatsapp_sent'` / `'email_sent'`.

### 2. QStash Scheduled Workflows (`backend/services/qstashService.js`)
- Uses Upstash QStash to schedule HTTP webhook callbacks for background job retries and scheduled daily cron tasks.
