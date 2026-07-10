import { NextRequest, NextResponse } from 'next/server'
import { MetaSettingsService } from '@/lib/meta/meta-settings-service'

// POST /api/instagram-bot-scan
export async function POST(req: NextRequest) {
  let dbBackendUrl = ''
  try {
    const dbSettings = await MetaSettingsService.getFromDB() as Record<string, string>
    dbBackendUrl = dbSettings.V3_BACKEND_URL || dbSettings.BACKEND_URL || ''
  } catch (err: any) {
    console.warn('[Instagram Bot Scan] Failed to load backend URL from DB:', err.message)
  }

  const backendUrl = (
    process.env.V3_BACKEND_URL ||
    dbBackendUrl ||
    'https://leadgen-automation-production-12c6.up.railway.app'
  ).replace(/\/+$/, '')

  const apiSecret = process.env.WHATSAPP_API_SECRET || process.env.API_SECRET || ''

  try {
    const body = await req.json().catch(() => ({}))
    console.log(`[Instagram Bot Scan] Proxying run scan to: ${backendUrl}/api/test/instagram/bot-scan`)

    const res = await fetch(`${backendUrl}/api/test/instagram/bot-scan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiSecret ? { 'x-api-secret': apiSecret } : {}),
      },
      body: JSON.stringify(body),
    })

    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Proxy connection failed'
    console.error('[Instagram Bot Scan] Error:', message)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
