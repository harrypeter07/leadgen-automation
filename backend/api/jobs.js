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
    const stats = await queueManager.stats();
    formatResponse(res, req, { jobs: list, isPaused: stats.isPaused });
  } catch (err) {
    next(err);
  }
});

router.post('/start', async (req, res, next) => {
  const { keyword, city, maxLeads, workerCount, provider, area } = req.body || {};
  if (!keyword || !city) {
    return res.status(400).json({ success: false, error: 'keyword and city are required' });
  }

  try {
    // Automatically resume queue manager processing when queueing a new job
    queueManager.resume();

    let finalCity = city;
    if (city.startsWith('Country: ')) {
      const rawCountry = city.replace('Country: ', '');
      const corrected = countryCorrector.correctCountryName(rawCountry);
      if (!corrected) {
        return res.status(400).json({ success: false, error: 'Wrong input: Please enter a valid country name.' });
      }
      finalCity = `Country: ${corrected}`;
    }

    const finalKeyword = area && area.trim() ? `${keyword.trim()} [Area: ${area.trim()}]` : keyword.trim();
    const job = await queueManager.enqueue({
      keyword: finalKeyword,
      city: finalCity,
      max_leads: maxLeads || 25,
      worker_count: workerCount || 1,
      current_provider: provider || 'google_maps'
    });

    formatResponse(res, req, { jobId: job.id, message: 'Scrape job successfully queued.' });
  } catch (err) {
    next(err);
  }
});

router.post('/start-batch', async (req, res, next) => {
  const { keywords, areas, city, maxLeads, workerCount, provider } = req.body || {};
  if (!keywords || !Array.isArray(keywords) || keywords.length === 0 || !city) {
    return res.status(400).json({ success: false, error: 'keywords (array) and city are required' });
  }

  try {
    queueManager.resume();

    let finalCity = city;
    if (city.startsWith('Country: ')) {
      const rawCountry = city.replace('Country: ', '');
      const corrected = countryCorrector.correctCountryName(rawCountry);
      if (!corrected) {
        return res.status(400).json({ success: false, error: 'Wrong input: Please enter a valid country name.' });
      }
      finalCity = `Country: ${corrected}`;
    }

    const activeAreas = Array.isArray(areas) && areas.length > 0 ? areas : [null];
    const createdJobs = [];

    for (const kw of keywords) {
      if (!kw || typeof kw !== 'string' || !kw.trim()) continue;
      for (const area of activeAreas) {
        const finalKeyword = area && area.trim() ? `${kw.trim()} [Area: ${area.trim()}]` : kw.trim();
        const job = await queueManager.enqueue({
          keyword: finalKeyword,
          city: finalCity,
          max_leads: maxLeads || 25,
          worker_count: workerCount || 1,
          current_provider: provider || 'google_maps'
        });
        createdJobs.push({ jobId: job.id, keyword: finalKeyword });
      }
    }

    formatResponse(res, req, {
      message: `Batch job successfully queued. Spawned ${createdJobs.length} scrape jobs.`,
      jobs: createdJobs
    });
  } catch (err) {
    next(err);
  }
});

router.post('/pause', async (req, res, next) => {
  const { jobId } = req.body || {};
  if (!jobId) return res.status(400).json({ success: false, error: 'jobId is required' });

  try {
    queueManager.pause();
    formatResponse(res, req, { message: 'Queue processing paused.' });
  } catch (err) {
    next(err);
  }
});

router.post('/resume', async (req, res, next) => {
  const { jobId } = req.body || {};
  // If no jobId, it's a global queue resume request
  try {
    queueManager.resume();
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
    // Automatically resume queue manager processing when retrying a job
    queueManager.resume();
    const retriedJob = await queueManager.retry(jobId);
    formatResponse(res, req, { jobId: retriedJob.id, message: 'Retried job queued.' });
  } catch (err) {
    next(err);
  }
});

// Get scraped_leads preview for a job (no DB save yet)
router.get('/:jobId/leads', async (req, res, next) => {
  const { jobId } = req.params;
  try {
    const leadsRepository = require('../repositories/leadsRepository');
    const leads = await leadsRepository.getByJobId(jobId);
    formatResponse(res, req, { leads, count: leads.length });
  } catch (err) {
    next(err);
  }
});

// Save selected scraped_leads from job record into the leads table
// Body: { indices: [0,1,2,...] } — optional, saves all if omitted
router.post('/:jobId/save-leads', async (req, res, next) => {
  const { jobId } = req.params;
  const { indices } = req.body || {}; // optional array of lead indices to save

  try {
    const job = await scrapeJobRepository.getById(jobId);
    if (!job) return res.status(404).json({ success: false, error: 'Job not found' });

    const allLeads = job.scraped_leads || [];
    if (allLeads.length === 0) {
      return res.status(400).json({ success: false, error: 'No scraped leads found on this job.' });
    }

    // Pick subset if indices provided, else all
    const toSave = Array.isArray(indices)
      ? indices.map(i => allLeads[i]).filter(Boolean)
      : allLeads;

    const leadsRepository = require('../repositories/leadsRepository');
    const results = { saved: 0, merged: 0, errors: 0, warnings: [] };

    for (const lead of toSave) {
      try {
        const result = await leadsRepository.upsert({ ...lead, job_id: jobId });
        if (result._was_duplicate) {
          results.merged++;
          results.warnings.push(`Merged duplicate: ${lead.name} (${lead.phone})`);
        } else {
          results.saved++;
        }
      } catch (err) {
        results.errors++;
        results.warnings.push(`Failed to save ${lead.name}: ${err.message}`);
      }
    }

    // Clear scraped_leads from job record now that they are saved
    await scrapeJobRepository.update(jobId, { scraped_leads: [] });

    formatResponse(res, req, {
      message: `Saved ${results.saved} new leads. Merged ${results.merged} duplicates.`,
      ...results
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
