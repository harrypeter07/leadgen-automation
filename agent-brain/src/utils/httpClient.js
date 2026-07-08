const logger = require('./logger');

/**
 * Fetch with timeout + retry with exponential backoff.
 * Retries on: network errors, 429 (rate limit), 5xx.
 * Does NOT retry on other 4xx — those are almost always a bad request that
 * won't succeed on retry, and retrying them just burns time/budget.
 */
async function fetchWithRetry(url, options = {}, config = {}) {
  const {
    timeoutMs = 20000,
    retries = 2,
    baseDelayMs = 500,
  } = config;

  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);

      if (response.status === 429 || response.status >= 500) {
        lastError = new Error(`HTTP ${response.status} from ${url}`);
        if (attempt < retries) {
          const delay = baseDelayMs * 2 ** attempt + Math.random() * 200;
          logger.warn({ url, status: response.status, attempt, delay }, 'Retryable HTTP error, backing off');
          await sleep(delay);
          continue;
        }
        throw lastError;
      }

      // Non-retryable 4xx — surface immediately with whatever body we can read
      if (!response.ok) {
        let bodyText = '';
        try { bodyText = await response.text(); } catch { /* ignore */ }
        throw new Error(`HTTP ${response.status} from ${url}: ${bodyText.slice(0, 300)}`);
      }

      return response;
    } catch (err) {
      clearTimeout(timeoutId);
      lastError = err;

      const isAbort = err.name === 'AbortError';
      const isNetworkError = err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || err.cause;

      if ((isAbort || isNetworkError) && attempt < retries) {
        const delay = baseDelayMs * 2 ** attempt + Math.random() * 200;
        logger.warn({ url, attempt, delay, reason: isAbort ? 'timeout' : 'network' }, 'Retrying after failure');
        await sleep(delay);
        continue;
      }
      throw lastError;
    }
  }

  throw lastError;
}

/** Safely parse JSON, never throws — returns { ok, data, error } */
async function safeJson(response) {
  try {
    const data = await response.json();
    return { ok: true, data, error: null };
  } catch (err) {
    return { ok: false, data: null, error: `Failed to parse JSON response: ${err.message}` };
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { fetchWithRetry, safeJson, sleep };
