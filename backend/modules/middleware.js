// backend/modules/middleware.js
const crypto = require('crypto');
const context = require('./context');
const logger = require('../worker/logger');
const { ValidationError } = require('./errors');

/**
 * Request correlation tracing middleware using AsyncLocalStorage
 */
function traceMiddleware(req, res, next) {
  const correlationId = req.headers['x-correlation-id'] || req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('x-correlation-id', correlationId);

  context.runWithContext({ correlationId, ip: req.ip }, () => {
    logger.info(`[API Request] ${req.method} ${req.originalUrl} started`);
    
    // Log response status on finish
    res.on('finish', () => {
      logger.info(`[API Response] ${req.method} ${req.originalUrl} completed with status ${res.statusCode}`);
    });
    
    next();
  });
}

/**
 * Recursive HTML injection / script tag sanitizer
 */
function sanitize(input) {
  if (typeof input === 'string') {
    // Basic regex script / html tag stripper
    return input
      .replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, '')
      .replace(/<[^>]*>/g, '')
      .trim();
  }
  if (Array.isArray(input)) {
    return input.map(sanitize);
  }
  if (input !== null && typeof input === 'object') {
    const cleaned = {};
    for (const [key, value] of Object.entries(input)) {
      cleaned[key] = sanitize(value);
    }
    return cleaned;
  }
  return input;
}

/**
 * Input sanitization middleware
 */
function sanitizeMiddleware(req, res, next) {
  if (req.body) req.body = sanitize(req.body);
  if (req.query) req.query = sanitize(req.query);
  if (req.params) req.params = sanitize(req.params);
  next();
}

// Simple in-memory rate-limiter map
const ipRateLimit = new Map();

/**
 * IP rate limiter middleware
 * @param {Object} [options] Limiter options
 * @param {number} [options.windowMs] Duration window in ms (default 15 minutes)
 * @param {number} [options.max] Max requests per window (default 150)
 */
function rateLimit(options = {}) {
  const windowMs = options.windowMs || 15 * 60 * 1000;
  const max = options.max || 150;

  return (req, res, next) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const now = Date.now();

    let rateData = ipRateLimit.get(ip);
    if (!rateData || now > rateData.resetTime) {
      rateData = {
        count: 0,
        resetTime: now + windowMs
      };
      ipRateLimit.set(ip, rateData);
    }

    rateData.count++;

    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - rateData.count));
    res.setHeader('X-RateLimit-Reset', Math.round(rateData.resetTime / 1000));

    if (rateData.count > max) {
      logger.warn(`[Security] Rate limit exceeded for IP: ${ip}`);
      return res.status(429).json({
        success: false,
        error: {
          name: 'TooManyRequests',
          message: 'Too many requests, please try again later.'
        }
      });
    }

    next();
  };
}

module.exports = {
  traceMiddleware,
  sanitizeMiddleware,
  rateLimit,
};
