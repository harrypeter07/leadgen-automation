// whatsapp-service/scraper/jobManager.js

const dbWriter = require('./dbWriter');
const scraperEngine = require('./scraperEngine');

class JobManager {
  constructor() {
    this.jobQueue = [];
    this.currentJob = null;
    this.isProcessingQueue = false;
  }

  /**
   * Recovers incomplete jobs on server boot.
   * Finds jobs stuck in 'running' state and resets them to 'queued' for recovery.
   */
  async recoverJobs() {
    console.log('🔄 [Job Manager] Running boot-time incomplete jobs audit...');
    try {
      const runningJobs = await dbWriter.fetchRecords('scrape_jobs', { status: 'eq.running' });
      for (const job of runningJobs) {
        console.log(`   [Recover] Job ${job.id} was left running. Resetting to 'queued'.`);
        const logs = job.logs || [];
        logs.push(`[${new Date().toISOString()}] Server restarted. Job recovered and queued.`);
        await dbWriter.writeRecord('scrape_jobs', {
          status: 'queued',
          logs: logs
        }, job.id);
      }
      
      // Load all queued jobs to start processing
      await this.processQueue();
    } catch (err) {
      console.error('❌ [Job Manager] Boot recovery failed:', err.message);
    }
  }

  /**
   * Processes the job queue sequentially.
   */
  async processQueue() {
    if (this.isProcessingQueue || this.currentJob) return;
    this.isProcessingQueue = true;

    try {
      const queuedJobs = await dbWriter.fetchRecords('scrape_jobs', {
        status: 'eq.queued',
        order: 'created_at.asc'
      });

      if (queuedJobs.length > 0) {
        this.currentJob = queuedJobs[0];
        console.log(`🚀 [Job Manager] Starting next job in queue: Job ID ${this.currentJob.id}`);
        await this.executeJob(this.currentJob);
      }
    } catch (err) {
      console.error('❌ [Job Manager] Queue processing failed:', err.message);
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Triggers background execution of a ScrapeJob.
   */
  async executeJob(job) {
    const startTime = Date.now();
    const logs = job.logs || [];
    logs.push(`[${new Date().toISOString()}] Job execution started.`);

    await dbWriter.writeRecord('scrape_jobs', {
      status: 'running',
      started_at: new Date().toISOString(),
      logs: logs
    }, job.id);

    try {
      await scraperEngine.runJob(
        job,
        // On progress update (new lead upserted)
        async (jId, name) => {
          const freshJob = (await dbWriter.fetchRecords('scrape_jobs', { id: `eq.${jId}` }))[0];
          if (!freshJob) return;

          const elapsed = (Date.now() - startTime) / 1000;
          const currentProgress = freshJob.progress + 1;
          
          let estRemaining = null;
          if (currentProgress > 0) {
            const avgTimePerLead = elapsed / currentProgress;
            estRemaining = Math.round(avgTimePerLead * (job.max_leads - currentProgress));
          }

          const jLogs = freshJob.logs || [];
          jLogs.push(`[${new Date().toISOString()}] Successfully scraped lead: ${name}`);

          await dbWriter.writeRecord('scrape_jobs', {
            progress: currentProgress,
            current_business: name,
            estimated_remaining_seconds: estRemaining,
            duration_seconds: Math.round(elapsed),
            logs: jLogs
          }, jId);
        },
        // On log print
        async (message) => {
          const freshJob = (await dbWriter.fetchRecords('scrape_jobs', { id: `eq.${job.id}` }))[0];
          const jLogs = freshJob ? (freshJob.logs || []) : [];
          jLogs.push(`[${new Date().toISOString()}] ${message}`);
          console.log(`[Job ${job.id}] ${message}`);

          await dbWriter.writeRecord('scrape_jobs', { logs: jLogs }, job.id).catch(() => {});
        },
        // On error
        async (jId, err) => {
          const freshJob = (await dbWriter.fetchRecords('scrape_jobs', { id: `eq.${jId}` }))[0];
          if (!freshJob) return;

          const jLogs = freshJob.logs || [];
          jLogs.push(`[${new Date().toISOString()}] Error: ${err.message}`);
          
          await dbWriter.writeRecord('scrape_jobs', {
            error_count: freshJob.error_count + 1,
            logs: jLogs
          }, jId).catch(() => {});
        }
      );

      // Verify final job state
      const finalJob = (await dbWriter.fetchRecords('scrape_jobs', { id: `eq.${job.id}` }))[0];
      const status = finalJob.status === 'paused' ? 'paused' : 'completed';
      const finalLogs = finalJob.logs || [];
      finalLogs.push(`[${new Date().toISOString()}] Job completed successfully. Duration: ${Math.round((Date.now() - startTime) / 1000)}s`);

      await dbWriter.writeRecord('scrape_jobs', {
        status: status,
        completed_at: new Date().toISOString(),
        logs: finalLogs
      }, job.id);

    } catch (err) {
      console.error(`❌ [Job Manager] Job ${job.id} execution failed:`, err);
      const finalJob = (await dbWriter.fetchRecords('scrape_jobs', { id: `eq.${job.id}` }))[0];
      const finalLogs = finalJob ? (finalJob.logs || []) : [];
      finalLogs.push(`[${new Date().toISOString()}] Fatal Error: ${err.message}`);

      await dbWriter.writeRecord('scrape_jobs', {
        status: err.message === 'CAPTCHA_DETECTED' ? 'paused' : 'failed',
        completed_at: new Date().toISOString(),
        logs: finalLogs
      }, job.id).catch(() => {});
    } finally {
      this.currentJob = null;
      // Start next job
      setTimeout(() => this.processQueue(), 1000);
    }
  }

  /**
   * Pauses a running job.
   */
  async pauseJob(jobId) {
    const success = scraperEngine.pauseJob(jobId);
    if (success) {
      const job = (await dbWriter.fetchRecords('scrape_jobs', { id: `eq.${jobId}` }))[0];
      const logs = job ? (job.logs || []) : [];
      logs.push(`[${new Date().toISOString()}] Job paused by user.`);
      await dbWriter.writeRecord('scrape_jobs', { status: 'paused', logs }, jobId);
      return true;
    }
    return false;
  }

  /**
   * Resumes a paused job.
   */
  async resumeJob(jobId) {
    const success = scraperEngine.resumeJob(jobId);
    if (success) {
      const job = (await dbWriter.fetchRecords('scrape_jobs', { id: `eq.${jobId}` }))[0];
      const logs = job ? (job.logs || []) : [];
      logs.push(`[${new Date().toISOString()}] Job resumed by user.`);
      await dbWriter.writeRecord('scrape_jobs', { status: 'running', logs }, jobId);
      // If it wasn't marked as active (e.g. server restarted while paused), re-run
      if (this.currentJob?.id !== jobId) {
        this.processQueue();
      }
      return true;
    }
    return false;
  }

  /**
   * Stops/aborts a running job.
   */
  async stopJob(jobId) {
    const success = scraperEngine.abortJob(jobId);
    const job = (await dbWriter.fetchRecords('scrape_jobs', { id: `eq.${jobId}` }))[0];
    const logs = job ? (job.logs || []) : [];
    logs.push(`[${new Date().toISOString()}] Job stopped/terminated by user.`);
    await dbWriter.writeRecord('scrape_jobs', { status: 'stopped', logs }, jobId);
    
    if (this.currentJob?.id === jobId) {
      this.currentJob = null;
    }
    return true;
  }
}

module.exports = new JobManager();
