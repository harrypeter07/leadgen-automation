import { NextRequest, NextResponse } from 'next/server'
import { MetaSettingsService } from '@/lib/meta/meta-settings-service'

// Dedicated logs endpoint for Instagram analyzer live log polling
export async function GET(req: NextRequest) {
  let dbBackendUrl = ''
  try {
    const dbSettings = await MetaSettingsService.getFromDB() as Record<string, string>
    dbBackendUrl = dbSettings.V3_BACKEND_URL || dbSettings.BACKEND_URL || ''
  } catch (err: any) {
    console.warn('[Instagram Logs] Failed to load backend URL from DB:', err.message)
  }

  const backendUrl = (
    process.env.V3_BACKEND_URL ||
    dbBackendUrl ||
    'https://leadgen-automation-production-12c6.up.railway.app'
  ).replace(/\/+$/, '')

  const apiSecret = process.env.WHATSAPP_API_SECRET || process.env.API_SECRET || ''

  try {
    const res = await fetch(`${backendUrl}/api/logs`, {
      method: 'GET',
      headers: {
        ...(apiSecret ? { 'x-api-secret': apiSecret } : {}),
      },
    })

    if (!res.ok) {
      return NextResponse.json({ logs: [] }, { status: 200 })
    }

    const contentType = res.headers.get('content-type') || ''
    if (!contentType.includes('application/json')) {
      return NextResponse.json({ logs: [] }, { status: 200 })
    }

    const data = await res.json()
    return NextResponse.json(data, { status: 200 })
  } catch (error: unknown) {
    // Graceful failure - return empty logs instead of error
    return NextResponse.json({ logs: [] }, { status: 200 })
  }
}
