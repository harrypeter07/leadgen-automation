import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// GET /api/meta/instagram/thread-config?senderId=...
// Returns the current thread configurations
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const senderId = searchParams.get('senderId')

    const { data, error } = await supabaseAdmin
      .from('meta_config')
      .select('value')
      .eq('key', 'THREAD_AI_CONFIGS')
      .single()

    let configs: Record<string, any> = {}
    if (data?.value) {
      try {
        configs = JSON.parse(data.value)
      } catch {}
    }

    if (senderId) {
      return NextResponse.json({ success: true, config: configs[senderId] || null })
    }

    return NextResponse.json({ success: true, configs })
  } catch (err: any) {
    return NextResponse.json({ success: true, configs: {}, config: null })
  }
}

// POST /api/meta/instagram/thread-config
// body: { senderId: string, enabled?: boolean, firstReplyDelay?: number, conversationDelay?: number, persona?: string, staticReply?: string }
// Updates custom configuration for a specific conversation/thread
export async function POST(req: NextRequest) {
  try {
    const { senderId, enabled, firstReplyDelay, conversationDelay, persona, staticReply } = await req.json()
    if (!senderId) {
      return NextResponse.json({ error: 'senderId is required' }, { status: 400 })
    }

    // 1. Fetch current configs
    const { data } = await supabaseAdmin
      .from('meta_config')
      .select('value')
      .eq('key', 'THREAD_AI_CONFIGS')
      .single()

    let configs: Record<string, any> = {}
    if (data?.value) {
      try {
        configs = JSON.parse(data.value)
      } catch {}
    }

    // 2. Set/Merge override
    configs[senderId] = {
      ...configs[senderId],
      ...(enabled !== undefined ? { enabled } : {}),
      ...(firstReplyDelay !== undefined ? { firstReplyDelay } : {}),
      ...(conversationDelay !== undefined ? { conversationDelay } : {}),
      ...(persona !== undefined ? { persona } : {}),
      ...(staticReply !== undefined ? { staticReply } : {}),
    }

    // 3. Save back to meta_config
    const { error } = await supabaseAdmin
      .from('meta_config')
      .upsert({
        key: 'THREAD_AI_CONFIGS',
        value: JSON.stringify(configs),
        encrypted: false,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' })

    if (error) throw error

    return NextResponse.json({ success: true, configs })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
