const { callGeminiWithTools } = require('./geminiClient');
const { getFunctionDeclarations, getToolByName } = require('./toolRegistry');
const { buildSystemInstruction } = require('./prompts');
const logger = require('../utils/logger');

const MAX_ATTEMPTS = Number(process.env.MAX_ATTEMPTS_PER_LEAD || 5);
const MAX_PAID_CALLS = Number(process.env.MAX_PAID_TOOL_CALLS_PER_LEAD || 2);

const TARGET_FIELDS = ['email', 'phone', 'website', 'owner_name', 'linkedin'];

/**
 * Enriches a single lead. This function is designed to NEVER throw — any
 * unexpected failure results in the lead being marked 'exhausted' with the
 * error recorded in its scratchpad, so one bad lead can't take down a batch
 * of concurrent enrichments.
 *
 * @param {object} lead - row from Supabase leads table (must include id,
 *   business_name, business_type, enrichment_fields, tools_tried,
 *   tools_failed, enrichment_scratchpad, attempts)
 * @returns {object} updated lead state, ready to persist
 */
async function enrichLead(lead) {
  let state = normalizeIncomingState(lead);
  let paidCallsUsed = 0;

  try {
    while (state.attempts < MAX_ATTEMPTS) {
      if (fieldsComplete(state.enrichment_fields)) {
        state.enrichment_status = 'enriched';
        break;
      }

      let decision;
      try {
        decision = await callGeminiWithTools({
          systemInstruction: buildSystemInstruction(),
          userContent: JSON.stringify(summarizeStateForModel(state)),
          toolDeclarations: getFunctionDeclarations(),
        });
      } catch (err) {
        // Gemini itself failed after retries — stop here, don't spin forever.
        state.enrichment_scratchpad.push(`Gemini call failed permanently: ${err.message}`);
        state.enrichment_status = 'exhausted';
        break;
      }

      state.attempts += 1;

      if (!decision.functionCalls.length) {
        // Model returned plain text — either it thinks it's done, or gave an
        // unexpected response. Either way, no tool calls means nothing left to try.
        state.enrichment_scratchpad.push(
          `Model returned no tool calls (attempt ${state.attempts}): ${(decision.text || '').slice(0, 200)}`
        );
        state.enrichment_status = fieldsComplete(state.enrichment_fields) ? 'enriched' : 'exhausted';
        break;
      }

      // Filter out calls that are invalid, already-tried-and-failed, or already
      // satisfied — this is the loop's own safety net, independent of whether
      // Gemini follows the prompt's rules correctly.
      const callsToRun = decision.functionCalls.filter((call) =>
        isCallWorthRunning(call, state, paidCallsUsed)
      );

      if (!callsToRun.length) {
        state.enrichment_scratchpad.push(
          `All proposed tool calls were redundant or over budget (attempt ${state.attempts}) — stopping.`
        );
        state.enrichment_status = fieldsComplete(state.enrichment_fields) ? 'enriched' : 'exhausted';
        break;
      }

      const results = await Promise.all(
        callsToRun.map((call) => runToolSafely(call, state, paidCallsUsed))
      );

      // Track paid-call budget based on what actually ran
      for (const call of callsToRun) {
        const tool = getToolByName(call.name);
        if (tool?.isPaid) paidCallsUsed += 1;
      }

      mergeResultsIntoState(state, callsToRun, results);
    }

    if (state.attempts >= MAX_ATTEMPTS && state.enrichment_status === 'enriching') {
      state.enrichment_scratchpad.push(`Hit MAX_ATTEMPTS (${MAX_ATTEMPTS}) without completing.`);
      state.enrichment_status = fieldsComplete(state.enrichment_fields) ? 'enriched' : 'exhausted';
    }
  } catch (err) {
    // Absolute last-resort catch — should be unreachable given the guards above,
    // but a lead-level crash must never propagate to the batch runner.
    logger.error({ leadId: lead.id, error: err.message, stack: err.stack }, 'Unhandled error enriching lead');
    state.enrichment_scratchpad.push(`Unhandled error: ${err.message}`);
    state.enrichment_status = 'exhausted';
  }

  return state;
}

function normalizeIncomingState(lead) {
  return {
    id: lead.id,
    business_name: lead.business_name || '',
    business_type: lead.business_type || '',
    country: lead.country || '',
    website: lead.website || null,
    phone: lead.phone || null,
    enrichment_fields: { ...(lead.enrichment_fields || {}) },
    tools_tried: Array.isArray(lead.tools_tried) ? [...lead.tools_tried] : [],
    tools_failed: Array.isArray(lead.tools_failed) ? [...lead.tools_failed] : [],
    enrichment_scratchpad: Array.isArray(lead.enrichment_scratchpad) ? [...lead.enrichment_scratchpad] : [],
    attempts: Number.isFinite(lead.attempts) ? lead.attempts : 0,
    enrichment_status: 'enriching',
  };
}

function summarizeStateForModel(state) {
  return {
    business_name: state.business_name,
    business_type: state.business_type,
    country: state.country,
    known_fields: {
      website: state.website,
      phone: state.phone,
      ...state.enrichment_fields,
    },
    tools_tried: state.tools_tried,
    tools_failed: state.tools_failed,
    attempts: state.attempts,
    scratchpad_tail: state.enrichment_scratchpad.slice(-5),
  };
}

function fieldsComplete(fields) {
  // "Complete" = has an email (the primary target). Adjust this if your
  // definition of a usable lead differs (e.g. phone-only leads are acceptable).
  return Boolean(fields?.email && fields?.email_verified !== false);
}

function isCallWorthRunning(call, state, paidCallsUsed) {
  const tool = getToolByName(call.name);
  if (!tool) {
    state.enrichment_scratchpad.push(`Model called unknown tool "${call.name}" — skipped.`);
    return false;
  }
  if (state.tools_failed.includes(call.name)) return false;
  if (tool.isPaid && paidCallsUsed >= MAX_PAID_CALLS) {
    state.enrichment_scratchpad.push(`Skipped paid tool "${call.name}" — budget (${MAX_PAID_CALLS}) reached.`);
    return false;
  }
  // Basic argument sanity check — required params must be present and non-empty strings
  const required = tool.parameters?.required || [];
  for (const key of required) {
    const val = call.args?.[key];
    if (typeof val !== 'string' || !val.trim()) {
      state.enrichment_scratchpad.push(`Skipped "${call.name}" — missing/invalid required arg "${key}".`);
      return false;
    }
  }
  return true;
}

async function runToolSafely(call) {
  const tool = getToolByName(call.name);
  try {
    const result = await tool.dispatch(call.args);
    return result;
  } catch (err) {
    // dispatch functions already catch internally and return {error}, but this
    // guards against any tool implementation that forgets to.
    logger.warn({ tool: call.name, error: err.message }, 'Tool dispatch threw unexpectedly');
    return { error: err.message };
  }
}

function mergeResultsIntoState(state, calls, results) {
  calls.forEach((call, i) => {
    const result = results[i] || {};
    state.tools_tried.push(call.name);

    if (result.error || result.skip) {
      state.tools_failed.push(call.name);
      state.enrichment_scratchpad.push(`${call.name} failed: ${(result.error || 'skipped').toString().slice(0, 150)}`);
      return;
    }

    // Merge any recognizable fields the tool returned. Tools are expected to
    // return a flat object with keys matching TARGET_FIELDS where applicable —
    // unknown/extra keys are ignored rather than causing an error.
    let mergedSomething = false;
    for (const field of TARGET_FIELDS) {
      if (result[field] && !state.enrichment_fields[field]) {
        state.enrichment_fields[field] = result[field];
        mergedSomething = true;
      }
    }
    if (typeof result.valid === 'boolean' && call.name === 'email_verify') {
      state.enrichment_fields.email_verified = result.valid;
      mergedSomething = true;
    }

    state.enrichment_scratchpad.push(
      mergedSomething
        ? `${call.name} succeeded, merged new field(s).`
        : `${call.name} returned no new usable data.`
    );
  });
}

module.exports = { enrichLead, fieldsComplete };
