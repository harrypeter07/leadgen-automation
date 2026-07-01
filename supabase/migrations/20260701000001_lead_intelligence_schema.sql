-- supabase/migrations/20260701000001_lead_intelligence_schema.sql
-- Migration to set up website_audits, instagram_audits, scraper_sessions, and lead references.

-- ============================================================
-- WEBSITE AUDITS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS website_audits (
    id                 UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at         TIMESTAMPTZ   NOT NULL DEFAULT now(),
    url                TEXT,
    seo_score          NUMERIC(5,2),
    ux_score           NUMERIC(5,2),
    performance_score  NUMERIC(5,2),
    accessibility_score NUMERIC(5,2),
    tech_stack         JSONB,
    social_links       TEXT[],
    emails             TEXT[],
    phone_numbers      TEXT[],
    screenshot_url     TEXT
);

ALTER TABLE website_audits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON website_audits FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "anon_read" ON website_audits FOR SELECT TO anon USING (true);

-- ============================================================
-- INSTAGRAM AUDITS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS instagram_audits (
    id                 UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at         TIMESTAMPTZ   NOT NULL DEFAULT now(),
    username           TEXT,
    display_name       TEXT,
    bio                TEXT,
    website            TEXT,
    followers          INTEGER,
    following          INTEGER,
    posts_count        INTEGER,
    verified           BOOLEAN,
    health_score       NUMERIC(5,2),
    consistency_score  NUMERIC(5,2),
    engagement_rate    NUMERIC(5,2)
);

ALTER TABLE instagram_audits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON instagram_audits FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "anon_read" ON instagram_audits FOR SELECT TO anon USING (true);

-- ============================================================
-- SCRAPER SESSIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS scraper_sessions (
    id                 UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    updated_at         TIMESTAMPTZ   NOT NULL DEFAULT now(),
    provider           TEXT          NOT NULL,
    username           TEXT          NOT NULL,
    session_data       JSONB,
    is_valid           BOOLEAN       DEFAULT true,
    UNIQUE(provider, username)
);

ALTER TABLE scraper_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON scraper_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "anon_read" ON scraper_sessions FOR SELECT TO anon USING (true);

-- ============================================================
-- LEADS TABLE UPDATES
-- ============================================================
ALTER TABLE leads ADD COLUMN IF NOT EXISTS website_audit_id UUID REFERENCES website_audits(id);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS instagram_audit_id UUID REFERENCES instagram_audits(id);
