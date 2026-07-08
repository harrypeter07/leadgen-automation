// backend/api/outreach.js
const express = require('express');
const outreachController = require('../controllers/outreachController');

const router = express.Router();

// 1. Initialize outreach tracking and schedule first mockup audit followup
router.post('/initialize', (req, res, next) => outreachController.initialize(req, res, next));

// 2. Fetch conversation state for a lead
router.get('/conversation/:leadId', (req, res, next) => outreachController.getConversationState(req, res, next));

// 3. Process all due items in followup_queue (automated audit/message dispatches)
router.post('/followups/process', (req, res, next) => outreachController.processFollowups(req, res, next));

// 4. Handle incoming messages from leads (simulate inbound WhatsApp/Email)
router.post('/message/inbound', (req, res, next) => outreachController.handleInbound(req, res, next));

// 5. Schedule/record meeting logs
router.post('/meetings', (req, res, next) => outreachController.scheduleMeeting(req, res, next));

// 6. Fetch memory records, observations, and research context for a lead
router.get('/memory/:leadId', (req, res, next) => outreachController.getMemory(req, res, next));

// 7. Trigger manual website audit & social discovery research
router.post('/research', (req, res, next) => outreachController.runResearch(req, res, next));

// 8. Get system outreach and ICP settings
router.get('/settings', (req, res, next) => outreachController.getSettings(req, res, next));

// 9. Update system outreach and ICP settings
router.post('/settings', (req, res, next) => outreachController.updateSettings(req, res, next));

// 10. Trigger n8n email outreach generation webhook
router.post('/email/generate', async (req, res, next) => {
  const { leadIds } = req.body || {};
  if (!leadIds || !Array.isArray(leadIds)) {
    return res.status(400).json({ error: 'leadIds must be an array of UUIDs.' });
  }

  const n8nWebhookBaseUrl = process.env.N8N_WEBHOOK_BASE_URL || 'http://localhost:5678';
  const targetUrl = `${n8nWebhookBaseUrl.replace(/\/+$/, '')}/webhook/email-outreach/generate`;

  const axios = require('axios');
  const logger = require('../worker/logger');
  logger.info({ leadIds, targetUrl }, '[Outreach API] Triggering n8n AI email generation...');

  try {
    const response = await axios.post(targetUrl, { leadIds }, { timeout: 45000 });
    res.json({ success: true, data: response.data });
  } catch (err) {
    logger.error(`[Outreach API] Generate failed: ${err.message}`);
    res.status(500).json({ error: `n8n webhook execution failed: ${err.message}` });
  }
});

// 11. Trigger n8n email outreach send webhook
router.post('/email/send', async (req, res, next) => {
  const { leadIds } = req.body || {};
  if (!leadIds || !Array.isArray(leadIds)) {
    return res.status(400).json({ error: 'leadIds must be an array of UUIDs.' });
  }

  const n8nWebhookBaseUrl = process.env.N8N_WEBHOOK_BASE_URL || 'http://localhost:5678';
  const targetUrl = `${n8nWebhookBaseUrl.replace(/\/+$/, '')}/webhook/email-outreach/send`;

  const axios = require('axios');
  const logger = require('../worker/logger');
  logger.info({ leadIds, targetUrl }, '[Outreach API] Triggering n8n email dispatch...');

  try {
    const response = await axios.post(targetUrl, { leadIds }, { timeout: 45000 });
    res.json({ success: true, data: response.data });
  } catch (err) {
    logger.error(`[Outreach API] Send failed: ${err.message}`);
    res.status(500).json({ error: `n8n webhook execution failed: ${err.message}` });
  }
});

// 12. Send a single outreach email using unified EmailService (utilized by n8n or direct actions)
router.post('/email/send-single', async (req, res, next) => {
  const { to, subject, body } = req.body || {};
  if (!to || !subject || !body) {
    return res.status(400).json({ error: 'to, subject, and body are required.' });
  }

  const allowedTestEmails = [
    'hassanmansuri570@gmail.com',
    'hmansuri882@gmail.com',
    'mansurihh@rknec.edu',
    'hassanmansuri379@gmail.com',
    'fgdgb62@gmail.com',
    'forhassan57@gmail.com',
    'sheikhafsana710@gmail.com',
    'whsofttech2026@gmail.com',
    'ayanmansuri0404@gmail.com'
  ];

  let recipient = to;
  const logger = require('../worker/logger');
  
  if (!allowedTestEmails.map(e => e.toLowerCase()).includes(to.toLowerCase())) {
    recipient = allowedTestEmails[Math.floor(Math.random() * allowedTestEmails.length)];
    logger.info(`[Outreach API] Redirecting outreach recipient from ${to} to test sandbox email ${recipient}`);
  }

  const emailService = require('../services/emailService');
  const database = require('../database/connection');
  const axios = require('axios');

  // Check if we have VERCEL_DASHBOARD_URL set in DB to proxy the email request
  let vercelUrl = null;
  if (database) {
    try {
      const { data } = await database
        .from('meta_config')
        .select('value')
        .eq('key', 'VERCEL_DASHBOARD_URL')
        .maybeSingle();
      if (data && data.value) {
        vercelUrl = data.value.trim().replace(/\/+$/, '');
      }
    } catch (dbErr) {
      logger.warn(`[Outreach API] Failed to fetch VERCEL_DASHBOARD_URL from DB: ${dbErr.message}`);
    }
  }

  // If Vercel URL is configured, proxy the send request to Vercel (to bypass Railway SMTP blocks)
  if (vercelUrl) {
    logger.info({ to: recipient, vercelUrl }, '[Outreach API] Proxying send-single email request to Vercel NextJS endpoint...');
    try {
      const response = await axios.post(`${vercelUrl}/api/email/send`, {
        to: recipient,
        subject,
        html: body
      }, { timeout: 15000 });
      logger.info(`[Outreach API] Proxy send successful via Vercel provider: ${response.data.provider}`);
      return res.json(response.data);
    } catch (err) {
      logger.warn(`[Outreach API] Proxy to Vercel failed: ${err.message}. Falling back to local send...`);
    }
  }

  logger.info({ to: recipient, subject }, '[Outreach API] Sending email locally via unified service...');
  try {
    const result = await emailService.sendEmail({
      to: recipient,
      subject,
      html: body
    });
    res.json(result);
  } catch (err) {
    logger.error(`[Outreach API] Send email failed: ${err.message}`);
    res.status(500).json({ error: `Failed to send email: ${err.message}` });
  }
});

module.exports = router;
