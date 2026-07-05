// backend/worker/backgroundWorkers.js
const db = require('../database/db');
const logger = require('./logger');
const config = require('../modules/config');
const outreachService = require('../services/outreachService');
const intelligenceService = require('../services/intelligenceService');
const conversationEngine = require('../services/conversationEngine');

class BackgroundWorkers {
  constructor() {
    this.intervals = [];
    this.processingLeads = new Set();
  }

  /**
   * Start all scheduled background loop services
   */
  start() {
    logger.info('[Background Workers] Starting background worker loops...');

    // 1. Follow-up Queue Processor Loop (every 15 seconds)
    if (config.features.followups) {
      const followupInterval = setInterval(async () => {
        try {
          const res = await outreachService.processFollowupQueue();
          if (res.processedCount > 0) {
            logger.info(`[Follow-up Worker] Processed ${res.processedCount} due followup(s).`);
          }
        } catch (err) {
          logger.error(`[Follow-up Worker Error] Execution failed: ${err.message}`);
        }
      }, 15000);
      this.intervals.push(followupInterval);
    } else {
      logger.info('[Background Workers] Follow-ups worker is disabled via feature flags.');
    }

    // 2. Automated Business Research Worker (every 30 seconds)
    // Dequeues leads with status 'new' and executes Playwright scrapers + social finders
    if (config.features.research) {
      const researchInterval = setInterval(async () => {
        try {
          const queryText = `
            SELECT l.id FROM leads l
            LEFT JOIN business_profiles bp ON l.id = bp.lead_id
            WHERE l.status = 'new' AND bp.id IS NULL
            LIMIT 2;
          `;
          const res = await db.query(queryText, [], 'ResearchWorker', 'getPendingLeads');
          const pendingLeads = res.rows.filter(l => !this.processingLeads.has(l.id));

          for (const lead of pendingLeads) {
            this.processingLeads.add(lead.id);
            logger.info(`[Research Worker] Automating research audit for lead: ${lead.id}`);
            
            // Trigger the research engine asynchronously
            intelligenceService.runBusinessResearch(lead.id)
              .then(async () => {
                // Update lead status to 'qualified' or 'audited'
                await db.query("UPDATE leads SET status = 'qualified' WHERE id = $1;", [lead.id]);
                logger.info(`[Research Worker] Lead ${lead.id} research completed and qualified.`);
              })
              .catch(err => {
                logger.error(`[Research Worker Error] Lead ${lead.id} audit failed: ${err.message}`);
              })
              .finally(() => {
                this.processingLeads.delete(lead.id);
              });
          }
        } catch (err) {
          logger.error(`[Research Worker Loop Error] ${err.message}`);
        }
      }, 30000);
      this.intervals.push(researchInterval);
    } else {
      logger.info('[Background Workers] Research worker is disabled via feature flags.');
    }

    // 3. Ghost Detection & Conversation Loop (every 6 hours)
    const ghostInterval = setInterval(async () => {
      try {
        await conversationEngine.performGhostDetection();
      } catch (err) {
        logger.error(`[Ghost Worker Error] execution failed: ${err.message}`);
      }
    }, 6 * 60 * 60 * 1000);
    this.intervals.push(ghostInterval);

    // 4. Retry Worker: Resends failed email/WhatsApp messages (every 5 minutes)
    const retryInterval = setInterval(async () => {
      try {
        const queryText = `
          SELECT ml.id, ml.message_id, ml.retry_count, cm.body, cm.channel, cm.recipient
          FROM message_logs ml
          JOIN conversation_messages cm ON ml.message_id = cm.id
          WHERE ml.status = 'failed'
            AND (ml.retry_count IS NULL OR ml.retry_count < 3)
            AND ml.created_at > NOW() - INTERVAL '2 hours'
          LIMIT 5;
        `;
        const res = await db.query(queryText, [], 'RetryWorker', 'getFailedLogs');
        const axios = require('axios');

        for (const log of res.rows) {
          const nextRetryCount = (log.retry_count || 0) + 1;
          logger.info(`[Retry Worker] Retrying failed message dispatch for log ${log.id} (Attempt ${nextRetryCount}/3)`);

          let success = false;
          let errorMessage = null;
          let gatewayResponse = {};

          try {
            if (log.channel === 'whatsapp') {
              const waUrl = process.env.WHATSAPP_SERVICE_URL || 'http://localhost:3002';
              const secret = process.env.WHATSAPP_API_SECRET || '';
              const waRes = await axios.post(`${waUrl}/send`, {
                phone: log.recipient,
                message: log.body
              }, {
                headers: { 'x-api-secret': secret },
                timeout: 8000
              });
              gatewayResponse = waRes.data;
            } else {
              // Email dispatch via Resend
              const resendKey = (process.env.RESEND_API_KEY || '').trim();
              if (resendKey) {
                const resendRes = await axios.post('https://api.resend.com/emails', {
                  from: 'Outreach <onboarding@resend.dev>',
                  to: log.recipient,
                  subject: 'Partnership Inquiry - Growth Audit',
                  html: `<p>${log.body.replace(/\n/g, '<br>')}</p>`
                }, {
                  headers: {
                    'Authorization': `Bearer ${resendKey}`,
                    'Content-Type': 'application/json'
                  },
                  timeout: 6000
                });
                gatewayResponse = resendRes.data;
              } else {
                gatewayResponse = { mock: true, note: 'Resend API key not set.' };
              }
            }
            success = true;
          } catch (err) {
            errorMessage = err.message;
            gatewayResponse = err.response ? err.response.data : { error: err.message };
          }

          await db.transaction(async (tx) => {
            if (success) {
              await tx.query(`
                UPDATE message_logs 
                SET status = 'sent', retry_count = $1, error_message = NULL, gateway_response = $2, updated_at = NOW() 
                WHERE id = $3;
              `, [nextRetryCount, JSON.stringify(gatewayResponse), log.id]);
              logger.info(`[Retry Worker] Log ${log.id} successfully retried & sent.`);
            } else {
              const nextStatus = nextRetryCount >= 3 ? 'dead_letter' : 'failed';
              await tx.query(`
                UPDATE message_logs 
                SET status = $1, retry_count = $2, error_message = $3, gateway_response = $4, updated_at = NOW() 
                WHERE id = $5;
              `, [nextStatus, nextRetryCount, errorMessage, JSON.stringify(gatewayResponse), log.id]);
              
              if (nextStatus === 'dead_letter') {
                logger.error(`[Retry Worker DLQ] Log ${log.id} reached max retry limit. Moved to Dead-Letter Queue.`);
              } else {
                logger.warn(`[Retry Worker] Log ${log.id} retry attempt failed. Will retry later.`);
              }
            }
          });
        }
      } catch (err) {
        logger.error(`[Retry Worker Loop Error] ${err.message}`);
      }
    }, 5 * 60 * 1000);
    this.intervals.push(retryInterval);

    // 5. Cleanup Worker: Purges old message logs (older than 30 days) and research logs (every 24 hours)
    const cleanupInterval = setInterval(async () => {
      try {
        logger.info('[Cleanup Worker] Starting database logs and cache cleanup...');
        const cleanLogsQuery = "DELETE FROM message_logs WHERE created_at < NOW() - INTERVAL '30 days';";
        const res = await db.query(cleanLogsQuery, [], 'CleanupWorker', 'deleteOldLogs');
        logger.info(`[Cleanup Worker] Purged ${res.rowCount} stale message logs.`);
      } catch (err) {
        logger.error(`[Cleanup Worker Error] Database cleanup failed: ${err.message}`);
      }
    }, 24 * 60 * 60 * 1000);
    this.intervals.push(cleanupInterval);
  }

  /**
   * Stop all scheduled background loops
   */
  stop() {
    logger.info('[Background Workers] Stopping background worker loops...');
    this.intervals.forEach(clearInterval);
    this.intervals = [];
  }
}

module.exports = new BackgroundWorkers();
