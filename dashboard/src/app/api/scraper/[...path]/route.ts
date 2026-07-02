import { NextRequest, NextResponse } from 'next/server'

const BACKEND = () =>
  (process.env.V3_BACKEND_URL || process.env.WHATSAPP_SERVICE_URL || 'http://localhost:3001').replace(/\/$/, '')

// Maps frontend scraper sub-paths to the correct backend routes
function resolveBackendPath(subPath: string): string {
  // /api/scraper/recent-leads  → /api/leads/recent
  if (subPath === 'recent-leads') return '/api/leads/recent'

  // /api/scraper/jobs           → /api/jobs
  if (subPath === 'jobs') return '/api/jobs'

  // /api/scraper/{uuid}/leads   → /api/jobs/{uuid}/leads
  const jobLeadsMatch = subPath.match(/^([0-9a-f-]{36})\/leads$/)
  if (jobLeadsMatch) return `/api/jobs/${jobLeadsMatch[1]}/leads`

  // /api/scraper/start|pause|stop|resume|retry → /api/jobs/start etc.
  return `/api/jobs/${subPath}`
}

async function proxyRequest(req: NextRequest, params: { path: string[] }, method: 'GET' | 'POST') {
  const subPath = params.path.join('/')
  const backendPath = resolveBackendPath(subPath)
  const targetUrl = `${BACKEND()}${backendPath}`

  console.log(`[Scraper Proxy] ${method} /api/scraper/${subPath} → ${targetUrl}`)

  try {
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-api-secret': process.env.WHATSAPP_API_SECRET || '',
      },
    }

    if (method === 'POST') {
      const body = await req.json().catch(() => ({}))
      options.body = JSON.stringify(body)
    }

    const res = await fetch(targetUrl, options)
    const contentType = res.headers.get('content-type') || ''

    if (!contentType.includes('application/json')) {
      // Backend returned HTML or non-JSON (e.g. 404 page)
      const text = await res.text()
      console.error(`[Scraper Proxy] Non-JSON response from ${targetUrl}: ${text.slice(0, 200)}`)
      return NextResponse.json(
        { error: `Backend returned non-JSON (status ${res.status}). Path: ${backendPath}` },
        { status: 502 }
      )
    }

    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Proxy connection failed'
    console.error(`[Scraper Proxy] Request failed for ${targetUrl}:`, message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyRequest(req, params, 'POST')
}

export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyRequest(req, params, 'GET')
}
