const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('../utils/logger');
const { sleep } = require('../utils/httpClient');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const CALL_TIMEOUT_MS = Number(process.env.GEMINI_CALL_TIMEOUT_MS || 25000);

/**
 * Calls Gemini with function-calling enabled and returns a normalized result.
 * NEVER throws for "the model didn't call a function" or "returned odd JSON" —
 * those are expected outcomes, not exceptions. Only throws after retries are
 * exhausted on genuine API/network failure.
 *
 * Returns: {
 *   functionCalls: [{ name, args }],   // may be empty array
 *   text: string,                       // any plain text the model returned
 *   raw: <original response>,
 * }
 */
async function callGeminiWithTools({ systemInstruction, userContent, toolDeclarations, retries = 2 }) {
  const model = genAI.getGenerativeModel({
    model: MODEL_NAME,
    systemInstruction,
    tools: toolDeclarations.length ? [{ functionDeclarations: toolDeclarations }] : undefined,
  });

  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await withTimeout(
        model.generateContent(userContent),
        CALL_TIMEOUT_MS,
        'Gemini call timed out'
      );

      return normalizeGeminiResponse(result);
    } catch (err) {
      lastError = err;
      const retryable = isRetryableGeminiError(err);

      if (retryable && attempt < retries) {
        const delay = 500 * 2 ** attempt + Math.random() * 300;
        logger.warn({ attempt, delay, error: err.message }, 'Retrying Gemini call after transient failure');
        await sleep(delay);
        continue;
      }
      break;
    }
  }

  // Exhausted retries on a genuine failure — caller must handle this by
  // marking the lead as exhausted/errored for this attempt, NOT crash the batch.
  logger.error({ error: lastError?.message }, 'Gemini call failed after retries');
  throw new Error(`Gemini call failed: ${lastError?.message || 'unknown error'}`);
}

function isRetryableGeminiError(err) {
  const msg = (err?.message || '').toLowerCase();
  return (
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('429') ||
    msg.includes('rate limit') ||
    msg.includes('503') ||
    msg.includes('overloaded') ||
    msg.includes('econnreset')
  );
}

function normalizeGeminiResponse(result) {
  try {
    const response = result?.response;
    if (!response) {
      return { functionCalls: [], text: '', raw: result };
    }

    // The SDK exposes functionCalls() but it can be undefined/throw if the
    // response has no candidates (e.g. safety block) — guard defensively.
    let calls = [];
    try {
      const fc = response.functionCalls?.();
      if (Array.isArray(fc)) calls = fc;
    } catch (e) {
      logger.warn({ error: e.message }, 'functionCalls() extraction failed, treating as no calls');
    }

    let text = '';
    try {
      text = response.text?.() || '';
    } catch (e) {
      // Some responses throw on .text() if only function calls were returned — that's fine.
    }

    return {
      functionCalls: calls.map((c) => ({
        name: c?.name || 'unknown_tool',
        args: (c && typeof c.args === 'object' && c.args !== null) ? c.args : {},
      })),
      text,
      raw: result,
    };
  } catch (err) {
    logger.error({ error: err.message }, 'Failed to normalize Gemini response — returning empty result');
    return { functionCalls: [], text: '', raw: result };
  }
}

function withTimeout(promise, ms, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);
}

module.exports = { callGeminiWithTools };
