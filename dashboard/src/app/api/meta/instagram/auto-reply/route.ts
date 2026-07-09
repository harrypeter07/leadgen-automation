import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// GET /api/meta/instagram/auto-reply
// Returns auto-reply settings: rules, chatbot enabled status, and chatbot persona
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('meta_config')
      .select('key, value')
      .in('key', ['AUTO_REPLY_RULES', 'AI_CHATBOT_ENABLED', 'AI_CHATBOT_PERSONA'])

    if (error) throw error

    const settings: Record<string, string> = {}
    for (const row of data || []) {
      settings[row.key] = row.value || ''
    }

    let rules = []
    try {
      rules = settings.AUTO_REPLY_RULES ? JSON.parse(settings.AUTO_REPLY_RULES) : []
    } catch {}

    return NextResponse.json({
      success: true,
      rules,
      chatbotEnabled: settings.AI_CHATBOT_ENABLED === 'true',
      chatbotPersona: settings.AI_CHATBOT_PERSONA || '',
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST /api/meta/instagram/auto-reply
// Saves rules, chatbot status, or persona
export async function POST(req: NextRequest) {
  try {
    const { rules, chatbotEnabled, chatbotPersona } = await req.json()

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
