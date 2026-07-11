import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { InstagramService } from '@/lib/meta/instagram-service'
import { ensureMetaConfig } from '@/lib/meta/runtime-config'

const LAST_POLL_KEY = 'IG_POLL_LAST_TIMESTAMP'
const AUTO_REPLY_LOGS_KEY = 'AUTO_REPLY_LOGS'

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getConfig(keys: string[]): Promise<Record<string, string>> {
  const { data } = await supabaseAdmin
    .from('meta_config')
    .select('key, value')
    .in('key', keys)
  const out: Record<string, string> = {}
  for (const r of data || []) out[r.key] = r.value || ''
  return out
}

async function saveConfig(key: string, value: string) {
  await supabaseAdmin
    .from('meta_config')
    .upsert({ key, value, encrypted: false, updated_at: new Date().toISOString() }, { onConflict: 'key' })
}

async function appendLog(event: {
  timestamp: string
  platform: string
  senderId: string
  message: string
  matchedType: string
  replyContent: string
  status: 'sent' | 'skipped' | 'failed'
  error?: string
  modelUsed?: string
}) {
  try {
    const { data } = await supabaseAdmin
      .from('meta_config').select('value').eq('key', AUTO_REPLY_LOGS_KEY).single()
    let logs: any[] = []
    try { logs = data?.value ? JSON.parse(data.value) : [] } catch {}
    logs.unshift(event)
    logs = logs.slice(0, 50)
    await saveConfig(AUTO_REPLY_LOGS_KEY, JSON.stringify(logs))
  } catch (err: any) {
    console.error('[PollReplies] appendLog error:', err.message)
  }
}

// ── Main poll handler ─────────────────────────────────────────────────────────

// GET /api/meta/instagram/poll-replies
// Called by a cron job or the frontend on an interval.
// Finds IG DMs newer than the last poll time and auto-replies.
export async function GET() {
  try {
    await ensureMetaConfig()

    const igId = process.env.INSTAGRAM_BUSINESS_ID || '17841411718913026'

    // Load settings
    const settings = await getConfig([
      LAST_POLL_KEY,
      'AUTO_REPLY_RULES',
      'AI_CHATBOT_ENABLED',
      'AI_CHATBOT_PERSONA',
      'THREAD_AUTOPILOT_OVERRIDES',
      'AI_FIRST_REPLY_DELAY',
      'AI_CONVERSATION_DELAY',
      'THREAD_AI_CONFIGS',
      'AI_STATIC_REPLY_OVERRIDE',
      'AI_STATIC_REPLY_ENABLED',
    ])

    const lastPollTs = settings[LAST_POLL_KEY]
      ? new Date(settings[LAST_POLL_KEY])
      : new Date(Date.now() - 5 * 60 * 1000) // default: last 5 min

    const nowTs = new Date()
    const processed: string[] = []
    let newMsgCount = 0

    // Fetch recent conversations
    const convsRes = await InstagramService.getMessages(20)
    if (!convsRes.success || !convsRes.data?.data) {
      return NextResponse.json({ success: false, error: convsRes.error?.message || 'Failed to fetch conversations', processed: 0 })
    }

    const conversations = convsRes.data.data as any[]

    // Parse config
    const rules = settings.AUTO_REPLY_RULES ? JSON.parse(settings.AUTO_REPLY_RULES) : []
    const globalChatbotEnabled = settings.AI_CHATBOT_ENABLED === 'true'
    let threadConfigs: Record<string, any> = {}
    try { threadConfigs = settings.THREAD_AI_CONFIGS ? JSON.parse(settings.THREAD_AI_CONFIGS) : {} } catch {}
    let overrides: Record<string, boolean> = {}
    try { overrides = settings.THREAD_AUTOPILOT_OVERRIDES ? JSON.parse(settings.THREAD_AUTOPILOT_OVERRIDES) : {} } catch {}

    for (const conv of conversations) {
      const convId = conv.id

      // Get the OTHER participant (not us) — same logic as manual send in inbox
      const otherParticipant = (conv.participants?.data as any[] || []).find(
        (p: any) => p.id !== igId && p.username !== 'smritifyp'
      ) || (conv.participants?.data as any[])?.[0]
      const participantId = otherParticipant?.id

      // Get the last few messages in this conversation
      const msgsRes = await InstagramService.getConversationMessages(convId, 5)
      if (!msgsRes.success || !msgsRes.data?.data) continue

      const msgs = msgsRes.data.data as any[]

      // Find the latest message from someone else (not us) newer than last poll
      for (const msg of msgs) {
        const msgTime = new Date(msg.created_time || msg.timestamp || 0)
        if (msgTime <= lastPollTs) continue // already processed
        if (!msg.message?.trim()) continue // no text

        const fromId = msg.from?.id
        if (!fromId || fromId === igId) continue // skip our own messages

        // Use participantId (from conversation participants) as the recipient —
        // same ID format that the manual Send button uses successfully
        const senderId = participantId || fromId
        console.log(`[PollReplies] msg.from.id=${fromId} | participantId=${participantId} | using senderId=${senderId}`)

        newMsgCount++
        const messageText = msg.message.trim()
        const textLower = messageText.toLowerCase()

        // Per-thread config
        const threadConfig = threadConfigs[senderId] || {}
        const chatbotEnabled = threadConfig.enabled !== undefined
          ? threadConfig.enabled
          : (overrides[senderId] !== undefined ? overrides[senderId] : globalChatbotEnabled)

        const chatbotPersona = threadConfig.persona || settings.AI_CHATBOT_PERSONA || 'You are a helpful, professional business assistant.'
        const firstReplyDelay = threadConfig.firstReplyDelay !== undefined ? Number(threadConfig.firstReplyDelay) : (settings.AI_FIRST_REPLY_DELAY ? Number(settings.AI_FIRST_REPLY_DELAY) : 0)
        const conversationDelay = threadConfig.conversationDelay !== undefined ? Number(threadConfig.conversationDelay) : (settings.AI_CONVERSATION_DELAY ? Number(settings.AI_CONVERSATION_DELAY) : 0)
        const staticReplyEnabled = threadConfig.staticReplyEnabled !== undefined ? !!threadConfig.staticReplyEnabled : (settings.AI_STATIC_REPLY_ENABLED === 'true')
        const staticReply = threadConfig.staticReply || settings.AI_STATIC_REPLY_OVERRIDE || ''

        let replied = false
        let replyContent = ''
        let matchedType: string = 'none'
        let modelUsed = ''

        // 0. Static override
        if (staticReplyEnabled && staticReply.trim()) {
          replyContent = staticReply.trim()
          replied = true
          matchedType = 'static_override'
        }

        // 1. Keyword rules
        if (!replied) {
          for (const rule of rules) {
            const keywords = Array.isArray(rule.keywords) ? rule.keywords : String(rule.keywords || '').split(',')
            const matched = keywords.some((kw: string) => textLower.includes(kw.trim().toLowerCase()))
            if (matched && rule.reply) {
              replyContent = rule.reply
              replied = true
              matchedType = 'keyword'
              break
            }
          }
        }

        // 2. AI Chatbot
        if (!replied && chatbotEnabled) {
          try {
            const { generateWithGemini } = await import('@/lib/gemini')
            const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY || ''
            const systemPrompt = `${chatbotPersona}

IMPORTANT RULES:
- You are replying to an Instagram DM. Keep replies SHORT (1-3 sentences max).
- Stay strictly in character with the persona above.
- Never mention you are an AI.
- Respond naturally and conversationally.`
            const { text: aiReply, model } = await generateWithGemini(
              {
                system_instruction: { parts: [{ text: systemPrompt }] },
                contents: [{ role: 'user', parts: [{ text: messageText }] }],
                generationConfig: { maxOutputTokens: 300, temperature: 0.5 },
              },
              apiKey
            )
            if (aiReply.trim()) {
              replyContent = aiReply.trim()
              replied = true
              matchedType = 'gemini_ai'
              modelUsed = model
            }
          } catch (aiErr: any) {
            console.error('[PollReplies] AI error:', aiErr.message)
          }
        }

        if (replied && replyContent) {
          // Apply delay
          const hasRepliedBefore = msgs.some(m => m.from?.id === igId)
          const delaySec = hasRepliedBefore ? conversationDelay : firstReplyDelay
          if (delaySec > 0) {
            await new Promise(r => setTimeout(r, delaySec * 1000))
          }

          try {
            const sendRes = await InstagramService.sendDM(senderId, replyContent)
            if (sendRes.success) {
              processed.push(senderId)
              await appendLog({
                timestamp: new Date().toISOString(),
                platform: 'instagram',
                senderId,
                message: messageText,
                matchedType,
                replyContent,
                status: 'sent',
                modelUsed,
              })
            } else {
              const errMsg = sendRes.error?.message || 'sendDM returned success:false'
              console.error('[PollReplies] sendDM failed:', errMsg)
              await appendLog({
                timestamp: new Date().toISOString(),
                platform: 'instagram',
                senderId,
                message: messageText,
                matchedType,
                replyContent,
                status: 'failed',
                error: errMsg,
              })
            }
          } catch (sendErr: any) {
            await appendLog({
              timestamp: new Date().toISOString(),
              platform: 'instagram',
              senderId,
              message: messageText,
              matchedType,
              replyContent,
              status: 'failed',
              error: sendErr.message,
            })
          }
        } else {
          await appendLog({
            timestamp: new Date().toISOString(),
            platform: 'instagram',
            senderId,
            message: messageText,
            matchedType: 'none',
            replyContent: '',
            status: 'skipped',
          })
        }
      }
    }

    // Save poll timestamp
    await saveConfig(LAST_POLL_KEY, nowTs.toISOString())

    return NextResponse.json({
      success: true,
      newMessages: newMsgCount,
      repliesSent: processed.length,
      processedSenders: processed,
      polledAt: nowTs.toISOString(),
    })
  } catch (err: any) {
    console.error('[PollReplies] Error:', err.message)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
