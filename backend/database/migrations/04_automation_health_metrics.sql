-- backend/database/migrations/04_automation_health_metrics.sql
-- UP Migration: Creates automation_health_metrics table

CREATE TABLE IF NOT EXISTS automation_health_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  last_sync_at TIMESTAMPTZ DEFAULT NOW(),
  last_api_error TEXT DEFAULT 'None',
  n8n_status TEXT DEFAULT 'active' CHECK (n8n_status IN ('active', 'degraded', 'down')),
  webhooks_verified BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pre-populate default health values
INSERT INTO automation_health_metrics (id, last_sync_at, last_api_error, n8n_status, webhooks_verified)
VALUES ('7fa8b9c0-1111-4000-8000-000000000001', NOW(), 'None', 'active', true)
ON CONFLICT DO NOTHING;
