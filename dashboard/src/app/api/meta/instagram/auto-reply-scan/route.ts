import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { InstagramService } from '@/lib/meta/instagram-service'
import { ensureMetaConfig } from '@/lib/meta/runtime-config'
import { generateWithGemini } from '@/lib/gemini'
import { getChatMemory, saveChatMemory, MemoryMessage } from '@/lib/meta/chat-memory'

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
// Background polling worker that inspects full conversation threads, syncs DB memory, and responds to user DMs
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
      // Fetch complete thread messages to inspect full real-time message stream
      const msgsRes = await InstagramService.getConversationMessages(conv.id, 20)
      const rawMsgs = (msgsRes.success && msgsRes.data) 
        ? ((msgsRes.data as any).data || []) 
        : (conv.messages?.data || [])

      // Sync fetched messages to DB chat memory
      if (rawMsgs.length > 0) {
        const memList: MemoryMessage[] = rawMsgs.map((m: any) => ({
          id: m.id || String(Math.random()),
          role: (m.from?.username === 'smritifyp' || m.from?.id === '17841411718913026') ? 'model' : 'user',
          text: m.message || '',
          time: m.created_time || new Date().toISOString(),
          fromUsername: m.from?.username,
        }))
        await saveChatMemory(conv.id, memList)
      }

      // Sort messages chronologically (oldest first, newest last)
      const sortedMsgs = [...rawMsgs].reverse()
      const lastMsg = sortedMsgs[sortedMsgs.length - 1]
      if (!lastMsg) continue

      const lastSenderId = lastMsg.from?.id
      const lastSenderUsername = lastMsg.from?.username

      // 1. Skip if the last message in the thread was sent by US (smritifyp)
      if (lastSenderUsername === 'smritifyp' || lastSenderId === '17841411718913026') continue

      // 2. Collect all consecutive unreplied user messages at the end of the thread
      const unrepliedUserMsgs: any[] = []
      for (let i = sortedMsgs.length - 1; i >= 0; i--) {
        const m = sortedMsgs[i]
        if (m.from?.username === 'smritifyp' || m.from?.id === '17841411718913026') break
        unrepliedUserMsgs.unshift(m)
      }

      if (unrepliedUserMsgs.length === 0) continue

      const latestUserMsg = unrepliedUserMsgs[unrepliedUserMsgs.length - 1]
      const senderId = latestUserMsg.from?.id
      const senderUsername = latestUserMsg.from?.username || ''

      // Skip if we already replied to this exact latest user message ID
      if (!senderId || autoRepliedMsgIds.has(latestUserMsg.id)) continue
      autoRepliedMsgIds.add(latestUserMsg.id)

      // Combine text of all unreplied messages sent back-to-back by the user
      const combinedUserText = unrepliedUserMsgs.map(m => m.message).filter(Boolean).join('\n')
      console.log(`[AutoReplyScan] Found ${unrepliedUserMsgs.length} unreplied message(s) from ${senderUsername}: "${combinedUserText}"`)

      // 3. Send typing indicator
      try {
        await InstagramService.sendTypingIndicator(senderId, 'typing_on')
      } catch {}

      // 4. Delay wait according to conversationDelay
      if (conversationDelay > 0) {
        await new Promise(res => setTimeout(res, Math.min(conversationDelay * 1000, 5000)))
      }

      // 5. Build full conversation history for Gemini (previous turns + new user input)
      const dbMem = await getChatMemory(conv.id)
      const convHistory = (dbMem.length > 0 ? dbMem : sortedMsgs)
        .slice(-12) // Take last 12 historical turns
        .map((m: any) => ({
          role: m.role || ((m.from?.username === 'smritifyp' || m.from?.id === '17841411718913026') ? 'model' : 'user'),
          parts: [{ text: m.text || m.message || '' }]
        }))
        .filter((m: any) => m.parts[0].text.trim().length > 0)

      if (convHistory.length === 0 || convHistory[convHistory.length - 1].parts[0].text !== combinedUserText) {
        convHistory.push({
          role: 'user',
          parts: [{ text: combinedUserText }]
        })
      }

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
          contents: convHistory,
          generationConfig: { maxOutputTokens: maxTokens, temperature: 0.75 }
        }, apiKey)

        replyText = sanitizeAiReply(text)
      }

      if (replyText) {
        console.log(`[AutoReplyScan] Sending DM reply to ${senderUsername}: "${replyText}"`)
        const sendRes = await InstagramService.sendDM(senderId, replyText)
        processedCount++

        // Save generated bot reply to DB memory
        const botMsgId = (sendRes.data as any)?.message_id || `bot_${Date.now()}`
        await saveChatMemory(conv.id, [{
          id: botMsgId,
          role: 'model',
          text: replyText,
          time: new Date().toISOString(),
          fromUsername: 'smritifyp',
        }])
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
