import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// GET /api/meta/webhook/logs
// Returns recent incoming raw webhook events & auto-reply execution logs
export async function GET() {
  try {
    const { data: incomingData } = await supabaseAdmin
      .from('meta_config')
      .select('value')
      .eq('key', 'WEBHOOK_INCOMING_LOGS')
      .single()

    const { data: autoReplyData } = await supabaseAdmin
      .from('meta_config')
      .select('value')
      .eq('key', 'AUTO_REPLY_LOGS')
      .single()

    let incomingLogs: any[] = []
    let autoReplyLogs: any[] = []

    if (incomingData?.value) {
      try { incomingLogs = JSON.parse(incomingData.value) } catch {}
    }
    if (autoReplyData?.value) {
      try { autoReplyLogs = JSON.parse(autoReplyData.value) } catch {}
    }

    return NextResponse.json({
      success: true,
      incomingLogs,
      autoReplyLogs
    })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}

// DELETE /api/meta/webhook/logs
// Clears stored webhook logs
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const target = searchParams.get('target') || 'all'

    if (target === 'all' || target === 'incoming') {
      await supabaseAdmin
        .from('meta_config')
        .upsert({ key: 'WEBHOOK_INCOMING_LOGS', value: JSON.stringify([]), encrypted: false, updated_at: new Date().toISOString() }, { onConflict: 'key' })
    }

    if (target === 'all' || target === 'autoReply') {
      await supabaseAdmin
        .from('meta_config')
        .upsert({ key: 'AUTO_REPLY_LOGS', value: JSON.stringify([]), encrypted: false, updated_at: new Date().toISOString() }, { onConflict: 'key' })
    }

    return NextResponse.json({ success: true, message: 'Logs cleared successfully' })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
