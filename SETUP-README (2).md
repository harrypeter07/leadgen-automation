# LeadGen Agent System — Setup Guide (v2, corrected against real backend)

This supersedes the earlier README. That version assumed a `discovery_queue` table
and a `/scrape/maps` endpoint that don't exist in the real repo. Everything below is
based on the actual audit of `leadgen/backend`.

## What changed from the first draft

- No new queue table — your `scrape_jobs` table + `queueManager.js` already do this job.
- No new `leads` table — the real one gets new columns added, not duplicated.
- n8n's role shrank a lot: it's now an optional convenience entry point, not the
  engine. The heavy lifting is backend (scraping) + agent-brain (deciding/enriching).
- `agent-brain` is delivered as real, runnable code (`agent-brain.zip`), not just a
  prompt for a coding agent to write it — since the endpoints it calls are now confirmed.

---

## Setup order — follow exactly, don't skip ahead

### Step 1 — Backend build-out (coding agent)

Run `backend-buildout-prompt.md` against your `leadgen` repo. This adds:
- New providers: Facebook/Messenger, Reddit, LinkedIn (via TinyFish Agent), TinyFish Search/Fetch
- Email verification integration
- Additive migration to the existing `leads` table (new enrichment columns)
- New enrichment endpoints agent-brain will call (`/api/enrich/website-email`,
  `/api/enrich/facebook`, `/api/enrich/reddit`, `/api/enrich/linkedin`,
  `/api/enrich/email-verify`, `/api/enrich/email-pattern`)
- Possibly `/api/jobs/start-batch` for zone × keyword fan-out (only if Step 1 of that
  prompt's own audit shows `queueManager.js` doesn't already support it)

**Do not proceed until this is deployed and its own verification checklist passes.**

### Step 2 — Deploy `scraper-automated` (second Railway service)

Same repo, same `/backend` root directory, same Dockerfile — just a second Railway
service so bulk/automated scraping never competes with live website requests hitting
your existing `scraper-manual` service. Copy env vars from `scraper-manual`, plus
whatever new keys Step 1 introduced (TinyFish, email verification).

Verify: hit its `/api/health` directly, confirm it's independent of `scraper-manual`.

### Step 3 — Deploy `agent-brain`

1. Unzip `agent-brain.zip` into its own new repo (or a new top-level folder in the
   monorepo, deployed as its own Railway service with root directory set accordingly).
2. Copy `.env.example` to `.env`, fill in real values:
   - `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` — same Supabase project as backend
   - `GEMINI_API_KEY`, `GEMINI_MODEL` — get a key from Google AI Studio; check
     current available model names there, the example default may be stale by
     the time you set this up
   - `BACKEND_AUTOMATED_URL` — the Step 2 service's public URL
   - `TINYFISH_API_KEY` — from your TinyFish account
3. `npm install && npm start` locally first to confirm it boots (it will refuse to
   start and log exactly which env var is missing if something's not set).
4. Deploy to Railway as its own service.

Verify:
```
GET  /health                 → { status: 'ok' }
GET  /api/tasks/progress     → counts per enrichment_status (all zero on a fresh DB)
POST /api/tasks/enrich {"limit": 3}
                              → runs enrichment on up to 3 pending leads, returns summary
```

Run the `/api/tasks/enrich` test only after Step 1's leads table has at least a
few rows with `enrichment_status = 'not_started'` in it (i.e. after you've run a
Maps scrape job that produced some leads).

### Step 4 — n8n (optional convenience layer)

Import `n8n-leadgen-start-batch-task.json`. Set env vars in n8n:
- `BACKEND_AUTOMATED_URL` — same as agent-brain's

This gives you a single webhook (`POST /webhook/leadgen/start-batch`) that expands
keyword × area combinations and calls your backend's job-start endpoint — useful if
you want to trigger a task from Slack, a form, or anywhere else n8n can receive a
webhook from, without hand-building the combination logic each time.

**What's intentionally NOT in n8n anymore, and why:**
- Discovery queue processing → your backend's `queueManager.js` already does this.
- Website email tool wrapper → your backend's `emailScraper.js` (extended per Step 1)
  already does this, and agent-brain calls it directly — no n8n hop needed.

n8n remains useful for things unrelated to this pipeline (WhatsApp/Baileys outreach,
notifications) — just not as a step inside the enrichment loop itself.

### Step 5 — Dashboard integration

Add the leadgen page to the Next.js dashboard: a form to POST to n8n's start-batch
webhook (or directly to the backend), a progress view polling `agent-brain`'s
`GET /api/tasks/progress`, and a leads table reading `GET /api/leads?status=qualified`.
This part of the earlier Phase 2 plan is still valid — just point it at these real,
confirmed endpoints instead of placeholders.

---

## Files in this delivery

| File | Purpose |
|---|---|
| `backend-audit-prompt.md` | (already run) read-only audit of the existing backend |
| `backend-buildout-prompt.md` | Step 1 — builds missing scrapers + endpoints |
| `agent-brain.zip` | Step 3 — the actual orchestrator service code |
| `n8n-leadgen-start-batch-task.json` | Step 4 — optional convenience trigger |

## Rollback safety

Steps 1-4 only ADD new services, new columns, and new files. Nothing modifies
`scraper-manual`, `whatsapp-service`, or existing dashboard pages. If anything in
Step 1's migration looks wrong once applied, the added columns can be dropped
without touching any pre-existing data or code path.
