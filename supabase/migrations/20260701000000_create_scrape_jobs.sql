-- supabase/migrations/20260701000000_create_scrape_jobs.sql
-- Migration to set up scrape_jobs table and leads unique constraints to support direct upsert operations.

-- ============================================================
-- SCRAPE JOBS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS scrape_jobs (
    id                           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at                   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    keyword                      TEXT         NOT NULL,
    city                         TEXT         NOT NULL,
    max_leads                    INTEGER      NOT NULL DEFAULT 50,
    status                       TEXT         NOT NULL DEFAULT 'queued'
                                 CONSTRAINT scrape_jobs_status_check
                                 CHECK (status IN (
                                     'queued',
                                     'running',
                                     'paused',
                                     'stopped',
                                     'completed',
                                     'failed'
                                 )),
    progress                     INTEGER      NOT NULL DEFAULT 0,
    current_business             TEXT,
    current_provider             TEXT         NOT NULL DEFAULT 'google_maps',
    error_count                  INTEGER      NOT NULL DEFAULT 0,
    started_at                   TIMESTAMPTZ,
    completed_at                 TIMESTAMPTZ,
    duration_seconds             INTEGER,
    estimated_remaining_seconds  INTEGER,
    logs                         TEXT[]       DEFAULT '{}',
    created_by                   TEXT         DEFAULT 'dashboard',
    worker_count                 INTEGER      NOT NULL DEFAULT 1
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS scrape_jobs_status_idx      ON scrape_jobs (status);
CREATE INDEX IF NOT EXISTS scrape_jobs_created_at_idx  ON scrape_jobs (created_at DESC);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE scrape_jobs ENABLE ROW LEVEL SECURITY;

-- service_role: full read/write access (n8n, scraper manager, backend APIs)
CREATE POLICY "service_role_all"
    ON scrape_jobs
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- anon: read-only access (dashboard polling)
CREATE POLICY "anon_read"
    ON scrape_jobs
    FOR SELECT
    TO anon
    USING (true);

-- ============================================================
-- UNIQUE CONSTRAINTS FOR LEADS UPSERT
-- ============================================================
-- Unique index to prevent duplicate leads by phone number
CREATE UNIQUE INDEX IF NOT EXISTS leads_phone_unique_idx ON leads (phone) WHERE phone IS NOT NULL;
