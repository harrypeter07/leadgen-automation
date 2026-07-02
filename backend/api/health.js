// backend/api/health.js

const express = require('express');
const browserManager = require('../worker/browserManager');
const supabase = require('../database/connection');
const bootstrapManager = require('../worker/bootstrapManager');

const router = express.Router();

router.use((req, res, next) => {
  req.startTime = Date.now();
  next();
});

router.get('/', async (req, res) => {
  let dbStatus = 'healthy';
  if (!supabase) {
    dbStatus = 'offline';
  } else {
    try {
      const { error } = await supabase.from('scrape_jobs').select('count').limit(1);
      if (error) throw error;
    } catch (e) {
      dbStatus = 'degraded';
    }
  }

  const browserHealth = browserManager.health();

  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    execution_time_ms: Date.now() - req.startTime,
    version: '3.0.0',
    health: {
      database: dbStatus,
      browser_pool: browserHealth.status,
      active_contexts: browserHealth.openContexts,
      active_pages: browserHealth.openPages
    }
  });
});

router.get('/system', (req, res) => {
  res.json(bootstrapManager.getSystemStatus());
});

module.exports = router;
