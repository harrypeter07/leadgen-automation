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

  // ── 1a. Try loading configuration from DB ──────────────────
  const dbConfig = await getSMTPConfigFromDB();
  if (dbConfig) {
    fromName = dbConfig.smtpFromName;
    activeResendKey = dbConfig.resendKey || '';
    activeResendFrom = dbConfig.resendFromEmail || 'onboarding@resend.dev';
    
    if (dbConfig.smtpUser && dbConfig.smtpPass) {
      gmailUser = dbConfig.smtpUser;
      transport = nodemailer.createTransport({
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
    // ── 1b. Fallback to Nodemailer/Gmail SMTP Env Vars ────────────────
    const gmailUserEnv = (process.env.NODEMAILER_USER || '').trim();
    const gmailPassEnv = (process.env.NODEMAILER_APP_PASSWORD || '').trim();
    activeResendKey = (process.env.RESEND_API_KEY || '').trim();
    activeResendFrom = (process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev').trim();
    
    if (gmailUserEnv && gmailPassEnv) {
      gmailUser = gmailUserEnv;
      fromName = process.env.NODEMAILER_FROM_NAME || 'Outreach';
      transport = nodemailer.createTransport({
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

  let nodemailerError = null;
  if (transport) {
    try {
      const info = await transport.sendMail({
        from: `"${fromName}" <${gmailUser}>`,
        to,
        subject,
        html,
        text: text || html.replace(/<[^>]+>/g, ''),
      });
      logger.info({ to, messageId: info.messageId }, '[EmailService] Sent via Nodemailer/Gmail SMTP');
      return { provider: 'nodemailer', response: { messageId: info.messageId }, mock: false };
    } catch (err) {
      nodemailerError = err.message;
      logger.warn({ to, error: err.message }, '[EmailService] Nodemailer SMTP failed — trying Resend fallback');
    }
  }

  // ── 2. Try Resend REST API ───────────────────────────────
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
          html,
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

  // ── 3. Mock / no-op ─────────────────────────────────────
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
