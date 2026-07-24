import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { ensureMetaConfig } from '@/lib/meta/runtime-config'

function sanitizeAiReply(text: string): string {
  if (!text) return ''
  let cleaned = text.trim()
  
  if (cleaned.includes('Draft') || cleaned.includes('* User:') || cleaned.includes('* Persona:')) {
    const quoteMatches = Array.from(cleaned.matchAll(/"([^"]+)"/g))
    if (quoteMatches.length > 0) {
      cleaned = quoteMatches[quoteMatches.length - 1][1]
    } else {
      cleaned = cleaned.replace(/\*[^*]+\*/g, '').trim()
    }
  }
  
  cleaned = cleaned.replace(/^["'`]+|["'`]+$/g, '').trim()
  return cleaned
}

// POST /api/meta/ai-chat
// body: { message, conversationHistory?, persona? }
// Returns AI-generated reply for DMs/comments using Gemini with memory & persona rules
export async function POST(req: NextRequest) {
  try {
    await ensureMetaConfig()

    const { message, conversationHistory = [], persona } = await req.json()
    if (!message?.trim()) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 })
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY || ''

    // Fetch saved persona from DB if not provided in payload
    let activePersona = persona
    if (!activePersona) {
      const { data } = await supabaseAdmin
        .from('meta_config')
        .select('value')
        .eq('key', 'AI_CHATBOT_PERSONA')
        .single()
      activePersona = data?.value || ''
    }

    const defaultPersona = `You are Smriti, a 21-year-old Indian influencer. Talk like a real human, not an AI. Use 90-95% Hindi/Hinglish in a casual WhatsApp/Instagram style. Be sweet, playful, caring, confident, and a little flirty (never explicit). Keep replies short (1-3 sentences), use emojis naturally (❤️🥹😂✨), ask follow-up questions, and make every conversation feel genuine.

Goal: Build attraction and connection. Occasionally suggest Premium if fits naturally.
Link: https://smritishans.mywebsite.social/`

    const systemPrompt = `${activePersona || defaultPersona}

CRITICAL RULES (NEVER BREAK THESE):
- Output ONLY your direct text response. DO NOT include internal reasoning, draft options (e.g. *Draft 1:*), explanations, or quotes.
- Keep reply short (1-3 sentences).
- Speak naturally like a real human Indian girl on Instagram DMs. Never sound like an AI or chatbot.
- Share link https://smritishans.mywebsite.social/ naturally when relevant.`

    // Build conversation memory history for Gemini
    const contents = [
      ...conversationHistory.map((m: { role: string; text: string }) => ({
        role: m.role === 'system' ? 'model' : 'user',
        parts: [{ text: m.text }],
      })),
      { role: 'user', parts: [{ text: message }] },
    ]

    const { generateWithGemini } = await import('@/lib/gemini')
    const { text: rawReply } = await generateWithGemini(
      {
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: {
          maxOutputTokens: 300,
          temperature: 0.75,
          topP: 0.9,
        },
      },
      apiKey
    )

    const reply = sanitizeAiReply(rawReply)
    return NextResponse.json({ success: true, reply })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'AI generation failed' }, { status: 500 })
  }
}
