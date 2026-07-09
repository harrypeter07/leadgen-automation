import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// POST /api/automation/outreach/email/send
// body: { leadIds: string[] }
// Sends personalized emails via Resend API for leads that have AI drafts

export async function POST(req: NextRequest) {
  try {
    const { leadIds } = await req.json()
    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return NextResponse.json({ error: 'leadIds array required' }, { status: 400 })
    }

    const resendApiKey = process.env.RESEND_API_KEY || ''
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'
    const fromName = process.env.SMTP_FROM_NAME || 'WHSoftec'

    if (!resendApiKey) {
      return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 503 })
    }

    // Fetch leads with drafts
    const { data: leads, error: fetchErr } = await supabaseAdmin
      .from('leads')
      .select('id,name,email,ai_message_email_subject,ai_message_email_body')
      .in('id', leadIds)

    if (fetchErr || !leads) {
      return NextResponse.json({ error: fetchErr?.message || 'Failed to fetch leads' }, { status: 500 })
    }

    const results: { id: string; name: string; email: string; success: boolean; error?: string }[] = []

    for (const lead of leads) {
      if (!lead.email) {
        results.push({ id: lead.id, name: lead.name, email: '', success: false, error: 'No email address' })
        continue
      }
      if (!lead.ai_message_email_subject || !lead.ai_message_email_body) {
        results.push({ id: lead.id, name: lead.name, email: lead.email, success: false, error: 'No AI draft generated' })
        continue
      }

      try {
        const resendRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: `${fromName} <${fromEmail}>`,
            to: [lead.email],
            subject: lead.ai_message_email_subject,
            text: lead.ai_message_email_body,
            html: `<div style="font-family:sans-serif;max-width:600px;line-height:1.6">${lead.ai_message_email_body.split('\n').map((p: string) => p ? `<p>${p}</p>` : '').join('')}</div>`,
          }),
        })

        const resendData = await resendRes.json()
        if (resendRes.ok && resendData.id) {
          // Mark as sent in Supabase
          await supabaseAdmin.from('leads').update({ status: 'contacted' }).eq('id', lead.id)
          results.push({ id: lead.id, name: lead.name, email: lead.email, success: true })
        } else {
          results.push({ id: lead.id, name: lead.name, email: lead.email, success: false, error: resendData.message || 'Resend error' })
        }
      } catch (err) {
        results.push({ id: lead.id, name: lead.name, email: lead.email, success: false, error: err instanceof Error ? err.message : 'Send error' })
      }
    }

    const sent = results.filter(r => r.success).length
    return NextResponse.json({
      success: sent > 0,
      sent,
      failed: results.length - sent,
      results,
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Send failed' }, { status: 500 })
  }
}
