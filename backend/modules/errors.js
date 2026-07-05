// backend/modules/errors.js

class AppError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found', details = null) {
    super(message, 404, details);
  }
}

class ValidationError extends AppError {
  constructor(message = 'Validation failed', details = null) {
    super(message, 400, details);
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized access', details = null) {
    super(message, 401, details);
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Access forbidden', details = null) {
    super(message, 403, details);
  }
}

class ConflictError extends AppError {
  constructor(message = 'Resource conflict', details = null) {
    super(message, 409, details);
  }
}

class DatabaseError extends AppError {
  constructor(message = 'Database operation failed', details = null) {
    super(message, 500, details);
  }
}

class ExternalServiceError extends AppError {
  constructor(message = 'External service failed', details = null) {
    super(message, 502, details);
  }
}

/**
 * Express error handling middleware
 */
function errorMiddleware(err, req, res, next) {
  const logger = require('../worker/logger');
  
  const statusCode = err.statusCode || 500;
  const responsePayload = {
    success: false,
    error: {
      message: err.message || 'Internal Server Error',
      name: err.name || 'AppError',
    }
  };

  if (err.details) {
    responsePayload.error.details = err.details;
  }

  // Include stack trace only in non-production
  if (process.env.NODE_ENV !== 'production' && err.stack) {
    responsePayload.error.stack = err.stack;
  }

  logger.error(`[Express Error Handler] ${err.name || 'Error'}: ${err.message}`, {
    statusCode,
    url: req.originalUrl,
    method: req.method,
    stack: err.stack,
    details: err.details
  });

  res.status(statusCode).json(responsePayload);
}

module.exports = {
  AppError,
  NotFoundError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  DatabaseError,
  ExternalServiceError,
  errorMiddleware,
};
