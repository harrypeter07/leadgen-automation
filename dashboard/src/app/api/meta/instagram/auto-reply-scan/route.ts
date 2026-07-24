import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { InstagramService } from '@/lib/meta/instagram-service'
import { ensureMetaConfig } from '@/lib/meta/runtime-config'
import { generateWithGemini } from '@/lib/gemini'

export const dynamic = 'force-dynamic'

const autoRepliedMsgIds = new Set<string>()

// Helper to clean internal thinking tags or draft options from Gemini output
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

// POST /api/meta/instagram/auto-reply-scan
// Background polling worker that checks for unreplied incoming DMs and sends AI responses with full chat history & persona compliance
export async function POST() {
  try {
    await ensureMetaConfig()

    // 1. Load Auto-Reply Settings from meta_config
    const { data: configRows } = await supabaseAdmin
      .from('meta_config')
      .select('key, value')
      .in('key', [
        'AUTO_REPLY_RULES',
        'AI_CHATBOT_ENABLED',
        'AI_CHATBOT_PERSONA',
        'AI_FIRST_REPLY_DELAY',
        'AI_CONVERSATION_DELAY',
        'AI_STATIC_REPLY_OVERRIDE',
        'AI_STATIC_REPLY_ENABLED',
        'AI_RESPONSE_LENGTH'
      ])

    const settings: Record<string, string> = {}
    for (const r of configRows || []) {
      settings[r.key] = r.value || ''
    }

    const chatbotEnabled = settings.AI_CHATBOT_ENABLED === 'true'
    const staticReplyEnabled = settings.AI_STATIC_REPLY_ENABLED === 'true'
    const staticReply = settings.AI_STATIC_REPLY_OVERRIDE || ''
    const chatbotPersona = settings.AI_CHATBOT_PERSONA || `You are Smriti, a 21-year-old Indian influencer. Talk like a real human, not an AI. Use 90-95% Hindi/Hinglish in a casual WhatsApp/Instagram style. Be sweet, playful, caring, confident, and a little flirty (never explicit). Keep replies short (1-3 sentences), use emojis naturally (❤️🥹😂✨), ask follow-up questions, and make every conversation feel genuine.

Goal: Build attraction and connection. Occasionally suggest Premium if fits naturally.
Link: https://smritishans.mywebsite.social/`
    
    const responseLength = (settings.AI_RESPONSE_LENGTH || 'small') as 'extra_small' | 'small' | 'medium' | 'large'
    const conversationDelay = Number(settings.AI_CONVERSATION_DELAY || 2)

    if (!chatbotEnabled && !staticReplyEnabled) {
      return NextResponse.json({ success: true, message: 'Auto-reply bot disabled' })
    }

    // 2. Fetch latest conversations
    const convsRes = await InstagramService.getMessages(10)
    if (!convsRes.success || !convsRes.data) {
      return NextResponse.json({ success: false, error: 'Could not fetch Instagram conversations' })
    }

    const conversations = (convsRes.data as any).data || []
    let processedCount = 0

    for (const conv of conversations) {
      const rawMessages = conv.messages?.data || []
      if (rawMessages.length === 0) continue

      const latestMsg = rawMessages[0]
      const msgId = latestMsg.id
      const messageText = latestMsg.message || ''
      const senderId = latestMsg.from?.id
      const senderUsername = latestMsg.from?.username || ''

      // Skip if we sent this message, or if message ID already processed
      if (!senderId || autoRepliedMsgIds.has(msgId)) continue
      if (senderUsername === 'smritifyp' || senderId === '17841411718913026') continue

      autoRepliedMsgIds.add(msgId)
      console.log(`[AutoReplyScan] Processing new message from ${senderUsername}: "${messageText}"`)

      // 3. Send typing indicator
      try {
        await InstagramService.sendTypingIndicator(senderId, 'typing_on')
      } catch {}

      // 4. Delay wait according to conversationDelay
      if (conversationDelay > 0) {
        await new Promise(res => setTimeout(res, Math.min(conversationDelay * 1000, 5000)))
      }

      // 5. Build full conversation history (up to 10 past turns)
      const convHistory = rawMessages
        .slice(0, 10)
        .reverse()
        .map((m: any) => ({
          role: (m.from?.username === 'smritifyp' || m.from?.id === '17841411718913026') ? 'model' : 'user',
          parts: [{ text: m.message || '' }]
        }))
        .filter((m: any) => m.parts[0].text.trim().length > 0)

      // 6. Generate reply content
      let replyText = ''
      if (staticReplyEnabled && staticReply.trim()) {
        replyText = staticReply.trim()
      } else {
        const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY || ''
        const maxTokens = responseLength === 'extra_small' ? 40 : responseLength === 'small' ? 90 : responseLength === 'medium' ? 180 : 350
        const lengthInstruction = responseLength === 'extra_small'
          ? 'Reply in MAXIMUM 5-8 words.'
          : responseLength === 'small'
          ? 'Reply in 1-2 short sentences. Be concise and punchy.'
          : 'Reply in 2-3 short sentences.'

        const prompt = `${chatbotPersona}

CRITICAL RULES (NEVER BREAK THESE):
- Output ONLY your direct text response. DO NOT include internal reasoning, draft options (e.g. *Draft 1:*), explanations, or quotes.
- ${lengthInstruction}
- Speak naturally like a real human Indian girl on Instagram DMs. Never sound like an AI or chatbot.
- Share link https://smritishans.mywebsite.social/ naturally when relevant.`

        const { text } = await generateWithGemini({
          system_instruction: { parts: [{ text: prompt }] },
          contents: convHistory.length > 0 ? convHistory : [{ role: 'user', parts: [{ text: messageText }] }],
          generationConfig: { maxOutputTokens: maxTokens, temperature: 0.75 }
        }, apiKey)

        replyText = sanitizeAiReply(text)
      }

      if (replyText) {
        console.log(`[AutoReplyScan] Sending sanitized auto-reply to ${senderUsername}: "${replyText}"`)
        await InstagramService.sendDM(senderId, replyText)
        processedCount++
      }

      // 7. Turn off typing indicator
      try {
        await InstagramService.sendTypingIndicator(senderId, 'typing_off')
      } catch {}
    }

    return NextResponse.json({ success: true, processedCount })
  } catch (err: any) {
    console.error('[AutoReplyScan] Error:', err.message)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
