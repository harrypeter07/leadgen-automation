// backend/services/outreachService.js
const axios = require('axios');
const db = require('../database/db');
const { handleDbError } = require('../database/dbErrorHandler');
const businessRepo = require('../repositories/businessRepository');
const conversationRepo = require('../repositories/conversationRepository');
const followupRepo = require('../repositories/followupRepository');
const memoryRepo = require('../repositories/memoryRepository');
const leadsRepository = require('../repositories/leadsRepository');
const aiService = require('./aiService');
const conversationEngine = require('./conversationEngine');
const logger = require('../worker/logger');

// Environment helpers
const WHATSAPP_SERVICE_URL = () => (process.env.WHATSAPP_SERVICE_URL || '').replace(/\/$/, '');
const WHATSAPP_API_SECRET = () => process.env.WHATSAPP_API_SECRET || process.env.API_SECRET || '';

class OutreachService {
  /**
   * Initialize outreach sequence for a lead (creates profile, state, and schedules initial followup)
   * @param {string} leadId Lead ID (UUID)
   * @returns {Promise<{profile: Object, state: Object, initialFollowup: Object}>}
   */
  async initializeOutreach(leadId) {
    logger.info({ leadId }, '[Outreach Service] Initializing outreach sequence...');

    // 1. Fetch details of the lead from existing leads table
    const lead = await leadsRepository.getById(leadId);
    if (!lead) {
      throw new Error(`Lead with ID ${leadId} not found in system.`);
    }

    return await db.transaction(async (tx) => {
      // 2. Create business profile
      let profile = await businessRepo.findByLeadId(leadId, tx);
      if (!profile) {
        profile = await businessRepo.create({
          lead_id: leadId,
          business_name: lead.name,
          industry: lead.category || 'Business Services',
          website: lead.website || null,
          email: lead.email || null,
          phone: lead.phone || null,
          address: lead.address || null
        }, tx);
      }

      // 3. Create conversation state
      let state = await conversationRepo.findByLeadId(leadId, tx, true);
      if (!state) {
        state = await conversationRepo.create({
          business_id: profile.id,
          current_stage: 'lead_qualified',
          next_action: 'Perform initial automated audit lookup'
        }, tx);
      }

      // 4. Schedule initial automated audit mockup task (runs immediately)
      const followup = await followupRepo.create({
        business_id: profile.id,
        scheduled_at: new Date(Date.now() + 1000).toISOString(), // 1 second from now
        status: 'pending',
        reason: 'automated_audit',
        payload: { action: 'run_scraper_and_enrichment' }
      }, tx);

      logger.info({ leadId, profileId: profile.id, stateId: state.id }, '[Outreach Service] Outreach initialized successfully.');
      return { profile, state, initialFollowup: followup };
    }, 'OutreachService.initializeOutreach');
  }

  /**
   * Process all pending followup queue items that are due
   * @returns {Promise<{processedCount: number}>}
   */
  async processFollowupQueue() {
    logger.info('[Outreach Service] Checking followup queue for due tasks...');
    const nowStr = new Date().toISOString();
    
    // Fetch all pending followups due right now
    const pendingTasks = await followupRepo.list({
      status: 'pending',
      before: nowStr,
      limit: 10
    });

    if (pendingTasks.length === 0) {
      logger.info('[Outreach Service] No pending outreach followups are due.');
      return { processedCount: 0 };
    }

    logger.info({ count: pendingTasks.length }, `[Outreach Service] Processing ${pendingTasks.length} due tasks...`);

    let processedCount = 0;

    for (const task of pendingTasks) {
      const start = Date.now();
      try {
        await db.transaction(async (tx) => {
          // 1. Mark task as completed
          await followupRepo.update(task.id, { status: 'completed' }, tx);

          // 2. Fetch business context
          const profile = await businessRepo.findById(task.business_id, tx);
          const state = await conversationRepo.findByBusinessId(task.business_id, tx);
          
          if (!profile || !state) {
            logger.warn({ taskId: task.id }, '[Outreach Service] Skipping followup, profile or state is missing.');
            return;
          }

          if (task.reason === 'automated_audit') {
            // 2.1 Process automated audit step
            logger.info({ leadId: profile.lead_id }, '[Outreach Service] Followup: Running automated audit phase...');
            
            // Advance state
            await conversationRepo.update(state.id, {
              current_stage: 'outreach_started',
              next_action: 'Send initial outreach contact message'
            }, tx);

            // Schedule the message dispatch task for 10 seconds later (in simulation)
            await followupRepo.create({
              business_id: profile.id,
              scheduled_at: new Date(Date.now() + 10000).toISOString(),
              status: 'pending',
              reason: 'send_outreach_message',
              payload: { attempt: 1 }
            }, tx);

          } else if (task.reason === 'send_outreach_message') {
            // 2.2 Process message dispatch step
            logger.info({ leadId: profile.lead_id }, '[Outreach Service] Followup: Generating outreach message...');

            // Fetch memory context for AI input
            const memory = await memoryRepo.findByLeadId(profile.lead_id, tx);
            const keyInsights = memory ? (memory.key_insights || []) : [];
            const objections = memory ? (memory.objections_raised || []) : [];
            
            // Fetch message history context
            const messages = await conversationRepo.getMessages(state.id, tx);

            // Draft the message via AI
            const draftText = await aiService.generateOutboundDraft(
              profile.business_name,
              profile.industry,
              keyInsights,
              objections,
              messages
            );

            // Determine channel: preference or fallback to Email
            let channel = 'email';
            let recipient = profile.email;
            
            // If phone verified on WhatsApp, use WhatsApp
            if (profile.phone) {
              channel = 'whatsapp';
              recipient = profile.phone;
            }

            if (!recipient) {
              logger.warn({ profileId: profile.id }, '[Outreach Service] No phone or email found. outreach skipped.');
              return;
            }

            // Create message record
            const messageRecord = await conversationRepo.createMessage({
              conversation_state_id: state.id,
              direction: 'outbound',
              channel: channel,
              sender: 'system',
              recipient: recipient,
              body: draftText
            }, tx);

            // Dispatch message via external gateway API
            let status = 'sent';
            let errorMessage = null;
            let gatewayResponse = {};

            try {
              if (channel === 'whatsapp') {
                const waUrl = WHATSAPP_SERVICE_URL();
                if (waUrl) {
                  const res = await axios.post(`${waUrl}/send`, {
                    phone: recipient,
                    message: draftText
                  }, {
                    headers: { 'x-api-secret': WHATSAPP_API_SECRET() },
                    timeout: 8000
                  });
                  gatewayResponse = res.data;
                } else {
                  gatewayResponse = { mock: true, note: 'WhatsApp Service URL not set.' };
                }
              } else {
                // Email via Resend API
                const resendKey = (process.env.RESEND_API_KEY || '').trim();
                if (resendKey) {
                  const res = await axios.post('https://api.resend.com/emails', {
                    from: 'Outreach <onboarding@resend.dev>',
                    to: recipient,
                    subject: 'Partnership Inquiry - Growth Audit',
                    html: `<p>${draftText.replace(/\n/g, '<br>')}</p>`
                  }, {
                    headers: {
                      'Authorization': `Bearer ${resendKey}`,
                      'Content-Type': 'application/json'
                    },
                    timeout: 6000
                  });
                  gatewayResponse = res.data;
                } else {
                  gatewayResponse = { mock: true, note: 'Resend API key not set.' };
                }
              }
            } catch (err) {
              status = 'failed';
              errorMessage = err.message;
              gatewayResponse = err.response ? err.response.data : { error: err.message };
              logger.error({ channel, error: err.message }, '[Outreach Service] External delivery failed.');
            }

            // Write message logs
            await conversationRepo.createMessageLog({
              message_id: messageRecord.id,
              status: status,
              error_message: errorMessage,
              gateway_response: gatewayResponse
            }, tx);

            // Update conversation state info
            await conversationRepo.update(state.id, {
              last_contacted_at: new Date().toISOString(),
              next_action: 'Wait for prospect response'
            }, tx);
          }
        }, 'OutreachService.processFollowupQueue.item');

        processedCount++;
      } catch (err) {
        logger.error({ taskId: task.id, error: err.message }, `[Outreach Service Error] Failed to process followup task.`);
      }
    }

    return { processedCount };
  }

  /**
   * Handle an inbound message from a lead
   * @param {string} leadId Lead ID (UUID)
   * @param {Object} messageData Incoming payload details
   * @param {string} messageData.body Message text
   * @param {'whatsapp'|'email'} messageData.channel Channel type
   * @param {string} [messageData.sender] Sender contact (e.g. phone/email)
   * @returns {Promise<{state: Object, receivedMessage: Object}>}
   */
  async handleInboundMessage(leadId, messageData) {
    logger.info({ leadId, channel: messageData.channel }, '[Outreach Service] Processing incoming message...');
    
    return await db.transaction(async (tx) => {
      const profile = await businessRepo.findByLeadId(leadId, tx);
      if (!profile) {
        throw new Error(`Business profile not found for lead ID ${leadId}.`);
      }

      const state = await conversationRepo.findByLeadId(leadId, tx, true);
      if (!state) {
        throw new Error(`Conversation state not initialized for lead ID ${leadId}.`);
      }

      // Insert inbound message record
      const messageRecord = await conversationRepo.createMessage({
        conversation_state_id: state.id,
        direction: 'inbound',
        channel: messageData.channel,
        sender: messageData.sender || 'lead',
        recipient: 'system',
        body: messageData.body
      }, tx);

      // Fetch message history for AI context
      const messages = await conversationRepo.getMessages(state.id, tx);

      // Call conversation engine to classify the next stage and next actions
      const classification = await conversationEngine.resolveNextAction(state.current_stage, messageData.body);

      // Process memory updates based on inbound message content
      const memory = await memoryRepo.findByLeadId(leadId, tx);
      const insights = memory ? (memory.key_insights || []) : [];
      
      // Look for positive intent or calendar keywords
      const isMeetingKeywords = /\b(schedule|meet|call|calendar|zoom|time|tomorrow|agenda)\b/i.test(messageData.body);
      if (isMeetingKeywords) {
        insights.push(`Lead expressed interest in scheduling a meeting: "${messageData.body.substring(0, 50)}..."`);
      }

      // Update state
      await conversationRepo.update(state.id, {
        current_stage: classification.nextStage,
        next_action: classification.nextAction
      }, tx);

      // Update memory insights
      if (memory) {
        await memoryRepo.update(memory.id, {
          key_insights: Array.from(new Set(insights)),
          summary: `Updated chat memory. Stage transitioned to: ${classification.nextStage}`
        }, tx);
      } else {
        await memoryRepo.create({
          business_id: profile.id,
          key_insights: insights,
          summary: `Inbound memory initialization.`
        }, tx);
      }

      const updatedState = await conversationRepo.findById(state.id, tx);
      return {
        state: updatedState,
        receivedMessage: messageRecord
      };
    }, 'OutreachService.handleInboundMessage');
  }

  /**
   * Log a scheduled or completed meeting in history
   * @param {string} leadId Lead ID (UUID)
   * @param {Object} meetingData Meeting record data
   * @param {string} meetingData.scheduled_at Scheduled date (ISO string)
   * @param {number} [meetingData.duration_minutes=30] Duration in minutes
   * @param {string} [meetingData.notes] Notes summary
   * @returns {Promise<Object>} Created meeting record
   */
  async scheduleMeeting(leadId, meetingData) {
    logger.info({ leadId }, '[Outreach Service] Logging meeting details...');

    const profile = await businessRepo.findByLeadId(leadId);
    if (!profile) {
      throw new Error(`Business profile not found for lead ID ${leadId}.`);
    }

    const state = await conversationRepo.findByLeadId(leadId);

    return await db.transaction(async (tx) => {
      // Record meeting
      const meeting = await followupRepo.createMeeting({
        business_id: profile.id,
        scheduled_at: meetingData.scheduled_at,
        duration_minutes: meetingData.duration_minutes || 30,
        status: 'scheduled',
        notes: meetingData.notes || 'Sales intro meeting scheduled.'
      }, tx);

      // Update stage if not already advanced
      if (state && state.current_stage !== 'demo_scheduled') {
        await conversationRepo.update(state.id, {
          current_stage: 'demo_scheduled',
          next_action: 'Prepare presentation deck for meeting'
        }, tx);
      }

      return meeting;
    }, 'OutreachService.scheduleMeeting');
  }
}

module.exports = new OutreachService();
