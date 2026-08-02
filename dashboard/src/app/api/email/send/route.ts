// dashboard/src/app/api/email/send/route.ts
import { withApiHandler } from '@/server/api/handler';
import { ok, fail } from '@/server/api/response';
import { MetaSettingsService } from '@/lib/meta/meta-settings-service';
import { generateTemplate } from '@/lib/email/email-components';
import { Logger } from '@/shared/logging/logger';
import nodemailer from 'nodemailer';

export const dynamic = 'force-dynamic';

const ALLOWED_TEST_EMAILS = [
  'hassanmansuri570@gmail.com',
  'hmansuri882@gmail.com',
  'mansurihh@rknec.edu',
  'hassanmansuri379@gmail.com',
  'fgdgb62@gmail.com',
  'forhassan57@gmail.com',
  'sheikhafsana710@gmail.com',
  'whsofttech2026@gmail.com',
  'ayanmansuri0404@gmail.com',
];

function scanForSpam(subject: string, bodyContent: string): { score: number; triggers: string[] } {
  let score = 0;
  const triggers: string[] = [];

  const capsSubject = subject.replace(/[^A-Z]/g, '').length;
  if (subject.length > 5 && (capsSubject / subject.length) > 0.4) {
    score += 2;
    triggers.push('Subject has high ratio of capital letters');
  }

  const subjectExcl = (subject.match(/!/g) || []).length;
  if (subjectExcl > 1) {
    score += 1.5;
    triggers.push('Multiple exclamation marks in subject');
  }
  const bodyExcl = (bodyContent.match(/!/g) || []).length;
  if (bodyExcl > 3) {
    score += 1.5;
    triggers.push('Too many exclamation marks in body');
  }

  const SPAM_KEYWORDS = [
    'urgent', 'important', 'free', 'limited', 'offer', 'congratulations', 'winner',
    'smtp', 'oauth', 'infrastructure', 'ssl', 'serverless', 'integration', 'deployment',
    'port 465', 'verified smtp', 'webhook', 'automation pipeline', 'authentication',
    'cold email', 'cloud infrastructure', 'buy now', 'make money', 'guaranteed'
  ];
  const combined = `${subject} ${bodyContent}`.toLowerCase();
  for (const kw of SPAM_KEYWORDS) {
    if (combined.includes(kw)) {
      score += 2;
      triggers.push(`Contains spam keyword: "${kw}"`);
    }
  }

  return { score, triggers };
}

function htmlToPlain(html: string): string {
  let text = html;
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/p>/gi, '\n\n');
  text = text.replace(/<\/div>/gi, '\n');
  text = text.replace(/<a\s+(?:[^>]*?\s+)?href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '$2 ($1)');
  text = text.replace(/<[^>]+>/g, '');
  text = text.replace(/&nbsp;/gi, ' ');
  return text.trim();
}

export const POST = withApiHandler(async (req: Request) => {
  const body = await req.json();
  let { to, subject, html, text, type = 'outreach', variables = {} } = body;

  if (!to || (!html && !body.body)) {
    return fail('Missing recipient email or body content', 'VALIDATION_ERROR', 400);
  }

  const rawContent = html || body.body || '';
  const toLower = to.toLowerCase().trim();

  if (!ALLOWED_TEST_EMAILS.map(e => e.toLowerCase()).includes(toLower)) {
    const interceptedTo = ALLOWED_TEST_EMAILS[Math.floor(Math.random() * ALLOWED_TEST_EMAILS.length)];
    Logger.info(`Sandbox Interceptor: Redirected email for ${to} to ${interceptedTo}`, { module: 'EmailApi' });
    to = interceptedTo;
  }

  const spamCheck = scanForSpam(subject || 'System Notification', rawContent);
  let spamWarning = null;
  if (spamCheck.score >= 4) {
    spamWarning = { message: 'Spam trigger thresholds exceeded', triggers: spamCheck.triggers, score: spamCheck.score };
    Logger.warn(`Spam warning triggered for email to ${to}: Score ${spamCheck.score}`, { module: 'EmailApi' });
  }

  const dbSettings = await MetaSettingsService.getFromDB() as Record<string, string>;
  const smtpUser = dbSettings.SMTP_USER || process.env.NODEMAILER_USER;
  const smtpPass = dbSettings.SMTP_PASS || process.env.NODEMAILER_APP_PASSWORD;
  const smtpFromName = dbSettings.SMTP_FROM_NAME || process.env.NODEMAILER_FROM_NAME || 'Outreach';
  const resendKey = dbSettings.RESEND_API_KEY || process.env.RESEND_API_KEY;
  const resendFromEmail = dbSettings.RESEND_FROM_EMAIL || process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

  const emailVariables = { ...variables, email: to, firstName: variables.firstName || '', company: variables.company || '' };
  const compiled = generateTemplate(type, rawContent, emailVariables);
  const finalSubject = subject || compiled.subject;
  const finalHtml = compiled.html;
  const finalPlain = text || htmlToPlain(finalHtml);

  if (smtpUser && smtpPass) {
    try {
      const transport = nodemailer.createTransport({
        pool: true,
        maxConnections: 5,
        service: 'gmail',
        auth: { user: smtpUser.trim(), pass: smtpPass.trim() },
      });
      const info = await transport.sendMail({
        from: `"${smtpFromName}" <${smtpUser}>`,
        to,
        subject: finalSubject,
        html: finalHtml,
        text: finalPlain,
      });
      Logger.info(`Sent email via Nodemailer SMTP: ${info.messageId}`, { module: 'EmailApi' });
      return ok({ provider: 'nodemailer', messageId: info.messageId, redirected_to: to, spam_warning: spamWarning });
    } catch (err: any) {
      Logger.warn(`Nodemailer transport error: ${err.message}`, { module: 'EmailApi' });
    }
  }

  if (resendKey) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${resendKey.trim()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: `${smtpFromName} <${resendFromEmail.trim()}>`, to, subject: finalSubject, html: finalHtml, text: finalPlain }),
      });
      const data = await res.json();
      if (res.ok) {
        Logger.info(`Sent email via Resend API: ${data.id}`, { module: 'EmailApi' });
        return ok({ provider: 'resend', messageId: data.id, redirected_to: to, spam_warning: spamWarning });
      }
    } catch (err: any) {
      Logger.warn(`Resend fetch error: ${err.message}`, { module: 'EmailApi' });
    }
  }

  return ok({
    provider: 'mock',
    response: { note: 'Neither Nodemailer nor Resend active. Sandbox mode enabled.' },
    mock: true,
    redirected_to: to,
    spam_warning: spamWarning,
  });
});
