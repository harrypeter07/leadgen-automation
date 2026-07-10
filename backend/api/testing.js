// backend/api/testing.js

const express = require('express');
const browserManager = require('../worker/browserManager');
const websiteAnalyzer = require('../providers/website/analyzer');
const instagramAnalyzer = require('../providers/instagram/analyzer');
const logger = require('../worker/logger');

const router = express.Router();

router.use((req, res, next) => {
  req.startTime = Date.now();
  next();
});

function formatResponse(res, req, data = {}) {
  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    execution_time_ms: Date.now() - req.startTime,
    version: '3.0.0',
    ...data
  });
}

/**
   * Test website analyzer.
   */
router.post('/website', async (req, res, next) => {
  const { url } = req.body || {};
  if (!url) return res.status(400).json({ success: false, error: 'url is required' });

  logger.info(`[API Testing] Audit request for website: ${url}`);
  
  let contextId = null;
  let pageId = null;
  try {
    const contextObj = await browserManager.newContext();
    contextId = contextObj.contextId;
    const pageObj = await browserManager.newPage(contextId, contextObj.context);
    pageId = pageObj.pageId;

    const report = await websiteAnalyzer.audit(pageObj.page, url);
    formatResponse(res, req, { report });
  } catch (err) {
    next(err);
  } finally {
    if (pageId) await browserManager.releasePage(pageId);
    if (contextId) await browserManager.releaseContext(contextId);
  }
});

/**
   * Test instagram analyzer.
   */
router.post('/instagram', async (req, res, next) => {
  const { username, timeframe, scrapeHistory, scrapeReels } = req.body || {};
  if (!username) return res.status(400).json({ success: false, error: 'username is required' });

  logger.info(`[API Testing] Audit request for Instagram: @${username} (Timeframe: ${timeframe}, History: ${scrapeHistory}, Reels: ${scrapeReels})`);
  
  let contextId = null;
  let pageId = null;
  try {
    const contextObj = await browserManager.newContext();
    contextId = contextObj.contextId;
    const pageObj = await browserManager.newPage(contextId, contextObj.context);
    pageId = pageObj.pageId;

    const report = await instagramAnalyzer.audit(pageObj.page, username, { timeframe, scrapeHistory, scrapeReels });
    
    if (report && report.success === false) {
      const status = report.error === 'profile_not_found' ? 404 : 500;
      res.status(status).json({ success: false, error: report.error });
    } else {
      formatResponse(res, req, { report });
    }
  } catch (err) {
    next(err);
  } finally {
    if (pageId) await browserManager.releasePage(pageId);
    if (contextId) await browserManager.releaseContext(contextId);
  }
});

/**
 * Run Playwright bot scanner for Instagram followers.
 */
router.post('/instagram/bot-scan', async (req, res, next) => {
  const { username, limit } = req.body || {};
  const cleanUsername = (username || '').trim().replace(/^@/, '');
  if (!cleanUsername) return res.status(400).json({ success: false, error: 'username is required' });

  logger.info(`[API Testing] Playwright Follower Bot Scan request: @${cleanUsername} (Limit: ${limit || 30})`);
  
  const botScanner = require('../providers/instagram/botScanner');
  let contextId = null;
  let pageId = null;
  try {
    const contextObj = await browserManager.newContext();
    contextId = contextObj.contextId;
    const pageObj = await browserManager.newPage(contextId, contextObj.context);
    pageId = pageObj.pageId;

    const result = await botScanner.scanFollowers(pageObj.page, cleanUsername, limit || 30);
    
    if (result.success === false) {
      const sessionErrors = ['session_expired', 'auth_required', 'profile_fetch_failed'];
      const statusCode = sessionErrors.includes(result.error) ? 401 : 500;
      res.status(statusCode).json(result);
    } else {
      formatResponse(res, req, result);
    }
  } catch (err) {
    next(err);
  } finally {
    if (pageId) await browserManager.releasePage(pageId);
    if (contextId) await browserManager.releaseContext(contextId);
  }
});

/**
 * Get stored bot audit results for a user.
 */
router.get('/instagram/bot-scan/:username', async (req, res, next) => {
  const username = req.params.username.trim().replace(/^@/, '');
  const db = require('../database/db');
  try {
    const queryRes = await db.query(
      `SELECT * FROM instagram_bot_audit WHERE target_username = $1 ORDER BY bot_score DESC`,
      [username],
      'Database',
      'get_bot_scan_results'
    );
    
    const results = queryRes.rows || [];
    const summary = {
      total: results.length,
      likely_bot: results.filter(r => r.verdict === 'likely_bot').length,
      suspicious: results.filter(r => r.verdict === 'suspicious').length,
      probably_real: results.filter(r => r.verdict === 'probably_real').length,
      real: results.filter(r => r.verdict === 'real').length,
    };
    
    formatResponse(res, req, { results, summary });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
