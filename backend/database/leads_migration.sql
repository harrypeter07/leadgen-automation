-- ============================================================
-- LEADS TABLE MIGRATION
-- Run this in Supabase SQL Editor (Project > SQL Editor)
-- ============================================================

-- 0. Add scraped_leads JSONB column to scrape_jobs (JSONB approach: temp cache before user saves)
ALTER TABLE scrape_jobs ADD COLUMN IF NOT EXISTS scraped_leads jsonb DEFAULT '[]'::jsonb;

-- 1. Create leads table with full schema
CREATE TABLE IF NOT EXISTS leads (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),

  -- Core Fields
  name          text NOT NULL,
  phone         text,
  email         text,
  address       text,
  city          text,
  category      text,
  website       text,
  rating        numeric(3,1),
  review_count  integer,
  notes         text,

  -- Source tracking
  source        text DEFAULT 'manual',
  status        text DEFAULT 'new',

  -- Job linkage (which scrape job created this lead)
  job_id        uuid REFERENCES scrape_jobs(id) ON DELETE SET NULL
);

-- 2. Add job_id column if table already exists (safe ALTER)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'job_id'
  ) THEN
    ALTER TABLE leads ADD COLUMN job_id uuid REFERENCES scrape_jobs(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 3. Create performance indexes
CREATE INDEX IF NOT EXISTS leads_phone_idx       ON leads(phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS leads_job_id_idx      ON leads(job_id);
CREATE INDEX IF NOT EXISTS leads_created_at_idx  ON leads(created_at DESC);
CREATE INDEX IF NOT EXISTS leads_status_idx      ON leads(status);
CREATE INDEX IF NOT EXISTS leads_city_idx        ON leads(city);

-- 4. Enable RLS on leads
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- 5. Drop old policies cleanly
DROP POLICY IF EXISTS "leads_anon_read"   ON leads;
DROP POLICY IF EXISTS "leads_service_all" ON leads;
DROP POLICY IF EXISTS "leads_anon_select" ON leads;

-- 6. Allow dashboard anon key to SELECT leads
CREATE POLICY "leads_anon_read" ON leads
  FOR SELECT USING (true);

-- 7. Allow backend service_role key to do everything
CREATE POLICY "leads_service_all" ON leads
  FOR ALL USING (auth.role() = 'service_role');

-- 8. Fix scrape_jobs RLS so dashboard can read job history
ALTER TABLE scrape_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "scrape_jobs_anon_read"   ON scrape_jobs;
DROP POLICY IF EXISTS "scrape_jobs_service_all"  ON scrape_jobs;

CREATE POLICY "scrape_jobs_anon_read" ON scrape_jobs
  FOR SELECT USING (true);

CREATE POLICY "scrape_jobs_service_all" ON scrape_jobs
  FOR ALL USING (auth.role() = 'service_role');

-- 9. Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS leads_updated_at ON leads;
CREATE TRIGGER leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
