// backend/index.js

require('dotenv').config();

const express = require('express');
const logger = require('./worker/logger');
const browserManager = require('./worker/browserManager');
const workerManager = require('./worker/workerManager');
const queueManager = require('./worker/queueManager');

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

// Legacy direct health checks
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'lead-intelligence-backend-v3'
  });
});

app.get('/', (_req, res) => {
  res.json({
    name: 'Lead Intelligence SaaS Backend V3',
    version: '3.0.0',
    status: 'online'
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

app.listen(PORT, () => {
  logger.info(`🌐 V3 Backend Service running on port ${PORT}`);
  
  // Initialize worker pool (4 tabs pool concurrency) pulling from queueManager
  workerManager.initialize(async () => {
    return await queueManager.dequeue();
  });
  
  logger.info('🚀 Core engine worker loop active and running.');
});
