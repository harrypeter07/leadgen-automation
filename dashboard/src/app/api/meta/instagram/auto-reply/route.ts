import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// GET /api/meta/instagram/auto-reply
// Returns auto-reply settings: rules, chatbot enabled status, chatbot persona, and delays
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('meta_config')
      .select('key, value')
      .in('key', [
        'AUTO_REPLY_RULES',
        'AI_CHATBOT_ENABLED',
        'AI_CHATBOT_PERSONA',
        'SAVED_CHATBOT_PERSONAS',
        'AI_FIRST_REPLY_DELAY',
        'AI_CONVERSATION_DELAY',
        'AI_STATIC_REPLY_OVERRIDE'
      ])

    if (error) throw error

    const settings: Record<string, string> = {}
    for (const row of data || []) {
      settings[row.key] = row.value || ''
    }

    let rules = []
    try {
      rules = settings.AUTO_REPLY_RULES ? JSON.parse(settings.AUTO_REPLY_RULES) : []
    } catch {}

    let personas = []
    try {
      personas = settings.SAVED_CHATBOT_PERSONAS ? JSON.parse(settings.SAVED_CHATBOT_PERSONAS) : []
    } catch {}

    return NextResponse.json({
      success: true,
      rules,
      chatbotEnabled: settings.AI_CHATBOT_ENABLED === 'true',
      chatbotPersona: settings.AI_CHATBOT_PERSONA || '',
      personas,
      firstReplyDelay: settings.AI_FIRST_REPLY_DELAY !== undefined ? Number(settings.AI_FIRST_REPLY_DELAY) : 5,
      conversationDelay: settings.AI_CONVERSATION_DELAY !== undefined ? Number(settings.AI_CONVERSATION_DELAY) : 2,
      staticReply: settings.AI_STATIC_REPLY_OVERRIDE || '',
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST /api/meta/instagram/auto-reply
// Saves rules, chatbot status, persona, delays, or saved personas list
export async function POST(req: NextRequest) {
  try {
    const { rules, chatbotEnabled, chatbotPersona, personas, firstReplyDelay, conversationDelay, staticReply } = await req.json()

    const rows = []

    if (rules !== undefined) {
      rows.push({
        key: 'AUTO_REPLY_RULES',
        value: JSON.stringify(rules),
        encrypted: false,
        updated_at: new Date().toISOString(),
      })
    }

    if (chatbotEnabled !== undefined) {
      rows.push({
        key: 'AI_CHATBOT_ENABLED',
        value: chatbotEnabled ? 'true' : 'false',
        encrypted: false,
        updated_at: new Date().toISOString(),
      })
    }

    if (chatbotPersona !== undefined) {
      rows.push({
        key: 'AI_CHATBOT_PERSONA',
        value: chatbotPersona,
        encrypted: false,
        updated_at: new Date().toISOString(),
      })
    }

    if (personas !== undefined) {
      rows.push({
        key: 'SAVED_CHATBOT_PERSONAS',
        value: JSON.stringify(personas),
        encrypted: false,
        updated_at: new Date().toISOString(),
      })
    }

    if (firstReplyDelay !== undefined) {
      rows.push({
        key: 'AI_FIRST_REPLY_DELAY',
        value: String(firstReplyDelay),
        encrypted: false,
        updated_at: new Date().toISOString(),
      })
    }

    if (conversationDelay !== undefined) {
      rows.push({
        key: 'AI_CONVERSATION_DELAY',
        value: String(conversationDelay),
        encrypted: false,
        updated_at: new Date().toISOString(),
      })
    }

    if (staticReply !== undefined) {
      rows.push({
        key: 'AI_STATIC_REPLY_OVERRIDE',
        value: staticReply,
        encrypted: false,
        updated_at: new Date().toISOString(),
      })
    }

    if (rows.length > 0) {
      const { error } = await supabaseAdmin
        .from('meta_config')
        .upsert(rows, { onConflict: 'key' })

      if (error) throw error
    }

    return NextResponse.json({ success: true, message: 'Settings saved successfully' })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
