// backend/services/conversationEngine.js
const { STAGES, CLASSIFICATIONS } = require('../modules/constants');
const aiService = require('./aiService');
const conversationRepo = require('../repositories/conversationRepository');
const followupRepo = require('../repositories/followupRepository');
const db = require('../database/db');
const logger = require('../worker/logger');

// Define logical stage transition mapping
const VALID_TRANSITIONS = {
  [STAGES.LEAD_QUALIFIED]: [STAGES.OUTREACH_STARTED, STAGES.OUTREACH_FAILED, STAGES.LOST],
  [STAGES.OUTREACH_STARTED]: [STAGES.NURTURING, STAGES.DEMO_SCHEDULED, STAGES.OUTREACH_FAILED, STAGES.LOST],
  [STAGES.OUTREACH_FAILED]: [STAGES.LEAD_QUALIFIED, STAGES.OUTREACH_STARTED, STAGES.LOST],
  [STAGES.NURTURING]: [STAGES.DEMO_SCHEDULED, STAGES.LOST, STAGES.OUTREACH_STARTED],
  [STAGES.DEMO_SCHEDULED]: [STAGES.CONVERTED, STAGES.LOST, STAGES.NURTURING],
  [STAGES.CONVERTED]: [STAGES.LOST],
  [STAGES.LOST]: [STAGES.LEAD_QUALIFIED],
};

class ConversationEngine {
  /**
   * Validate if a transition from currentStage to nextStage is valid
   * @param {string} currentStage Current stage name
   * @param {string} nextStage Target stage name
   * @returns {boolean} True if allowed
   */
  isValidTransition(currentStage, nextStage) {
    if (currentStage === nextStage) return true;
    const allowed = VALID_TRANSITIONS[currentStage];
    return allowed ? allowed.includes(nextStage) : false;
  }

  /**
   * Determine target stage and action description based on message content
   * @param {string} currentStage Current conversation stage
   * @param {string} messageBody Incoming message text
   * @returns {Promise<{nextStage: string, nextAction: string, classification: string}>}
   */
  async resolveNextAction(currentStage, messageBody) {
    // 1. Classify incoming message
    const res = await aiService.classifyInboundMessage(messageBody);
    const classification = res.classification;
    logger.info(`[Conversation Engine] Classified message as: ${classification} (Explanation: ${res.explanation})`);

    let nextStage = currentStage;
    let nextAction = '';

    // 2. Resolve next stage & action based on current state + classification
    switch (classification) {
      case CLASSIFICATIONS.STOP:
        nextStage = STAGES.LOST;
        nextAction = 'Opted out. Removed from contact outreach campaigns.';
        break;
      case CLASSIFICATIONS.POSITIVE:
        if (this.isValidTransition(currentStage, STAGES.DEMO_SCHEDULED)) {
          nextStage = STAGES.DEMO_SCHEDULED;
          nextAction = 'Schedule demo presentation or dispatch calendar links.';
        } else {
          nextAction = 'User responded positively. Check scheduling availability.';
        }
        break;
      case CLASSIFICATIONS.NEGATIVE:
        if (this.isValidTransition(currentStage, STAGES.LOST)) {
          nextStage = STAGES.LOST;
          nextAction = 'Lead declined offer. Log objection detail and mark as lost.';
        } else {
          nextAction = 'User responded negatively. Acknowledge and drop sequence.';
        }
        break;
      case CLASSIFICATIONS.NEUTRAL:
      default:
        if (currentStage === STAGES.OUTREACH_STARTED && this.isValidTransition(currentStage, STAGES.NURTURING)) {
          nextStage = STAGES.NURTURING;
        }
        nextAction = 'Answer queries, address objections and nurture the lead.';
        break;
    }

    return {
      nextStage,
      nextAction,
      classification
    };
  }

  /**
   * Scan active conversations and auto-transition to lost if ghosted (no response for 7 days)
   * @returns {Promise<{ghostedCount: number}>}
   */
  async performGhostDetection() {
    logger.info('[Conversation Engine] Executing automated ghost detection scan...');
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    
    // Fetch conversation states that have not responded for 7 days
    const queryText = `
      SELECT cs.* FROM conversation_states cs
      WHERE cs.current_stage IN ($1, $2)
        AND cs.last_contacted_at < $3;
    `;
    
    try {
      const res = await db.query(queryText, [STAGES.OUTREACH_STARTED, STAGES.NURTURING, sevenDaysAgo]);
      const staleConversations = res.rows;
      
      if (staleConversations.length === 0) {
        logger.info('[Conversation Engine] No ghosted conversations found.');
        return { ghostedCount: 0 };
      }

      logger.info(`[Conversation Engine] Found ${staleConversations.length} candidate(s) for ghosting. Processing...`);
      let ghostedCount = 0;

      for (const state of staleConversations) {
        await db.transaction(async (tx) => {
          // 1. Move stage to lost
          await conversationRepo.update(state.id, {
            current_stage: STAGES.LOST,
            next_action: 'Automatically marked as lost due to ghosting (no response in 7 days).',
            metadata: {
              ...state.metadata,
              ghosted: true,
              ghosted_at: new Date().toISOString()
            }
          }, tx);

          // 2. Cancel any pending followups
          const pendings = await followupRepo.list({ business_id: state.business_id, status: 'pending' }, tx);
          for (const f of pendings) {
            await followupRepo.update(f.id, { status: 'cancelled' }, tx);
          }
          ghostedCount++;
        }, 'ConversationEngine.ghostDetection');
      }

      logger.info(`[Conversation Engine] Ghost detection completed. ${ghostedCount} leads updated.`);
      return { ghostedCount };
    } catch (err) {
      logger.error(`[Conversation Engine] Ghost detection process failed: ${err.message}`);
      throw err;
    }
  }
}

module.exports = new ConversationEngine();
