// lib/meta/retry-handler.ts
export interface RetryOptions { maxRetries?: number; baseDelayMs?: number; maxDelayMs?: number; retryOn?: (statusCode: number, error?: string) => boolean }
const DEFAULT_RETRY_ON = (statusCode: number): boolean => statusCode === 429 || statusCode >= 500 || statusCode === 0
export async function withRetry<T>(fn: (attempt: number) => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const maxRetries = options.maxRetries ?? 3
  const baseDelay = options.baseDelayMs ?? 500
  const maxDelay = options.maxDelayMs ?? 8000
  const shouldRetry = options.retryOn ?? DEFAULT_RETRY_ON
  let lastError: Error | null = null
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try { return await fn(attempt) } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err))
      if (attempt >= maxRetries) break
      const statusCode = (err as Record<string, number>)?.statusCode ?? 0
      if (!shouldRetry(statusCode, lastError.message)) break
      const delay = Math.min(baseDelay * Math.pow(2, attempt) + Math.random() * 100, maxDelay)
      await new Promise(r => setTimeout(r, delay))
    }
  }
  throw lastError ?? new Error('Max retries exceeded')
}
export async function withMetaRetry<T>(fn: () => Promise<{ success: boolean; statusCode: number; data?: T; error?: unknown }>, maxRetries = 2): Promise<{ success: boolean; statusCode: number; data?: T; error?: unknown; retryCount: number }> {
  let retryCount = 0
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const result = await fn()
    if (result.success || result.statusCode === 400 || result.statusCode === 401 || result.statusCode === 403) return { ...result, retryCount }
    if (attempt < maxRetries) { retryCount++; const delay = result.statusCode === 429 ? 5000 : 1000 * (attempt + 1); await new Promise(r => setTimeout(r, delay)) }
  }
  return { ...await fn(), retryCount }
}
