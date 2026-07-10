import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { InstagramService } from '@/lib/meta/instagram-service'
import { FacebookService } from '@/lib/meta/facebook-service'
import { ensureMetaConfig } from '@/lib/meta/runtime-config'

const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || 'FLOWFYP_VERIFY_TOKEN'
const APP_SECRET   = process.env.META_APP_SECRET || ''

// GET /api/meta/webhook — Challenge verification
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mode      = searchParams.get('hub.mode')
  const token     = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('[Meta Webhook] ✓ Verification challenge passed.')
    return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } })
  }

  console.warn('[Meta Webhook] ✗ Verification failed — token mismatch or wrong mode.', { mode, token })
  return NextResponse.json({ error: 'Verification failed.' }, { status: 403 })
}

// Helper to check rules and send AI/Keyword replies
async function handleAutoReply(
  platform: 'instagram' | 'messenger',
  senderId: string,
  messageText: string
) {
  try {
    await ensureMetaConfig()
    const pageId = process.env.META_PAGE_ID || '1165738093294228'
    const igId = process.env.INSTAGRAM_BUSINESS_ID || '17841411718913026'

    // Skip if sender is ourselves
    if (senderId === pageId || senderId === igId) return

    // Fetch config
    const { data: configRows } = await supabaseAdmin
      .from('meta_config')
      .select('key, value')
      .in('key', [
        'AUTO_REPLY_RULES',
        'AI_CHATBOT_ENABLED',
        'AI_CHATBOT_PERSONA',
        'THREAD_AUTOPILOT_OVERRIDES',
        'AI_FIRST_REPLY_DELAY',
        'AI_CONVERSATION_DELAY',
        'THREAD_AI_CONFIGS'
      ])

    const settings: Record<string, string> = {}
    for (const r of configRows || []) {
      settings[r.key] = r.value || ''
    }

    const rules = settings.AUTO_REPLY_RULES ? JSON.parse(settings.AUTO_REPLY_RULES) : []
    const globalChatbotEnabled = settings.AI_CHATBOT_ENABLED === 'true'

    // Thread-level configurations override
    let threadConfigs: Record<string, any> = {}
    try {
      threadConfigs = settings.THREAD_AI_CONFIGS ? JSON.parse(settings.THREAD_AI_CONFIGS) : {}
    } catch {}

    const threadConfig = threadConfigs[senderId] || {}

    // 1. Autopilot toggle override
    let overrides: Record<string, boolean> = {}
    try {
      overrides = settings.THREAD_AUTOPILOT_OVERRIDES ? JSON.parse(settings.THREAD_AUTOPILOT_OVERRIDES) : {}
    } catch {}

    const chatbotEnabled = threadConfig.enabled !== undefined
      ? threadConfig.enabled
      : (overrides[senderId] !== undefined ? overrides[senderId] : globalChatbotEnabled)

    // 2. Persona override
    const chatbotPersona = threadConfig.persona || settings.AI_CHATBOT_PERSONA || 'You are a helpful, professional business assistant.'

    // 3. Delays override
    const firstReplyDelay = threadConfig.firstReplyDelay !== undefined
      ? Number(threadConfig.firstReplyDelay)
      : (settings.AI_FIRST_REPLY_DELAY ? Number(settings.AI_FIRST_REPLY_DELAY) : 5)

    const conversationDelay = threadConfig.conversationDelay !== undefined
      ? Number(threadConfig.conversationDelay)
      : (settings.AI_CONVERSATION_DELAY ? Number(settings.AI_CONVERSATION_DELAY) : 2)

    const textLower = messageText.toLowerCase()
    let replied = false
    let replyContent = ''

    // 1. Keyword check
    for (const rule of rules) {
      const keywords = Array.isArray(rule.keywords) ? rule.keywords : String(rule.keywords || '').split(',')
      const matched = keywords.some((kw: string) => textLower.includes(kw.trim().toLowerCase()))
      if (matched && rule.reply) {
        console.log(`[AutoReply] Keyword match for "${messageText}".`)
        replyContent = rule.reply
        replied = true
        break
      }
    }

    // 2. AI Chatbot check
    if (!replied && chatbotEnabled) {
      console.log(`[AutoReply] Generating AI response for "${messageText}"...`)
      const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY || ''
      if (apiKey) {
        const { generateWithGemini } = await import('@/lib/gemini')
        const { text: aiReply } = await generateWithGemini(
          {
            system_instruction: { parts: [{ text: chatbotPersona }] },
            contents: [{ role: 'user', parts: [{ text: messageText }] }],
            generationConfig: { maxOutputTokens: 150, temperature: 0.7 },
          },
          apiKey
        )
        if (aiReply.trim()) {
          replyContent = aiReply.trim()
          replied = true
        }
      }
    }

    // Apply sleep delay and send reply if matched
    if (replied && replyContent) {
      // Determine if first reply by looking at messages history
      let isFirstReply = true
      try {
        if (platform === 'instagram') {
          const convsRes = await InstagramService.getMessages(10)
          if (convsRes.success && convsRes.data?.data) {
            const convs = convsRes.data.data as any[]
            const myConv = convs.find(c =>
              c.participants?.data?.some((p: any) => p.id === senderId)
            )
            if (myConv) {
              const msgsRes = await InstagramService.getConversationMessages(myConv.id, 10)
              if (msgsRes.success && msgsRes.data?.data) {
                const msgs = msgsRes.data.data as any[]
                // If there are messages from ourselves, it's not the first reply
                const hasRepliedBefore = msgs.some(m => m.from?.id === igId)
                isFirstReply = !hasRepliedBefore
              }
            }
          }
        } else {
          const convsRes = await FacebookService.getMessages(10)
          if (convsRes.success && convsRes.data?.data) {
            const convs = convsRes.data.data as any[]
            const myConv = convs.find(c =>
              c.participants?.data?.some((p: any) => p.id === senderId)
            )
            if (myConv) {
              const msgsRes = await FacebookService.getConversationMessages(myConv.id, 10)
              if (msgsRes.success && msgsRes.data?.data) {
                const msgs = msgsRes.data.data as any[]
                const hasRepliedBefore = msgs.some(m => m.from?.id === pageId)
                isFirstReply = !hasRepliedBefore
              }
            }
          }
        }
      } catch (historyErr: any) {
        console.error('[AutoReply] History retrieval failed, defaulting to firstReplyDelay:', historyErr.message)
      }

      const delaySec = isFirstReply ? firstReplyDelay : conversationDelay
      if (delaySec > 0) {
        console.log(`[AutoReply] Sleeping for ${delaySec} seconds before dispatching reply...`)
        await new Promise(resolve => setTimeout(resolve, delaySec * 1000))
      }

      console.log(`[AutoReply] Sending reply: "${replyContent.slice(0, 60)}..."`)
      if (platform === 'instagram') {
        await InstagramService.sendDM(senderId, replyContent)
      } else {
        await FacebookService.sendMessage(senderId, replyContent)
      }
    }
  } catch (err: any) {
    console.error('[AutoReply] Processor error:', err.message)
  }
}

// POST /api/meta/webhook — Incoming event delivery
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()

    if (APP_SECRET) {
      const signature = req.headers.get('x-hub-signature-256') || ''
      const expected  = 'sha256=' + crypto.createHmac('sha256', APP_SECRET).update(rawBody).digest('hex')
      if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
        console.warn('[Meta Webhook] ✗ Signature mismatch — payload rejected.')
        return NextResponse.json({ error: 'Invalid signature.' }, { status: 401 })
      }
    }

    const body = JSON.parse(rawBody)
    const object = body.object as string

    console.log(`[Meta Webhook] Received ${object} event:`, JSON.stringify(body).slice(0, 450))

    // Parse messages
    if (body.entry && Array.isArray(body.entry)) {
      for (const entry of body.entry) {
        // Platform detection
        const platform = object === 'instagram' ? 'instagram' : 'messenger'

        // 1. Messenger Messaging
        if (entry.messaging && Array.isArray(entry.messaging)) {
          for (const msgEvent of entry.messaging) {
            const senderId = msgEvent.sender?.id
            const text = msgEvent.message?.text
            if (senderId && text) {
              // Handle in background to keep response under 20s
              handleAutoReply(platform, senderId, text)
            }
          }
        }

        // 2. Instagram changes (comments, feed mentions)
        if (entry.changes && Array.isArray(entry.changes)) {
          for (const change of entry.changes) {
            // Instagram Comments
            if (change.field === 'comments' && change.value) {
              const commentId = change.value.id
              const text = change.value.text
              const fromId = change.value.from?.id
              if (commentId && text && fromId) {
                // Auto-reply to comment if configured
                ensureMetaConfig().then(async () => {
                  const myIgId = process.env.INSTAGRAM_BUSINESS_ID || '17841411718913026'
                  if (fromId !== myIgId) {
                    const { data: configRows } = await supabaseAdmin
                      .from('meta_config')
                      .select('key, value')
                      .eq('key', 'AUTO_REPLY_RULES')
                    const rules = configRows?.[0]?.value ? JSON.parse(configRows[0].value) : []
                    const textLower = text.toLowerCase()
                    for (const rule of rules) {
                      const keywords = Array.isArray(rule.keywords) ? rule.keywords : String(rule.keywords || '').split(',')
                      const matched = keywords.some((kw: string) => textLower.includes(kw.trim().toLowerCase()))
                      if (matched && rule.reply) {
                        await InstagramService.replyToComment(commentId, rule.reply)
                        break
                      }
                    }
                  }
                }).catch(() => {})
              }
            }
          }
        }
      }
    }

    // Forward to n8n communication hub
    const n8nUrl = process.env.N8N_BASE_URL || process.env.N8N_WEBHOOK_BASE_URL
    if (n8nUrl) {
      fetch(`${n8nUrl}/webhook/meta-communication-inbound`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).catch(err => console.error('[Meta Webhook] Failed to forward to n8n:', err.message))
    }

    // Log event
    const backendUrl = process.env.V3_BACKEND_URL || process.env.WHATSAPP_SERVICE_URL
    if (backendUrl) {
      fetch(`${backendUrl}/api/automation/accounts/logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-secret': process.env.WHATSAPP_API_SECRET || '',
        },
        body: JSON.stringify({
          action: `WEBHOOK_${(object || 'unknown').toUpperCase()}`,
          details: JSON.stringify(body).slice(0, 500),
        }),
      }).catch(() => {})
    }

    return NextResponse.json({ received: true })
  } catch (err: unknown) {
    console.error('[Meta Webhook] POST error:', err)
    return NextResponse.json({ error: 'Webhook processing failed.' }, { status: 500 })
  }
}
