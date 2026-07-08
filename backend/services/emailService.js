const nodemailer = require('nodemailer');
const axios = require('axios');
const logger = require('../worker/logger');
const supabase = require('../database/connection');

// ── helpers ──────────────────────────────────────────────

/**
 * Retrieve SMTP and Resend configuration dynamically from Supabase meta_config table.
 */
async function getSMTPConfigFromDB() {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('meta_config')
      .select('key, value')
      .in('key', ['SMTP_USER', 'SMTP_PASS', 'SMTP_FROM_NAME', 'RESEND_API_KEY', 'RESEND_FROM_EMAIL']);
    if (error || !data || data.length === 0) return null;

    const config = {};
    data.forEach(row => {
      config[row.key] = row.value;
    });

    return {
      smtpUser: config.SMTP_USER ? config.SMTP_USER.trim() : null,
      smtpPass: config.SMTP_PASS ? config.SMTP_PASS.trim() : null,
      smtpFromName: config.SMTP_FROM_NAME ? config.SMTP_FROM_NAME.trim() : 'Outreach',
      resendKey: config.RESEND_API_KEY ? config.RESEND_API_KEY.trim() : null,
      resendFromEmail: config.RESEND_FROM_EMAIL ? config.RESEND_FROM_EMAIL.trim() : 'onboarding@resend.dev'
    };
  } catch (err) {
    logger.warn({ error: err.message }, '[EmailService] Failed to load SMTP/Resend config from DB');
  }
  return null;
}

/**
 * Scan content for potential spam trigger indicators.
 */
function scanForSpam(subject, bodyContent) {
  let score = 0;
  const triggers = [];

  // 1. ALL CAPS
  const capsSubject = subject.replace(/[^A-Z]/g, '').length;
  if (subject.length > 5 && (capsSubject / subject.length) > 0.4) {
    score += 2;
    triggers.push('Subject has high ratio of capital letters');
  }

  // 2. Exclamation marks
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
  if (bodyContent.includes('!!') || bodyContent.includes('!!!')) {
    score += 2;
    triggers.push('Consecutive exclamation marks');
  }

  // 3. Spam keywords
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

  // 4. Overuse of emojis
  const emojiRegex = /[\uD800-\uDFFF\u2600-\u27BF]/g;
  const emojis = (combined.match(emojiRegex) || []).length;
  if (emojis > 2) {
    score += 1.5;
    triggers.push(`Too many emojis (${emojis})`);
  }

  // 5. Links limitation
  const links = (bodyContent.match(/<a\s/g) || []).length;
  if (links > 2) {
    score += 2;
    triggers.push(`Too many links (${links})`);
  }

  return { score, triggers };
}

/**
 * Auto-generate plain text from HTML content.
 */
function htmlToPlain(html) {
  let text = html;
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/p>/gi, '\n\n');
  text = text.replace(/<\/div>/gi, '\n');
  text = text.replace(/<\/li>/gi, '\n');
  text = text.replace(/<a\s+(?:[^>]*?\s+)?href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '$2 ($1)');
  text = text.replace(/<[^>]+>/g, '');
  text = text.replace(/&nbsp;/gi, ' ');
  text = text.replace(/\n{3,}/g, '\n\n');
  return text.trim();
}

/**
 * Base email layout wrapper following responsive deliverability best practices.
 */
function wrapInLayout(title, bodyContent, isMarketing = false) {
  const unsubscribeLink = isMarketing 
    ? `<p style="margin: 15px 0 0 0; font-size: 11px; color: #999999;">No longer want emails? <a href="{{unsubscribeUrl}}" style="color: #E3B859; text-decoration: underline;">Unsubscribe here</a>.</p>` 
    : '';

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta name="color-scheme" content="light dark">
      <meta name="supported-color-schemes" content="light dark">
      <title>${title}</title>
      <style>
        :root {
          color-scheme: light dark;
          supported-color-schemes: light dark;
        }
        @media only screen and (max-width: 600px) {
          .email-container {
            width: 100% !important;
            padding: 15px !important;
          }
        }
        @media (prefers-color-scheme: dark) {
          body {
            background-color: #121212 !important;
            color: #e0e0e0 !important;
          }
          .email-wrapper {
            background-color: #121212 !important;
          }
          .email-card {
            background-color: #1e1e1e !important;
            border-color: #333333 !important;
          }
          .body-text, .header-title {
            color: #e0e0e0 !important;
          }
        }
      </style>
    </head>
    <body style="margin: 0; padding: 0; width: 100% !important; background-color: #f7f7f7; font-family: Arial, Helvetica, sans-serif; -webkit-font-smoothing: antialiased; -ms-text-size-adjust: 100%; -webkit-text-size-adjust: 100%;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" class="email-wrapper" style="background-color: #f7f7f7; padding: 20px 0;">
        <tr>
          <td align="center">
            <table border="0" cellpadding="0" cellspacing="0" width="600" class="email-container" style="max-width: 600px; width: 100%;">
              <!-- Brand Header -->
              <tr>
                <td style="padding: 10px 0 20px 0; text-align: left;">
                  <span style="font-size: 18px; font-weight: bold; color: #1a1a1a; letter-spacing: 1px; text-transform: uppercase;">LeadGen Automation</span>
                </td>
              </tr>
              <!-- Content Body -->
              <tr>
                <td class="email-card" bgcolor="#ffffff" style="background-color: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-radius: 8px; text-align: left;">
                  <div class="body-text" style="font-size: 15px; line-height: 1.6; color: #444444;">
                    ${bodyContent.replace(/\n/g, '<br />')}
                  </div>
                </td>
              </tr>
              <!-- Footer Section -->
              <tr>
                <td style="padding: 25px 30px; text-align: left; font-size: 12px; color: #888888; line-height: 1.5;">
                  <p style="margin: 0; font-weight: bold;">LeadGen Automation</p>
                  <p style="margin: 5px 0 0 0;">Questions? Just reply directly to this email to contact support.</p>
                  ${unsubscribeLink}
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

// ── public API ────────────────────────────────────────────

/**
 * Send an email. Tries Nodemailer first, then Resend, then mock.
 *
 * @param {object} opts
 * @param {string} opts.to        - recipient email address
 * @param {string} opts.subject   - email subject
 * @param {string} opts.html      - HTML body
 * @param {string} [opts.text]    - Plain-text body fallback
 * @returns {Promise<{provider: string, response: any, mock: boolean}>}
 */
async function sendEmail({ to, subject, html, text }) {
  let transport = null;
  let gmailUser = '';
  let fromName = 'Outreach';
  let activeResendKey = '';
  let activeResendFrom = 'onboarding@resend.dev';

  // ── 1. Load configuration from DB ──────────────────
  const dbConfig = await getSMTPConfigFromDB();
  if (dbConfig) {
    fromName = dbConfig.smtpFromName;
    activeResendKey = dbConfig.resendKey || '';
    activeResendFrom = dbConfig.resendFromEmail || 'onboarding@resend.dev';
    
    if (dbConfig.smtpUser && dbConfig.smtpPass) {
      gmailUser = dbConfig.smtpUser;
      transport = nodemailer.createTransport({
        pool: true,
        maxConnections: 5,
        maxMessages: 50,
        service: 'gmail',
        auth: {
          user: dbConfig.smtpUser,
          pass: dbConfig.smtpPass,
        },
        connectionTimeout: 5000,
        greetingTimeout: 5000,
        socketTimeout: 5000,
      });
    }
  } else {
    // ── Fallback to Env variables ────────────────────
    const gmailUserEnv = (process.env.NODEMAILER_USER || '').trim();
    const gmailPassEnv = (process.env.NODEMAILER_APP_PASSWORD || '').trim();
    activeResendKey = (process.env.RESEND_API_KEY || '').trim();
    activeResendFrom = (process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev').trim();
    
    if (gmailUserEnv && gmailPassEnv) {
      gmailUser = gmailUserEnv;
      fromName = process.env.NODEMAILER_FROM_NAME || 'Outreach';
      transport = nodemailer.createTransport({
        pool: true,
        maxConnections: 5,
        maxMessages: 50,
        service: 'gmail',
        auth: {
          user: gmailUserEnv,
          pass: gmailPassEnv,
        },
        connectionTimeout: 5000,
        greetingTimeout: 5000,
        socketTimeout: 5000,
      });
    }
  }

  // ── 2. Spam Scanning ──────────────────────────────
  const rawContent = html || text || '';
  const spamCheck = scanForSpam(subject || 'Inquiry', rawContent);
  if (spamCheck.score >= 4) {
    logger.warn({ to, score: spamCheck.score, triggers: spamCheck.triggers }, '[EmailService] Content exceeded spam score limit');
  }

  const finalHtml = wrapInLayout(subject, rawContent, true);
  const finalPlain = text || htmlToPlain(finalHtml);

  let nodemailerError = null;
  if (transport) {
    try {
      const info = await transport.sendMail({
        from: `"${fromName}" <${gmailUser}>`,
        to,
        subject,
        html: finalHtml,
        text: finalPlain,
      });
      logger.info({ to, messageId: info.messageId }, '[EmailService] Sent via Nodemailer/Gmail SMTP');
      return { provider: 'nodemailer', response: { messageId: info.messageId }, mock: false };
    } catch (err) {
      nodemailerError = err.message;
      logger.warn({ to, error: err.message }, '[EmailService] Nodemailer SMTP failed — trying Resend fallback');
    }
  }

  // ── 3. Try Resend REST API ───────────────────────────────
  let resendError = null;
  if (activeResendKey) {
    const fromNameResend = fromName || 'Outreach';
    try {
      const res = await axios.post(
        'https://api.resend.com/emails',
        {
          from: `${fromNameResend} <${activeResendFrom}>`,
          to,
          subject,
          html: finalHtml,
          text: finalPlain
        },
        {
          headers: {
            Authorization: `Bearer ${activeResendKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 6000,
        }
      );
      logger.info({ to, id: res.data.id }, '[EmailService] Sent via Resend');
      return { provider: 'resend', response: res.data, mock: false };
    } catch (err) {
      resendError = err.response ? err.response.data : err.message;
      logger.warn({ to, error: err.message }, '[EmailService] Resend also failed');
    }
  }

  // ── 4. Mock / no-op ─────────────────────────────────────
  logger.warn({ to }, '[EmailService] No email provider configured — email not sent (mock mode)');
  return {
    provider: 'mock',
    response: { 
      note: 'Neither Nodemailer nor Resend is configured. Set NODEMAILER_USER + NODEMAILER_APP_PASSWORD or RESEND_API_KEY.',
      nodemailer_error: nodemailerError,
      resend_error: resendError
    },
    mock: true,
  };
}

module.exports = { sendEmail, getSMTPConfigFromDB, supabase };
