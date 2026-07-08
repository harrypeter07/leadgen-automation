// dashboard/src/app/api/email/send/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { MetaSettingsService } from '@/lib/meta/meta-settings-service'
import { generateTemplate } from '@/lib/email/email-components'
import nodemailer from 'nodemailer'

export const dynamic = 'force-dynamic'

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

/**
 * Scan email elements for potential spam indicators.
 */
function scanForSpam(subject: string, bodyContent: string): { score: number; triggers: string[] } {
  let score = 0
  const triggers: string[] = []

  // 1. ALL CAPS checker
  const capsSubject = subject.replace(/[^A-Z]/g, '').length
  if (subject.length > 5 && (capsSubject / subject.length) > 0.4) {
    score += 2
    triggers.push('Subject has high ratio of capital letters')
  }

  // 2. Exclamation marks
  const subjectExcl = (subject.match(/!/g) || []).length
  if (subjectExcl > 1) {
    score += 1.5
    triggers.push('Multiple exclamation marks in subject')
  }
  const bodyExcl = (bodyContent.match(/!/g) || []).length
  if (bodyExcl > 3) {
    score += 1.5
    triggers.push('Too many exclamation marks in body')
  }
  if (bodyContent.includes('!!') || bodyContent.includes('!!!')) {
    score += 2
    triggers.push('Consecutive exclamation marks')
  }

  // 3. Spam trigger words list
  const SPAM_KEYWORDS = [
    'urgent', 'important', 'free', 'limited', 'offer', 'congratulations', 'winner',
    'smtp', 'oauth', 'infrastructure', 'ssl', 'serverless', 'integration', 'deployment',
    'port 465', 'verified smtp', 'webhook', 'automation pipeline', 'authentication',
    'cold email', 'cloud infrastructure', 'buy now', 'make money', 'guaranteed'
  ]
  const combined = `${subject} ${bodyContent}`.toLowerCase()
  for (const kw of SPAM_KEYWORDS) {
    if (combined.includes(kw)) {
      score += 2
      triggers.push(`Contains spam keyword: "${kw}"`)
    }
  }

  // 4. Overuse of emojis
  const emojiRegex = /[\uD800-\uDFFF\u2600-\u27BF]/g
  const emojis = (combined.match(emojiRegex) || []).length
  if (emojis > 2) {
    score += 1.5
    triggers.push(`Too many emojis (${emojis})`)
  }

  // 5. Link count limitation
  const links = (bodyContent.match(/<a\s/g) || []).length
  if (links > 2) {
    score += 2
    triggers.push(`Too many links (${links})`)
  }

  return { score, triggers }
}

/**
 * Auto-generate a high-quality plain text fallback version from HTML.
 */
function htmlToPlain(html: string): string {
  let text = html
  text = text.replace(/<br\s*\/?>/gi, '\n')
  text = text.replace(/<\/p>/gi, '\n\n')
  text = text.replace(/<\/div>/gi, '\n')
  text = text.replace(/<\/li>/gi, '\n')
  text = text.replace(/<a\s+(?:[^>]*?\s+)?href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '$2 ($1)')
  text = text.replace(/<[^>]+>/g, '')
  text = text.replace(/&nbsp;/gi, ' ')
  text = text.replace(/\n{3,}/g, '\n\n')
  return text.trim()
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    let { to, subject, html, text, type = 'outreach', variables = {} } = body

    if (!to || (!html && !body.body)) {
      return NextResponse.json({ error: 'Missing to, or email content body' }, { status: 400 })
    }

    const rawContent = html || body.body || ''

    // ── 0. Sandbox Redirection Interceptor ──────────────────
    const toLower = to.toLowerCase().trim()
    if (!ALLOWED_TEST_EMAILS.map(e => e.toLowerCase()).includes(toLower)) {
      const interceptedTo = ALLOWED_TEST_EMAILS[Math.floor(Math.random() * ALLOWED_TEST_EMAILS.length)]
      console.log(`[NextEmailApi] Sandbox Interceptor: Redirected email for ${to} to ${interceptedTo}`)
      to = interceptedTo
    }

    // ── 1. Spam Scanner & Filter ────────────────────────────
    const spamCheck = scanForSpam(subject || 'System Notification', rawContent)
    let spamWarning = null
    if (spamCheck.score >= 4) {
      spamWarning = {
        message: 'Spam trigger thresholds exceeded',
        triggers: spamCheck.triggers,
        score: spamCheck.score
      }
      console.warn(`[NextEmailApi] Spam warning triggered for email to ${to}: Score ${spamCheck.score}. Triggers: ${spamCheck.triggers.join(', ')}`)
    }

    // ── 2. Fetch config from DB ──────────────────────────────
    const dbSettings = await MetaSettingsService.getFromDB() as Record<string, string>
    
    const smtpUser = dbSettings.SMTP_USER || process.env.NODEMAILER_USER
    const smtpPass = dbSettings.SMTP_PASS || process.env.NODEMAILER_APP_PASSWORD
    const smtpFromName = dbSettings.SMTP_FROM_NAME || process.env.NODEMAILER_FROM_NAME || 'Outreach'
    
    const resendKey = dbSettings.RESEND_API_KEY || process.env.RESEND_API_KEY
    const resendFromEmail = dbSettings.RESEND_FROM_EMAIL || process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'

    // Compile dynamic layout templates
    const emailVariables = {
      ...variables,
      email: to,
      firstName: variables.firstName || '',
      company: variables.company || ''
    }

    const compiled = generateTemplate(type, rawContent, emailVariables)
    const finalSubject = subject || compiled.subject
    const finalHtml = compiled.html
    const finalPlain = text || htmlToPlain(finalHtml)

    // ── 3. Nodemailer Transporter ───────────────────────────
    let transport = null
    if (smtpUser && smtpPass) {
      transport = nodemailer.createTransport({
        pool: true, // connection pooling enabled
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

    let nodemailerError = null
    if (transport) {
      try {
        const info = await transport.sendMail({
          from: `"${smtpFromName}" <${smtpUser}>`,
          to,
          subject: finalSubject,
          html: finalHtml,
          text: finalPlain,
        })
        console.log(`[NextEmailApi] Sent via Nodemailer/Gmail SMTP: ${info.messageId}`)
        return NextResponse.json({
          provider: 'nodemailer',
          response: { messageId: info.messageId },
          mock: false,
          redirected_to: to,
          spam_warning: spamWarning
        })
      } catch (err: any) {
        nodemailerError = err.message
        console.warn(`[NextEmailApi] Nodemailer failed: ${err.message}`)
      }
    }

    // ── 4. Resend API Fallback ───────────────────────────────
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
            subject: finalSubject,
            html: finalHtml,
            text: finalPlain
          })
        })
        
        const data = await res.json()
        if (res.ok) {
          console.log(`[NextEmailApi] Sent via Resend API: ${data.id}`)
          return NextResponse.json({
            provider: 'resend',
            response: data,
            mock: false,
            redirected_to: to,
            spam_warning: spamWarning
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

    // ── 5. Mock Fallback ─────────────────────────────────────
    return NextResponse.json({
      provider: 'mock',
      response: {
        note: 'Neither Nodemailer nor Resend is configured successfully on NextJS Serverless API.',
        nodemailer_error: nodemailerError,
        resend_error: resendError
      },
      mock: true,
      redirected_to: to,
      spam_warning: spamWarning
    })

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
