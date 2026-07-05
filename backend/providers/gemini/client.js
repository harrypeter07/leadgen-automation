// backend/providers/gemini/client.js
const axios = require('axios');
const crypto = require('crypto');
const logger = require('../../worker/logger');
const metrics = require('../../worker/metrics');
const cache = require('../../modules/cache');

// Cost parameters for gemini-2.5-flash (in USD per 1M tokens)
const COST_PER_1M_INPUT_TOKENS = 0.075;
const COST_PER_1M_OUTPUT_TOKENS = 0.30;

class GeminiClient {
  constructor() {
    this.modelName = 'gemini-2.5-flash';
  }

  /**
   * Approximate token count from characters (average ~4 chars per token in English)
   * @param {string} text Text to evaluate
   * @returns {number} Estimated token count
   */
  estimateTokens(text) {
    if (!text) return 0;
    return Math.round(text.length / 4);
  }

  /**
   * Calculate cost of API call based on token counts
   * @param {number} inputTokens Input token count
   * @param {number} outputTokens Output token count
   * @returns {number} Estimated cost in USD
   */
  calculateCost(inputTokens, outputTokens) {
    const inputCost = (inputTokens / 1_000_000) * COST_PER_1M_INPUT_TOKENS;
    const outputCost = (outputTokens / 1_000_000) * COST_PER_1M_OUTPUT_TOKENS;
    return inputCost + outputCost;
  }

  /**
   * Call the Gemini REST API with the provided prompt
   * @param {string} prompt Prompt content
   * @param {boolean} [jsonMode=false] Expect JSON format output
   * @param {Object} [options] Call options
   * @param {number} [options.timeout=10000] Timeout in milliseconds
   * @param {number} [options.retries=3] Retries limit
   * @returns {Promise<string>} Model response text
   */
  async generateContent(prompt, jsonMode = false, options = {}) {
    const apiKey = (process.env.GEMINI_API_KEY || '').trim();
    if (!apiKey) {
      logger.warn('[Gemini Client] GEMINI_API_KEY is not set. Falling back to mock responses.');
      return jsonMode ? '{"status": "mock", "message": "API key not configured"}' : 'Mock response from Gemini provider client.';
    }

    // 1. Check in-memory cache
    const cacheKey = crypto.createHash('sha256').update(`${prompt}_json=${jsonMode}`).digest('hex');
    const cachedResponse = cache.get(cacheKey);
    if (cachedResponse) {
      logger.info({ cacheHit: true }, '[Gemini Client] Cache hit for prompt.');
      return cachedResponse;
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:generateContent?key=${apiKey}`;
    const requestBody = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {}
    };

    if (jsonMode) {
      requestBody.generationConfig.responseMimeType = 'application/json';
    }

    const timeout = options.timeout || 10000;
    const retries = options.retries !== undefined ? options.retries : 3;
    const startTime = Date.now();

    // 2. Call with retry logic and timeout
    try {
      const responseText = await this._callWithRetryAndTimeout(async () => {
        const response = await axios.post(endpoint, requestBody, {
          headers: { 'Content-Type': 'application/json' },
          timeout: timeout
        });

        const candidate = response.data?.candidates?.[0];
        const textResult = candidate?.content?.parts?.[0]?.text;

        if (!textResult) {
          throw new Error('Invalid or empty content structure returned from Gemini API.');
        }

        return textResult.trim();
      }, retries);

      const duration = Date.now() - startTime;
      const inputTokens = this.estimateTokens(prompt);
      const outputTokens = this.estimateTokens(responseText);
      const cost = this.calculateCost(inputTokens, outputTokens);

      // Record metric if tracker supports it
      if (metrics.recordAICall) {
        metrics.recordAICall(this.modelName, duration, inputTokens, outputTokens, cost);
      } else {
        // Fallback execution logging in metrics
        if (!metrics.aiCost) metrics.aiCost = 0;
        metrics.aiCost += cost;
      }

      logger.info({
        model: this.modelName,
        latencyMs: duration,
        inputTokens,
        outputTokens,
        estimatedCostUsd: cost,
        cacheHit: false
      }, `[Gemini Client] API call succeeded in ${duration}ms (Cost: $${cost.toFixed(6)})`);

      // Store in cache
      cache.set(cacheKey, responseText);

      return responseText;
    } catch (err) {
      const duration = Date.now() - startTime;
      logger.error({
        model: this.modelName,
        latencyMs: duration,
        error: err.message,
        stack: err.stack
      }, `[Gemini Client Error] API call failed after ${duration}ms: ${err.message}`);
      throw err;
    }
  }

  /**
   * Run helper with exponential backoff retries + random jitter
   */
  async _callWithRetryAndTimeout(fn, retries, delay = 1000) {
    for (let i = 0; i < retries; i++) {
      try {
        return await fn();
      } catch (err) {
        if (i === retries - 1) throw err;
        
        // Add random jitter between 0 and 500ms
        const jitter = Math.floor(Math.random() * 500);
        const sleepTime = (delay * Math.pow(2, i)) + jitter;

        logger.warn({
          attempt: i + 1,
          maxRetries: retries,
          sleepMs: sleepTime,
          error: err.message
        }, '[Gemini Client] Temporary request failure. Retrying with jittered backoff...');
        await new Promise(resolve => setTimeout(resolve, sleepTime));
      }
    }
  }
}

module.exports = new GeminiClient();
