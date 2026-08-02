-- Database Migration: Performance Indexing & Latency Optimization
-- Date: 2026-08-02

-- Indexes for High-Velocity Lead Queries
CREATE INDEX IF NOT EXISTS idx_leads_status_created 
  ON leads (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_leads_city_category 
  ON leads (city, category);

CREATE INDEX IF NOT EXISTS idx_leads_job_id 
  ON leads (job_id);

-- Index for Active Connected Accounts Context Switching
CREATE INDEX IF NOT EXISTS idx_connected_accounts_platform_active 
  ON connected_accounts (platform, is_active);

-- Index for Rapid Meta Config Key Lookups
CREATE INDEX IF NOT EXISTS idx_meta_config_key 
  ON meta_config (key);
