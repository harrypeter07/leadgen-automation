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
  const { context, contextId } = await browserManager.newContext();
  const { page, pageId } = await browserManager.newPage(contextId, context);

  try {
    const report = await websiteAnalyzer.audit(page, url);
    formatResponse(res, req, { report });
  } catch (err) {
    next(err);
  } finally {
    await browserManager.releasePage(pageId);
    await browserManager.releaseContext(contextId);
  }
});

/**
   * Test instagram analyzer.
   */
router.post('/instagram', async (req, res, next) => {
  const { username } = req.body || {};
  if (!username) return res.status(400).json({ success: false, error: 'username is required' });

  logger.info(`[API Testing] Audit request for Instagram: @${username}`);
  const { context, contextId } = await browserManager.newContext();
  const { page, pageId } = await browserManager.newPage(contextId, context);

  try {
    const report = await instagramAnalyzer.audit(page, username);
    formatResponse(res, req, { report });
  } catch (err) {
    next(err);
  } finally {
    await browserManager.releasePage(pageId);
    await browserManager.releaseContext(contextId);
  }
});

module.exports = router;
