require('dotenv').config();
const express = require('express');
const logger = require('./utils/logger');
const tasksRouter = require('./routes/tasks');

const REQUIRED_ENV = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'GEMINI_API_KEY', 'AGENTIC_BACKEND_URL'];
const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missing.length) {
  logger.error({ missing }, 'Missing required environment variables — refusing to start');
  process.exit(1);
}

const app = express();
app.use(express.json({ limit: '2mb' }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.use('/api', tasksRouter);

// Catch-all for unmatched routes
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Last-resort error handler — if anything throws outside a route's own
// try/catch, this prevents Express from hanging the request or crashing.
app.use((err, req, res, next) => {
  logger.error({ error: err.message, stack: err.stack }, 'Unhandled error reached top-level handler');
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 8080;
const server = app.listen(PORT, () => {
  logger.info({ port: PORT }, 'agent-brain listening');
});

// Prevent the whole process from dying on an unhandled promise rejection —
// log it loudly instead, since a single stray rejection (e.g. from a
// fire-and-forget call somewhere) shouldn't take down the entire service.
process.on('unhandledRejection', (reason) => {
  logger.error({ reason: reason?.message || reason }, 'Unhandled promise rejection');
});

process.on('uncaughtException', (err) => {
  logger.error({ error: err.message, stack: err.stack }, 'Uncaught exception');
  // Uncaught exceptions leave the process in an unknown state — exit and let
  // Railway restart it, rather than limping along.
  process.exit(1);
});

function shutdown(signal) {
  logger.info({ signal }, 'Shutting down gracefully');
  server.close(() => process.exit(0));
  // Force-exit if graceful close hangs
  setTimeout(() => process.exit(1), 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
