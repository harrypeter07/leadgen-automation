import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// GET /api/meta/instagram/thread-autopilot
// Returns the current map of thread overrides: { overrides: Record<string, boolean> }
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('meta_config')
      .select('value')
      .eq('key', 'THREAD_AUTOPILOT_OVERRIDES')
      .single()

    let overrides = {}
    if (data?.value) {
      try {
        overrides = JSON.parse(data.value)
      } catch {}
    }

    return NextResponse.json({ success: true, overrides })
  } catch (err: any) {
    // If table/row is not found, return empty overrides
    return NextResponse.json({ success: true, overrides: {} })
  }
}

// POST /api/meta/instagram/thread-autopilot
// body: { senderId: string, enabled: boolean }
// Updates or toggles autopilot override for a specific conversation/thread
export async function POST(req: NextRequest) {
  try {
    const { senderId, enabled } = await req.json()
    if (!senderId) {
      return NextResponse.json({ error: 'senderId is required' }, { status: 400 })
    }

    // 1. Fetch current overrides
    const { data } = await supabaseAdmin
      .from('meta_config')
      .select('value')
      .eq('key', 'THREAD_AUTOPILOT_OVERRIDES')
      .single()

    let overrides: Record<string, boolean> = {}
    if (data?.value) {
      try {
        overrides = JSON.parse(data.value)
      } catch {}
    }

    // 2. Set override
    overrides[senderId] = enabled

    // 3. Save back to meta_config
    const { error } = await supabaseAdmin
      .from('meta_config')
      .upsert({
        key: 'THREAD_AUTOPILOT_OVERRIDES',
        value: JSON.stringify(overrides),
        encrypted: false,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' })

    if (error) throw error

    return NextResponse.json({ success: true, overrides })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
