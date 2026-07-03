// backend/worker/bootstrapManager.js

const logger = require('./logger');
const supabase = require('../database/connection');
const browserManager = require('./browserManager');
const workerManager = require('./workerManager');
const queueManager = require('./queueManager');

class BootstrapManager {
  constructor() {
    this.status = {
      version: '3.0.0',
      git_commit: process.env.RAILWAY_GIT_COMMIT_SHA || 'development',
      build_time: new Date().toISOString(),
      node_version: process.version,
      platform: process.platform,
      railway_env: process.env.RAILWAY_ENVIRONMENT || 'local',
      database: {
        status: 'Uninitialized',
        message: '',
        latency_ms: 0
      },
      browser: {
        status: 'Uninitialized',
        open_contexts: 0,
        open_pages: 0
      },
      workers: {
        status: 'Uninitialized',
        concurrency: 4
      },
      server: {
        status: 'Uninitialized',
        port: process.env.PORT || 3001
      }
    };
  }

  async runBootstrap(app) {
    logger.info('========================================================');
    logger.info('🚀 STARTING SYSTEM BOOTSTRAP SEQUENCE...');
    logger.info('========================================================');
    
    // 1. Environment & Diagnostics report
    this.reportDiagnostics();

    // 2. Database Connection Check
    await this.bootstrapDatabase();

    // Cleanup stale running jobs left from a previous crash/restart
    await this.cleanupStaleJobs();

    // 3. Browser Pool Boot check
    await this.bootstrapBrowser();

    // 4. Worker Pool initialization
    await this.bootstrapWorkers();

    // 5. Server routing & listener state
    this.status.server.status = 'Ready';
    logger.info('✅ System Bootstrap Sequence Completed.');
    logger.info('========================================================');
  }

  reportDiagnostics() {
    logger.info('[Bootstrap] Step 1: Diagnostic Startup Report');
    logger.info(`  • Node Version:       ${this.status.node_version}`);
    logger.info(`  • OS / Platform:      ${this.status.platform}`);
    logger.info(`  • Railway Env:        ${this.status.railway_env}`);
    logger.info(`  • Package Version:    ${this.status.version}`);
    logger.info(`  • Git Commit SHA:     ${this.status.git_commit}`);
    logger.info(`  • WebSocket transport: ${global.WebSocket ? 'ws package' : 'native'}`);
    logger.info(`  • Playwright path:    ${process.env.PLAYWRIGHT_BROWSERS_PATH}`);
  }

  async bootstrapDatabase() {
    logger.info('[Bootstrap] Step 2: Verifying Supabase connection...');
    const startDb = Date.now();
    
    if (!supabase) {
      this.status.database.status = 'Degraded';
      this.status.database.message = 'Supabase client could not be created (missing environment variables).';
      logger.error(`❌ [Bootstrap] Database check failed: ${this.status.database.message}`);
      return;
    }

    try {
      // Run a simple query to verify the connection works
      const { data, error } = await supabase
        .from('scrape_jobs')
        .select('count')
        .limit(1);

      const duration = Date.now() - startDb;
      this.status.database.latency_ms = duration;

      if (error) {
        // Table might not exist but connection works, or query failed
        this.status.database.status = 'Connected (Query Failed)';
        this.status.database.message = error.message;
        logger.warn(`⚠️ [Bootstrap] Supabase connection active but query failed in ${duration}ms: ${error.message}`);
      } else {
        this.status.database.status = 'Connected';
        this.status.database.message = 'Connection and table select verified successfully.';
        logger.info(`✓ [Bootstrap] Supabase connection verified successfully in ${duration}ms.`);
      }
    } catch (err) {
      this.status.database.status = 'Offline';
      this.status.database.message = err.message;
      logger.error(`❌ [Bootstrap] Supabase connection failed: ${err.message}`);
    }
  }

  async bootstrapBrowser() {
    logger.info('[Bootstrap] Step 3: Initializing Browser Pool...');
    const startBrowser = Date.now();
    try {
      // Warm up browser
      await browserManager.launch();
      const metrics = browserManager.metrics();
      this.status.browser.status = 'Healthy';
      this.status.browser.open_contexts = metrics.contexts;
      this.status.browser.open_pages = metrics.pages;
      logger.info(`✓ [Bootstrap] Browser Pool loaded successfully in ${Date.now() - startBrowser}ms.`);
    } catch (err) {
      this.status.browser.status = 'Failed';
      logger.error(`❌ [Bootstrap] Browser Pool launch failed: ${err.message}`);
      // Do not crash the server if browser launch fails, let it bootstrap in degraded mode
    }
  }

  async bootstrapWorkers() {
    logger.info('[Bootstrap] Step 4: Initializing Engine Worker Loop...');
    const startWorkers = Date.now();
    try {
      workerManager.initialize(async () => {
        return await queueManager.dequeue();
      });
      this.status.workers.status = 'Active';
      logger.info(`✓ [Bootstrap] Core engine worker pool initialized in ${Date.now() - startWorkers}ms.`);
    } catch (err) {
      this.status.workers.status = 'Failed';
      logger.error(`❌ [Bootstrap] Worker pool initialization failed: ${err.message}`);
    }
  }

  getSystemStatus() {
    return {
      success: true,
      timestamp: new Date().toISOString(),
      status: this.status
    };
  }

  async cleanupStaleJobs() {
    try {
      const supabase = require('../database/connection');
      if (!supabase) return;
      
      // Reset any jobs stuck in 'running' state from a previous crash/restart
      const { data: staleJobs } = await supabase
        .from('scrape_jobs')
        .select('id, keyword')
        .eq('status', 'running');

      if (staleJobs && staleJobs.length > 0) {
        logger.warn(`[Bootstrap] Found ${staleJobs.length} stale running job(s). Resetting to 'failed'...`);
        for (const job of staleJobs) {
          const { data: jobDetails } = await supabase
            .from('scrape_jobs')
            .select('logs')
            .eq('id', job.id)
            .single();

          const currentLogs = jobDetails?.logs || [];
          currentLogs.push(`[${new Date().toISOString()}] Job terminated/aborted due to server restart.`);

          await supabase
            .from('scrape_jobs')
            .update({
              status: 'failed',
              completed_at: new Date().toISOString(),
              logs: currentLogs
            })
            .eq('id', job.id);
        }
        logger.info(`[Bootstrap] ✓ Cleaned up ${staleJobs.length} stale job(s).`);
      } else {
        logger.info('[Bootstrap] No stale running jobs found.');
      }
    } catch (err) {
      logger.warn(`[Bootstrap] Stale job cleanup failed (non-critical): ${err.message}`);
    }
  }
}

module.exports = new BootstrapManager();
