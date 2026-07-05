// backend/modules/response.js
const context = require('./context');

/**
 * Standard API response formatter
 */
class ResponseHelper {
  static success(res, data = null, statusCode = 200, meta = {}) {
    return res.status(statusCode).json({
      success: true,
      data,
      meta: {
        correlationId: context.getCorrelationId(),
        timestamp: new Date().toISOString(),
        ...meta
      }
    });
  }

  static created(res, data = null, meta = {}) {
    return this.success(res, data, 201, meta);
  }

  static accepted(res, data = null, meta = {}) {
    return this.success(res, data, 202, meta);
  }

  static noContent(res) {
    return res.status(204).end();
  }
}

module.exports = ResponseHelper;
