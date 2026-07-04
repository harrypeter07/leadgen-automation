import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('query')
  if (!query) {
    return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 })
  }

  const location = searchParams.get('location') || 'US'
  const language = searchParams.get('language') || 'en'
  const page = searchParams.get('page') || '0'

  const apiKey = process.env.TINYFISH_API_KEY || 'sk-tinyfish-0YxHuvbi-dw9Hfh7ynR7mRI9HixoEoQS'

  try {
    const targetUrl = new URL('https://api.search.tinyfish.ai')
    targetUrl.searchParams.append('query', query)
    targetUrl.searchParams.append('location', location)
    targetUrl.searchParams.append('language', language)
    targetUrl.searchParams.append('page', page)

    const res = await fetch(targetUrl.toString(), {
      method: 'GET',
      headers: {
        'X-API-Key': apiKey,
      },
    })

    if (!res.ok) {
      const errText = await res.text()
      return NextResponse.json({ error: `TinyFish API error: ${errText}` }, { status: res.status })
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown search error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
