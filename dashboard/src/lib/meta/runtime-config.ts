// lib/meta/runtime-config.ts
// Loads Meta credentials from Supabase meta_config table into process.env
// at runtime if the env vars are not already set. Caches the result for
// the lifetime of the process (singleton).
//
// Call: await ensureMetaConfig() at the start of any API route handler
// that needs Meta credentials.
import { supabaseAdmin } from '@/lib/supabase'
import crypto from 'crypto'

let hydrated  = false
let hydrating = false
const waiters: Array<() => void> = []

const ENCRYPTED_KEYS = new Set([
  'META_APP_SECRET', 'META_PAGE_ACCESS_TOKEN', 'META_VERIFY_TOKEN',
  'META_WEBHOOK_SECRET', 'META_LONG_LIVED_USER_TOKEN', 'META_SYSTEM_USER_TOKEN', 'WHATSAPP_PERMANENT_TOKEN',
  'INSTAGRAM_ACCESS_TOKEN', 'MESSENGER_PAGE_TOKEN',
])

function getEncKey(): Buffer {
  const raw = process.env.SUPABASE_SERVICE_ROLE_KEY || 'fallback-key-32-bytes-padded-123'
  return Buffer.from(raw.slice(0, 32).padEnd(32, '0'))
}

function decrypt(value: string): string {
  try {
    if (!value.startsWith('enc:')) return value
    const parts = value.split(':')
    if (parts.length < 3) return value
    const iv        = Buffer.from(parts[1], 'hex')
    const encrypted = Buffer.from(parts[2], 'hex')
    const decipher  = crypto.createDecipheriv('aes-256-cbc', getEncKey(), iv)
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
  } catch {
    return value
  }
}

/**
 * Ensures all Meta credentials are loaded into process.env.
 * - If env vars already exist: no-op (fast path).
 * - If env vars are missing: loads from Supabase meta_config.
 * Thread-safe: concurrent calls wait for a single hydration pass.
 */
export async function ensureMetaConfig(): Promise<void> {
  // Already hydrated from DB
  if (hydrated) return

  // Already being hydrated — wait for it
  if (hydrating) {
    return new Promise(resolve => waiters.push(resolve))
  }

  hydrating = true
  try {
    const { data, error } = await supabaseAdmin
      .from('meta_config')
      .select('key, value, encrypted')

    if (error) {
      console.warn('[RuntimeConfig] Failed to load from Supabase:', error.message)
      return
    }

    let loaded = 0
    for (const row of data || []) {
      if (!row.key || !row.value) continue
      const val = ENCRYPTED_KEYS.has(row.key) ? decrypt(row.value) : row.value
      process.env[row.key] = val
      loaded++
    }

    console.log(`[RuntimeConfig] Loaded ${loaded} credentials from Supabase meta_config into process.env`)
    hydrated = true
  } catch (err) {
    console.warn('[RuntimeConfig] Error:', err)
  } finally {
    hydrating = false
    // Wake up all waiting callers
    while (waiters.length) waiters.pop()!()
  }
}

/** Force a re-hydration on next call (use after settings save) */
export function invalidateMetaConfig(): void {
  hydrated  = false
  hydrating = false
}

// ─── Active Connected Account helper ─────────────────────────────────────────

function getEncKey(): Buffer {
  const raw = process.env.SUPABASE_SERVICE_ROLE_KEY || 'fallback-key-32-bytes-padded-123'
  return Buffer.from(raw.slice(0, 32).padEnd(32, '0'))
}

function decryptCredValue(value: string): string {
  try {
    if (!value) return ''
    if (value.startsWith('enc:')) {
      const parts = value.split(':')
      if (parts.length < 3) return value
      const iv        = Buffer.from(parts[1], 'hex')
      const encrypted = Buffer.from(parts[2], 'hex')
      const decipher  = crypto.createDecipheriv('aes-256-cbc', getEncKey(), iv)
      return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
    }
    // Backend-encrypted format: iv:ciphertext (no 'enc:' prefix)
    const parts = value.split(':')
    if (parts.length >= 2) {
      const iv        = Buffer.from(parts.shift() || '', 'hex')
      const encrypted = Buffer.from(parts.join(':'), 'hex')
      const rawKey    = process.env.WHATSAPP_API_SECRET || 'antigravity_fallback_encryption_key_32_bytes_long'
      const derivedKey = crypto.createHash('sha256').update(rawKey).digest()
      const decipher  = crypto.createDecipheriv('aes-256-cbc', derivedKey, iv)
      return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
    }
    return value
  } catch {
    return value
  }
}

export interface ActiveAccountCredentials {
  pageAccessToken: string
  instagramToken: string
  pageId: string
  instagramBusinessId: string
  displayName: string
  platform: string
}

/**
 * Returns the credentials for the currently-active connected account.
 * Falls back to null if no active account is found (caller should then
 * use meta_config / process.env as before).
 */
export async function getActiveConnectedAccount(
  preferPlatform?: 'instagram' | 'messenger' | 'facebook'
): Promise<ActiveAccountCredentials | null> {
  try {
    let query = supabaseAdmin
      .from('connected_accounts')
      .select('display_name, platform, credentials, is_active')
      .eq('is_active', true)
    if (preferPlatform) {
      query = query.eq('platform', preferPlatform)
    }
    const { data, error } = await query.limit(1).single()
    if (error || !data) return null

    let creds: Record<string, string> = {}
    try {
      const raw = decryptCredValue(data.credentials as string)
      creds = JSON.parse(raw)
    } catch {
      return null
    }

    return {
      pageAccessToken:      creds.page_access_token || creds.META_PAGE_ACCESS_TOKEN || creds.MESSENGER_PAGE_TOKEN || '',
      instagramToken:       creds.instagram_access_token || creds.INSTAGRAM_ACCESS_TOKEN || creds.page_access_token || '',
      pageId:               creds.page_id || creds.META_PAGE_ID || '',
      instagramBusinessId:  creds.instagram_business_id || creds.INSTAGRAM_BUSINESS_ID || '',
      displayName:          data.display_name as string || '',
      platform:             data.platform as string || '',
    }
  } catch (err) {
    console.warn('[RuntimeConfig] getActiveConnectedAccount failed:', err)
    return null
  }
}

