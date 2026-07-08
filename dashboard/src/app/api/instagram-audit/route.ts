import { NextRequest, NextResponse } from 'next/server'
import { MetaSettingsService } from '@/lib/meta/meta-settings-service'

// Dedicated Instagram audit endpoint - bypasses the generic catch-all proxy
// which has CDN caching issues on Vercel for POST requests
export async function POST(req: NextRequest) {
  // Load backend URL from DB or env, with hardcoded fallback
  let dbBackendUrl = ''
  try {
    const dbSettings = await MetaSettingsService.getFromDB() as Record<string, string>
    dbBackendUrl = dbSettings.V3_BACKEND_URL || dbSettings.BACKEND_URL || ''
  } catch (err: any) {
    console.warn('[Instagram Audit] Failed to load backend URL from DB:', err.message)
  }

  const backendUrl = (
    process.env.V3_BACKEND_URL ||
    dbBackendUrl ||
    'https://leadgen-automation-production-12c6.up.railway.app'
  ).replace(/\/+$/, '')

  const apiSecret = process.env.WHATSAPP_API_SECRET || process.env.API_SECRET || ''

  try {
    const body = await req.json().catch(() => ({}))
    
    console.log(`[Instagram Audit] Routing to: ${backendUrl}/api/test/instagram for user: ${body.username}`)

    const res = await fetch(`${backendUrl}/api/test/instagram`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiSecret ? { 'x-api-secret': apiSecret } : {}),
      },
      body: JSON.stringify(body),
      // Vercel serverless functions have 60s limit - use it
    })

    if (!res.ok && res.status === 404) {
      return NextResponse.json(
        { success: false, error: 'profile_not_found', message: 'Instagram profile does not exist' },
        { status: 404 }
      )
    }

    const contentType = res.headers.get('content-type') || ''
    if (!contentType.includes('application/json')) {
      const text = await res.text()
      console.error(`[Instagram Audit] Non-JSON response from backend (${res.status}):`, text.substring(0, 200))
      return NextResponse.json(
        { success: false, error: 'backend_error', message: `Backend returned non-JSON response (${res.status})` },
        { status: 502 }
      )
    }

    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Proxy connection failed'
    console.error('[Instagram Audit] Error:', message)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
