import { NextRequest, NextResponse } from 'next/server'
import { MetaSettingsService } from '@/lib/meta/meta-settings-service'

export const dynamic = 'force-dynamic'

// GET /api/meta/settings — Returns current config (DB-first, env fallback)
export async function GET() {
  try {
    // Try DB first
    const dbSettings = await MetaSettingsService.getFromDB()
    const envSettings = MetaSettingsService.getFromEnv()

    // Merge: DB values override env (DB is source of truth)
    const merged = { ...envSettings, ...dbSettings }

    // Never expose secrets in GET response — mask them
    const SECRET_KEYS = new Set([
      'META_APP_SECRET', 'META_PAGE_ACCESS_TOKEN', 'META_VERIFY_TOKEN',
      'META_WEBHOOK_SECRET', 'META_LONG_LIVED_USER_TOKEN', 'META_SYSTEM_USER_TOKEN', 'WHATSAPP_PERMANENT_TOKEN',
      'SMTP_PASS'
    ])
    const safeSettings: Record<string, string | boolean> = {}
    for (const [k, v] of Object.entries(merged)) {
      if (SECRET_KEYS.has(k)) {
        // Return masked value + "set" flag so UI can show ✓ without revealing secret
        safeSettings[k] = v ? '•'.repeat(24) : ''
        safeSettings[`${k}__set`] = !!v
      } else {
        safeSettings[k] = (v as string) || ''
      }
    }

    const { ok, missing } = await MetaSettingsService.isConfiguredAsync()
    return NextResponse.json({ settings: safeSettings, configured: ok, missing })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// POST /api/meta/settings — Saves settings to Supabase meta_config table
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { settings } = body

    if (!settings || typeof settings !== 'object') {
      return NextResponse.json({ error: 'Invalid settings payload.' }, { status: 400 })
    }

    // Persist to DB
    const result = await MetaSettingsService.saveToDB(settings)
    if (result.ok) {
      try {
        const { invalidateMetaConfig } = require('@/lib/meta/runtime-config')
        invalidateMetaConfig()
      } catch {}
    }
    if (!result.ok) {
      // If DB write fails (table not created yet), try forwarding to backend
      const backendUrl = process.env.V3_BACKEND_URL || process.env.WHATSAPP_SERVICE_URL
      if (backendUrl) {
        const res = await fetch(`${backendUrl}/api/automation/accounts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-secret': process.env.WHATSAPP_API_SECRET || '',
          },
          body: JSON.stringify({
            platform: 'facebook',
            account_name: settings.META_PAGE_NAME || 'Meta App',
            app_id: settings.META_APP_ID,
            credentials: {
              app_secret: settings.META_APP_SECRET,
              access_token: settings.META_PAGE_ACCESS_TOKEN,
              page_id: settings.META_PAGE_ID,
              verify_token: settings.META_VERIFY_TOKEN,
              webhook_url: settings.META_WEBHOOK_CALLBACK_URL,
              ig_business_id: settings.INSTAGRAM_BUSINESS_ID,
              ig_username: settings.INSTAGRAM_USERNAME,
            },
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Backend save failed.')
        return NextResponse.json({ success: true, message: 'Settings saved to backend.', dbError: result.error })
      }
      return NextResponse.json({ success: false, error: result.error }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: `Saved ${Object.keys(settings).length} settings to database.` })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
