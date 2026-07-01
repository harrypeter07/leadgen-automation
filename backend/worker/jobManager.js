// backend/worker/jobManager.js

const scrapeJobRepository = require('../repositories/scrapeJobRepository');
const leadsRepository = require('../repositories/leadsRepository');
const browserManager = require('./browserManager');
const eventBus = require('./eventBus');
const logger = require('./logger');

const GoogleMapsProvider = require('../providers/googleMaps/provider');
const GoogleSearchProvider = require('../providers/googleSearch/provider');

class JobManager {
  constructor() {
    this.activeAborts = new Map(); // jobId -> boolean flag
    this.providers = {
      'google_maps': new GoogleMapsProvider(),
      'google_search': new GoogleSearchProvider()
    };
  }

  async executeJob(job, workerId) {
    const startTime = Date.now();
    const providerName = job.current_provider || 'google_maps';
    const provider = this.providers[providerName];

    if (!provider) {
      throw new Error(`PROVIDER_NOT_REGISTERED: ${providerName}`);
    }

    logger.info(`[JobManager] Initiating job ${job.id} on worker #${workerId} using provider ${providerName}`);
    this.activeAborts.set(job.id, false);

    const { context, contextId } = await browserManager.newContext();
    const { page, pageId } = await browserManager.newPage(contextId, context);

    try {
      // 1. Search Query phase
      const freshJob = await scrapeJobRepository.getById(job.id);
      const logs = freshJob.logs || [];
      logs.push(`[${new Date().toISOString()}] Initiating provider search query...`);
      await scrapeJobRepository.update(job.id, { logs });

      await provider.search(page, { keyword: job.keyword, city: job.city });

      // 2. Collection Scroll phase
      logs.push(`[${new Date().toISOString()}] Scrolling list for listings elements...`);
      await scrapeJobRepository.update(job.id, { logs });

      const totalItems = await provider.collect(page, job.max_leads || 10);
      const limit = Math.min(totalItems, job.max_leads || 10);

      logs.push(`[${new Date().toISOString()}] Found ${totalItems} elements. Extracting ${limit} leads...`);
      await scrapeJobRepository.update(job.id, { logs });

      // 3. Details Extraction Loop
      for (let i = 0; i < limit; i++) {
        if (this.activeAborts.get(job.id) === true) {
          throw new Error('JOB_ABORTED');
        }

        const raw = await provider.extract(page, i, job.version || 'v2');
        if (!raw) continue;

        const lead = provider.normalize(raw, job.city);
        
        // Write to Supabase via Repository
        await leadsRepository.upsert(lead);

        // Update Job progress
        const currentFresh = await scrapeJobRepository.getById(job.id);
        const loopLogs = currentFresh.logs || [];
        loopLogs.push(`[${new Date().toISOString()}] Extracted: ${lead.name}`);

        const elapsed = (Date.now() - startTime) / 1000;
        const avg = elapsed / (i + 1);
        const estRemaining = Math.round(avg * (limit - (i + 1)));

        await scrapeJobRepository.update(job.id, {
          progress: i + 1,
          current_business: lead.name,
          estimated_remaining_seconds: estRemaining,
          duration_seconds: Math.round(elapsed),
          logs: loopLogs
        });

        eventBus.publish('job.progress', { jobId: job.id, progress: i + 1, maxLeads: limit });
      }

      // Mark Job completed
      const finalFresh = await scrapeJobRepository.getById(job.id);
      const finalLogs = finalFresh.logs || [];
      finalLogs.push(`[${new Date().toISOString()}] Job completed successfully.`);

      await scrapeJobRepository.update(job.id, {
        status: 'completed',
        completed_at: new Date().toISOString(),
        logs: finalLogs
      });

      eventBus.publish('job.completed', { jobId: job.id, status: 'completed' });
    } catch (err) {
      const freshJob = await scrapeJobRepository.getById(job.id);
      const logs = freshJob ? (freshJob.logs || []) : [];
      
      if (err.message === 'JOB_ABORTED') {
        logs.push(`[${new Date().toISOString()}] Job stopped/cancelled by user.`);
        await scrapeJobRepository.update(job.id, {
          status: 'stopped',
          completed_at: new Date().toISOString(),
          logs
        });
        eventBus.publish('job.completed', { jobId: job.id, status: 'stopped' });
      } else {
        logs.push(`[${new Date().toISOString()}] Execution Error: ${err.message}`);
        await scrapeJobRepository.update(job.id, {
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_count: (freshJob?.error_count || 0) + 1,
          logs
        });
        eventBus.publish('job.failed', { jobId: job.id, error: err.message });
        throw err;
      }
    } finally {
      await browserManager.releasePage(pageId);
      await browserManager.releaseContext(contextId);
      this.activeAborts.delete(job.id);
    }
  }

  stop(jobId) {
    if (this.activeAborts.has(jobId)) {
      this.activeAborts.set(jobId, true);
      return true;
    }
    return false;
  }
}

module.exports = new JobManager();
