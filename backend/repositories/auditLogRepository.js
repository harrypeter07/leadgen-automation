// backend/repositories/auditLogRepository.js
const supabase = require('../database/connection');
const logger = require('../worker/logger');

class AuditLogRepository {
  /**
   * Appends a log trace into system_audit_logs
   * @param {string} action - Event type description (e.g. ACCOUNT_CONNECTED)
   * @param {string} details - Detailed text or metadata
   * @param {string} [userIdentifier='system'] - Identity of the agent triggering the action
   */
  async log(action, details, userIdentifier = 'system') {
    logger.info(`[AuditLogRepository] Logging system event: ${action} | Details: ${details}`);
    try {
      const { data, error } = await supabase
        .from('system_audit_logs')
        .insert([{
          action,
          details,
          user_identifier: userIdentifier,
          created_at: new Date().toISOString()
        }]);

      if (error) {
        logger.error(`[AuditLogRepository] db insert failed: ${error.message}`);
      }
      return data;
    } catch (err) {
      logger.error(`[AuditLogRepository] error: ${err.message}`);
    }
  }

  async getRecent(limit = 100) {
    logger.debug(`[AuditLogRepository] Fetching recent ${limit} audit logs...`);
    const { data, error } = await supabase
      .from('system_audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      logger.error(`[AuditLogRepository] getRecent error: ${error.message}`);
      throw error;
    }
    return data || [];
  }
}

module.exports = new AuditLogRepository();
