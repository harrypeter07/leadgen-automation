// backend/api/whatsappScan.js
// Express router exposing start / stop / status endpoints for the WA scan background worker.

const express = require('express');
const whatsappScanService = require('../services/whatsappScanService');

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
    ...data,
  });
}

// POST /api/whatsapp-scan/start
// Body: { job_id?, city?, intervalMs? }
router.post('/start', (req, res) => {
  const { job_id, city, intervalMs } = req.body || {};
  const result = whatsappScanService.startScan(
    { job_id: job_id || undefined, city: city || undefined },
    intervalMs || 5000
  );

  if (result.alreadyRunning) {
    return res.status(409).json({
      success: false,
      error: 'A WhatsApp scan is already running. Stop it first.',
      status: whatsappScanService.getStatus(),
    });
  }

  fmt(res, req, { message: 'WhatsApp scan started in background.', ...result });
});

// POST /api/whatsapp-scan/stop
router.post('/stop', (req, res) => {
  const result = whatsappScanService.stopScan();
  fmt(res, req, { message: result.stopped ? 'Scan stop signal sent.' : 'No scan was running.', ...result });
});

// GET /api/whatsapp-scan/status
router.get('/status', (req, res) => {
  fmt(res, req, whatsappScanService.getStatus());
});

module.exports = router;
