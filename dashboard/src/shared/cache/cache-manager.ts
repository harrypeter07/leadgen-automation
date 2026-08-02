// dashboard/src/shared/cache/cache-manager.ts

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  scope: string;
}

export class CacheManager {
  private static store = new Map<string, CacheEntry<any>>();

  /**
   * Sets a value in cache with specified TTL and scope tag.
   */
  static set<T>(key: string, value: T, ttlMs = 30000, scope = 'global'): void {
    const expiresAt = Date.now() + ttlMs;
    this.store.set(key, { value, expiresAt, scope });
  }

  /**
   * Retrieves value from cache if present and unexpired.
   */
  static get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return entry.value as T;
  }

  /**
   * Invalidates single key.
   */
  static delete(key: string): void {
    this.store.delete(key);
  }

  /**
   * Invalidates all keys matching a scope tag (e.g. during account switching).
   */
  static invalidateScope(scopeTag: string): void {
    let cleared = 0;
    for (const [key, entry] of Array.from(this.store.entries())) {
      if (entry.scope === scopeTag || entry.scope.startsWith(scopeTag)) {
        this.store.delete(key);
        cleared++;
      }
    }
    console.log(`[CacheManager] Invalidated ${cleared} keys for scope: ${scopeTag}`);
  }

  /**
   * Clears entire cache.
   */
  static clearAll(): void {
    this.store.clear();
    console.log('[CacheManager] Entire cache cleared');
  }
}
