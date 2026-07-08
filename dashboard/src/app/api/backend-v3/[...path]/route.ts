import { NextRequest, NextResponse } from 'next/server'
import { MetaSettingsService } from '@/lib/meta/meta-settings-service'

function getTargetUrl(baseUrl: string, subPath: string) {
  let formatted = baseUrl.trim()
  if (!formatted.startsWith('http://') && !formatted.startsWith('https://')) {
    formatted = `https://${formatted}`
  }
  // Remove trailing slashes
  formatted = formatted.replace(/\/+$/, '')
  return `${formatted}/api/${subPath}`
}

export async function POST(req: NextRequest, { params }: { params: { path: string[] } }) {
  // Query fallback backend URL from DB if not defined in env
  let dbBackendUrl = ''
  try {
    const dbSettings = await MetaSettingsService.getFromDB() as Record<string, string>
    dbBackendUrl = dbSettings.V3_BACKEND_URL || dbSettings.WHATSAPP_SERVICE_URL || dbSettings.BACKEND_URL || ''
  } catch (err: any) {
    console.warn('[Backend-V3 Proxy] Failed to load backend URL fallback from DB:', err.message)
  }

  const backendUrl = process.env.V3_BACKEND_URL || dbBackendUrl || process.env.WHATSAPP_SERVICE_URL || 'https://scraper-auto.up.railway.app'
  if (!backendUrl) {
    return NextResponse.json({ error: 'V3_BACKEND_URL not configured' }, { status: 500 })
  }

  const subPath = params.path.join('/')
  const targetUrl = getTargetUrl(backendUrl, subPath)

  try {
    const body = await req.json().catch(() => ({}))
    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-secret': process.env.WHATSAPP_API_SECRET || '',
      },
      body: JSON.stringify(body)
    })

    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Proxy connection failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  // Query fallback backend URL from DB if not defined in env
  let dbBackendUrl = ''
  try {
    const dbSettings = await MetaSettingsService.getFromDB() as Record<string, string>
    dbBackendUrl = dbSettings.V3_BACKEND_URL || dbSettings.WHATSAPP_SERVICE_URL || dbSettings.BACKEND_URL || ''
  } catch (err: any) {
    console.warn('[Backend-V3 Proxy] Failed to load backend URL fallback from DB:', err.message)
  }

  const backendUrl = process.env.V3_BACKEND_URL || dbBackendUrl || process.env.WHATSAPP_SERVICE_URL || 'https://scraper-auto.up.railway.app'
  if (!backendUrl) {
    return NextResponse.json({ error: 'V3_BACKEND_URL not configured' }, { status: 500 })
  }

  const subPath = params.path.join('/')
  const targetUrl = getTargetUrl(backendUrl, subPath)

  try {
    const res = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'x-api-secret': process.env.WHATSAPP_API_SECRET || '',
      },
    })

    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Proxy connection failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
