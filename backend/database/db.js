// backend/database/db.js
const { Pool } = require('pg');
const logger = require('../worker/logger');
require('dotenv').config();

const config = require('../modules/config');

const connectionString = config.databaseUrl;

if (!connectionString) {
  logger.error('[Database] Connection string is not set in environment or config fallbacks.');
}

const pool = new Pool({
  connectionString,
  max: 10,                 // standard pool size limit
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  logger.error(`[Database] Idle pool client encountered unexpected error: ${err.message}`);
});

function sanitizeParams(params) {
  if (!params || !Array.isArray(params)) return params;
  return params.map(val => {
    if (typeof val === 'string') {
      return val.replace(/\u0000/g, '');
    }
    if (typeof val === 'object' && val !== null) {
      try {
        const str = JSON.stringify(val).replace(/\u0000/g, '');
        return JSON.parse(str);
      } catch (e) {
        return val;
      }
    }
    return val;
  });
}

module.exports = {
  pool,

  /**
   * Run a query on the global connection pool with execution logging
   * @param {string} text SQL Query text
   * @param {Array} [params] Query parameters
   * @param {string} [repoName] Name of the calling repository
   * @param {string} [opName] Operation description
   * @returns {Promise<import('pg').QueryResult>}
   */
  async query(text, params = [], repoName = 'Database', opName = 'query') {
    const start = Date.now();
    const cleanParams = sanitizeParams(params);
    try {
      const res = await pool.query(text, cleanParams);
      const duration = Date.now() - start;
      logger.info({
        repository: repoName,
        operation: opName,
        executionTimeMs: duration,
        success: true
      }, `[DB Query] ${repoName}.${opName} succeeded in ${duration}ms`);
      return res;
    } catch (err) {
      const duration = Date.now() - start;
      logger.error({
        repository: repoName,
        operation: opName,
        executionTimeMs: duration,
        success: false,
        error: err.message,
        stack: err.stack
      }, `[DB Query Error] ${repoName}.${opName} failed in ${duration}ms: ${err.message}`);
      throw err;
    }
  },

  /**
   * Run a query on either a transaction client or the global connection pool with logging
   * @param {import('pg').ClientBase|null} tx Optional transaction client
   * @param {string} text SQL Query text
   * @param {Array} [params] Query parameters
   * @param {string} [repoName] Name of the calling repository
   * @param {string} [opName] Operation description
   * @returns {Promise<import('pg').QueryResult>}
   */
  async execute(tx, text, params = [], repoName = 'Database', opName = 'query') {
    if (tx) {
      const start = Date.now();
      try {
        const res = await tx.query(text, params);
        const duration = Date.now() - start;
        logger.info({
          repository: repoName,
          operation: opName,
          executionTimeMs: duration,
          success: true,
          inTransaction: true
        }, `[DB Query TX] ${repoName}.${opName} succeeded in ${duration}ms`);
        return res;
      } catch (err) {
        const duration = Date.now() - start;
        logger.error({
          repository: repoName,
          operation: opName,
          executionTimeMs: duration,
          success: false,
          inTransaction: true,
          error: err.message,
          stack: err.stack
        }, `[DB Query TX Error] ${repoName}.${opName} failed in ${duration}ms: ${err.message}`);
        throw err;
      }
    }
    return this.query(text, params, repoName, opName);
  },

  /**
   * Run a function inside a transaction block
   * @template T
   * @param {function(import('pg').ClientBase): Promise<T>} fn Async function taking client and returning result
   * @param {string} [repoName] Name of the calling repository / trace context
   * @returns {Promise<T>}
   */
  async transaction(fn, repoName = 'Database') {
    const client = await pool.connect();
    const start = Date.now();
    try {
      await client.query('BEGIN');
      logger.info({ repository: repoName, operation: 'BEGIN', success: true }, `[DB Transaction] ${repoName} started`);
      
      const result = await fn(client);
      
      await client.query('COMMIT');
      logger.info({
        repository: repoName,
        operation: 'COMMIT',
        success: true,
        durationMs: Date.now() - start
      }, `[DB Transaction] ${repoName} committed successfully`);
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      logger.error({
        repository: repoName,
        operation: 'ROLLBACK',
        success: false,
        error: err.message,
        durationMs: Date.now() - start
      }, `[DB Transaction Error] ${repoName} failed and was rolled back: ${err.message}`);
      throw err;
    } finally {
      client.release();
    }
  }
};
