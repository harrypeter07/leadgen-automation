// backend/api/metrics.js

const express = require('express');
const metrics = require('../worker/metrics');
const workerManager = require('../worker/workerManager');
const queueManager = require('../worker/queueManager');

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

router.get('/', (req, res) => {
  const stats = metrics.getMetrics();
  formatResponse(res, req, { metrics: stats });
});

router.get('/workers', (req, res) => {
  const list = workerManager.workerHealth();
  formatResponse(res, req, { workers: list });
});

router.get('/queue', async (req, res) => {
  const stats = await queueManager.stats();
  formatResponse(res, req, { queue: stats });
});

module.exports = router;
