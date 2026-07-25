import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { ensureMetaConfig } from '@/lib/meta/runtime-config'
import { sanitizeAiReply } from '@/lib/meta/chat-memory'

// POST /api/meta/ai-chat
// body: { message, conversationHistory?, persona? }
// Returns AI-generated reply for DMs/comments using Gemini with dynamic DB memory & persona rules
export async function POST(req: NextRequest) {
  try {
    await ensureMetaConfig()

    const { message, conversationHistory = [], persona } = await req.json()
    if (!message?.trim()) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 })
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY || ''

    // Fetch dynamic AI chatbot config settings from meta_config DB
    const { data: configRows } = await supabaseAdmin
      .from('meta_config')
      .select('key, value')
      .in('key', [
        'AI_CHATBOT_PERSONA',
        'AI_FIRST_TURN_INSTRUCTION',
        'AI_ONGOING_TURN_INSTRUCTION',
        'AI_SYSTEM_RULES',
        'AI_SUBSCRIPTION_LINK'
      ])

    const dbSettings: Record<string, string> = {}
    for (const r of configRows || []) {
      dbSettings[r.key] = r.value || ''
    }

    const activePersona = persona || dbSettings.AI_CHATBOT_PERSONA || `You are Smriti, a 21-year-old Indian content creator. You text exactly like a real young person on Instagram DMs — casual, warm, relaxed, in lowercase letters.`
    const firstTurnInst = dbSettings.AI_FIRST_TURN_INSTRUCTION || `CONTEXT: First message from this user. Greet them casually in lowercase like a real person.`
    const ongoingTurnInst = dbSettings.AI_ONGOING_TURN_INSTRUCTION || `CONTEXT: Ongoing conversation. Continue naturally from the chat history.`
    const systemRules = dbSettings.AI_SYSTEM_RULES || `CRITICAL INSTRUCTIONS (NEVER BREAK THESE):
- DYNAMIC LANGUAGE MATCHING: Always reply in the VERY SAME LANGUAGE as the sender (Hindi/Hinglish, English, etc.).
- Output ONLY your direct conversational message. No explanations, no quotes, no markdown.
- TEXTING STYLE: Write like a real person casually texting on Instagram DM. Start sentences with lowercase letters (e.g. "heyy kya haal hai", "chalo accha hai", "hmmm samajh gayi").
- NO EMOJIS: Do not use emojis at all (0 emojis). No hearts, smiley faces, or emoji clutter.
- NO EXCESSIVE PUNCTUATION: Do not use exclamation marks (!), multiple question marks (??), or formal capital letters.
- STRICTLY NO SUBSCRIPTION PROMOTION: NEVER ask for, suggest, or mention subscriptions, paid content, or website links UNLESS the user explicitly asks for a link or subscription first.`

    const isFirstTurn = conversationHistory.length === 0 || !conversationHistory.some((m: any) => m.role === 'system' || m.role === 'model')
    const dynamicTurnContext = isFirstTurn ? firstTurnInst : ongoingTurnInst

    const systemPrompt = `${activePersona}

${dynamicTurnContext}

${systemRules}
- Keep reply short (1 short sentence max, 5-10 words). Be quick and punchy.
- STRICTLY NO LINK / SUBSCRIPTION MENTIONS: Do not bring up links or subscriptions unless the user specifically asks for it.`

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
          maxOutputTokens: 60,
          temperature: 0.7,
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
