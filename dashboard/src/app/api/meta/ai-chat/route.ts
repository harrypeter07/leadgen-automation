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

    const activePersona = persona || dbSettings.AI_CHATBOT_PERSONA || `You are a friendly AI assistant representing our business...`
    const firstTurnInst = dbSettings.AI_FIRST_TURN_INSTRUCTION || `CONTEXT: FIRST MESSAGE FROM A NEW STRANGER (NEW IG DM)\nThis is the very FIRST message from this user. Greet them in a sweet, lovely, warm, and welcoming way like a real Indian girl receiving a fresh DM.`
    const ongoingTurnInst = dbSettings.AI_ONGOING_TURN_INSTRUCTION || `CONTEXT: ONGOING CONVERSATION\nContinue the chat naturally based on the previous dialogue history.`
    const systemRules = dbSettings.AI_SYSTEM_RULES || `CRITICAL INSTRUCTIONS (NEVER BREAK THESE):
- DYNAMIC LANGUAGE MATCHING (CRITICAL): Always detect the exact language of the user's latest message (e.g. Romanian, English, Spanish, Hindi/Hinglish, French, German, etc.) and ALWAYS reply in the VERY SAME LANGUAGE as the sender! Never switch languages randomly.
- Output ONLY your direct conversational message to the user.
- DO NOT include internal reasoning, thought options (e.g. *Draft 1:*), explanations, quotes, or markdown asterisks.
- Speak naturally like a real human. Never sound like a chatbot.`
    const subscriptionLink = dbSettings.AI_SUBSCRIPTION_LINK || `https://smritishans.mywebsite.social/`

    const isFirstTurn = conversationHistory.length === 0 || !conversationHistory.some((m: any) => m.role === 'system' || m.role === 'model')
    const dynamicTurnContext = isFirstTurn ? firstTurnInst : ongoingTurnInst

    const systemPrompt = `${activePersona}

${dynamicTurnContext}

${systemRules}
- Keep reply short (1-2 sentences max). Be quick and concise.
${subscriptionLink ? `- Share link ${subscriptionLink} naturally when relevant.` : ''}`

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
