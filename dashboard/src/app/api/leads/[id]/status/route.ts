import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { LEAD_STATUSES, type LeadStatus } from '@/types/lead'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { status } = body as { status?: string }

    if (!status || !LEAD_STATUSES.includes(status as LeadStatus)) {
      return NextResponse.json(
        { error: `Invalid status. Allowed: ${LEAD_STATUSES.join(', ')}` },
        { status: 400 }
      )
    }

    const { error } = await supabaseAdmin
      .from('leads')
      .update({ status })
      .eq('id', params.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}
