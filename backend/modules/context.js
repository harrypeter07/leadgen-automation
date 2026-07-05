// backend/modules/context.js
const { AsyncLocalStorage } = require('async_hooks');
const crypto = require('crypto');

const contextStorage = new AsyncLocalStorage();

/**
 * Run a function within a request context
 * @param {Object} context Context data containing correlationId etc.
 * @param {Function} fn Function to execute
 */
function runWithContext(context, fn) {
  const store = new Map();
  for (const [key, value] of Object.entries(context)) {
    store.set(key, value);
  }
  if (!store.has('correlationId')) {
    store.set('correlationId', crypto.randomUUID());
  }
  return contextStorage.run(store, fn);
}

/**
 * Get context value by key
 * @param {string} key Key name
 * @returns {*} Value or undefined
 */
function getContextValue(key) {
  const store = contextStorage.getStore();
  return store ? store.get(key) : undefined;
}

/**
 * Get current correlation ID
 * @returns {string} Correlation ID
 */
function getCorrelationId() {
  return getContextValue('correlationId') || 'system';
}

module.exports = {
  runWithContext,
  getContextValue,
  getCorrelationId,
};
