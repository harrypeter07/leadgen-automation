// backend/controllers/outreachController.js
const outreachService = require('../services/outreachService');
const intelligenceService = require('../services/intelligenceService');
const conversationRepo = require('../repositories/conversationRepository');
const logger = require('../worker/logger');
const ResponseHelper = require('../modules/response');
const { ValidationError, NotFoundError } = require('../modules/errors');

// Regex to validate UUID format
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUUID(uuid) {
  return UUID_REGEX.test(uuid);
}

class OutreachController {
  /**
   * Start outreach tracking for a lead
   */
  async initialize(req, res, next) {
    const { leadId } = req.body;

    logger.info({ leadId, controller: 'OutreachController', operation: 'initialize' }, '[Outreach Controller] POST /initialize received.');

    if (!leadId || !isValidUUID(leadId)) {
      throw new ValidationError('Invalid parameter: leadId must be a valid UUID.');
    }

    try {
      const result = await outreachService.initializeOutreach(leadId);
      logger.info({ leadId, success: true }, '[Outreach Controller] Outreach initialized successfully.');
      return ResponseHelper.created(res, result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Fetch conversation state for a lead
   */
  async getConversationState(req, res, next) {
    const { leadId } = req.params;

    logger.info({ leadId, controller: 'OutreachController', operation: 'getConversationState' }, '[Outreach Controller] GET /conversation/:leadId received.');

    if (!leadId || !isValidUUID(leadId)) {
      throw new ValidationError('Invalid parameter: leadId path param must be a valid UUID.');
    }

    try {
      const state = await conversationRepo.findByLeadId(leadId);
      if (!state) {
        throw new NotFoundError(`No outreach sequence or conversation state found for lead ID ${leadId}.`);
      }
      logger.info({ leadId, success: true }, '[Outreach Controller] Conversation state retrieved.');
      return ResponseHelper.success(res, { state });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Process all pending followup tasks currently due
   */
  async processFollowups(req, res, next) {
    logger.info({ controller: 'OutreachController', operation: 'processFollowups' }, '[Outreach Controller] POST /followups/process received.');

    try {
      const result = await outreachService.processFollowupQueue();
      logger.info({ success: true, processedCount: result.processedCount }, '[Outreach Controller] Followup queue processing completed.');
      return ResponseHelper.success(res, result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Process simulated incoming message from a lead
   */
  async handleInbound(req, res, next) {
    const { leadId, body, channel, sender } = req.body;

    logger.info({ leadId, channel, controller: 'OutreachController', operation: 'handleInbound' }, '[Outreach Controller] POST /message/inbound received.');

    if (!leadId || !isValidUUID(leadId)) {
      throw new ValidationError('leadId must be a valid UUID.');
    }
    if (!body || typeof body !== 'string' || body.trim().length === 0) {
      throw new ValidationError('body content is required.');
    }
    if (!channel || !['whatsapp', 'email'].includes(channel)) {
      throw new ValidationError('channel must be either "whatsapp" or "email".');
    }

    try {
      const result = await outreachService.handleInboundMessage(leadId, { body, channel, sender });
      logger.info({ leadId, success: true }, '[Outreach Controller] Inbound message handled successfully.');
      return ResponseHelper.success(res, result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Log a scheduled or completed meeting
   */
  async scheduleMeeting(req, res, next) {
    const { leadId, scheduled_at, duration_minutes, notes } = req.body;

    logger.info({ leadId, controller: 'OutreachController', operation: 'scheduleMeeting' }, '[Outreach Controller] POST /meetings received.');

    if (!leadId || !isValidUUID(leadId)) {
      throw new ValidationError('leadId must be a valid UUID.');
    }
    if (!scheduled_at || isNaN(Date.parse(scheduled_at))) {
      throw new ValidationError('scheduled_at must be a valid date string.');
    }

    try {
      const meeting = await outreachService.scheduleMeeting(leadId, {
        scheduled_at,
        duration_minutes: duration_minutes ? parseInt(duration_minutes, 10) : 30,
        notes
      });
      logger.info({ leadId, success: true }, '[Outreach Controller] Meeting logged successfully.');
      return ResponseHelper.created(res, { meeting });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Fetch memory insights and observations context for a lead
   */
  async getMemory(req, res, next) {
    const { leadId } = req.params;

    logger.info({ leadId, controller: 'OutreachController', operation: 'getMemory' }, '[Outreach Controller] GET /memory/:leadId received.');

    if (!leadId || !isValidUUID(leadId)) {
      throw new ValidationError('leadId must be a valid UUID.');
    }

    try {
      const context = await intelligenceService.getLeadContext(leadId);
      if (!context.profile) {
        throw new NotFoundError(`No business profile or memory found for lead ID ${leadId}.`);
      }
      logger.info({ leadId, success: true }, '[Outreach Controller] Memory context retrieved.');
      return ResponseHelper.success(res, context);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Trigger website audit & business research discovery manually
   */
  async runResearch(req, res, next) {
    const { leadId } = req.body;

    logger.info({ leadId, controller: 'OutreachController', operation: 'runResearch' }, '[Outreach Controller] POST /research received.');

    if (!leadId || !isValidUUID(leadId)) {
      throw new ValidationError('leadId must be a valid UUID.');
    }

    try {
      const result = await intelligenceService.runBusinessResearch(leadId);
      logger.info({ leadId, success: true }, '[Outreach Controller] Manually triggered business research finished.');
      return ResponseHelper.success(res, result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new OutreachController();
