// backend/api/workflows.js
const express = require('express');
const router = express.Router();
const config = require('../modules/config');
const logger = require('../worker/logger');
const db = require('../database/db');
const outreachService = require('../services/outreachService');
const intelligenceService = require('../services/intelligenceService');
const ResponseHelper = require('../modules/response');
const { ValidationError, UnauthorizedError } = require('../modules/errors');

/**
 * Middleware to validate incoming request authenticity
 */
function authenticateWorkflowRequest(req, res, next) {
  const secret = req.headers['x-api-secret'] || req.query.secret;
  const expectedSecret = config.whatsappApiSecret;

  if (expectedSecret && secret !== expectedSecret) {
    logger.warn('[Workflow Orchestrator] Unauthorized request blocked: invalid secret.');
    throw new UnauthorizedError('Invalid API secret authorization.');
  }
  next();
}

/**
 * POST /api/workflows/orchestrate
 * Unified entry point for n8n Master Workflow orchestration
 */
router.post('/orchestrate', authenticateWorkflowRequest, async (req, res, next) => {
  const { event, payload } = req.body;

  if (!event) {
    throw new ValidationError('Orchestrate payload is missing "event" parameter.');
  }

  logger.info({ event }, `[Workflow Orchestrator] Orchestrating event: ${event}`);

  try {
    let nextAction = 'NONE';
    let actionPayload = {};

    switch (event) {
      case 'lead_intake': {
        const { name, city, category, phone, email, website } = payload || {};
        if (!name) {
          throw new ValidationError('Lead intake payload is missing "name" parameter.');
        }

        // Insert new lead into PostgreSQL leads table using transaction pool
        const leadId = await db.transaction(async (tx) => {
          const insertQuery = `
            INSERT INTO leads (name, city, category, phone, email, website, status)
            VALUES ($1, $2, $3, $4, $5, $6, 'new')
            RETURNING id;
          `;
          const dbRes = await tx.query(insertQuery, [name, city, category, phone, email, website]);
          const newLead = dbRes.rows[0];

          // Auto-initialize outreach state
          await outreachService.initializeOutreach(newLead.id, tx);
          return newLead.id;
        });

        nextAction = 'INITIALIZE_OUTREACH';
        actionPayload = { leadId };
        break;
      }

      case 'followup_due':
      case 'trigger_outreach': {
        const result = await outreachService.processFollowupQueue();
        nextAction = 'PROCESS_FOLLOWUPS';
        actionPayload = { processedCount: result.processedCount };
        break;
      }

      case 'trigger_ai': {
        const { leadId } = payload || {};
        if (!leadId) {
          throw new ValidationError('Trigger AI payload is missing "leadId" parameter.');
        }

        // Execute Playwright analysis and social discoveries
        const result = await intelligenceService.runBusinessResearch(leadId);
        nextAction = 'RUN_CRAWLER_SCRAPE';
        actionPayload = { leadId, observationsCount: result.observations?.length || 0 };
        break;
      }

      case 'inbound_message': {
        const { leadId, body, channel, sender } = payload || {};
        if (!leadId || !body || !channel) {
          throw new ValidationError('Inbound message payload requires leadId, body, and channel.');
        }

        const result = await outreachService.handleInboundMessage(leadId, { body, channel, sender });
        nextAction = 'PROCESS_REPLY';
        actionPayload = { leadId, nextStage: result.nextStage };
        break;
      }

      case 'action_completed': {
        const { leadId, actionType, status, messageId } = payload || {};
        logger.info({ leadId, actionType, status, messageId }, `[Workflow Orchestrator] Action completed callback received.`);
        
        if (messageId) {
          await db.transaction(async (tx) => {
            await tx.query("UPDATE message_logs SET status = 'sent', updated_at = NOW() WHERE message_id = $1;", [messageId]);
          });
        }
        
        nextAction = 'NONE';
        actionPayload = { status: 'logged' };
        break;
      }

      case 'action_failed': {
        const { leadId, actionType, error, messageId } = payload || {};
        logger.error({ leadId, actionType, error, messageId }, `[Workflow Orchestrator] Action failed callback received.`);
        
        if (messageId) {
          await db.transaction(async (tx) => {
            await tx.query("UPDATE message_logs SET status = 'failed', error_message = $1, updated_at = NOW() WHERE message_id = $2;", [error, messageId]);
          });
        }
        
        nextAction = 'NONE';
        actionPayload = { status: 'error_logged' };
        break;
      }

      default:
        logger.warn({ event }, '[Workflow Orchestrator] Received unhandled orchestrator event.');
        break;
    }

    const actions = [];
    if (nextAction && nextAction !== 'NONE') {
      actions.push({
        type: nextAction,
        payload: actionPayload
      });
    }

    return ResponseHelper.success(res, {
      success: true,
      nextAction,
      actionPayload,
      actions
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
