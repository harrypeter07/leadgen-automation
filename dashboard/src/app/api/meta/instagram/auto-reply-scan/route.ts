import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { InstagramService } from '@/lib/meta/instagram-service'
import { ensureMetaConfig } from '@/lib/meta/runtime-config'
import { generateWithGemini } from '@/lib/gemini'

export const dynamic = 'force-dynamic'

// Processed message IDs cache to prevent duplicate replies during polling
const autoRepliedMsgIds = new Set<string>()

// POST /api/meta/instagram/auto-reply-scan
// Background polling worker that checks for unreplied incoming DMs and sends AI responses according to configured persona rules & delays
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
    const chatbotPersona = settings.AI_CHATBOT_PERSONA || 'You are Smriti, a 21-year-old Indian influencer. Talk like a real human in casual Hinglish/Hindi.'
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
      const messages = conv.messages?.data || []
      if (messages.length === 0) continue

      const latestMsg = messages[0]
      const msgId = latestMsg.id
      const messageText = latestMsg.message || ''
      const senderId = latestMsg.from?.id
      const senderUsername = latestMsg.from?.username || ''

      // Skip if we sent this message, or if message ID already processed
      if (!senderId || autoRepliedMsgIds.has(msgId)) continue
      if (senderUsername === 'smritifyp' || senderId === '17841411718913026') continue

      // Check if latest message is from lead and unreplied
      autoRepliedMsgIds.add(msgId)
      console.log(`[AutoReplyScan] Found new unreplied message from ${senderUsername} (${senderId}): "${messageText}"`)

      // 3. Send typing indicator
      try {
        await InstagramService.sendTypingIndicator(senderId, 'typing_on')
      } catch {}

      // 4. Delay wait according to conversationDelay
      if (conversationDelay > 0) {
        await new Promise(res => setTimeout(res, Math.min(conversationDelay * 1000, 5000)))
      }

      // 5. Generate reply content
      let replyText = ''
      if (staticReplyEnabled && staticReply.trim()) {
        replyText = staticReply.trim()
      } else {
        const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY || ''
        const maxTokens = responseLength === 'extra_small' ? 30 : responseLength === 'small' ? 60 : responseLength === 'medium' ? 150 : 300
        const lengthInstruction = responseLength === 'extra_small'
          ? 'Reply in MAXIMUM 5-8 words.'
          : responseLength === 'small'
          ? 'Reply in MAXIMUM 1 short sentence. Be very concise and punchy.'
          : 'Reply in 2-3 short sentences.'

        const prompt = `${chatbotPersona}

CRITICAL RULES:
- ${lengthInstruction}
- Use casual Hinglish/Hindi with natural emojis.
- Speak naturally like a real human on Instagram DM. No markdown formatting.`

        const { text } = await generateWithGemini({
          system_instruction: { parts: [{ text: prompt }] },
          contents: [{ role: 'user', parts: [{ text: messageText }] }],
          generationConfig: { maxOutputTokens: maxTokens, temperature: 0.75 }
        }, apiKey)

        replyText = text.trim()
      }

      if (replyText) {
        console.log(`[AutoReplyScan] Sending auto-reply to ${senderUsername}: "${replyText}"`)
        await InstagramService.sendDM(senderId, replyText)
        processedCount++
      }

      // 6. Turn off typing indicator
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
