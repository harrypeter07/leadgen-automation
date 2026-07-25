import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { InstagramService } from '@/lib/meta/instagram-service'
import { ensureMetaConfig } from '@/lib/meta/runtime-config'
import { generateWithGemini } from '@/lib/gemini'
import { getChatMemory, saveChatMemory, sanitizeAiReply, MemoryMessage } from '@/lib/meta/chat-memory'

export const dynamic = 'force-dynamic'

// In-memory map: msgId -> timestamp we replied (resets on server restart — that's fine, DB is source of truth)
const lastRepliedTimestampMap = new Map<string, number>()

// POST /api/meta/instagram/auto-reply-scan
// Background worker: anti-spam, session inactivity window, turn limits, dynamic language matching
export async function POST() {
  try {
    await ensureMetaConfig()

    // 1. Load settings from meta_config
    const { data: configRows } = await supabaseAdmin
      .from('meta_config')
      .select('key, value')
      .in('key', [
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
        'AI_SUBSCRIPTION_LINK',
        'AI_CONVERSATION_MAX_DURATION_MINS',
        'AI_CONVERSATION_MAX_TURNS',
        'AI_SESSION_INACTIVITY_HOURS',
        'AI_ENDING_TALK_INSTRUCTION'
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

    const systemRules = settings.AI_SYSTEM_RULES || `CRITICAL INSTRUCTIONS (NEVER BREAK THESE):
- DYNAMIC LANGUAGE MATCHING (CRITICAL): Always detect the exact language of the user's latest message (e.g. Romanian, English, Spanish, Hindi/Hinglish, French, German, etc.) and ALWAYS reply in the VERY SAME LANGUAGE as the sender! Never switch languages randomly. If the user speaks Romanian, respond in Romanian. If the user speaks English, respond in English. If the user speaks Hindi/Hinglish, respond in Hindi/Hinglish.
- Output ONLY your direct conversational message to the user.
- DO NOT include internal reasoning, thought options (e.g. *Draft 1:*), explanations, quotes, or markdown asterisks.
- Speak naturally like a real human. Never sound like a chatbot.`

    const subscriptionLink = settings.AI_SUBSCRIPTION_LINK || `https://smritishans.mywebsite.social/`
    const maxDurationMins = Number(settings.AI_CONVERSATION_MAX_DURATION_MINS || 3)
    const maxTurns = Number(settings.AI_CONVERSATION_MAX_TURNS || 6)
    const inactivityHours = Number(settings.AI_SESSION_INACTIVITY_HOURS || 1)
    const endingTalkInstruction = settings.AI_ENDING_TALK_INSTRUCTION || `CONTEXT: MAXIMUM CONVERSATION DURATION/TURNS REACHED FOR THIS CHAT SESSION\nWrap up the conversation warmly and naturally. Say you have to leave for some work or rest now and will chat later ("Arey g, abhi mujhe kaam hai! Bye bye, later baat karte hain ❤️✨"). Do not ask more open questions.`

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

      // -----------------------------------------------------------
      // STEP A: Fetch real-time messages from Meta API
      // -----------------------------------------------------------
      const msgsRes = await InstagramService.getConversationMessages(convId, 20)
      const rawMsgs = (msgsRes.success && msgsRes.data)
        ? ((msgsRes.data as any).data || [])
        : (conv.messages?.data || [])

      if (rawMsgs.length === 0) continue

      // Sort chronologically: oldest first, newest last
      const sortedMsgs = [...rawMsgs].reverse()
      const lastMsg = sortedMsgs[sortedMsgs.length - 1]
      if (!lastMsg) continue

      const lastSenderUsername = lastMsg.from?.username
      const lastSenderId = lastMsg.from?.id

      // -----------------------------------------------------------
      // GUARD #1 (Real-time): Last message in thread must be from USER (not bot)
      // This uses the live Meta API data, NOT the DB memory
      // -----------------------------------------------------------
      if (lastSenderUsername === 'smritifyp' || lastSenderId === '17841411718913026') {
        continue
      }

      // -----------------------------------------------------------
      // GUARD #2: No consecutive bot messages (check live thread)
      // -----------------------------------------------------------
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

      // -----------------------------------------------------------
      // GUARD #3: 20-second per-thread timing guard
      // -----------------------------------------------------------
      const lastSentTime = lastRepliedTimestampMap.get(convId) || 0
      if (Date.now() - lastSentTime < 20000) {
        continue
      }

      // -----------------------------------------------------------
      // Collect all consecutive unreplied user messages at the end
      // -----------------------------------------------------------
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

      if (!senderId) continue

      // -----------------------------------------------------------
      // GUARD #4: Per-chat autopilot override
      // -----------------------------------------------------------
      const isAutopilotDisabled =
        threadOverrides[convId] === false ||
        threadOverrides[`ig_${convId}`] === false ||
        (senderId && threadOverrides[senderId] === false) ||
        (senderUsername && threadOverrides[senderUsername] === false)

      if (isAutopilotDisabled) {
        console.log(`[AutoReplyScan] Autopilot disabled for thread ${convId} (${senderUsername}). Skipping.`)
        continue
      }

      // -----------------------------------------------------------
      // Combine unreplied user messages into one text block
      // -----------------------------------------------------------
      const userTextParts = unrepliedUserMsgs.map(m => {
        const txt = (m.message || '').trim()
        if (txt) return txt
        if (m.attachments?.data?.length || m.attachments?.length) return '[User sent a photo/attachment]'
        return ''
      }).filter(Boolean)

      if (userTextParts.length === 0) continue
      const combinedUserText = userTextParts.join('\n')

      // -----------------------------------------------------------
      // Load DB memory ONLY for building conversation history & session tracking
      // DB memory is NOT used as a reply gate (that's the fixed bug)
      // -----------------------------------------------------------
      const dbMem = await getChatMemory(convId)

      // -----------------------------------------------------------
      // Session detection: find the start of current active session
      // using the inactivity gap between messages (default: 1 hour)
      // -----------------------------------------------------------
      const inactivityGapMs = inactivityHours * 3600 * 1000
      
      // Build a combined timeline from DB memory + live messages for session detection
      const liveAsMemory: MemoryMessage[] = sortedMsgs
        .map((m: any) => ({
          id: m.id || String(Math.random()),
          role: (m.from?.username === 'smritifyp' || m.from?.id === '17841411718913026') ? 'model' as const : 'user' as const,
          text: m.message || (m.attachments?.data?.length ? '[Photo/Attachment]' : ''),
          time: m.created_time || new Date().toISOString(),
          fromUsername: m.from?.username,
        }))
        .filter((m: MemoryMessage) => m.text.trim().length > 0)

      // Use DB mem if available (richer history), else use live messages
      const fullHistory: MemoryMessage[] = dbMem.length > 0 ? dbMem : liveAsMemory

      // Find the start of current session: look for the last big inactivity gap
      let sessionStartIndex = 0
      for (let i = fullHistory.length - 1; i > 0; i--) {
        const currentTime = new Date(fullHistory[i].time).getTime()
        const prevTime = new Date(fullHistory[i - 1].time).getTime()
        if (!isNaN(currentTime) && !isNaN(prevTime) && (currentTime - prevTime) >= inactivityGapMs) {
          sessionStartIndex = i
          break
        }
      }

      const currentSessionMsgs = fullHistory.slice(sessionStartIndex)

      // -----------------------------------------------------------
      // Session duration: measure from FIRST msg of current session
      // to the LAST user msg time (NOT to now — avoids stale sessions)
      // -----------------------------------------------------------
      let sessionElapsedMins = 0
      if (currentSessionMsgs.length >= 2) {
        const sessionStartMs = new Date(currentSessionMsgs[0].time).getTime()
        // Use the timestamp of the last message, not Date.now()
        const sessionLastMsgMs = new Date(currentSessionMsgs[currentSessionMsgs.length - 1].time).getTime()
        if (!isNaN(sessionStartMs) && !isNaN(sessionLastMsgMs) && sessionLastMsgMs > sessionStartMs) {
          sessionElapsedMins = (sessionLastMsgMs - sessionStartMs) / 60000
        }
      }

      // Count bot turns in current session
      const sessionBotTurns = currentSessionMsgs.filter((m: MemoryMessage) => m.role === 'model').length

      const isDurationLimitReached = sessionElapsedMins >= maxDurationMins
      const isTurnLimitReached = sessionBotTurns >= maxTurns
      const isSessionLimitReached = isDurationLimitReached || isTurnLimitReached

      // If session limit reached AND bot already sent the wrap-up message (last session msg is model), stop
      if (isSessionLimitReached) {
        const lastSessionMsg = currentSessionMsgs[currentSessionMsgs.length - 1]
        if (lastSessionMsg && lastSessionMsg.role === 'model') {
          console.log(`[AutoReplyScan] Session limit for ${senderUsername} (${sessionElapsedMins.toFixed(1)} mins, ${sessionBotTurns} bot turns). Wrap-up already sent. Skipping.`)
          continue
        }
      }

      // -----------------------------------------------------------
      // Build conversation history for Gemini
      // -----------------------------------------------------------
      const convHistory = fullHistory
        .slice(-12)
        .map((m: MemoryMessage) => ({
          role: m.role,
          parts: [{ text: m.text || '' }]
        }))
        .filter((m: any) => m.parts[0].text.trim().length > 0)

      // Ensure the last entry is the user's current message
      const lastHistoryParts = convHistory[convHistory.length - 1]?.parts[0]?.text
      if (!lastHistoryParts || lastHistoryParts !== combinedUserText) {
        convHistory.push({ role: 'user', parts: [{ text: combinedUserText }] })
      }

      // Select the right system context directive
      const isFirstTurn = sessionBotTurns === 0
      let dynamicTurnContext = isFirstTurn ? firstTurnInst : ongoingTurnInst
      if (isSessionLimitReached) {
        dynamicTurnContext = endingTalkInstruction
      }

      // Mark as being processed
      lastRepliedTimestampMap.set(convId, Date.now())
      console.log(`[AutoReplyScan] Processing reply for ${senderUsername} (session: ${sessionElapsedMins.toFixed(1)} mins, turns: ${sessionBotTurns}, limitReached: ${isSessionLimitReached}): "${combinedUserText.slice(0, 80)}"`)

      // Send typing indicator
      try { await InstagramService.sendTypingIndicator(senderId, 'typing_on') } catch {}

      // Apply conversation delay
      if (conversationDelay > 0) {
        await new Promise(res => setTimeout(res, Math.min(conversationDelay * 1000, 5000)))
      }

      // -----------------------------------------------------------
      // Generate reply
      // -----------------------------------------------------------
      let replyText = ''
      if (staticReplyEnabled && staticReply.trim()) {
        replyText = staticReply.trim()
      } else {
        const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY || ''
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

      if (!replyText) {
        console.log(`[AutoReplyScan] Empty reply generated for ${senderUsername}, skipping send.`)
        try { await InstagramService.sendTypingIndicator(senderId, 'typing_off') } catch {}
        continue
      }

      // -----------------------------------------------------------
      // Send and save to DB memory
      // -----------------------------------------------------------
      console.log(`[AutoReplyScan] Sending DM to ${senderUsername}: "${replyText}"`)
      const sendRes = await InstagramService.sendDM(senderId, replyText)
      processedCount++

      // Sync all live messages into DB memory first, then append our bot reply
      if (liveAsMemory.length > 0) {
        await saveChatMemory(convId, liveAsMemory)
      }
      const botMsgId = (sendRes.data as any)?.message_id || `bot_${Date.now()}`
      await saveChatMemory(convId, [{
        id: botMsgId,
        role: 'model',
        text: replyText,
        time: new Date().toISOString(),
        fromUsername: 'smritifyp',
      }])

      try { await InstagramService.sendTypingIndicator(senderId, 'typing_off') } catch {}
    }

    return NextResponse.json({ success: true, processedCount })
  } catch (err: any) {
    console.error('[AutoReplyScan] Error:', err.message)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
