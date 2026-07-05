// backend/index.js

require('dotenv').config();

const express = require('express');
const logger = require('./worker/logger');
const browserManager = require('./worker/browserManager');
const workerManager = require('./worker/workerManager');
const bootstrapManager = require('./worker/bootstrapManager');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

// Log incoming request metadata
app.use((req, res, next) => {
  logger.info(`[API] ${req.method} ${req.path}`);
  next();
});

// Mount Routes
app.use('/api/jobs', require('./api/jobs'));
app.use('/api/metrics', require('./api/metrics'));
app.use('/api/providers', require('./api/providers'));
app.use('/api/health', require('./api/health'));
app.use('/api/test', require('./api/testing'));
app.use('/api/discovery', require('./api/discovery'));
app.use('/api/logs', require('./api/logs'));
app.use('/api/leads', require('./api/leads'));
app.use('/api/whatsapp-scan', require('./api/whatsappScan'));

// System diagnostic health endpoints
app.get('/health', (_req, res) => {
  const status = bootstrapManager.getSystemStatus();
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'lead-intelligence-backend-v3',
    database: status.status.database.status,
    browser: status.status.browser.status,
    workers: status.status.workers.status
  });
});

app.get('/health/system', (_req, res) => {
  res.json(bootstrapManager.getSystemStatus());
});

app.get('/', (_req, res) => {
  res.json({
    name: 'Lead Intelligence SaaS Backend V3',
    version: '3.0.0',
    status: 'online',
    system: `/health/system`
  });
});

app.use((err, req, res, next) => {
  logger.error(`[Error Handler] ${err.message}`);
  res.status(err.statusCode || 500).json({
    success: false,
    error: err.message
  });
});

// Graceful Shutdown
process.on('SIGTERM', async () => {
  logger.info('[Lifecycle] SIGTERM received. Shutting down gracefully...');
  workerManager.shutdown();
  await browserManager.shutdown();
  process.exit(0);
});

// Start Express server immediately, THEN run bootstrap sequence.
// This guarantees that the HTTP port is bound instantly and health endpoints respond even if database is offline.
app.listen(PORT, async () => {
  logger.info(`🌐 V3 Backend Service listening on port ${PORT}`);
  
  // Run bootstrap sequence asynchronously so that it doesn't block the Express event loop binding
  bootstrapManager.runBootstrap(app).catch(err => {
    logger.error(`❌ [Bootstrap] Startup sequence encountered an unhandled error: ${err.message}`);
  });
});
