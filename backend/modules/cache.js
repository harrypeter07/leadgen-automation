// backend/modules/cache.js

class CacheManager {
  constructor(defaultTtlSeconds = 300, maxSize = 1000) {
    this.defaultTtl = defaultTtlSeconds * 1000;
    this.maxSize = maxSize;
    this.cache = new Map();
  }

  /**
   * Set key-value pair in cache
   * @param {string} key Cache key
   * @param {*} value Value to cache
   * @param {number} [ttlSeconds] Override TTL in seconds
   */
  set(key, value, ttlSeconds) {
    // Evict oldest if max size reached
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    const ttl = ttlSeconds !== undefined ? ttlSeconds * 1000 : this.defaultTtl;
    const expiresAt = Date.now() + ttl;

    this.cache.set(key, { value, expiresAt });
  }

  /**
   * Get value by key from cache
   * @param {string} key Cache key
   * @returns {*} Cached value or null
   */
  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  /**
   * Delete key from cache
   * @param {string} key Cache key
   */
  delete(key) {
    this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Check if cache entry exists
   * @param {string} key Cache key
   * @returns {boolean} True if active
   */
  has(key) {
    return this.get(key) !== null;
  }
}

module.exports = new CacheManager();
