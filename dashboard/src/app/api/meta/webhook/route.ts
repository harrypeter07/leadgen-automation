import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { InstagramService } from '@/lib/meta/instagram-service'
import { FacebookService } from '@/lib/meta/facebook-service'
import { ensureMetaConfig } from '@/lib/meta/runtime-config'

export const dynamic = 'force-dynamic'

const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || 'FLOWFYP_VERIFY_TOKEN'
const APP_SECRET   = process.env.META_APP_SECRET || ''

function getEncKey(): Buffer {
  const raw = process.env.SUPABASE_SERVICE_ROLE_KEY || 'fallback-key-32-bytes-padded-123'
  return Buffer.from(raw.slice(0, 32).padEnd(32, '0'))
}

function decrypt(value: string): string {
  try {
    if (!value) return ''
    if (!value.startsWith('enc:')) {
      const parts = value.split(':')
      if (parts.length >= 2) {
        const iv = Buffer.from(parts.shift() || '', 'hex')
        const encrypted = Buffer.from(parts.join(':'), 'hex')
        const rawKey = process.env.WHATSAPP_API_SECRET || 'antigravity_fallback_encryption_key_32_bytes_long'
        const derivedKey = crypto.createHash('sha256').update(rawKey).digest()
        const decipher = crypto.createDecipheriv('aes-256-cbc', derivedKey, iv)
        return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
      }
      return value
    }
    const parts = value.split(':')
    if (parts.length < 3) return value
    const iv        = Buffer.from(parts[1], 'hex')
    const encrypted = Buffer.from(parts[2], 'hex')
    const decipher  = crypto.createDecipheriv('aes-256-cbc', getEncKey(), iv)
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
  } catch {
    return value
  }
}

// Memory cache to prevent duplicate webhook message processing
const processedMids = new Set<string>()

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

// Helper to record auto-reply events
async function logAutoReplyEvent(event: {
  timestamp: string
  platform: string
  senderId: string
  message: string
  matchedType: 'static_override' | 'keyword' | 'gemini_ai' | 'none'
  replyContent: string
  status: 'sent' | 'skipped' | 'failed'
  error?: string
  modelUsed?: string
}) {
  try {
    const { data } = await supabaseAdmin
      .from('meta_config')
      .select('value')
      .eq('key', 'AUTO_REPLY_LOGS')
      .single()

    let logs: any[] = []
    if (data?.value) {
      try {
        logs = JSON.parse(data.value)
      } catch {}
    }

    logs.unshift(event)
    logs = logs.slice(0, 50)

    await supabaseAdmin
      .from('meta_config')
      .upsert({
        key: 'AUTO_REPLY_LOGS',
        value: JSON.stringify(logs),
        encrypted: false,
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' })
  } catch (err: any) {
    console.error('[logAutoReplyEvent] Error saving log:', err.message)
  }
}

// Helper to check rules and send AI/Keyword r// Helper to check rules and send AI/Keyword replies
async function handleAutoReply(
  platform: 'instagram' | 'messenger',
  senderId: string,
  messageText: string,
  recipientId: string
) {
  try {
    await ensureMetaConfig()

    // 1. Query connected_accounts table to find the record matching platform and recipientId
    const { data: accounts } = await supabaseAdmin
      .from('connected_accounts')
      .select('*')
      .eq('platform', platform === 'instagram' ? 'instagram' : 'messenger')

    let matchedAccount: any = null
    for (const acc of accounts || []) {
      if (acc.encrypted_credentials) {
        try {
          const decryptedStr = decrypt(acc.encrypted_credentials)
          const creds = JSON.parse(decryptedStr)
          if (creds && String(creds.page_id) === String(recipientId)) {
            matchedAccount = { ...acc, credentials: creds }
            break
          }
        } catch {}
      }
    }

    // 2. Fallback: if not matched by recipientId, search for the active account on this platform
    if (!matchedAccount) {
      const activeAcc = (accounts || []).find(a => a.is_active)
      if (activeAcc && activeAcc.encrypted_credentials) {
        try {
          const decryptedStr = decrypt(activeAcc.encrypted_credentials)
          const creds = JSON.parse(decryptedStr)
          matchedAccount = { ...activeAcc, credentials: creds }
        } catch {}
      }
    }

    // 3. Resolve the config options: prefer account-specific fields, fall back to global config
    const pageId = matchedAccount?.credentials?.page_id || process.env.META_PAGE_ID || ''
    const igId = matchedAccount?.credentials?.instagram_business_id || matchedAccount?.credentials?.page_id || process.env.INSTAGRAM_BUSINESS_ID || ''
    
    // Skip if sender is ourselves
    if ((pageId && senderId === pageId) || (igId && senderId === igId)) return

    // Load global settings for fallback
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
        'THREAD_AI_CONFIGS',
        'AI_STATIC_REPLY_OVERRIDE',
        'AI_STATIC_REPLY_ENABLED',
        'AI_RESPONSE_LENGTH'
      ])

    const settings: Record<string, string> = {}
    for (const r of configRows || []) {
      settings[r.key] = r.value || ''
    }

    // Resolve rules: account-specific or fallback to global
    let rules = []
    if (matchedAccount && matchedAccount.auto_reply_rules) {
      rules = Array.isArray(matchedAccount.auto_reply_rules) 
        ? matchedAccount.auto_reply_rules 
        : JSON.parse(JSON.stringify(matchedAccount.auto_reply_rules))
    } else {
      rules = settings.AUTO_REPLY_RULES ? JSON.parse(settings.AUTO_REPLY_RULES) : []
    }

    // Resolve chatbot enabled status
    let globalChatbotEnabled = false
    if (matchedAccount && matchedAccount.chatbot_enabled !== undefined && matchedAccount.chatbot_enabled !== null) {
      globalChatbotEnabled = !!matchedAccount.chatbot_enabled
    } else {
      globalChatbotEnabled = settings.AI_CHATBOT_ENABLED === 'true'
    }

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
    let chatbotPersona = 'You are a helpful, professional business assistant.'
    if (matchedAccount && matchedAccount.chatbot_persona) {
      chatbotPersona = matchedAccount.chatbot_persona
    } else {
      chatbotPersona = settings.AI_CHATBOT_PERSONA || chatbotPersona
    }
    if (threadConfig.persona) {
      chatbotPersona = threadConfig.persona
    }

    // 3. Delays override
    const firstReplyDelay = threadConfig.firstReplyDelay !== undefined
      ? Number(threadConfig.firstReplyDelay)
      : (matchedAccount && matchedAccount.first_reply_delay !== undefined && matchedAccount.first_reply_delay !== null
          ? Number(matchedAccount.first_reply_delay)
          : (settings.AI_FIRST_REPLY_DELAY ? Number(settings.AI_FIRST_REPLY_DELAY) : 8))

    const conversationDelay = threadConfig.conversationDelay !== undefined
      ? Number(threadConfig.conversationDelay)
      : (matchedAccount && matchedAccount.conversation_delay !== undefined && matchedAccount.conversation_delay !== null
          ? Number(matchedAccount.conversation_delay)
          : (settings.AI_CONVERSATION_DELAY ? Number(settings.AI_CONVERSATION_DELAY) : 4))

    // 4. Static test reply override
    const staticReplyEnabled = threadConfig.staticReplyEnabled !== undefined
      ? !!threadConfig.staticReplyEnabled
      : (matchedAccount && matchedAccount.static_reply_enabled !== undefined && matchedAccount.static_reply_enabled !== null
          ? !!matchedAccount.static_reply_enabled
          : (settings.AI_STATIC_REPLY_ENABLED === 'true'))

    const staticReply = threadConfig.staticReply !== undefined
      ? threadConfig.staticReply
      : (matchedAccount && matchedAccount.static_reply_override !== undefined && matchedAccount.static_reply_override !== null
          ? matchedAccount.static_reply_override
          : (settings.AI_STATIC_REPLY_OVERRIDE || ''))

    // Response length → token limits (default to short for concise responses)
    const responseLength: 'extra_small' | 'short' | 'medium' | 'long' = threadConfig.responseLength || settings.AI_RESPONSE_LENGTH || 'medium'
    const maxTokensMap = { extra_small: 30, short: 60, medium: 150, long: 350 }

    const textLower = messageText.toLowerCase()
    let replied = false
    let replyContent = ''
    let matchedType: 'static_override' | 'keyword' | 'gemini_ai' | 'none' = 'none'
    let modelUsed = ''

    // 0. Static Reply Override check
    if (staticReplyEnabled && staticReply.trim()) {
      console.log(`[AutoReply] Static reply override matched: "${staticReply}"`)
      replyContent = staticReply.trim()
      replied = true
      matchedType = 'static_override'
    }

    // 1. Keyword check (only if not already replied by static override)
    if (!replied) {
      for (const rule of rules) {
        const keywords = Array.isArray(rule.keywords) ? rule.keywords : String(rule.keywords || '').split(',')
        const matched = keywords.some((kw: string) => textLower.includes(kw.trim().toLowerCase()))
        if (matched && rule.reply) {
          console.log(`[AutoReply] Keyword match for "${messageText}".`)
          replyContent = rule.reply
          replied = true
          matchedType = 'keyword'
          break
        }
      }
    }

    // 2. AI Chatbot check
    if (!replied && chatbotEnabled) {
      console.log(`[AutoReply] Generating AI response for "${messageText}"...`)
      const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY || ''
      const { generateWithGemini } = await import('@/lib/gemini')
      const lengthInstruction = responseLength === 'extra_small'
        ? 'Reply in MAXIMUM 5-8 words. Extremely short and punchy.'
        : responseLength === 'short'
        ? 'Reply in MAXIMUM 1 short sentence. Be very concise.'
        : responseLength === 'long'
        ? 'Reply in 4-5 sentences. Be expressive and detailed.'
        : 'Reply in 1-3 short sentences. Be natural and conversational.'

      const systemPrompt = `${chatbotPersona}
 
CRITICAL RULES (NEVER BREAK THESE):
- Output ONLY your direct conversational text response. DO NOT include internal reasoning, draft options (e.g. *Draft 1:*), explanations, or quotes.
- ${lengthInstruction}
- You are replying to an Instagram DM as Smriti. Never admit you are an AI or bot.
- Share link https://smritishans.mywebsite.social/ naturally when relevant.
- Plain conversational text only. No markdown formatting.`

      const { text: rawAiReply, model } = await generateWithGemini(
        {
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: messageText }] }],
          generationConfig: { maxOutputTokens: maxTokensMap[responseLength] || 150, temperature: 0.75 },
        },
        apiKey
      )

      // Sanitize output to strip any draft annotations or thought blocks
      let cleanedReply = rawAiReply.trim()
      if (cleanedReply.includes('Draft') || cleanedReply.includes('* User:') || cleanedReply.includes('* Persona:')) {
        const quoteMatches = Array.from(cleanedReply.matchAll(/"([^"]+)"/g))
        if (quoteMatches.length > 0) {
          cleanedReply = quoteMatches[quoteMatches.length - 1][1]
        } else {
          cleanedReply = cleanedReply.replace(/\*[^*]+\*/g, '').trim()
        }
      }
      cleanedReply = cleanedReply.replace(/^["'`]+|["'`]+$/g, '').trim()

      if (cleanedReply) {
        replyContent = cleanedReply
        replied = true
        matchedType = 'gemini_ai'
        modelUsed = model
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
                
                // Strict consecutive guard: Skip if latest message is from the bot
                if (msgs.length > 0) {
                  const latestMsg = msgs[0]
                  const latestFromId = latestMsg.from?.id
                  if (!latestFromId || latestFromId === igId) {
                    console.log(`[AutoReply] Skipping webhook: Bot already replied last.`)
                    return NextResponse.json({ success: true, message: 'Bot already replied last.' })
                  }
                }

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

                // Strict consecutive guard: Skip if latest message is from the bot
                if (msgs.length > 0) {
                  const latestMsg = msgs[0]
                  const latestFromId = latestMsg.from?.id
                  if (!latestFromId || latestFromId === pageId) {
                    console.log(`[AutoReply] Skipping webhook: Bot already replied last.`)
                    return NextResponse.json({ success: true, message: 'Bot already replied last.' })
                  }
                }

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

      const tokenOverride = matchedAccount?.credentials?.access_token || undefined

      // Show typing indicator to recipient (gives real-time "typing..." bubble) periodically during the delay to look natural
      if (platform === 'instagram') {
        await InstagramService.sendTypingIndicator(senderId, 'typing_on', tokenOverride).catch(() => {})
      }

      if (delaySec > 0) {
        console.log(`[AutoReply] Sleeping for ${delaySec} seconds before dispatching reply...`)
        const intervalTime = 3000
        const totalMs = delaySec * 1000
        let elapsedMs = 0

        while (elapsedMs < totalMs) {
          const waitMs = Math.min(intervalTime, totalMs - elapsedMs)
          await new Promise(resolve => setTimeout(resolve, waitMs))
          elapsedMs += waitMs
          if (elapsedMs < totalMs && platform === 'instagram') {
            await InstagramService.sendTypingIndicator(senderId, 'typing_on', tokenOverride).catch(() => {})
          }
        }
      } else {
        await new Promise(resolve => setTimeout(resolve, 800))
      }

      console.log(`[AutoReply] Sending reply: "${replyContent.slice(0, 60)}..."`)
      let sendSuccess = false
      let sendError = ''
      if (platform === 'instagram') {
        const sendRes = await InstagramService.sendDM(senderId, replyContent, tokenOverride)
        sendSuccess = sendRes.success
        sendError = sendRes.error?.message || ''
      } else {
        const pageIdOverride = matchedAccount?.credentials?.page_id || undefined
        const sendRes = await FacebookService.sendMessage(senderId, replyContent, tokenOverride, pageIdOverride)
        sendSuccess = sendRes.success
        sendError = sendRes.error?.message || ''
      }

      if (sendSuccess) {
        // Log success
        await logAutoReplyEvent({
          timestamp: new Date().toISOString(),
          platform,
          senderId,
          message: messageText,
          matchedType,
          replyContent,
          status: 'sent',
          modelUsed
        })
      } else {
        console.error(`[AutoReply] sendDM failed: ${sendError}`)
        await logAutoReplyEvent({
          timestamp: new Date().toISOString(),
          platform,
          senderId,
          message: messageText,
          matchedType,
          replyContent,
          status: 'failed',
          error: sendError,
          modelUsed
        })
      }
    } else {
      // Log skipped
      await logAutoReplyEvent({
        timestamp: new Date().toISOString(),
        platform,
        senderId,
        message: messageText,
        matchedType: 'none',
        replyContent: '',
        status: 'skipped'
      })
    }
  } catch (err: any) {
    console.error('[AutoReply] Processor error:', err.message)
    // Log failure
    try {
      await logAutoReplyEvent({
        timestamp: new Date().toISOString(),
        platform,
        senderId,
        message: messageText,
        matchedType: 'none',
        replyContent: '',
        status: 'failed',
        error: err.message
      })
    } catch {}
  }
}

// Helper to record raw incoming webhook payloads
async function logIncomingWebhookEvent(object: string, payload: any) {
  try {
    const { data } = await supabaseAdmin
      .from('meta_config')
      .select('value')
      .eq('key', 'WEBHOOK_INCOMING_LOGS')
      .single()

    let logs: any[] = []
    if (data?.value) {
      try {
        logs = JSON.parse(data.value)
      } catch {}
    }

    let senderId = 'unknown'
    let messageSnippet = ''
    try {
      if (payload.entry?.[0]?.messaging?.[0]) {
        const m = payload.entry[0].messaging[0]
        senderId = m.sender?.id || 'unknown'
        messageSnippet = m.message?.text || ''
      } else if (payload.entry?.[0]?.changes?.[0]?.value) {
        const val = payload.entry[0].changes[0].value
        senderId = val.from?.id || 'unknown'
        messageSnippet = val.text || ''
      }
    } catch {}

    logs.unshift({
      timestamp: new Date().toISOString(),
      object,
      senderId,
      snippet: messageSnippet,
      payload
    })

    logs = logs.slice(0, 50)

    await supabaseAdmin
      .from('meta_config')
      .upsert({
        key: 'WEBHOOK_INCOMING_LOGS',
        value: JSON.stringify(logs),
        encrypted: false,
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' })
  } catch (err: any) {
    console.error('[logIncomingWebhookEvent] Error saving log:', err.message)
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

    // Log the raw incoming webhook event
    await logIncomingWebhookEvent(object || 'unknown', body)

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

            // Skip echos (messages sent by our own bot/page)
            if (msgEvent.message?.is_echo) {
              console.log('[Meta Webhook] Skipping message echo event from ourselves.')
              continue
            }

            // Deduplicate message processing using message mid
            const mid = msgEvent.message?.mid
            if (mid) {
              if (processedMids.has(mid)) {
                console.log(`[Meta Webhook] Already processed message ID: ${mid}. Skipping duplicate.`)
                continue
              }
              processedMids.add(mid)
              // Keep cache size small
              if (processedMids.size > 500) {
                const firstItem = processedMids.values().next().value
                if (firstItem) processedMids.delete(firstItem)
              }
            }

            const recipientId = msgEvent.recipient?.id || entry.id
            if (senderId && text && recipientId) {
              // Trigger asynchronously to avoid blocking the HTTP response, 
              // which completely prevents Meta webhook retries/duplicates.
              handleAutoReply(platform, senderId, text, recipientId).catch(err => {
                console.error('[Meta Webhook] handleAutoReply failed:', err.message)
              })
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
