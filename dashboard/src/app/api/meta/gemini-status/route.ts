import { NextRequest, NextResponse } from 'next/server'

// POST /api/meta/gemini-status
// Checks the status and quota limits of a Gemini API key by calling the listModels endpoint
export async function POST(req: NextRequest) {
  try {
    const { apiKey } = await req.json()
    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'API key is required' }, { status: 400 })
    }

    console.log('[GeminiStatus] Testing API key:', apiKey.slice(0, 8) + '...')

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    const data = await res.json()

    if (!res.ok) {
      const statusCode = res.status
      const errorMsg = data.error?.message || 'Unknown API error'
      const errorStatus = data.error?.status || 'UNKNOWN'

      console.warn(`[GeminiStatus] API key verification failed (${statusCode}):`, errorMsg)

      if (statusCode === 429 || errorStatus === 'RESOURCE_EXHAUSTED') {
        return NextResponse.json({
          success: false,
          status: 'limit_reached',
          error: 'Quota Exceeded / Limit Reached'
        })
      }

      if (statusCode === 400 || statusCode === 401 || errorStatus === 'INVALID_ARGUMENT') {
        return NextResponse.json({
          success: false,
          status: 'invalid_key',
          error: 'Invalid/Expired API Key'
        })
      }

      return NextResponse.json({
        success: false,
        status: 'error',
        error: errorMsg
      })
    }

    // Key is active! Parse available models
    const models: any[] = data.models || []
    const availableModels = models
      .map((m: any) => m.name?.replace('models/', ''))
      .filter((name: string) => name && (name.includes('flash') || name.includes('pro')))

    console.log(`[GeminiStatus] API key is active. Found ${availableModels.length} models.`)

    return NextResponse.json({
      success: true,
      status: 'active',
      models: availableModels
    })
  } catch (err: any) {
    console.error('[GeminiStatus] Connection error:', err.message)
    return NextResponse.json({
      success: false,
      status: 'error',
      error: `Network Connection Error: ${err.message}`
    }, { status: 500 })
  }
}
