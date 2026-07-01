// backend/worker/sessionManager.js

const supabase = require('../database/connection');
const logger = require('./logger');
const eventBus = require('./eventBus');

class SessionManager {
  /**
   * Loads cookies and localStorage from database into browser context.
   */
  async loadSession(context, provider, username) {
    logger.info(`[SessionManager] Loading session for ${provider} (${username})...`);
    try {
      const { data, error } = await supabase
        .from('scraper_sessions')
        .select('session_data')
        .eq('provider', provider)
        .eq('username', username)
        .single();

      if (error || !data) {
        logger.warn(`[SessionManager] No session found in DB for ${provider} (${username}).`);
        return false;
      }

      const { cookies, localStorage } = data.session_data || {};
      
      if (cookies) {
        await context.addCookies(cookies);
        logger.info(`[SessionManager] Applied ${cookies.length} cookies to context.`);
      }

      eventBus.publish('session.loaded', { provider, username });
      return true;
    } catch (err) {
      logger.error(`[SessionManager] Failed to load session: ${err.message}`);
      return false;
    }
  }

  /**
   * Saves current context cookies and localStorage back to database.
   */
  async saveSession(context, provider, username) {
    logger.info(`[SessionManager] Saving session for ${provider} (${username})...`);
    try {
      const cookies = await context.cookies();
      const sessionData = {
        cookies,
        localStorage: {},
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('scraper_sessions')
        .upsert({
          provider,
          username,
          session_data: sessionData,
          updated_at: new Date().toISOString(),
          is_valid: true
        }, {
          onConflict: 'provider,username'
        });

      if (error) throw error;

      logger.info(`[SessionManager] Successfully saved ${cookies.length} cookies for ${provider}.`);
      return true;
    } catch (err) {
      logger.error(`[SessionManager] Failed to save session: ${err.message}`);
      return false;
    }
  }

  /**
   * Invalidates a session when expiration is detected (e.g. redirected to login page).
   */
  async invalidateSession(provider, username) {
    logger.warn(`[SessionManager] Invalidating session for ${provider} (${username})...`);
    try {
      await supabase
        .from('scraper_sessions')
        .update({ is_valid: false })
        .eq('provider', provider)
        .eq('username', username);

      eventBus.publish('session.expired', { provider, username });
    } catch (err) {
      logger.error(`[SessionManager] Failed to invalidate session: ${err.message}`);
    }
  }
}

module.exports = new SessionManager();
