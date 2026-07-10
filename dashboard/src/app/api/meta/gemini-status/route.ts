import { NextRequest, NextResponse } from 'next/server'

// POST /api/meta/gemini-status
// Checks the status, validity, and active quota of a Gemini API key by performing a test generation call
export async function POST(req: NextRequest) {
  try {
    const { apiKey } = await req.json()
    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'API key is required' }, { status: 400 })
    }

    const keyAbbr = apiKey.slice(0, 8) + '...'
    console.log('[GeminiStatus] Actively testing API key:', keyAbbr)

    // Step 1: Active generation check to verify remaining quota (not just key validity)
    const testGenUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`
    let isQuotaExhausted = false
    let isInvalidKey = false
    let testErrorMsg = ''

    try {
      const genRes = await fetch(testGenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'OK' }] }]
        })
      })

      if (!genRes.ok) {
        const genData = await genRes.json()
        const genErr = genData.error || {}
        testErrorMsg = genErr.message || 'Verification call failed'
        
        if (genRes.status === 429 || genErr.status === 'RESOURCE_EXHAUSTED') {
          isQuotaExhausted = true
        } else if (genRes.status === 400 || genRes.status === 401 || genErr.status === 'INVALID_ARGUMENT') {
          isInvalidKey = true
        }
      }
    } catch (err: any) {
      console.warn('[GeminiStatus] Pre-flight generation call errored:', err.message)
    }

    if (isInvalidKey) {
      return NextResponse.json({
        success: false,
        status: 'invalid_key',
        error: 'Invalid/Expired API Key'
      })
    }

    if (isQuotaExhausted) {
      return NextResponse.json({
        success: false,
        status: 'limit_reached',
        error: 'Quota Exceeded / Limit Reached (429)'
      })
    }

    // Step 2: Fetch available models since quota test passed
    const listModelsUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    const res = await fetch(listModelsUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })

    const data = await res.json()

    if (!res.ok) {
      const statusCode = res.status
      const errorMsg = data.error?.message || 'Unknown API error'
      const errorStatus = data.error?.status || 'UNKNOWN'

      if (statusCode === 429 || errorStatus === 'RESOURCE_EXHAUSTED') {
        return NextResponse.json({
          success: false,
          status: 'limit_reached',
          error: 'Quota Exceeded / Limit Reached'
        })
      }

      return NextResponse.json({
        success: false,
        status: 'error',
        error: errorMsg
      })
    }

    // Key is active and has remaining quota!
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
