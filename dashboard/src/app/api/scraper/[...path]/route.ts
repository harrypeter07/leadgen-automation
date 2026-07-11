import { NextRequest, NextResponse } from 'next/server'
import { MetaSettingsService } from '@/lib/meta/meta-settings-service'
import { generateWithGemini } from '@/lib/gemini'

async function getGeographicalSubLocations(city: string, area?: string): Promise<Array<string | { city: string, area: string }>> {
  const cleanCity = city.trim()
  const cleanArea = area?.trim() || ''
  
  const targetName = cleanArea ? `${cleanCity} [Area: ${cleanArea}]` : cleanCity

  const prompt = `
You are a geographical division engine.
Your task is to split a target location query into exactly 8 distinct sub-locations (cities, states, districts, neighborhoods, or sectors depending on geographical scale) so that a web scraper can crawl them concurrently to cover the entire target location.

Scale rules:
1. If the target is "Global", return exactly 8 major countries, prefixed with "Country: " (e.g. ["Country: United States", "Country: United Kingdom", "Country: India", "Country: Canada", "Country: Australia", "Country: Germany", "Country: France", "Country: Sweden"]).
2. If the target starts with "Country: " (e.g., "Country: India"), return exactly 8 major cities in that country as simple strings (e.g. ["Mumbai", "Delhi", "Bangalore", ...]).
3. If the target is a State/Province/Region (e.g. "California", "Maharashtra"), return exactly 8 major cities/counties/districts in that state as simple strings (e.g. ["Los Angeles", "San Diego", ...]).
4. If the target is a City (e.g. "Nagpur", "New York"), return exactly 8 prominent neighborhoods, districts, or areas inside that city as JSON objects.
   Format: {"city": "CityName", "area": "NeighborhoodName"}
   Example: [{"city": "Nagpur", "area": "Civil Lines"}, {"city": "Nagpur", "area": "Dharampeth"}, ...]
5. If the target is a neighborhood or small area (e.g. "Nagpur [Area: Civil Lines]"), return exactly 8 smaller sub-regions, blocks, sectors, or streets in that neighborhood as JSON objects.
   Format: {"city": "ParentTargetName", "area": "SubAreaName"}
   Example: [{"city": "Nagpur [Area: Civil Lines]", "area": "Sector 1"}, {"city": "Nagpur [Area: Civil Lines]", "area": "Block A"}, ...]

Target Location: "${targetName}"

Return ONLY a clean JSON array containing exactly 8 elements.
Do NOT include markdown syntax like \`\`\`json, do NOT include explanations, do NOT return anything other than the JSON array.
`;

  try {
    const payload = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }]
    }
    
    const { text } = await generateWithGemini(payload, '')
    const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim()
    const parsed = JSON.parse(cleanJson)
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed
    }
  } catch (err: any) {
    console.warn(`[Scraper Proxy] Gemini geographical division failed for ${targetName}:`, err.message)
  }

  // Fallbacks:
  if (cleanCity === 'Global') {
    return [
      'Country: United States', 'Country: United Kingdom', 'Country: India', 'Country: Canada',
      'Country: Australia', 'Country: Germany', 'Country: France', 'Country: Sweden'
    ]
  }

  if (cleanCity.startsWith('Country: ')) {
    const countryName = cleanCity.replace('Country: ', '').trim().toLowerCase()
    const countryMap: Record<string, string[]> = {
      'sweden': ['Stockholm', 'Gothenburg', 'Malmo', 'Uppsala', 'Vasteras', 'Orebro', 'Linkoping', 'Helsingborg'],
      'india': ['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai', 'Ahmedabad', 'Pune', 'Kolkata'],
      'usa': ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio', 'San Diego'],
      'united states': ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio', 'San Diego'],
      'uk': ['London', 'Birmingham', 'Leeds', 'Glasgow', 'Sheffield', 'Bradford', 'Liverpool', 'Edinburgh'],
      'united kingdom': ['London', 'Birmingham', 'Leeds', 'Glasgow', 'Sheffield', 'Bradford', 'Liverpool', 'Edinburgh'],
      'canada': ['Toronto', 'Montreal', 'Vancouver', 'Calgary', 'Edmonton', 'Ottawa', 'Winnipeg', 'Quebec City'],
      'australia': ['Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Adelaide', 'Gold Coast', 'Canberra', 'Newcastle'],
      'germany': ['Berlin', 'Hamburg', 'Munich', 'Cologne', 'Frankfurt', 'Stuttgart', 'Dusseldorf', 'Dortmund'],
      'france': ['Paris', 'Marseille', 'Lyon', 'Toulouse', 'Nice', 'Nantes', 'Strasbourg', 'Montpellier'],
      'uae': ['Dubai', 'Abu Dhabi', 'Sharjah', 'Al Ain', 'Ajman', 'Ras Al Khaimah', 'Fujairah', 'Umm Al Quwain'],
      'united arab emirates': ['Dubai', 'Abu Dhabi', 'Sharjah', 'Al Ain', 'Ajman', 'Ras Al Khaimah', 'Fujairah', 'Umm Al Quwain']
    }
    const list = countryMap[countryName]
    if (list) return list
  }

  const parentCity = cleanCity
  const subAreaName = cleanArea || 'Center'
  return [
    { city: parentCity, area: `${subAreaName} North` },
    { city: parentCity, area: `${subAreaName} South` },
    { city: parentCity, area: `${subAreaName} East` },
    { city: parentCity, area: `${subAreaName} West` },
    { city: parentCity, area: `${subAreaName} Central` },
    { city: parentCity, area: `${subAreaName} Plaza` },
    { city: parentCity, area: `${subAreaName} Downtown` },
    { city: parentCity, area: `${subAreaName} Heights` }
  ]
}

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

  // /api/scraper/enrich/... → /api/enrich/...
  if (subPath.startsWith('enrich/')) {
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
  let dbSecondaryUrl = ''
  try {
    const dbSettings = await MetaSettingsService.getFromDB() as Record<string, string>
    dbBackendUrl = dbSettings.V3_BACKEND_URL || dbSettings.WHATSAPP_SERVICE_URL || dbSettings.BACKEND_URL || ''
    dbSecondaryUrl = dbSettings.V3_BACKEND_URL_SECONDARY || dbSettings.BACKEND_URL || ''
  } catch (err: any) {
    console.warn('[Scraper Proxy] Failed to load backend URL fallback from DB:', err.message)
  }

  // Get routing inputs from frontend custom headers
  const primaryUrl = getValidUrl(req.headers.get('x-backend-primary')) || 
                     getValidUrl(process.env.V3_BACKEND_URL ?? null) || 
                     getValidUrl(dbBackendUrl) || 
                     'https://scraper-auto.up.railway.app'
  const secondaryUrl = getValidUrl(req.headers.get('x-backend-secondary')) || 
                       getValidUrl(process.env.V3_BACKEND_URL_SECONDARY ?? null) ||
                       getValidUrl(dbSecondaryUrl) ||
                       'https://leadgen-automation-production-12c6.up.railway.app'
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
  
  let promises: Promise<any>[] = []

  if (subPath === 'start' && targets.length === 2 && bodyJson) {
    const keyword = bodyJson.keyword || ''
    const city = bodyJson.city || ''
    const area = bodyJson.area || ''
    
    console.log(`[Scraper Proxy] Performing dynamic geographical splitting for "${city}" [Area: ${area}] via Gemini/Fallback...`)
    const targetCities = await getGeographicalSubLocations(city, area)
    console.log(`[Scraper Proxy] Generated ${targetCities.length} sub-locations:`, JSON.stringify(targetCities))

    const mid = Math.ceil(targetCities.length / 2)
    const citiesA = targetCities.slice(0, mid)
    const citiesB = targetCities.slice(mid)
    const batchId = `batch_${city.replace(/\s+/g, '_')}_${Date.now()}`

    const bodyA = { ...bodyJson, cities: citiesA, batch_id: batchId }
    const bodyB = { ...bodyJson, cities: citiesB, batch_id: batchId }

    console.log(`[Scraper Proxy] Splitting batch job: enqueuing ${citiesA.length} locations on Target A and ${citiesB.length} locations on Target B with batch_id: ${batchId}`)

    promises = [
      proxyToTarget(targets[0], bodyA)
        .then(res => ({ success: true, error: null, ...res }))
        .catch(err => ({ success: false, error: err.message, status: 500, data: null })),
      proxyToTarget(targets[1], bodyB)
        .then(res => ({ success: true, error: null, ...res }))
        .catch(err => ({ success: false, error: err.message, status: 500, data: null }))
    ]
  } else {
    promises = targets.map(target =>
      proxyToTarget(target, bodyJson)
        .then(res => ({ success: true, error: null, ...res }))
        .catch(err => ({ success: false, error: err.message, status: 500, data: null }))
    )
  }

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
