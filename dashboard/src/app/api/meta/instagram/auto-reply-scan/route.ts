import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { InstagramService } from '@/lib/meta/instagram-service'
import { ensureMetaConfig } from '@/lib/meta/runtime-config'
import { generateWithGemini } from '@/lib/gemini'
import { getChatMemory, saveChatMemory, sanitizeAiReply, MemoryMessage } from '@/lib/meta/chat-memory'

export const dynamic = 'force-dynamic'
export const maxDuration = 55

// ─── DB-based reply lock ───────────────────────────────────────────────────────
// Stores the last message ID we replied to per thread in Supabase.
// Survives server restarts. Prevents double-replies from concurrent calls.
const REPLIED_LOCK_KEY = 'AI_REPLIED_MSG_IDS'

async function getLastRepliedIds(): Promise<Record<string, string>> {
  try {
    const { data } = await supabaseAdmin
      .from('meta_config').select('value').eq('key', REPLIED_LOCK_KEY).single()
    return data?.value ? JSON.parse(data.value) : {}
  } catch { return {} }
}

async function markAsReplied(threadId: string, msgId: string) {
  const map = await getLastRepliedIds()
  map[threadId] = msgId
  // Keep only last 50 threads to avoid bloat
  const keys = Object.keys(map)
  if (keys.length > 50) {
    const trimmed: Record<string, string> = {}
    keys.slice(-50).forEach(k => { trimmed[k] = map[k] })
    Object.assign(map, trimmed)
  }
  await supabaseAdmin.from('meta_config').upsert(
    { key: REPLIED_LOCK_KEY, value: JSON.stringify(map), updated_at: new Date().toISOString() },
    { onConflict: 'key' }
  )
}

// ─── Main scan handler ─────────────────────────────────────────────────────────

export async function POST() {
  try {
    await ensureMetaConfig()

    // 1. Load settings
    const { data: configRows } = await supabaseAdmin
      .from('meta_config')
      .select('key, value')
      .in('key', [
        'AI_CHATBOT_ENABLED',
        'AI_CHATBOT_PERSONA',
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
    for (const r of configRows || []) settings[r.key] = r.value || ''

    const chatbotEnabled = settings.AI_CHATBOT_ENABLED === 'true'
    const staticReplyEnabled = settings.AI_STATIC_REPLY_ENABLED === 'true'
    const staticReply = settings.AI_STATIC_REPLY_OVERRIDE || ''

    if (!chatbotEnabled && !staticReplyEnabled) {
      return NextResponse.json({ success: true, message: 'Auto-reply disabled' })
    }

    // Default persona — natural, casual lowercase texting, no emojis, no excessive punctuation
    const chatbotPersona = settings.AI_CHATBOT_PERSONA ||
      `You are Smriti, a 21-year-old Indian content creator. You text exactly like a real young person on Instagram DMs — casual, warm, relaxed, in lowercase letters. Use Hindi/Hinglish or English matching the user. Keep replies to 1 short sentence (5-10 words). DO NOT use emojis (0 emojis). DO NOT use exclamation marks or formal capitals.`

    const firstTurnInst = settings.AI_FIRST_TURN_INSTRUCTION ||
      `CONTEXT: First message from this person. Greet them casually in lowercase — like "heyy, kya haal hai" or "hi, bolo". Do not ask multiple questions.`

    const ongoingTurnInst = settings.AI_ONGOING_TURN_INSTRUCTION ||
      `CONTEXT: Ongoing conversation. Continue naturally from the chat history. One short reply in lowercase.`

    const systemRules = settings.AI_SYSTEM_RULES ||
      `RULES (follow strictly):
- Match the user's language exactly. If they write in English, reply in English. If Hindi/Hinglish, reply in Hindi/Hinglish.
- Output ONLY your reply message. No explanations, no internal notes, no asterisks, no quotes.
- Start sentences with lowercase letters (casual DM style, e.g. "heyy kya kar rahe ho", "accha aisa hai kya").
- NO EMOJIS: Do not use any emojis at all (0 emojis).
- SUBSCRIPTION LINK RULE: You may mention the subscription link naturally ONCE when relevant. DO NOT repeat or spam the link multiple times if it was already mentioned or if unrelated.`

    const subscriptionLink = settings.AI_SUBSCRIPTION_LINK || ''
    const maxDurationMins = Number(settings.AI_CONVERSATION_MAX_DURATION_MINS || 30)
    const maxTurns = Number(settings.AI_CONVERSATION_MAX_TURNS || 10)
    const inactivityHours = Number(settings.AI_SESSION_INACTIVITY_HOURS || 1)
    const endingTalkInstruction = settings.AI_ENDING_TALK_INSTRUCTION ||
      `CONTEXT: You've been chatting a while. Wrap up naturally — say you have to go now, keep it short and warm.`

    const responseLength = (settings.AI_RESPONSE_LENGTH || 'small') as 'extra_small' | 'small' | 'medium' | 'large'
    const conversationDelay = Number(settings.AI_CONVERSATION_DELAY || 3)

    let threadOverrides: Record<string, boolean> = {}
    try { threadOverrides = settings.THREAD_AUTOPILOT_OVERRIDES ? JSON.parse(settings.THREAD_AUTOPILOT_OVERRIDES) : {} } catch {}

    let threadConfigs: Record<string, any> = {}
    try { threadConfigs = settings.THREAD_AI_CONFIGS ? JSON.parse(settings.THREAD_AI_CONFIGS) : {} } catch {}

    // 2. Load DB-based reply lock — which message ID did we last reply to per thread
    const lastRepliedIds = await getLastRepliedIds()

    // 3. Fetch conversations
    const convsRes = await InstagramService.getMessages(10)
    if (!convsRes.success || !convsRes.data) {
      return NextResponse.json({ success: false, error: 'Could not fetch conversations' })
    }

    const conversations = (convsRes.data as any).data || []
    const botIgId = process.env.INSTAGRAM_BUSINESS_ID || '17841441378827572'
    let processedCount = 0

    const isOurMsg = (m: any) => m.from?.username === 'smritifyp' || m.from?.id === botIgId

    for (const conv of conversations) {
      const convId = conv.id

      // Use embedded messages (avoids per-conv API calls that hit rate limits)
      let rawMsgs: any[] = conv.messages?.data || []
      if (rawMsgs.length === 0) continue

      // Sort: oldest first, newest last
      const sortedMsgs = [...rawMsgs].reverse()
      const lastMsg = sortedMsgs[sortedMsgs.length - 1]
      if (!lastMsg) continue

      // ── GUARD 1: Last message must be from user, not bot ──
      if (isOurMsg(lastMsg)) continue

      // ── GUARD 2: No consecutive bot messages at end ──
      let botStreak = 0
      for (let i = sortedMsgs.length - 1; i >= 0; i--) {
        if (isOurMsg(sortedMsgs[i])) botStreak++; else break
      }
      if (botStreak >= 1) continue

      // ── GUARD 3: DB-based dedup — already replied to this exact message? ──
      const latestUserMsg = lastMsg
      if (lastRepliedIds[convId] === latestUserMsg.id) {
        continue // already replied to this message, skip
      }

      const senderId = latestUserMsg.from?.id
      const senderUsername = latestUserMsg.from?.username || ''
      if (!senderId) continue

      // ── GUARD 4: Autopilot override ──
      const autopilotOff =
        threadOverrides[convId] === false ||
        threadOverrides[`ig_${convId}`] === false ||
        threadOverrides[senderId] === false ||
        threadOverrides[`ig_${senderId}`] === false ||
        (senderUsername && threadOverrides[senderUsername] === false) ||
        (threadConfigs[convId] && threadConfigs[convId].enabled === false) ||
        (threadConfigs[`ig_${convId}`] && threadConfigs[`ig_${convId}`].enabled === false) ||
        (threadConfigs[senderId] && threadConfigs[senderId].enabled === false) ||
        (senderUsername && threadConfigs[senderUsername] && threadConfigs[senderUsername].enabled === false)

      if (autopilotOff) continue

      // Collect unreplied user messages
      const unrepliedUserMsgs: any[] = []
      for (let i = sortedMsgs.length - 1; i >= 0; i--) {
        if (isOurMsg(sortedMsgs[i])) break
        unrepliedUserMsgs.unshift(sortedMsgs[i])
      }

      const userTextParts = unrepliedUserMsgs.map(m => {
        const t = (m.message || '').trim()
        if (t) return t
        if (m.attachments?.data?.length || m.attachments?.length) return '[sent a photo]'
        return ''
      }).filter(Boolean)

      if (userTextParts.length === 0) continue
      const combinedUserText = userTextParts.join('\n')

      // ── SESSION TRACKING (DB memory) ──
      const dbMem = await getChatMemory(convId)
      const inactivityGapMs = inactivityHours * 3600 * 1000

      // Build live message list for session detection
      const liveAsMemory: MemoryMessage[] = sortedMsgs
        .map((m: any) => ({
          id: m.id || String(Math.random()),
          role: isOurMsg(m) ? 'model' as const : 'user' as const,
          text: m.message || '',
          time: m.created_time || new Date().toISOString(),
          fromUsername: m.from?.username,
        }))
        .filter((m: MemoryMessage) => m.text.trim().length > 0)

      // Safety valve: if DB memory is older than inactivity threshold → fresh session
      let useDbMem = dbMem.length > 0
      if (useDbMem) {
        const lastDbTime = new Date(dbMem[dbMem.length - 1].time).getTime()
        if (!isNaN(lastDbTime) && (Date.now() - lastDbTime) >= inactivityGapMs) {
          useDbMem = false
        }
      }
      const fullHistory: MemoryMessage[] = useDbMem ? dbMem : liveAsMemory

      // Find session start via inactivity gap
      let sessionStartIndex = 0
      for (let i = fullHistory.length - 1; i > 0; i--) {
        const t1 = new Date(fullHistory[i].time).getTime()
        const t0 = new Date(fullHistory[i - 1].time).getTime()
        if (!isNaN(t1) && !isNaN(t0) && (t1 - t0) >= inactivityGapMs) {
          sessionStartIndex = i; break
        }
      }
      const currentSessionMsgs = fullHistory.slice(sessionStartIndex)

      // Session elapsed = last msg time - first msg time (not wall clock)
      let sessionElapsedMins = 0
      if (currentSessionMsgs.length >= 2) {
        const t0 = new Date(currentSessionMsgs[0].time).getTime()
        const tN = new Date(currentSessionMsgs[currentSessionMsgs.length - 1].time).getTime()
        if (!isNaN(t0) && !isNaN(tN)) sessionElapsedMins = (tN - t0) / 60000
      }

      const sessionBotTurns = currentSessionMsgs.filter((m: MemoryMessage) => m.role === 'model').length
      const isDurationLimitReached = sessionElapsedMins >= maxDurationMins
      const isTurnLimitReached = sessionBotTurns >= maxTurns
      const isSessionLimitReached = isDurationLimitReached || isTurnLimitReached

      // If limit reached and wrap-up already sent → stop
      if (isSessionLimitReached) {
        const lastS = currentSessionMsgs[currentSessionMsgs.length - 1]
        if (lastS?.role === 'model') {
          console.log(`[AutoReplyScan] Session limit hit for ${senderUsername}, wrap-up already sent. Skip.`)
          continue
        }
      }

      // Build Gemini conversation history (last 10 turns)
      const convHistory = fullHistory
        .slice(-10)
        .map((m: MemoryMessage) => ({ role: m.role, parts: [{ text: m.text || '' }] }))
        .filter((m: any) => m.parts[0].text.trim().length > 0)

      const lastHistoryText = convHistory[convHistory.length - 1]?.parts[0]?.text
      if (!lastHistoryText || lastHistoryText !== combinedUserText) {
        convHistory.push({ role: 'user', parts: [{ text: combinedUserText }] })
      }

      // Select context directive
      const isFirstTurn = sessionBotTurns === 0
      let dynamicTurnContext = isFirstTurn ? firstTurnInst : ongoingTurnInst
      if (isSessionLimitReached) dynamicTurnContext = endingTalkInstruction

      // ── Mark as processing immediately in DB to prevent concurrent duplicates ──
      await markAsReplied(convId, latestUserMsg.id)

      console.log(`[AutoReplyScan] Replying to ${senderUsername} (${sessionBotTurns} turns, ${sessionElapsedMins.toFixed(0)} min): "${combinedUserText.slice(0, 60)}"`)

      try { await InstagramService.sendTypingIndicator(senderId, 'typing_on') } catch {}
      if (conversationDelay > 0) {
        await new Promise(res => setTimeout(res, Math.min(conversationDelay * 1000, 5000)))
      }

      // Generate reply
      let replyText = ''
      if (staticReplyEnabled && staticReply.trim()) {
        replyText = staticReply.trim()
      } else {
        const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY || ''
        const maxTokens = responseLength === 'extra_small' ? 20
          : responseLength === 'small' ? 35
          : responseLength === 'medium' ? 70
          : 140

        const lengthInstruction = responseLength === 'extra_small'
          ? 'Reply in 5-7 words maximum.'
          : responseLength === 'small'
          ? 'Reply in 1 short sentence (10-15 words max).'
          : 'Reply in 1-2 short sentences.'

        const prompt = `${chatbotPersona}

${dynamicTurnContext}

${systemRules}
- ${lengthInstruction}
${subscriptionLink ? `- Mention ${subscriptionLink} naturally ONCE when relevant. Do not repeat or spam the link.` : ''}`

        const { text } = await generateWithGemini({
          system_instruction: { parts: [{ text: prompt }] },
          contents: convHistory,
          generationConfig: { maxOutputTokens: maxTokens, temperature: 0.65 }
        }, apiKey)

        replyText = sanitizeAiReply(text)
      }

      if (!replyText) {
        console.log(`[AutoReplyScan] Empty reply for ${senderUsername}, skipping.`)
        try { await InstagramService.sendTypingIndicator(senderId, 'typing_off') } catch {}
        continue
      }

      // Send
      console.log(`[AutoReplyScan] → ${senderUsername}: "${replyText}"`)
      const sendRes = await InstagramService.sendDM(senderId, replyText)
      processedCount++

      // Save to memory
      if (liveAsMemory.length > 0) await saveChatMemory(convId, liveAsMemory)
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

// GET — alias so Railway/external cron pings can also trigger via HTTP GET
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return POST()
}
