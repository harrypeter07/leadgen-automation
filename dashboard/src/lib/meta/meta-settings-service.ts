// lib/meta/meta-settings-service.ts
// Reads/writes Meta configuration from Supabase meta_config table,
// with fallback to process.env for local dev or if DB is not reachable.
import { supabaseAdmin } from '@/lib/supabase'
import crypto from 'crypto'

export interface MetaSettings {
  META_APP_ID: string
  META_APP_SECRET: string
  META_APP_MODE: string
  META_PAGE_ID: string
  META_PAGE_NAME: string
  META_PAGE_ACCESS_TOKEN: string
  INSTAGRAM_APP_ID: string
  INSTAGRAM_USERNAME: string
  INSTAGRAM_BUSINESS_ID: string
  BUSINESS_PORTFOLIO_ID: string
  META_VERIFY_TOKEN: string
  META_WEBHOOK_CALLBACK_URL: string
  META_WEBHOOK_SECRET: string
  META_OAUTH_REDIRECT_URI: string
  META_GRAPH_API_VERSION: string
  META_GRAPH_BASE_URL: string
  META_LONG_LIVED_USER_TOKEN: string
  META_SYSTEM_USER_ID: string
  META_SYSTEM_USER_TOKEN: string
  META_PAGE_SUBSCRIPTION_ID: string
  WHATSAPP_PHONE_NUMBER_ID: string
  WHATSAPP_BUSINESS_ACCOUNT_ID: string
  WHATSAPP_PERMANENT_TOKEN: string
}

// Keys that should have their values encrypted at rest
const ENCRYPTED_KEYS = new Set([
  'META_APP_SECRET',
  'META_PAGE_ACCESS_TOKEN',
  'META_VERIFY_TOKEN',
  'META_WEBHOOK_SECRET',
  'META_LONG_LIVED_USER_TOKEN',
  'META_SYSTEM_USER_TOKEN',
  'WHATSAPP_PERMANENT_TOKEN',
])

function getEncKey(): Buffer {
  const raw = process.env.SUPABASE_SERVICE_ROLE_KEY || 'fallback-key-32-bytes-padded-123'
  return Buffer.from(raw.slice(0, 32).padEnd(32, '0'))
}

function encrypt(value: string): string {
  try {
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv('aes-256-cbc', getEncKey(), iv)
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
    return `enc:${iv.toString('hex')}:${encrypted.toString('hex')}`
  } catch {
    return value
  }
}

function decrypt(value: string): string {
  try {
    if (!value.startsWith('enc:')) return value
    const parts = value.split(':')
    if (parts.length < 3) return value
    const iv = Buffer.from(parts[1], 'hex')
    const encrypted = Buffer.from(parts[2], 'hex')
    const decipher = crypto.createDecipheriv('aes-256-cbc', getEncKey(), iv)
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
  } catch {
    return value
  }
}

export const MetaSettingsService = {
  /** Read from .env (always available, never encrypted) */
  getFromEnv(): Partial<MetaSettings> {
    return {
      META_APP_ID: process.env.META_APP_ID || '',
      META_APP_SECRET: process.env.META_APP_SECRET || '',
      META_APP_MODE: process.env.META_APP_MODE || 'development',
      META_PAGE_ID: process.env.META_PAGE_ID || '',
      META_PAGE_NAME: process.env.META_PAGE_NAME || '',
      META_PAGE_ACCESS_TOKEN: process.env.META_PAGE_ACCESS_TOKEN || '',
      INSTAGRAM_APP_ID: process.env.INSTAGRAM_APP_ID || '',
      INSTAGRAM_USERNAME: process.env.INSTAGRAM_USERNAME || '',
      INSTAGRAM_BUSINESS_ID: process.env.INSTAGRAM_BUSINESS_ID || '',
      BUSINESS_PORTFOLIO_ID: process.env.BUSINESS_PORTFOLIO_ID || '',
      META_VERIFY_TOKEN: process.env.META_VERIFY_TOKEN || '',
      META_WEBHOOK_CALLBACK_URL: process.env.META_WEBHOOK_CALLBACK_URL || '',
      META_OAUTH_REDIRECT_URI: process.env.META_OAUTH_REDIRECT_URI || '',
      META_GRAPH_API_VERSION: process.env.META_GRAPH_API_VERSION || 'v23.0',
      META_GRAPH_BASE_URL: process.env.META_GRAPH_BASE_URL || 'https://graph.facebook.com',
      WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
      WHATSAPP_BUSINESS_ACCOUNT_ID: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '',
    }
  },

  /** Read all settings from Supabase meta_config table */
  async getFromDB(): Promise<Partial<MetaSettings>> {
    try {
      const { data, error } = await supabaseAdmin
        .from('meta_config')
        .select('key, value, encrypted')

      if (error) throw error

      const result: Record<string, string> = {}
      for (const row of data || []) {
        result[row.key] = row.encrypted ? decrypt(row.value || '') : (row.value || '')
      }
      return result as Partial<MetaSettings>
    } catch {
      // Silently fall back to env if table doesn't exist yet
      return {}
    }
  },

  /** Write all settings to Supabase meta_config table (upsert) */
  async saveToDB(settings: Partial<MetaSettings>): Promise<{ ok: boolean; error?: string }> {
    try {
      const rows = Object.entries(settings)
        .filter(([, v]) => v !== undefined && v !== null)
        .map(([key, value]) => {
          const shouldEncrypt = ENCRYPTED_KEYS.has(key) && value
          return {
            key,
            value: shouldEncrypt ? encrypt(value as string) : (value as string),
            encrypted: !!shouldEncrypt,
            updated_at: new Date().toISOString(),
          }
        })

      const { error } = await supabaseAdmin
        .from('meta_config')
        .upsert(rows, { onConflict: 'key' })

      if (error) throw error
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'DB write failed' }
    }
  },

  /** Check whether required variables are configured (env OR DB) */
  isConfigured(): { ok: boolean; missing: string[] } {
    const required = ['META_APP_ID', 'META_APP_SECRET', 'META_PAGE_ID', 'META_PAGE_ACCESS_TOKEN', 'META_VERIFY_TOKEN']
    // Check env first (fastest)
    const missingFromEnv = required.filter(k => !process.env[k])
    // If nothing missing from env, we're good
    if (missingFromEnv.length === 0) return { ok: true, missing: [] }
    // Otherwise, return as configured=false with the missing list
    // (DB check happens asynchronously via getFromDB at read time)
    return { ok: false, missing: missingFromEnv }
  },

  /** Async version that checks DB as fallback */
  async isConfiguredAsync(): Promise<{ ok: boolean; missing: string[] }> {
    const required = ['META_APP_ID', 'META_APP_SECRET', 'META_PAGE_ID', 'META_PAGE_ACCESS_TOKEN', 'META_VERIFY_TOKEN']
    const dbSettings = await this.getFromDB()
    const missing = required.filter(k => !process.env[k] && !(dbSettings as Record<string, unknown>)[k])
    return { ok: missing.length === 0, missing }
  },
}
