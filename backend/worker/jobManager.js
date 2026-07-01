// backend/worker/jobManager.js

const scrapeJobRepository = require('../repositories/scrapeJobRepository');
const leadsRepository = require('../repositories/leadsRepository');
const browserManager = require('./browserManager');
const eventBus = require('./eventBus');
const logger = require('./logger');

class JobManager {
  constructor() {
    this.activeAborts = new Map(); // jobId -> boolean flag
  }

  async executeJob(job, workerId) {
    const startTime = Date.now();
    logger.info(`[JobManager] Starting job ${job.id} on worker #${workerId}`);
    
    // Register cancel token
    this.activeAborts.set(job.id, false);

    // Context & Page requested through BrowserManager
    const { context, contextId } = await browserManager.newContext();
    const { page, pageId } = await browserManager.newPage(contextId, context);

    try {
      // Mock provider logic since provider plugins are implemented in Phase 4
      const maxLeads = job.max_leads || 10;
      for (let i = 1; i <= maxLeads; i++) {
        // Check for cancel / stop aborts
        if (this.activeAborts.get(job.id) === true) {
          throw new Error('JOB_ABORTED');
        }

        // Simulate page actions & dynamic waits
        await page.goto('about:blank');
        await new Promise(resolve => setTimeout(resolve, 500)); // rate limiting simulate

        // Add log & progress
        const name = `Mock Business ${i} (${job.keyword})`;
        const mockLead = {
          name,
          phone: `+9198765${Math.floor(10000 + Math.random() * 90000)}`,
          email: `contact@mockbusiness${i}.com`,
          city: job.city,
          category: job.keyword,
          source: job.current_provider,
          status: 'new'
        };

        // Write directly via Repository
        await leadsRepository.upsert(mockLead);

        // Update Job progress in Supabase
        const freshJob = await scrapeJobRepository.getById(job.id);
        const logs = freshJob.logs || [];
        logs.push(`[${new Date().toISOString()}] Scraped: ${name}`);

        const elapsed = (Date.now() - startTime) / 1000;
        const avg = elapsed / i;
        const estRemaining = Math.round(avg * (maxLeads - i));

        await scrapeJobRepository.update(job.id, {
          progress: i,
          current_business: name,
          estimated_remaining_seconds: estRemaining,
          duration_seconds: Math.round(elapsed),
          logs
        });

        eventBus.publish('job.progress', { jobId: job.id, progress: i, maxLeads });
      }

      // Mark completed
      const freshJob = await scrapeJobRepository.getById(job.id);
      const logs = freshJob.logs || [];
      logs.push(`[${new Date().toISOString()}] Job completed successfully.`);
      
      await scrapeJobRepository.update(job.id, {
        status: 'completed',
        completed_at: new Date().toISOString(),
        logs
      });

      eventBus.publish('job.completed', { jobId: job.id, status: 'completed' });
    } catch (err) {
      const freshJob = await scrapeJobRepository.getById(job.id);
      const logs = freshJob ? (freshJob.logs || []) : [];
      
      if (err.message === 'JOB_ABORTED') {
        logs.push(`[${new Date().toISOString()}] Job aborted by user.`);
        await scrapeJobRepository.update(job.id, {
          status: 'stopped',
          completed_at: new Date().toISOString(),
          logs
        });
        eventBus.publish('job.completed', { jobId: job.id, status: 'stopped' });
      } else {
        logs.push(`[${new Date().toISOString()}] Error: ${err.message}`);
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
      // Release resources via BrowserManager
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
