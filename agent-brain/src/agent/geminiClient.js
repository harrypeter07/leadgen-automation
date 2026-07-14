const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('../utils/logger');
const { sleep } = require('../utils/httpClient');

const { supabase } = require('../db/queries');

const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const CALL_TIMEOUT_MS = Number(process.env.GEMINI_CALL_TIMEOUT_MS || 25000);

const MODELS_TO_TRY = [
  process.env.GEMINI_MODEL || 'gemini-2.0-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash-lite'
];

/**
 * Fetch rotated Gemini keys list from Supabase meta_config table
 */
async function getGeminiApiKeys() {
  try {
    const { data } = await supabase
      .from('meta_config')
      .select('value')
      .eq('key', 'SAVED_GEMINI_API_KEYS')
      .single();

    if (data?.value) {
      const parsed = JSON.parse(data.value);
      if (Array.isArray(parsed)) {
        const clean = parsed.filter(Boolean);
        if (clean.length > 0) return clean;
      }
    }
  } catch (err) {
    logger.warn(`Failed to load Gemini keys from DB, using fallback: ${err.message}`);
  }
  return [process.env.GEMINI_API_KEY].filter(Boolean);
}

/**
 * Calls Gemini with function-calling enabled and returns a normalized result.
 * Retries across a list of database-defined API keys AND models sequentially if it hits rate limits (429) or quota limits.
 */
async function callGeminiWithTools({ systemInstruction, userContent, toolDeclarations, retries = 2 }) {
  let lastError;

  // 1. Fetch live rotated API keys
  const keys = await getGeminiApiKeys();
  if (keys.length === 0) {
    throw new Error('No Gemini API keys are configured in settings or environment.');
  }

  // 2. Loop through each key to find one that succeeds or has quota
  for (let keyIdx = 0; keyIdx < keys.length; keyIdx++) {
    const currentKey = keys[keyIdx];
    const client = new GoogleGenerativeAI(currentKey);

    // 3. For the selected key, try each model sequentially
    for (const modelName of MODELS_TO_TRY) {
      const model = client.getGenerativeModel({
        model: modelName,
        systemInstruction,
        tools: toolDeclarations.length ? [{ functionDeclarations: toolDeclarations }] : undefined,
      });

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

          // If quota exceeded (429) or model is not supported (404)
          const isQuotaOrNotFound = 
            err.message.includes('429') || 
            err.message.includes('quota') || 
            err.message.includes('404') || 
            err.message.includes('not found') ||
            err.message.includes('unsupported') ||
            err.message.includes('Too Many Requests');

          if (isQuotaOrNotFound) {
            logger.warn({ keyIndex: keyIdx, model: modelName, error: err.message }, 'Gemini key or model hit limit/unsupported');
            
            // If we have more models for this key, try them; otherwise cascade immediately to the next API key!
            break; // Break inner loop, fallback to next modelName
          }

          if (retryable && attempt < retries) {
            const delay = 500 * 2 ** attempt + Math.random() * 300;
            logger.warn({ model: modelName, attempt, delay, error: err.message }, 'Retrying Gemini call after transient failure');
            await sleep(delay);
            continue;
          }
          break;
        }
      }
    }
  }

  // Exhausted all keys, models, and retries
  logger.error({ error: lastError?.message }, 'Gemini call failed after trying all rotated API keys and fallback models');
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
