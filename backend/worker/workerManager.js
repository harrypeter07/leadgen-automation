// backend/worker/workerManager.js

const logger = require('./logger');
const eventBus = require('./eventBus');
const metrics = require('./metrics');

class Worker {
  constructor(id, onJobPull) {
    this.id = id;
    this.status = 'Idle'; // 'Idle', 'Busy', 'Paused', 'Stopped', 'Recovering'
    this.currentJobId = null;
    this.currentProvider = null;
    this.startTime = null;
    this.onJobPull = onJobPull;
    this.loopInterval = null;
  }

  start() {
    logger.info(`[WORKER #${this.id}] Started`);
    this.loopInterval = setInterval(() => this.poll(), 2000);
  }

  async poll() {
    if (this.status !== 'Idle') return;
    
    const job = await this.onJobPull();
    if (job) {
      await this.execute(job);
    }
  }

  async execute(job) {
    this.status = 'Busy';
    this.currentJobId = job.id;
    this.currentProvider = job.current_provider;
    this.startTime = Date.now();

    logger.info(`[WORKER #${this.id}] Running ${this.currentProvider} Job ID ${job.id}`);
    eventBus.publish('provider.started', { workerId: this.id, jobId: job.id, provider: this.currentProvider });

    try {
      // Import jobManager dynamically to avoid circular references
      const jobManager = require('./jobManager');
      await jobManager.executeJob(job, this.id);
      
      const duration = Date.now() - this.startTime;
      logger.info(`[WORKER #${this.id}] Finished Job ID ${job.id}. Duration=${duration}ms`);
      eventBus.publish('provider.completed', { workerId: this.id, jobId: job.id, duration });
      metrics.recordJobExecution(this.currentProvider, duration, true);
    } catch (err) {
      const duration = Date.now() - this.startTime;
      logger.error(`[WORKER #${this.id}] Failed Job ID ${job.id}: ${err.message}`);
      metrics.recordJobExecution(this.currentProvider, duration, false);
    } finally {
      this.status = 'Idle';
      this.currentJobId = null;
      this.currentProvider = null;
      this.startTime = null;
    }
  }

  pause() {
    if (this.status === 'Busy') {
      this.status = 'Paused';
      logger.info(`[WORKER #${this.id}] Paused`);
    }
  }

  resume() {
    if (this.status === 'Paused') {
      this.status = 'Busy';
      logger.info(`[WORKER #${this.id}] Resumed`);
    }
  }

  stop() {
    this.status = 'Stopped';
    if (this.loopInterval) {
      clearInterval(this.loopInterval);
    }
    logger.info(`[WORKER #${this.id}] Stopped`);
  }

  health() {
    return {
      workerId: this.id,
      status: this.status,
      currentJobId: this.currentJobId,
      currentProvider: this.currentProvider,
      elapsedSeconds: this.startTime ? Math.round((Date.now() - this.startTime) / 1000) : 0,
    };
  }
}

class WorkerManager {
  constructor() {
    this.workers = new Map(); // workerId -> Worker
    this.maxWorkers = 4;
  }

  initialize(onJobPull) {
    logger.info(`[WorkerManager] Initializing worker pool (concurrency: ${this.maxWorkers})...`);
    for (let i = 1; i <= this.maxWorkers; i++) {
      this.createWorker(i, onJobPull);
    }
  }

  createWorker(id, onJobPull) {
    const worker = new Worker(id, onJobPull);
    worker.start();
    this.workers.set(id, worker);
    return worker;
  }

  destroyWorker(id) {
    const worker = this.workers.get(id);
    if (worker) {
      worker.stop();
      this.workers.delete(id);
      logger.info(`[WorkerManager] Worker #${id} destroyed.`);
    }
  }

  pauseWorker(id) {
    const worker = this.workers.get(id);
    if (worker) worker.pause();
  }

  resumeWorker(id) {
    const worker = this.workers.get(id);
    if (worker) worker.resume();
  }

  stopWorker(id) {
    const worker = this.workers.get(id);
    if (worker) worker.stop();
  }

  workerHealth() {
    const list = [];
    for (const worker of this.workers.values()) {
      list.push(worker.health());
    }
    return list;
  }

  shutdown() {
    logger.info('[WorkerManager] Shutting down worker pool...');
    for (const id of this.workers.keys()) {
      this.destroyWorker(id);
    }
  }
}

module.exports = new WorkerManager();
