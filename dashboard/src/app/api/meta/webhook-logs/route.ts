import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// GET /api/meta/webhook-logs
// Returns the recent incoming webhook event logs
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('meta_config')
      .select('value')
      .eq('key', 'WEBHOOK_INCOMING_LOGS')
      .single()

    if (error && error.code !== 'PGRST116') throw error

    let logs = []
    if (data?.value) {
      try {
        logs = JSON.parse(data.value)
      } catch {}
    }

    return NextResponse.json({ success: true, logs })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}

// DELETE /api/meta/webhook-logs
// Clears the webhook logs
export async function DELETE() {
  try {
    const { error } = await supabaseAdmin
      .from('meta_config')
      .upsert({
        key: 'WEBHOOK_INCOMING_LOGS',
        value: JSON.stringify([]),
        encrypted: false,
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' })

    if (error) throw error

    return NextResponse.json({ success: true, message: 'Webhook logs cleared' })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
