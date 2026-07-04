import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { urls } = await request.json()
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json({ error: 'An array of urls is required' }, { status: 400 })
    }

    const apiKey = process.env.TINYFISH_API_KEY || 'sk-tinyfish-0YxHuvbi-dw9Hfh7ynR7mRI9HixoEoQS'

    const res = await fetch('https://api.fetch.tinyfish.ai', {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        urls: urls,
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      return NextResponse.json({ error: `TinyFish API error: ${errText}` }, { status: res.status })
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown fetch error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
