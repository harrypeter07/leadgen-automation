// dashboard/src/config/env.ts
/**
 * Unified Configuration Layer
 * Centralized, type-safe accessor for environment variables and default runtime fallbacks.
 */

export const env = {
  // Supabase Configuration
  SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://nefgezqgrfvqegmduzce.supabase.co',
  SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',

  // Microservices & Backend URLs
  V3_BACKEND_URL: process.env.V3_BACKEND_URL || 'https://leadgen-automation-production-12c6.up.railway.app',
  V3_BACKEND_URL_SECONDARY: process.env.V3_BACKEND_URL_SECONDARY || 'https://scraper-auto.up.railway.app',
  WHATSAPP_SERVICE_URL: process.env.WHATSAPP_SERVICE_URL || 'https://leadgen-automation-production.up.railway.app',
  WHATSAPP_API_SECRET: process.env.WHATSAPP_API_SECRET || '27pwgfjvq491aircy8lh6nz3eb5mkus0',
  N8N_WEBHOOK_BASE_URL: process.env.N8N_WEBHOOK_BASE_URL || 'https://n8n-production-4cbd.up.railway.app',

  // Authentication & Secrets
  DASHBOARD_PASSWORD: process.env.DASHBOARD_PASSWORD || 'wrongpassword',
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || process.env.WHATSAPP_API_SECRET || 'antigravity_fallback_encryption_key_32_bytes_long',
  TINYFISH_API_KEY: process.env.TINYFISH_API_KEY || '',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',

  // Environment Flags
  IS_PRODUCTION: process.env.NODE_ENV === 'production',
  IS_DEV: process.env.NODE_ENV === 'development',
} as const;
