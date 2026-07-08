import { NextRequest, NextResponse } from 'next/server'
import { MetaSettingsService } from '@/lib/meta/meta-settings-service'
import nodemailer from 'nodemailer'

export const dynamic = 'force-dynamic'

const ALLOWED_TEST_EMAILS = [
  'hassanmansuri570@gmail.com',
  'hmansuri882@gmail.com',
  'mansurihh@rknec.edu',
  'hassanmansuri379@gmail.com'
]

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    let { to, subject, html, text } = body

    if (!to || !subject || !html) {
      return NextResponse.json({ error: 'Missing to, subject, or html' }, { status: 400 })
    }

    // ── 0. Sandbox redirection logic ─────────────────────────
    const toLower = to.toLowerCase().trim()
    if (!ALLOWED_TEST_EMAILS.map(e => e.toLowerCase()).includes(toLower)) {
      const interceptedTo = ALLOWED_TEST_EMAILS[Math.floor(Math.random() * ALLOWED_TEST_EMAILS.length)]
      console.log(`[NextEmailApi] Sandbox Interceptor: Redirected email for ${to} to ${interceptedTo}`)
      to = interceptedTo
    }

    // ── 1. Fetch config from DB ──────────────────────────────
    const dbSettings = await MetaSettingsService.getFromDB() as Record<string, string>
    
    const smtpUser = dbSettings.SMTP_USER || process.env.NODEMAILER_USER
    const smtpPass = dbSettings.SMTP_PASS || process.env.NODEMAILER_APP_PASSWORD
    const smtpFromName = dbSettings.SMTP_FROM_NAME || process.env.NODEMAILER_FROM_NAME || 'Outreach'
    
    const resendKey = dbSettings.RESEND_API_KEY || process.env.RESEND_API_KEY
    const resendFromEmail = dbSettings.RESEND_FROM_EMAIL || process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'

    let transport = null
    if (smtpUser && smtpPass) {
      transport = nodemailer.createTransport({
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

    let nodemailerError = null
    if (transport) {
      try {
        const info = await transport.sendMail({
          from: `"${smtpFromName}" <${smtpUser}>`,
          to,
          subject,
          html,
          text: text || html.replace(/<[^>]+>/g, ''),
        })
        console.log(`[NextEmailApi] Sent via Nodemailer/Gmail SMTP: ${info.messageId}`)
        return NextResponse.json({
          provider: 'nodemailer',
          response: { messageId: info.messageId },
          mock: false,
          redirected_to: to
        })
      } catch (err: any) {
        nodemailerError = err.message
        console.warn(`[NextEmailApi] Nodemailer failed: ${err.message}`)
      }
    }

    // ── 2. Resend API Fallback (using native fetch) ───────────
    let resendError = null
    if (resendKey) {
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendKey.trim()}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: `${smtpFromName} <${resendFromEmail.trim()}>`,
            to,
            subject,
            html,
          })
        })
        
        const data = await res.json()
        if (res.ok) {
          console.log(`[NextEmailApi] Sent via Resend API: ${data.id}`)
          return NextResponse.json({
            provider: 'resend',
            response: data,
            mock: false,
            redirected_to: to
          })
        } else {
          resendError = data
          console.warn(`[NextEmailApi] Resend failed with code ${res.status}`)
        }
      } catch (err: any) {
        resendError = err.message
        console.warn(`[NextEmailApi] Resend fetch failed: ${err.message}`)
      }
    }

    // ── 3. Mock Fallback ─────────────────────────────────────
    return NextResponse.json({
      provider: 'mock',
      response: {
        note: 'Neither Nodemailer nor Resend is configured successfully on NextJS Serverless API.',
        nodemailer_error: nodemailerError,
        resend_error: resendError
      },
      mock: true,
      redirected_to: to
    })

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
