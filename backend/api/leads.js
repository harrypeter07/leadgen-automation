// backend/api/leads.js

const express = require('express');
const leadsRepository = require('../repositories/leadsRepository');
const logger = require('../worker/logger');

const router = express.Router();

router.use((req, res, next) => {
  req.startTime = Date.now();
  next();
});

function fmt(res, req, data = {}) {
  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    execution_time_ms: Date.now() - req.startTime,
    ...data
  });
}

// GET /api/leads/recent  — last 20 leads for scraper dashboard panel
router.get('/recent', async (req, res, next) => {
  try {
    const { leads } = await leadsRepository.getAll({ limit: 20 });
    logger.debug(`[LeadsAPI] /recent returned ${leads.length} leads`);
    fmt(res, req, { leads });
  } catch (err) {
    logger.error(`[LeadsAPI] /recent error: ${err.message}`);
    next(err);
  }
});

// GET /api/leads?limit=25&offset=0&city=...&category=...&status=...&search=...
router.get('/', async (req, res, next) => {
  try {
    const { limit = 25, offset = 0, city, category, status, search, job_id, job_ids, has_email } = req.query;
    const result = await leadsRepository.getAll({
      limit: parseInt(limit) || 25,
      offset: parseInt(offset) || 0,
      city: city || undefined,
      category: category || undefined,
      status: status || undefined,
      search: search || undefined,
      job_id: job_id || undefined,
      job_ids: job_ids || undefined,
      has_email: has_email || undefined,
    });
    fmt(res, req, result);
  } catch (err) {
    logger.error(`[LeadsAPI] getAll error: ${err.message}`);
    next(err);
  }
});

module.exports = router;
