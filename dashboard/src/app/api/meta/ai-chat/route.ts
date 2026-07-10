import { NextRequest, NextResponse } from 'next/server'
import { ensureMetaConfig } from '@/lib/meta/runtime-config'

// POST /api/meta/ai-chat
// body: { message, conversationHistory?, persona? }
// Returns AI-generated reply for DMs/comments using Gemini
export async function POST(req: NextRequest) {
  try {
    await ensureMetaConfig()

    const { message, conversationHistory = [], persona } = await req.json()
    if (!message?.trim()) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 })
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY || ''

    const systemPersona = persona || `You are a professional business assistant responding to customer messages on social media.
Be helpful, friendly, concise (2-4 sentences max), and professional.
Always end with a soft call-to-action or invitation to continue the conversation.
Never use generic filler phrases. Sound human and genuine.`

    // Build conversation for Gemini
    const contents = [
      ...conversationHistory.map((m: { role: string; text: string }) => ({
        role: m.role === 'system' ? 'model' : 'user',
        parts: [{ text: m.text }],
      })),
      { role: 'user', parts: [{ text: message }] },
    ]

    const { generateWithGemini } = await import('@/lib/gemini')
    const { text: reply } = await generateWithGemini(
      {
        system_instruction: { parts: [{ text: systemPersona }] },
        contents,
        generationConfig: {
          maxOutputTokens: 1000,
          temperature: 0.75,
          topP: 0.9,
        },
      },
      apiKey
    )

    return NextResponse.json({ success: true, reply })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'AI generation failed' }, { status: 500 })
  }
}
