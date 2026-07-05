// backend/worker/logger.js

const pino = require('pino');
const context = require('../modules/context');

const pinoLogger = pino({
  level: process.env.LOG_LEVEL || 'info',
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() };
    },
  },
});

const logBuffer = [];
const MAX_LOGS = 250;

function addBufferLog(level, message, meta) {
  const correlationId = context.getCorrelationId();
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    correlationId,
    meta: meta ? JSON.stringify(meta) : null
  };
  logBuffer.push(logEntry);
  if (logBuffer.length > MAX_LOGS) {
    logBuffer.shift();
  }
}

const logger = {
  info: (msg, meta) => {
    const correlationId = context.getCorrelationId();
    pinoLogger.info({ correlationId, ...(meta || {}) }, msg);
    addBufferLog('INFO', msg, meta);
  },
  warn: (msg, meta) => {
    const correlationId = context.getCorrelationId();
    pinoLogger.warn({ correlationId, ...(meta || {}) }, msg);
    addBufferLog('WARN', msg, meta);
  },
  error: (msg, meta) => {
    const correlationId = context.getCorrelationId();
    pinoLogger.error({ correlationId, ...(meta || {}) }, msg);
    addBufferLog('ERROR', msg, meta);
  },
  debug: (msg, meta) => {
    const correlationId = context.getCorrelationId();
    pinoLogger.debug({ correlationId, ...(meta || {}) }, msg);
    addBufferLog('DEBUG', msg, meta);
  },
  getLogs: () => logBuffer
};

module.exports = logger;
