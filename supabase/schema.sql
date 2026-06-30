-- supabase/schema.sql
-- Full schema for the LeadGen automation system
-- Run this in the Supabase SQL Editor (https://app.supabase.com → SQL Editor → New Query)
-- Safe to run multiple times — all statements are idempotent.

-- ============================================================
-- EXTENSIONS
-- ============================================================
-- gen_random_uuid() is built-in on Supabase (PostgreSQL 13+),
-- but we enable pgcrypto as well for maximum compatibility.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- LEADS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS leads (
    id                       UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at               TIMESTAMPTZ  NOT NULL DEFAULT now(),

    -- Core business info
    name                     TEXT         NOT NULL,
    phone                    TEXT,
    email                    TEXT,
    address                  TEXT,
    city                     TEXT,
    category                 TEXT,                        -- e.g. 'restaurant', 'clinic', 'gym'
    website                  TEXT,
    rating                   NUMERIC(2,1),
    review_count             INTEGER,

    -- Provenance
    source                   TEXT         NOT NULL DEFAULT 'google_maps',

    -- Pipeline status — constrained to known values
    status                   TEXT         NOT NULL DEFAULT 'new'
                             CONSTRAINT leads_status_check
                             CHECK (status IN (
                                 'new',
                                 'whatsapp_sent',
                                 'email_sent',
                                 'replied',
                                 'converted',
                                 'skip'
                             )),

    -- Outreach timestamps
    whatsapp_sent_at         TIMESTAMPTZ,
    email_sent_at            TIMESTAMPTZ,
    last_contacted_at        TIMESTAMPTZ,

    -- Free-form notes
    notes                    TEXT,

    -- Gemini AI-generated outreach copy
    ai_message_whatsapp      TEXT,
    ai_message_email_subject TEXT,
    ai_message_email_body    TEXT
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS leads_status_idx      ON leads (status);
CREATE INDEX IF NOT EXISTS leads_city_idx        ON leads (city);
CREATE INDEX IF NOT EXISTS leads_category_idx    ON leads (category);
CREATE INDEX IF NOT EXISTS leads_created_at_idx  ON leads (created_at DESC);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- service_role: full read/write access
-- Used by: n8n, whatsapp-service, backend scripts
CREATE POLICY "service_role_all"
    ON leads
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- anon: read-only access (used by the Next.js dashboard via public anon key)
CREATE POLICY "anon_read"
    ON leads
    FOR SELECT
    TO anon
    USING (true);
