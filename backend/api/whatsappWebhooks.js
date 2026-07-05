// backend/api/whatsappWebhooks.js
const express = require('express');
const router = express.Router();
const config = require('../modules/config');
const logger = require('../worker/logger');
const outreachService = require('../services/outreachService');
const businessRepo = require('../repositories/businessRepository');
const conversationRepo = require('../repositories/conversationRepository');
const { UnauthorizedError, ValidationError } = require('../modules/errors');

/**
 * Middleware to validate webhook signature/secret
 */
function validateWebhookSecret(req, res, next) {
  const secret = req.headers['x-api-secret'] || req.query.secret;
  const expectedSecret = config.whatsappApiSecret;
  
  if (expectedSecret && secret !== expectedSecret) {
    logger.warn('[WhatsApp Webhook] Unauthorized request blocked: secrets do not match.');
    throw new UnauthorizedError('Invalid webhook api secret signature.');
  }
  next();
}

/**
 * POST /api/whatsapp-webhook
 * Receive events from the external whatsapp-service microservice
 */
router.post('/', validateWebhookSecret, async (req, res, next) => {
  const { event, data } = req.body;
  
  if (!event || !data) {
    throw new ValidationError('Webhook payload is missing event or data parameters.');
  }

  logger.info({ event }, `[WhatsApp Webhook] Received webhook event: ${event}`);

  try {
    if (event === 'message') {
      const { from, to, body, mediaUrl, fileName, fileType, fileSize } = data;
      
      if (!from || !body) {
        logger.warn('[WhatsApp Webhook] Skipping message event: from or body parameters missing.');
        return res.json({ success: false, reason: 'Missing parameters' });
      }

      // Try to clean phone number to find matching lead in business profiles
      const cleanPhone = from.replace(/\D/g, ''); // strip non-numeric characters
      
      // Query database for business profile by phone matching CleanPhone
      const queryText = `
        SELECT * FROM business_profiles 
        WHERE phone ILIKE $1 
           OR REPLACE(phone, ' ', '') ILIKE $2;
      `;
      const matchPattern = `%${cleanPhone.slice(-10)}%`; // match last 10 digits
      const db = require('../database/db');
      const dbRes = await db.query(queryText, [matchPattern, matchPattern]);
      const profile = dbRes.rows[0];

      if (!profile) {
        logger.info({ from }, '[WhatsApp Webhook] No matching business profile found for this phone number. Skipping message processing.');
        return res.json({ success: true, reason: 'No matching lead profile' });
      }

      // Trigger the handleInboundMessage function in outreach service
      const result = await outreachService.handleInboundMessage(profile.lead_id, {
        body,
        channel: 'whatsapp',
        sender: from
      });

      // If mediaUrl is attached, save to attachments table linked to the inbound message record
      if (mediaUrl && result.receivedMessage) {
        logger.info({ mediaUrl }, `[WhatsApp Webhook] Persisting attachment for message ${result.receivedMessage.id}`);
        await conversationRepo.createAttachment({
          message_id: result.receivedMessage.id,
          file_name: fileName || 'attachment',
          file_type: fileType || 'image/jpeg',
          file_url: mediaUrl,
          file_size_bytes: fileSize || 0
        });
      }

      return res.json({ success: true, processed: true, leadId: profile.lead_id });
    }

    if (event === 'status') {
      // Handles QR code scans, ready, or disconnect events
      const { status, qrCode } = data;
      logger.info(`[WhatsApp Webhook] Microservice state status: ${status}`);
      
      // Publish event internally or write to a global scan status cache/store
      const whatsappScanService = require('../services/whatsappScanService');
      if (status === 'qr' && qrCode) {
        whatsappScanService.lastQR = qrCode;
        whatsappScanService.status = 'SCAN_REQUIRED';
      } else if (status === 'ready') {
        whatsappScanService.status = 'READY';
        whatsappScanService.lastQR = null;
      } else if (status === 'disconnected') {
        whatsappScanService.status = 'DISCONNECTED';
      }

      return res.json({ success: true });
    }

    return res.json({ success: true, warning: 'Unhandled event type' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
