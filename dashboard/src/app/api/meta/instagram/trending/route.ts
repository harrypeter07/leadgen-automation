import { NextRequest, NextResponse } from 'next/server'
import { ensureMetaConfig } from '@/lib/meta/runtime-config'

// POST /api/meta/instagram/trending
// body: { topic, platform?: 'instagram' | 'facebook' }
// Uses Gemini to search and generate trending content ideas, strategies, and hashtags for the topic
export async function POST(req: NextRequest) {
  try {
    await ensureMetaConfig()
    const { topic, platform = 'instagram' } = await req.json()

    if (!topic?.trim()) {
      return NextResponse.json({ error: 'topic is required' }, { status: 400 })
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY || ''
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 503 })
    }

    const prompt = `Research and generate trending social media content ideas for the platform "${platform}" in the business niche "${topic}".
Include:
1. Top 4 trending hashtags currently active.
2. 3 highly engaging post/reel ideas (title, media recommendation, copy, hook).
3. The overall current audience sentiment or interest direction.

Provide the response as a JSON structure:
{
  "niche": "string",
  "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4"],
  "sentiment": "string",
  "ideas": [
    {
      "title": "string",
      "hook": "string",
      "description": "string",
      "copy": "string",
      "mediaSuggestion": "string"
    }
  ]
}

Only return raw JSON format without markdown blocks.`

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: 500,
            temperature: 0.7,
            responseMimeType: 'application/json'
          },
        }),
      }
    )

    if (!geminiRes.ok) {
      const errText = await geminiRes.text()
      return NextResponse.json({ error: `Gemini API error: ${errText}` }, { status: geminiRes.status })
    }

    const geminiData = await geminiRes.json()
    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
    const parsed = JSON.parse(rawText)

    return NextResponse.json({ success: true, ...parsed })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
