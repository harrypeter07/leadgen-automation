// backend/api/jobs.js

const express = require('express');
const queueManager = require('../worker/queueManager');
const jobManager = require('../worker/jobManager');
const workerManager = require('../worker/workerManager');
const metrics = require('../worker/metrics');
const scrapeJobRepository = require('../repositories/scrapeJobRepository');

const router = express.Router();

// Middleware to calculate execution time
router.use((req, res, next) => {
  req.startTime = Date.now();
  next();
});

// Helper response formatter
function formatResponse(res, req, data = {}) {
  const executionTime = Date.now() - req.startTime;
  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    execution_time_ms: executionTime,
    version: '3.0.0',
    ...data
  });
}

router.get('/', async (req, res, next) => {
  try {
    const list = await scrapeJobRepository.getAll();
    formatResponse(res, req, { jobs: list });
  } catch (err) {
    next(err);
  }
});

router.post('/start', async (req, res, next) => {
  const { keyword, city, maxLeads, workerCount, provider } = req.body || {};
  if (!keyword || !city) {
    return res.status(400).json({ success: false, error: 'keyword and city are required' });
  }

  try {
    const job = await queueManager.enqueue({
      keyword,
      city,
      max_leads: maxLeads || 25,
      worker_count: workerCount || 1,
      current_provider: provider || 'google_maps'
    });

    formatResponse(res, req, { jobId: job.id, message: 'Scrape job successfully queued.' });
  } catch (err) {
    next(err);
  }
});

router.post('/pause', async (req, res, next) => {
  const { jobId } = req.body || {};
  if (!jobId) return res.status(400).json({ success: false, error: 'jobId is required' });

  try {
    const success = await queueManager.pause(jobId);
    formatResponse(res, req, { message: 'Queue processing paused.' });
  } catch (err) {
    next(err);
  }
});

router.post('/resume', async (req, res, next) => {
  const { jobId } = req.body || {};
  if (!jobId) return res.status(400).json({ success: false, error: 'jobId is required' });

  try {
    await queueManager.resume(jobId);
    formatResponse(res, req, { message: 'Queue processing resumed.' });
  } catch (err) {
    next(err);
  }
});

router.post('/stop', async (req, res, next) => {
  const { jobId } = req.body || {};
  if (!jobId) return res.status(400).json({ success: false, error: 'jobId is required' });

  try {
    await queueManager.cancel(jobId);
    jobManager.stop(jobId);
    formatResponse(res, req, { message: 'Job stopped/cancelled successfully.' });
  } catch (err) {
    next(err);
  }
});

router.post('/retry', async (req, res, next) => {
  const { jobId } = req.body || {};
  if (!jobId) return res.status(400).json({ success: false, error: 'jobId is required' });

  try {
    const retriedJob = await queueManager.retry(jobId);
    formatResponse(res, req, { jobId: retriedJob.id, message: 'Retried job queued.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
