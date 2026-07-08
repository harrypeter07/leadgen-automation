// backend/index.js

require('dotenv').config();

const express = require('express');
const logger = require('./worker/logger');
const browserManager = require('./worker/browserManager');
const workerManager = require('./worker/workerManager');
const bootstrapManager = require('./worker/bootstrapManager');

const { traceMiddleware, sanitizeMiddleware, rateLimit } = require('./modules/middleware');
const { errorMiddleware } = require('./modules/errors');

const app = express();
const PORT = process.env.PORT || 3001;

// Mount tracing and global rate limiting first
app.use(traceMiddleware);
app.use(rateLimit({ max: 300 })); // 300 requests per 15 minutes max limit per IP

app.use(express.json());
app.use(sanitizeMiddleware);

// Mount Routes
app.use('/api/jobs', require('./api/jobs'));
app.use('/api/enrich', require('./api/enrich'));
app.use('/api/metrics', require('./api/metrics'));
app.use('/api/providers', require('./api/providers'));
app.use('/api/health', require('./api/health'));
app.use('/api/test', require('./api/testing'));
app.use('/api/discovery', require('./api/discovery'));
app.use('/api/logs', require('./api/logs'));
app.use('/api/leads', require('./api/leads'));
app.use('/api/whatsapp-scan', require('./api/whatsappScan'));
app.use('/api/outreach', require('./api/outreach'));
app.use('/api/whatsapp-webhook', require('./api/whatsappWebhooks'));
app.use('/api/docs', require('./api/docs'));
app.use('/api/analytics', require('./api/analytics'));
app.use('/api/workflows', require('./api/workflows'));
app.use('/api/automation/accounts', require('./api/automationAccounts'));
app.use('/api/automation/workflows', require('./api/automationWorkflows'));

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

app.get('/health/env-check', (req, res) => {
  res.json({
    SUPABASE_URL_defined: !!process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY_defined: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
});

app.get('/health/smtp-check', async (req, res) => {
  const supabase = require('./database/connection');
  if (!supabase) {
    return res.json({ error: 'Supabase client is null' });
  }
  try {
    const { data, error } = await supabase
      .from('meta_config')
      .select('key, value')
      .in('key', ['SMTP_USER', 'SMTP_PASS', 'SMTP_FROM_NAME']);
    res.json({ data, error });
  } catch (err) {
    res.json({ catch_error: err.message });
  }
});

app.get('/health/smtp-send-check', async (req, res) => {
  const emailService = require('./services/emailService');
  let serviceConfig = null;
  let serviceErr = null;
  
  try {
    const data = await emailService.getSMTPConfigFromDB();
    if (data) {
      serviceConfig = {
        user: data.user,
        pass_exists: !!data.pass,
        fromName: data.fromName
      };
    } else {
      serviceConfig = 'returned null';
    }
  } catch (err) {
    serviceErr = err.message;
  }

  try {
    const result = await emailService.sendEmail({
      to: 'mansurihh@rknec.edu',
      subject: 'production test diagnostic',
      html: 'testing'
    });
    res.json({
      result,
      serviceConfig,
      serviceErr,
      supabase_in_service_is_null: !emailService.supabase
    });
  } catch (err) {
    res.json({
      send_error: err.message,
      serviceConfig,
      serviceErr,
      supabase_in_service_is_null: !emailService.supabase
    });
  }
});

// Liveness probe
app.get('/health/live', (_req, res) => {
  res.json({ status: 'live', timestamp: new Date().toISOString() });
});

// Readiness probe
app.get('/health/ready', async (_req, res) => {
  const status = bootstrapManager.getSystemStatus();
  const dbOk = status.status.database.status === 'connected';
  
  if (!dbOk) {
    logger.warn('[Health Check] Readiness probe failed: database disconnected.');
    return res.status(503).json({ status: 'unready', reason: 'database disconnected' });
  }
  
  res.json({ status: 'ready', timestamp: new Date().toISOString() });
});

app.get('/', (_req, res) => {
  res.json({
    name: 'Lead Intelligence SaaS Backend V3',
    version: '3.0.0',
    status: 'online',
    system: `/health/system`
  });
});

// Global Error Handler Middleware
app.use(errorMiddleware);

// Graceful Shutdown
const handleShutdown = async (signal) => {
  logger.info(`[Lifecycle] ${signal} received. Shutting down gracefully...`);
  try {
    workerManager.shutdown();
    await browserManager.shutdown();
  } catch (err) {
    logger.error(`[Lifecycle Error] Failed during shutdown cleanups: ${err.message}`);
  }
  process.exit(0);
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

// Start Express server immediately, THEN run bootstrap sequence.
app.listen(PORT, async () => {
  logger.info(`🌐 V3 Backend Service listening on port ${PORT}`);
  
  bootstrapManager.runBootstrap(app).catch(err => {
    logger.error(`❌ [Bootstrap] Startup sequence encountered an unhandled error: ${err.message}`);
  });
});
