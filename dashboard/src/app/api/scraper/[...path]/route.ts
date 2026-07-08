import { NextRequest, NextResponse } from 'next/server'
import { MetaSettingsService } from '@/lib/meta/meta-settings-service'

// Maps frontend scraper sub-paths to the correct backend routes
function resolveBackendPath(subPath: string): string {
  // /api/scraper/recent-leads  → /api/leads/recent
  if (subPath === 'recent-leads') return '/api/leads/recent'

  // /api/scraper/jobs           → /api/jobs
  if (subPath === 'jobs') return '/api/jobs'

  // /api/scraper/{uuid}/leads        → /api/jobs/${uuid}/leads  (GET)
  const jobLeadsMatch = subPath.match(/^([0-9a-f-]{36})\/leads$/)
  if (jobLeadsMatch) return `/api/jobs/${jobLeadsMatch[1]}/leads`

  // /api/scraper/{uuid}/save-leads   → /api/jobs/${uuid}/save-leads  (POST)
  const saveLeadsMatch = subPath.match(/^([0-9a-f-]{36})\/save-leads$/)
  if (saveLeadsMatch) return `/api/jobs/${saveLeadsMatch[1]}/save-leads`

  // /api/scraper/whatsapp-scan/start|stop|status → /api/whatsapp-scan/start etc.
  if (subPath.startsWith('whatsapp-scan/')) {
    return `/api/${subPath}`
  }

  // /api/scraper/start|pause|stop|resume|retry → /api/jobs/start etc.
  return `/api/jobs/${subPath}`
}

function getValidUrl(url: string | null): string | null {
  if (!url) return null
  const trimmed = url.trim()
  if (trimmed === '' || trimmed === 'undefined' || trimmed === 'null') return null
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) return null
  return trimmed
}

async function proxyRequest(req: NextRequest, params: { path: string[] }, method: 'GET' | 'POST') {
  const subPath = params.path.join('/')
  const backendPath = resolveBackendPath(subPath)

  // Query fallback backend URL from DB if not defined in headers or env
  let dbBackendUrl = ''
  try {
    const dbSettings = await MetaSettingsService.getFromDB() as Record<string, string>
    dbBackendUrl = dbSettings.V3_BACKEND_URL || dbSettings.WHATSAPP_SERVICE_URL || dbSettings.BACKEND_URL || ''
  } catch (err: any) {
    console.warn('[Scraper Proxy] Failed to load backend URL fallback from DB:', err.message)
  }

  // Get routing inputs from frontend custom headers
  const primaryUrl = getValidUrl(req.headers.get('x-backend-primary')) || 
                     getValidUrl(process.env.V3_BACKEND_URL) || 
                     getValidUrl(dbBackendUrl) || 
                     getValidUrl(process.env.WHATSAPP_SERVICE_URL) || 
                     'https://scraper-auto.up.railway.app'
  const secondaryUrl = getValidUrl(req.headers.get('x-backend-secondary')) || ''
  const mode = req.headers.get('x-backend-mode') || 'primary'

  const cleanUrl = (url: string) => url.replace(/\/$/, '')

  const targets: string[] = []
  if (mode === 'primary' && primaryUrl) {
    targets.push(cleanUrl(primaryUrl))
  } else if (mode === 'secondary' && secondaryUrl) {
    targets.push(cleanUrl(secondaryUrl))
  } else if (mode === 'both') {
    if (primaryUrl) targets.push(cleanUrl(primaryUrl))
    if (secondaryUrl) targets.push(cleanUrl(secondaryUrl))
  }

  if (targets.length === 0) {
    targets.push(cleanUrl(primaryUrl))
  }

  // Helper to proxy to a single target URL
  const proxyToTarget = async (target: string, bodyJson?: any) => {
    const targetUrl = `${target}${backendPath}`
    console.log(`[Scraper Proxy] ${method} /api/scraper/${subPath} → ${targetUrl}`)

    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-api-secret': process.env.WHATSAPP_API_SECRET || '',
      },
    }

    if (method === 'POST' && bodyJson) {
      options.body = JSON.stringify(bodyJson)
    }

    const res = await fetch(targetUrl, options)
    const contentType = res.headers.get('content-type') || ''

    if (!contentType.includes('application/json')) {
      const text = await res.text()
      throw new Error(`Non-JSON response from ${targetUrl} (Status ${res.status}): ${text.slice(0, 100)}`)
    }

    const data = await res.json()
    return { data, status: res.status }
  }

  // Parse body once for POST requests
  let bodyJson: any = null
  if (method === 'POST') {
    bodyJson = await req.json().catch(() => ({}))
  }

  if (targets.length === 1) {
    try {
      const result = await proxyToTarget(targets[0], bodyJson)
      return NextResponse.json(result.data, { status: result.status })
    } catch (error: any) {
      console.error(`[Scraper Proxy] Request failed for ${targets[0]}${backendPath}:`, error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  // Dual broadcasting mode
  console.log(`[Scraper Proxy] Dual proxy to targets: ${targets.join(', ')}`)
  const promises = targets.map(target =>
    proxyToTarget(target, bodyJson)
      .then(res => ({ success: true, error: null, ...res }))
      .catch(err => ({ success: false, error: err.message, status: 500, data: null }))
  )

  const results = await Promise.all(promises)
  const successes = results.filter(r => r.success)

  if (successes.length === 0) {
    return NextResponse.json(
      { error: `Both backend requests failed. Errors: ${results.map(r => r.error).join(' | ')}` },
      { status: 502 }
    )
  }

  // Merge responses depending on subPath
  if (subPath === 'jobs') {
    const allJobsMap = new Map<string, any>()
    let isPausedAny = false

    for (const res of successes) {
      if (res.data) {
        if (res.data.isPaused) isPausedAny = true
        const jobsList = res.data.jobs || []
        for (const job of jobsList) {
          if (job && job.id) {
            allJobsMap.set(job.id, job)
          }
        }
      }
    }

    const mergedJobs = Array.from(allJobsMap.values()).sort((a, b) => {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

    return NextResponse.json({ jobs: mergedJobs, isPaused: isPausedAny })
  }

  const jobLeadsMatch = subPath.match(/^([0-9a-f-]{36})\/leads$/)
  if (jobLeadsMatch) {
    const allLeadsMap = new Map<string, any>()
    for (const res of successes) {
      if (res.data && res.data.leads) {
        for (const lead of res.data.leads) {
          const key = `${(lead.name || '').toLowerCase()}|${(lead.phone || '').replace(/\s/g, '')}`
          allLeadsMap.set(key, lead)
        }
      }
    }
    return NextResponse.json({ leads: Array.from(allLeadsMap.values()) })
  }

  // Return the first successful response
  const firstSuccess = successes[0]
  return NextResponse.json(firstSuccess.data, { status: firstSuccess.status })
}

export async function POST(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyRequest(req, params, 'POST')
}

export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyRequest(req, params, 'GET')
}
