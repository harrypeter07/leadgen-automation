const express = require('express');
const { enrichBatch } = require('../agent/batchRunner');
const { getLeadsByStatus, getTaskProgress } = require('../db/queries');
const logger = require('../utils/logger');

const router = express.Router();

// Wraps an async handler so any thrown error becomes a clean 500 instead of
// crashing the process or hanging the request.
function safeHandler(fn) {
  return async (req, res) => {
    try {
      await fn(req, res);
    } catch (err) {
      logger.error({ path: req.path, error: err.message, stack: err.stack }, 'Route handler error');
      res.status(500).json({ error: 'Internal error', message: err.message });
    }
  };
}

/**
 * Triggers one enrichment batch run. Intentionally synchronous-ish (awaits
 * completion) for simplicity — if your batches get large enough that this
 * risks HTTP timeouts, switch to fire-and-forget + polling via /progress.
 */
router.post('/tasks/enrich', safeHandler(async (req, res) => {
  const limit = Number(req.body?.limit) || 20;
  if (limit < 1 || limit > 200) {
    return res.status(400).json({ error: 'limit must be between 1 and 200' });
  }
  const result = await enrichBatch(limit);
  res.json(result);
}));

router.get('/tasks/progress', safeHandler(async (req, res) => {
  const counts = await getTaskProgress();
  res.json({ counts });
}));

router.get('/leads', safeHandler(async (req, res) => {
  const status = req.query.status || 'qualified';
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const offset = Number(req.query.offset) || 0;

  const validStatuses = ['not_started', 'enriching', 'enriched', 'exhausted', 'qualified', 'rejected'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}` });
  }

  const { data, count } = await getLeadsByStatus(status, { limit, offset });
  res.json({ leads: data, total: count });
}));

module.exports = router;
