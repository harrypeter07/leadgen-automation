// backend/worker/queueManager.js

const scrapeJobRepository = require('../repositories/scrapeJobRepository');
const logger = require('./logger');
const eventBus = require('./eventBus');
const metrics = require('./metrics');

class QueueManager {
  constructor() {
    this.memoryQueue = [];
    this.isPaused = false;
  }

  /**
   * Enqueues a job data payload to database and triggers processing.
   */
  async enqueue(jobData) {
    logger.info(`[Queue] Enqueue requested for provider: ${jobData.current_provider}`);
    const job = await scrapeJobRepository.create({
      status: 'queued',
      progress: 0,
      error_count: 0,
      logs: [`[${new Date().toISOString()}] Job entered queue`],
      ...jobData
    });
    
    eventBus.publish('job.created', { jobId: job.id, provider: job.current_provider });
    return job;
  }

  /**
   * Dequeues the next available job for a worker.
   */
  async dequeue() {
    if (this.isPaused) return null;

    try {
      // Find oldest queued job
      const list = await scrapeJobRepository.getAll({ status: 'queued', order: 'asc' });
      if (list.length === 0) return null;

      const nextJob = list[0];
      // Mark as running immediately to avoid race condition conflicts
      const logs = nextJob.logs || [];
      logs.push(`[${new Date().toISOString()}] Job assigned to worker.`);
      
      const updated = await scrapeJobRepository.update(nextJob.id, {
        status: 'running',
        started_at: new Date().toISOString(),
        logs
      });

      eventBus.publish('job.started', { jobId: updated.id });
      return updated;
    } catch (err) {
      logger.error(`[Queue] Dequeue fetch error: ${err.message}`);
      return null;
    }
  }

  /**
   * Retries a job, copying parameters.
   */
  async retry(jobId) {
    logger.info(`[Queue] Triggering retry for Job ID ${jobId}...`);
    metrics.recordRetry();
    
    const job = await scrapeJobRepository.getById(jobId);
    if (!job) throw new Error('Job not found');

    const newJob = await this.enqueue({
      keyword: job.keyword,
      city: job.city,
      max_leads: job.max_leads,
      current_provider: job.current_provider,
      worker_count: job.worker_count,
      created_by: job.created_by,
      logs: [`[${new Date().toISOString()}] Retried from Job ID ${jobId}`]
    });

    return newJob;
  }

  /**
   * Cancels a queued or running job.
   */
  async cancel(jobId) {
    logger.info(`[Queue] Cancelling Job ID ${jobId}...`);
    const job = await scrapeJobRepository.getById(jobId);
    if (!job) throw new Error('Job not found');

    const logs = job.logs || [];
    logs.push(`[${new Date().toISOString()}] Job cancelled by user.`);

    const updated = await scrapeJobRepository.update(jobId, {
      status: 'stopped',
      completed_at: new Date().toISOString(),
      logs
    });

    eventBus.publish('job.completed', { jobId, status: 'cancelled' });
    return updated;
  }

  pause() {
    this.isPaused = true;
    logger.info('[Queue] Queue Manager processing paused.');
  }

  resume() {
    this.isPaused = false;
    logger.info('[Queue] Queue Manager processing resumed.');
  }

  async stats() {
    try {
      const all = await scrapeJobRepository.getAll();
      const queued = all.filter(j => j.status === 'queued').length;
      const running = all.filter(j => j.status === 'running').length;
      const completed = all.filter(j => j.status === 'completed').length;
      const failed = all.filter(j => j.status === 'failed').length;

      return {
        queued,
        running,
        completed,
        failed,
        total: all.length,
        isPaused: this.isPaused
      };
    } catch (err) {
      return { queued: 0, running: 0, completed: 0, failed: 0, total: 0, isPaused: this.isPaused };
    }
  }
}

module.exports = new QueueManager();
