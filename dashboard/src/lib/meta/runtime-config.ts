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
  'INSTAGRAM_ACCESS_TOKEN',
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
  // Fast path: already set in env (must have both FB page token AND IG token)
  if (process.env.META_PAGE_ACCESS_TOKEN && process.env.META_APP_ID && process.env.INSTAGRAM_ACCESS_TOKEN) {
    return
  }

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
      // Only set if not already in env
      if (!process.env[row.key]) {
        const val = ENCRYPTED_KEYS.has(row.key) ? decrypt(row.value) : row.value
        process.env[row.key] = val
        loaded++
      }
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
