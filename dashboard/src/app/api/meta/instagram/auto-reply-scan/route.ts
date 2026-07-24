import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { InstagramService } from '@/lib/meta/instagram-service'
import { ensureMetaConfig } from '@/lib/meta/runtime-config'
import { generateWithGemini } from '@/lib/gemini'
import { getChatMemory, saveChatMemory, sanitizeAiReply, MemoryMessage } from '@/lib/meta/chat-memory'

export const dynamic = 'force-dynamic'

const autoRepliedMsgIds = new Set<string>()
const lastRepliedTimestampMap = new Map<string, number>()

// POST /api/meta/instagram/auto-reply-scan
// Background polling worker that inspects full conversation threads, syncs DB memory, respects per-chat autopilot overrides, and dynamically builds AI prompts from meta_config DB settings
export async function POST() {
  try {
    await ensureMetaConfig()

    // 1. Load Auto-Reply Settings & Dynamic Prompt Directives from meta_config
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
        'AI_RESPONSE_LENGTH',
        'THREAD_AUTOPILOT_OVERRIDES',
        'AI_FIRST_TURN_INSTRUCTION',
        'AI_ONGOING_TURN_INSTRUCTION',
        'AI_SYSTEM_RULES',
        'AI_SUBSCRIPTION_LINK'
      ])

    const settings: Record<string, string> = {}
    for (const r of configRows || []) {
      settings[r.key] = r.value || ''
    }

    const chatbotEnabled = settings.AI_CHATBOT_ENABLED === 'true'
    const staticReplyEnabled = settings.AI_STATIC_REPLY_ENABLED === 'true'
    const staticReply = settings.AI_STATIC_REPLY_OVERRIDE || ''
    
    const chatbotPersona = settings.AI_CHATBOT_PERSONA || `You are Smriti, a 21-year-old Indian influencer. Talk like a real human, not an AI. Use 90-95% Hindi/Hinglish in a casual WhatsApp/Instagram style. Be sweet, playful, caring, confident, and a little flirty (never explicit). Keep replies short (1-3 sentences), use emojis naturally (❤️🥹😂✨), ask follow-up questions, and make every conversation feel genuine.`

    const firstTurnInst = settings.AI_FIRST_TURN_INSTRUCTION || `CONTEXT: FIRST MESSAGE FROM A NEW STRANGER (NEW IG DM)\nThis is the very FIRST message from this user.\n- Greet them in a sweet, lovely, warm, and welcoming way like a real Indian girl receiving a fresh DM.\n- Say something cute, lovely, and short like "Heyy! Boliye? 😊✨", "Hii! Kaise ho? ❤️", or "Hey! Thanks for messaging ✨".\n- DO NOT act like you already know them well, and DO NOT ask heavy personal questions or how their whole day went yet on message #1.`

    const ongoingTurnInst = settings.AI_ONGOING_TURN_INSTRUCTION || `CONTEXT: ONGOING CONVERSATION\nContinue the chat naturally based on the previous dialogue history.`

    const systemRules = settings.AI_SYSTEM_RULES || `CRITICAL INSTRUCTIONS (NEVER BREAK THESE):\n- Output ONLY your direct conversational message to the user.\n- DO NOT include internal reasoning, thought options (e.g. *Draft 1:*), explanations, quotes, or markdown asterisks.\n- Speak naturally like a real human. Never sound like a chatbot.`

    const subscriptionLink = settings.AI_SUBSCRIPTION_LINK || `https://smritishans.mywebsite.social/`

    const responseLength = (settings.AI_RESPONSE_LENGTH || 'small') as 'extra_small' | 'small' | 'medium' | 'large'
    const conversationDelay = Number(settings.AI_CONVERSATION_DELAY || 3)

    let threadOverrides: Record<string, boolean> = {}
    try {
      threadOverrides = settings.THREAD_AUTOPILOT_OVERRIDES ? JSON.parse(settings.THREAD_AUTOPILOT_OVERRIDES) : {}
    } catch {}

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
      const convId = conv.id

      // Human timing guard: Avoid replying multiple times in less than 12 seconds to the same thread
      const lastSentTime = lastRepliedTimestampMap.get(convId) || 0
      if (Date.now() - lastSentTime < 12000) {
        continue
      }

      // Fetch complete thread messages to inspect full real-time message stream
      const msgsRes = await InstagramService.getConversationMessages(convId, 20)
      const rawMsgs = (msgsRes.success && msgsRes.data) 
        ? ((msgsRes.data as any).data || []) 
        : (conv.messages?.data || [])

      if (rawMsgs.length === 0) continue

      // Sync fetched messages to DB chat memory
      const memList: MemoryMessage[] = rawMsgs.map((m: any) => ({
        id: m.id || String(Math.random()),
        role: (m.from?.username === 'smritifyp' || m.from?.id === '17841411718913026') ? 'model' : 'user',
        text: m.message || (m.attachments?.data?.length ? '[Photo/Attachment]' : ''),
        time: m.created_time || new Date().toISOString(),
        fromUsername: m.from?.username,
      })).filter((m: MemoryMessage) => m.text.trim().length > 0)

      if (memList.length > 0) {
        await saveChatMemory(convId, memList)
      }

      // Sort messages chronologically (oldest first, newest last)
      const sortedMsgs = [...rawMsgs].reverse()
      const lastMsg = sortedMsgs[sortedMsgs.length - 1]
      if (!lastMsg) continue

      const lastSenderId = lastMsg.from?.id
      const lastSenderUsername = lastMsg.from?.username

      // 1. STRICT GUARD: Skip if the last message in the thread was sent by US (smritifyp)
      // Never send double messages / >1 consecutive bot replies without the user replying back!
      if (lastSenderUsername === 'smritifyp' || lastSenderId === '17841411718913026') continue

      // Check consecutive bot messages count guard
      let consecutiveBotCount = 0
      for (let i = sortedMsgs.length - 1; i >= 0; i--) {
        const m = sortedMsgs[i]
        if (m.from?.username === 'smritifyp' || m.from?.id === '17841411718913026') {
          consecutiveBotCount++
        } else {
          break
        }
      }
      if (consecutiveBotCount >= 1) continue

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

      // 3. Per-Chat Autopilot Override check: Skip if user turned off AI automation for this chat
      const isAutopilotDisabled = 
        threadOverrides[convId] === false ||
        threadOverrides[`ig_${convId}`] === false ||
        (senderId && threadOverrides[senderId] === false) ||
        (senderUsername && threadOverrides[senderUsername] === false)

      if (isAutopilotDisabled) {
        console.log(`[AutoReplyScan] AI Autopilot disabled for thread ${convId} (${senderUsername}). Skipping.`)
        continue
      }

      // Skip if we already replied to this exact latest user message ID
      if (!senderId || autoRepliedMsgIds.has(latestUserMsg.id)) continue

      // Combine text of all unreplied messages (substituting photos/attachments if text is empty)
      const userTextParts = unrepliedUserMsgs.map(m => {
        const txt = (m.message || '').trim()
        if (txt) return txt
        if (m.attachments?.data?.length || m.attachments?.length) return '[User sent a photo/attachment]'
        return ''
      }).filter(Boolean)

      if (userTextParts.length === 0) continue
      const combinedUserText = userTextParts.join('\n')

      autoRepliedMsgIds.add(latestUserMsg.id)
      lastRepliedTimestampMap.set(convId, Date.now())
      console.log(`[AutoReplyScan] Processing ${unrepliedUserMsgs.length} unreplied message(s) from ${senderUsername}: "${combinedUserText}"`)

      // 4. Send typing indicator
      try {
        await InstagramService.sendTypingIndicator(senderId, 'typing_on')
      } catch {}

      // 5. Delay wait according to conversationDelay
      if (conversationDelay > 0) {
        await new Promise(res => setTimeout(res, Math.min(conversationDelay * 1000, 5000)))
      }

      // 6. Build full conversation history for Gemini from DB memory
      const dbMem = await getChatMemory(convId)
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

      // Check if this conversation thread has 0 previous replies from the bot/model
      const previousBotTurns = convHistory.filter(m => m.role === 'model')
      const isFirstTurn = previousBotTurns.length === 0

      const dynamicTurnContext = isFirstTurn ? firstTurnInst : ongoingTurnInst

      // 7. Generate reply content
      let replyText = ''
      if (staticReplyEnabled && staticReply.trim()) {
        replyText = staticReply.trim()
      } else {
        const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY || ''
        
        // Strict token limit & instructions based on selected response length
        const maxTokens = responseLength === 'extra_small' ? 25 : responseLength === 'small' ? 45 : responseLength === 'medium' ? 85 : 180
        const lengthInstruction = responseLength === 'extra_small'
          ? 'Reply in MAXIMUM 1 short sentence (5-8 words total).'
          : responseLength === 'small'
          ? 'Reply in MAXIMUM 1 short sentence (max 12-15 words total). Never write long paragraphs.'
          : 'Reply in MAXIMUM 2 short sentences.'

        const prompt = `${chatbotPersona}

${dynamicTurnContext}

${systemRules}
- ${lengthInstruction}
${subscriptionLink ? `- Share link ${subscriptionLink} naturally when relevant.` : ''}`

        const { text } = await generateWithGemini({
          system_instruction: { parts: [{ text: prompt }] },
          contents: convHistory,
          generationConfig: { maxOutputTokens: maxTokens, temperature: 0.7 }
        }, apiKey)

        replyText = sanitizeAiReply(text)
      }

      if (replyText) {
        console.log(`[AutoReplyScan] Sending DM reply to ${senderUsername}: "${replyText}"`)
        const sendRes = await InstagramService.sendDM(senderId, replyText)
        processedCount++

        // Save generated bot reply to DB memory
        const botMsgId = (sendRes.data as any)?.message_id || `bot_${Date.now()}`
        await saveChatMemory(convId, [{
          id: botMsgId,
          role: 'model',
          text: replyText,
          time: new Date().toISOString(),
          fromUsername: 'smritifyp',
        }])
      }

      // 8. Turn off typing indicator
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
