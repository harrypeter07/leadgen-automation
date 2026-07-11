import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { MetaSettingsService } from '@/lib/meta/meta-settings-service'
import nodemailer from 'nodemailer'

const ALLOWED_TEST_EMAILS = [
  'hassanmansuri570@gmail.com',
  'hmansuri882@gmail.com',
  'mansurihh@rknec.edu',
  'hassanmansuri379@gmail.com',
  'fgdgb62@gmail.com',
  'forhassan57@gmail.com',
  'sheikhafsana710@gmail.com',
  'whsofttech2026@gmail.com',
  'ayanmansuri0404@gmail.com'
]

// POST /api/automation/outreach/email/send
// body: { leadIds: string[] }
// Sends personalized emails via Nodemailer SMTP or Resend API for leads that have AI drafts

export async function POST(req: NextRequest) {
  try {
    const { leadIds } = await req.json()
    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return NextResponse.json({ error: 'leadIds array required' }, { status: 400 })
    }

    // Load configuration from DB & Env
    const dbSettings = await MetaSettingsService.getFromDB() as Record<string, string>
    
    const smtpUser = dbSettings.SMTP_USER || process.env.NODEMAILER_USER
    const smtpPass = dbSettings.SMTP_PASS || process.env.NODEMAILER_APP_PASSWORD
    const smtpFromName = dbSettings.SMTP_FROM_NAME || process.env.NODEMAILER_FROM_NAME || 'Outreach'
    
    const resendApiKey = dbSettings.RESEND_API_KEY || process.env.RESEND_API_KEY || ''
    const fromEmail = dbSettings.RESEND_FROM_EMAIL || process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'

    // Fetch leads with drafts
    const { data: leads, error: fetchErr } = await supabaseAdmin
      .from('leads')
      .select('id,name,email,ai_message_email_subject,ai_message_email_body')
      .in('id', leadIds)

    if (fetchErr || !leads) {
      return NextResponse.json({ error: fetchErr?.message || 'Failed to fetch leads' }, { status: 500 })
    }

    const results: { id: string; name: string; email: string; success: boolean; error?: string }[] = []

    // Setup Nodemailer Transporter if credentials exist
    let transport: nodemailer.Transporter | null = null
    if (smtpUser && smtpPass) {
      transport = nodemailer.createTransport({
        pool: true,
        maxConnections: 5,
        maxMessages: 50,
        service: 'gmail',
        auth: {
          user: smtpUser.trim(),
          pass: smtpPass.trim(),
        },
        connectionTimeout: 5000,
        greetingTimeout: 5000,
        socketTimeout: 5000,
      })
    }

    for (const lead of leads) {
      if (!lead.email) {
        results.push({ id: lead.id, name: lead.name, email: '', success: false, error: 'No email address' })
        continue
      }
      if (!lead.ai_message_email_subject || !lead.ai_message_email_body) {
        results.push({ id: lead.id, name: lead.name, email: lead.email, success: false, error: 'No AI draft generated' })
        continue
      }

      // Sandbox Redirection Interceptor
      let recipientEmail = lead.email
      const toLower = recipientEmail.toLowerCase().trim()
      if (!ALLOWED_TEST_EMAILS.map(e => e.toLowerCase()).includes(toLower)) {
        recipientEmail = ALLOWED_TEST_EMAILS[Math.floor(Math.random() * ALLOWED_TEST_EMAILS.length)]
        console.log(`[BatchEmailApi] Sandbox Interceptor: Redirected email for ${lead.email} to ${recipientEmail}`)
      }

      const subject = lead.ai_message_email_subject
      const textBody = lead.ai_message_email_body
      const htmlBody = `<div style="font-family:sans-serif;max-width:600px;line-height:1.6">${textBody.split('\n').map((p: string) => p ? `<p>${p}</p>` : '').join('')}</div>`

      let sentSuccess = false
      let currentError = ''

      // 1. Try Nodemailer Gmail SMTP
      if (transport && smtpUser) {
        try {
          const info = await transport.sendMail({
            from: `"${smtpFromName}" <${smtpUser.trim()}>`,
            to: recipientEmail,
            subject,
            html: htmlBody,
            text: textBody,
          })
          console.log(`[BatchEmailApi] Sent lead ${lead.id} via SMTP: ${info.messageId}`)
          sentSuccess = true
        } catch (err: any) {
          currentError = `SMTP: ${err.message}`
          console.warn(`[BatchEmailApi] SMTP failed for lead ${lead.id}: ${err.message}`)
        }
      }

      // 2. Try Resend API Fallback
      if (!sentSuccess && resendApiKey) {
        try {
          const resendRes = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${resendApiKey.trim()}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: `${smtpFromName} <${fromEmail.trim()}>`,
              to: [recipientEmail],
              subject,
              text: textBody,
              html: htmlBody,
            }),
          })

          const resendData = await resendRes.json()
          if (resendRes.ok && resendData.id) {
            console.log(`[BatchEmailApi] Sent lead ${lead.id} via Resend: ${resendData.id}`)
            sentSuccess = true
          } else {
            const resendMsg = resendData.message || 'Resend error'
            currentError = currentError ? `${currentError} | Resend: ${resendMsg}` : `Resend: ${resendMsg}`
          }
        } catch (err: any) {
          const fetchMsg = err.message || 'Resend fetch failed'
          currentError = currentError ? `${currentError} | Resend: ${fetchMsg}` : `Resend: ${fetchMsg}`
        }
      }

      if (sentSuccess) {
        // Mark as sent in Supabase
        await supabaseAdmin.from('leads').update({ status: 'contacted' }).eq('id', lead.id)
        results.push({ id: lead.id, name: lead.name, email: lead.email, success: true })
      } else {
        const finalErr = currentError || 'No email provider configured'
        results.push({ id: lead.id, name: lead.name, email: lead.email, success: false, error: finalErr })
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
