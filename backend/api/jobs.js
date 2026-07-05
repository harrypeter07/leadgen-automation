// backend/api/jobs.js

const express = require('express');
const queueManager = require('../worker/queueManager');
const jobManager = require('../worker/jobManager');
const workerManager = require('../worker/workerManager');
const metrics = require('../worker/metrics');
const scrapeJobRepository = require('../repositories/scrapeJobRepository');
const countryCorrector = require('../modules/countryCorrector');

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

function combineBatchJobs(jobs) {
  const grouped = {};
  const resultList = [];

  for (const job of jobs) {
    if (!job.batch_id) {
      resultList.push(job);
      continue;
    }

    if (!grouped[job.batch_id]) {
      // Decode combined city name from batch_id e.g. "batch_Country:_Sweden_178327..." -> "Country: Sweden"
      let displayCity = job.city;
      const match = job.batch_id.match(/^batch_(Country:_[a-zA-Z_\s]+|Global)_(?:\d+)$/);
      if (match) {
        displayCity = match[1].replace(/_/g, ' ');
      } else {
        if (job.city && job.city.includes(',')) {
          displayCity = 'Combined Scrape';
        }
      }

      grouped[job.batch_id] = {
        id: job.id,
        batch_id: job.batch_id,
        created_at: job.created_at,
        keyword: job.keyword,
        city: displayCity,
        max_leads: 0,
        status: 'completed',
        progress: 0,
        current_business: null,
        current_provider: job.current_provider,
        error_count: 0,
        started_at: job.started_at,
        completed_at: job.completed_at,
        duration_seconds: 0,
        estimated_remaining_seconds: 0,
        logs: [],
        worker_count: job.worker_count,
        scraped_leads: [],
        subJobs: []
      };
    }

    const parent = grouped[job.batch_id];
    parent.subJobs.push(job);
    parent.max_leads += job.max_leads || 0;
    parent.progress += job.progress || 0;
    parent.error_count += job.error_count || 0;
    
    // Status priority resolution: running > queued > failed > paused > stopped > completed
    const statusPriority = {
      'running': 6,
      'queued': 5,
      'failed': 4,
      'paused': 3,
      'stopped': 2,
      'completed': 1
    };
    
    const parentPriority = statusPriority[parent.status] || 0;
    const childPriority = statusPriority[job.status] || 0;
    if (childPriority > parentPriority) {
      parent.status = job.status;
    }

    // Merge scraped leads
    if (Array.isArray(job.scraped_leads)) {
      parent.scraped_leads.push(...job.scraped_leads);
    }

    // Merge logs prefixed with the city name
    if (Array.isArray(job.logs)) {
      const cityPrefix = `[${job.city}] `;
      const prefixedLogs = job.logs.map(logStr => {
        const tsMatch = logStr.match(/^(\[[^\]]+\]\s*)(.*)$/);
        if (tsMatch) {
          return `${tsMatch[1]}${cityPrefix}${tsMatch[2]}`;
        }
        return `${cityPrefix}${logStr}`;
      });
      parent.logs.push(...prefixedLogs);
    }

    // Update timestamps
    if (job.started_at && (!parent.started_at || job.started_at < parent.started_at)) {
      parent.started_at = job.started_at;
    }
    if (job.completed_at && (!parent.completed_at || job.completed_at > parent.completed_at)) {
      parent.completed_at = job.completed_at;
    }
    
  }

  // Sort logs in grouped batches and construct dynamic status descriptions
  for (const bId of Object.keys(grouped)) {
    const parent = grouped[bId];
    parent.logs.sort((a, b) => {
      const aMatch = a.match(/^\[([^\]]+)\]/);
      const bMatch = b.match(/^\[([^\]]+)\]/);
      if (aMatch && bMatch) {
        return new Date(aMatch[1]) - new Date(bMatch[1]);
      }
      return 0;
    });

    const runningSubJob = parent.subJobs.find(j => j.status === 'running');
    if (runningSubJob) {
      const remainingCities = parent.subJobs
        .filter(j => j.status === 'queued')
        .map(j => j.city);
      const nextStr = remainingCities.length > 0 ? ` (Next: ${remainingCities.join(', ')})` : '';
      const currentBiz = runningSubJob.current_business ? ` - ${runningSubJob.current_business}` : '';
      parent.current_business = `Scraping ${runningSubJob.city}${currentBiz}${nextStr}`;
    } else {
      const queuedSubJob = parent.subJobs.find(j => j.status === 'queued');
      if (queuedSubJob) {
        const remainingCities = parent.subJobs
          .filter(j => j.status === 'queued')
          .map(j => j.city);
        parent.current_business = `Waiting to scrape ${queuedSubJob.city} (Remaining: ${remainingCities.join(', ')})`;
      } else {
        const failedSubJob = parent.subJobs.find(j => j.status === 'failed');
        if (failedSubJob) {
          parent.current_business = 'Failed';
        } else {
          parent.current_business = 'Completed';
        }
      }
    }

    resultList.push(parent);
  }

  return resultList.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

router.get('/', async (req, res, next) => {
  try {
    const list = await scrapeJobRepository.getAll();
    const stats = await queueManager.stats();
    const combinedList = combineBatchJobs(list);
    formatResponse(res, req, { jobs: combinedList, isPaused: stats.isPaused });
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

    // Auto-split batch chunking strategy for Country & Global queries to prevent local timeouts
    let targetCities = [];
    const limitVal = maxLeads || 25;

    if (finalCity === 'Global') {
      targetCities = ['New York', 'London', 'Sydney', 'Mumbai', 'Toronto', 'Berlin', 'Tokyo', 'Singapore'];
    } else if (finalCity.startsWith('Country: ')) {
      const countryName = finalCity.replace('Country: ', '');
      const countryCities = {
        'Sweden': ['Stockholm', 'Gothenburg', 'Malmo', 'Uppsala'],
        'India': ['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai'],
        'United States': ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix'],
        'United Kingdom': ['London', 'Birmingham', 'Leeds', 'Glasgow', 'Manchester'],
        'Canada': ['Toronto', 'Montreal', 'Vancouver', 'Calgary'],
        'Australia': ['Sydney', 'Melbourne', 'Brisbane', 'Perth'],
        'Germany': ['Berlin', 'Hamburg', 'Munich', 'Cologne'],
        'France': ['Paris', 'Marseille', 'Lyon', 'Toulouse'],
        'United Arab Emirates': ['Dubai', 'Abu Dhabi', 'Sharjah']
      };
      targetCities = countryCities[countryName] || [];
    }

    if (targetCities.length > 0) {
      const chunkLeads = Math.max(5, Math.ceil(limitVal / targetCities.length));
      const createdJobs = [];
      const batchId = `batch_${finalCity.replace(/\s+/g, '_')}_${Date.now()}`;
      
      for (const tCity of targetCities) {
        const finalKeyword = area && area.trim() ? `${keyword.trim()} [Area: ${area.trim()}]` : keyword.trim();
        const job = await queueManager.enqueue({
          keyword: finalKeyword,
          city: tCity,
          max_leads: chunkLeads,
          worker_count: workerCount || 1,
          current_provider: provider || 'google_maps',
          batch_id: batchId
        });
        createdJobs.push(job.id);
      }
      
      return formatResponse(res, req, {
        jobIds: createdJobs,
        message: `Search query split successfully into ${createdJobs.length} city-level jobs (${chunkLeads} leads each).`
      });
    }

    const finalKeyword = area && area.trim() ? `${keyword.trim()} [Area: ${area.trim()}]` : keyword.trim();
    const job = await queueManager.enqueue({
      keyword: finalKeyword,
      city: finalCity,
      max_leads: limitVal,
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
        createdJobs.push({ jobId: job.id, keyword: kw.trim(), area: area || null });
      }
    }

    res.json({
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
    const job = await scrapeJobRepository.getById(jobId).catch(() => null);
    if (job && job.batch_id) {
      const allJobs = await scrapeJobRepository.getAll();
      const batchJobs = allJobs.filter(j => j.batch_id === job.batch_id);
      for (const bj of batchJobs) {
        await queueManager.cancel(bj.id).catch(() => {});
        jobManager.stop(bj.id);
      }
    } else {
      await queueManager.cancel(jobId);
      jobManager.stop(jobId);
    }
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

    let toSave = [];
    let jobIdsToClear = [jobId];

    if (job.batch_id) {
      const allJobs = await scrapeJobRepository.getAll();
      const batchJobs = allJobs.filter(j => j.batch_id === job.batch_id);
      jobIdsToClear = batchJobs.map(j => j.id);
      for (const bj of batchJobs) {
        if (Array.isArray(bj.scraped_leads)) {
          toSave.push(...bj.scraped_leads);
        }
      }
    } else {
      toSave = job.scraped_leads || [];
    }

    if (toSave.length === 0) {
      return res.status(400).json({ success: false, error: 'No scraped leads found on this job.' });
    }

    // Pick subset if indices provided, else all
    const selectedLeads = Array.isArray(indices)
      ? indices.map(i => toSave[i]).filter(Boolean)
      : toSave;

    const leadsRepository = require('../repositories/leadsRepository');
    const results = { saved: 0, merged: 0, errors: 0, warnings: [] };

    for (const lead of selectedLeads) {
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

    // Clear scraped_leads from all sub-jobs in the batch
    for (const jId of jobIdsToClear) {
      await scrapeJobRepository.update(jId, { scraped_leads: [] });
    }

    formatResponse(res, req, {
      message: `Saved ${results.saved} new leads. Merged ${results.merged} duplicates.`,
      ...results
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
