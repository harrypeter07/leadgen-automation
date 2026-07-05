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

function formatArgs(arg1, arg2) {
  let msg = '';
  let meta = {};
  if (typeof arg1 === 'object' && arg1 !== null) {
    meta = arg1;
    msg = typeof arg2 === 'string' ? arg2 : '';
  } else {
    msg = typeof arg1 === 'string' ? arg1 : '';
    meta = (typeof arg2 === 'object' && arg2 !== null) ? arg2 : {};
  }
  return { msg, meta };
}

const logger = {
  info: (arg1, arg2) => {
    const { msg, meta } = formatArgs(arg1, arg2);
    const correlationId = context.getCorrelationId();
    pinoLogger.info({ correlationId, ...meta }, msg);
    addBufferLog('INFO', msg, meta);
  },
  warn: (arg1, arg2) => {
    const { msg, meta } = formatArgs(arg1, arg2);
    const correlationId = context.getCorrelationId();
    pinoLogger.warn({ correlationId, ...meta }, msg);
    addBufferLog('WARN', msg, meta);
  },
  error: (arg1, arg2) => {
    const { msg, meta } = formatArgs(arg1, arg2);
    const correlationId = context.getCorrelationId();
    pinoLogger.error({ correlationId, ...meta }, msg);
    addBufferLog('ERROR', msg, meta);
  },
  debug: (arg1, arg2) => {
    const { msg, meta } = formatArgs(arg1, arg2);
    const correlationId = context.getCorrelationId();
    pinoLogger.debug({ correlationId, ...meta }, msg);
    addBufferLog('DEBUG', msg, meta);
  },
  getLogs: () => logBuffer
};

module.exports = logger;
