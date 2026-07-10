import { NextRequest, NextResponse } from 'next/server'
import { MetaSettingsService } from '@/lib/meta/meta-settings-service'

// GET /api/instagram-bot-scan/[username]
export async function GET(req: NextRequest, { params }: { params: { username: string } }) {
  const username = params.username
  let dbBackendUrl = ''
  try {
    const dbSettings = await MetaSettingsService.getFromDB() as Record<string, string>
    dbBackendUrl = dbSettings.V3_BACKEND_URL || dbSettings.BACKEND_URL || ''
  } catch (err: any) {
    console.warn('[Instagram Bot Scan Get] Failed to load backend URL from DB:', err.message)
  }

  const backendUrl = (
    process.env.V3_BACKEND_URL ||
    dbBackendUrl ||
    'https://leadgen-automation-production-12c6.up.railway.app'
  ).replace(/\/+$/, '')

  const apiSecret = process.env.WHATSAPP_API_SECRET || process.env.API_SECRET || ''

  try {
    console.log(`[Instagram Bot Scan Get] Proxying fetch to: ${backendUrl}/api/test/instagram/bot-scan/${username}`)

    const res = await fetch(`${backendUrl}/api/test/instagram/bot-scan/${username}`, {
      method: 'GET',
      headers: {
        ...(apiSecret ? { 'x-api-secret': apiSecret } : {}),
      },
    })

    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Proxy connection failed'
    console.error('[Instagram Bot Scan Get] Error:', message)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
