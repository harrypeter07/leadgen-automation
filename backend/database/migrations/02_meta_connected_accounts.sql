-- backend/database/migrations/02_meta_connected_accounts.sql
-- UP Migration: Creates connected_accounts and system_audit_logs tables

-- 1. connected_accounts Table
CREATE TABLE IF NOT EXISTS connected_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID,
  platform TEXT NOT NULL CHECK (platform IN ('facebook', 'instagram', 'messenger', 'whatsapp')),
  account_name TEXT NOT NULL,
  app_id TEXT,
  encrypted_credentials TEXT NOT NULL,
  oauth_status TEXT NOT NULL DEFAULT 'not_connected' CHECK (oauth_status IN ('connected', 'expired', 'needs_reauth', 'not_connected', 'error')),
  token_expires_at TIMESTAMPTZ,
  webhook_verification_status TEXT NOT NULL DEFAULT 'unconfigured' CHECK (webhook_verification_status IN ('verified', 'unconfigured', 'failed')),
  permissions JSONB DEFAULT '[]'::jsonb,
  health_status TEXT NOT NULL DEFAULT 'healthy' CHECK (health_status IN ('healthy', 'degraded', 'down')),
  last_tested_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. system_audit_logs Table
CREATE TABLE IF NOT EXISTS system_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  details TEXT,
  user_identifier TEXT DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Create update triggers for auto updated_at
CREATE TRIGGER trg_connected_accounts_updated_at BEFORE UPDATE ON connected_accounts FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- 4. Create indexes to optimize queries
CREATE INDEX IF NOT EXISTS idx_connected_accounts_platform ON connected_accounts(platform);
CREATE INDEX IF NOT EXISTS idx_connected_accounts_oauth_status ON connected_accounts(oauth_status);
CREATE INDEX IF NOT EXISTS idx_system_audit_logs_action ON system_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_system_audit_logs_created_at ON system_audit_logs(created_at);
