// backend/worker/bootstrapManager.js

const logger = require('./logger');
const supabase = require('../database/connection');
const browserManager = require('./browserManager');
const workerManager = require('./workerManager');
const queueManager = require('./queueManager');
const db = require('../database/db');
const fs = require('fs');
const path = require('path');

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
    logger.info('[Bootstrap] Step 2: Verifying PostgreSQL connection and running migrations...');
    const startDb = Date.now();
    try {
      // Ensure migrations_log table exists
      await db.query(`
        CREATE TABLE IF NOT EXISTS migrations_log (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL UNIQUE,
          executed_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      const MIGRATION_NAME = '01_conversation_intelligence';
      const checkRes = await db.query('SELECT * FROM migrations_log WHERE name = $1;', [MIGRATION_NAME]);
      
      if (checkRes.rows.length === 0) {
        logger.info('[Bootstrap] Migration "01_conversation_intelligence" is not applied. Applying now...');
        const upFilePath = path.join(__dirname, '..', 'database', 'migrations', '01_conversation_intelligence.sql');
        const sql = fs.readFileSync(upFilePath, 'utf8');
        
        await db.transaction(async (tx) => {
          await tx.query(sql);
          await tx.query('INSERT INTO migrations_log (name) VALUES ($1);', [MIGRATION_NAME]);
        }, 'BootstrapMigrations');
        logger.info('[Bootstrap] Migration applied successfully.');
      } else {
        logger.info('[Bootstrap] Migration "01_conversation_intelligence" is already up to date.');
      }

      const duration = Date.now() - startDb;
      this.status.database.latency_ms = duration;
      this.status.database.status = 'Connected';
      this.status.database.message = 'PostgreSQL connection and migration verified.';
      logger.info(`✓ [Bootstrap] PostgreSQL connection verified in ${duration}ms.`);
    } catch (err) {
      this.status.database.status = 'Offline';
      this.status.database.message = err.message;
      logger.error(`❌ [Bootstrap] PostgreSQL connection/migration failed: ${err.message}`);
      throw err;
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
    logger.info('[Bootstrap] Step 4: Initializing Engine Worker Loop and Background CRONs...');
    const startWorkers = Date.now();
    try {
      workerManager.initialize(async () => {
        return await queueManager.dequeue();
      });
      
      // Start background cron loops (research, followups, ghost, retries, cleanup)
      const backgroundWorkers = require('./backgroundWorkers');
      backgroundWorkers.start();

      this.status.workers.status = 'Active';
      logger.info(`✓ [Bootstrap] Core engine worker pool and background loops initialized in ${Date.now() - startWorkers}ms.`);
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
