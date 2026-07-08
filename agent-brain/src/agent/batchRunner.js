const { enrichLead } = require('./loop');
const { getPendingEnrichmentBatch, saveLeadState } = require('../db/queries');
const logger = require('../utils/logger');

const MAX_CONCURRENT = Number(process.env.MAX_CONCURRENT_LEADS || 8);

/**
 * Runs enrichment across a batch of leads with bounded concurrency.
 * Deliberately hand-rolled instead of using the `p-limit` package — recent
 * p-limit versions are ESM-only, which breaks a plain CommonJS `require()`
 * codebase like this one. This is ~15 lines and has zero dependency-version risk.
 */
async function runWithConcurrencyLimit(items, limit, worker) {
  const results = [];
  let index = 0;

  async function runNext() {
    while (index < items.length) {
      const current = index++;
      try {
        results[current] = await worker(items[current]);
      } catch (err) {
        // worker (enrichLead) is designed to never throw, but guard anyway —
        // one item's crash must not stop the rest of the batch.
        logger.error({ error: err.message }, 'Unexpected throw from worker — continuing batch');
        results[current] = { error: err.message };
      }
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => runNext());
  await Promise.all(workers);
  return results;
}

async function enrichBatch(limit = 20) {
  let leads;
  try {
    leads = await getPendingEnrichmentBatch(limit);
  } catch (err) {
    logger.error({ error: err.message }, 'Could not fetch pending batch — aborting this run');
    return { processed: 0, error: err.message };
  }

  if (!leads.length) {
    return { processed: 0, message: 'No pending leads to enrich' };
  }

  logger.info({ count: leads.length }, 'Starting enrichment batch');

  const finalStates = await runWithConcurrencyLimit(leads, MAX_CONCURRENT, async (lead) => {
    const state = await enrichLead(lead);
    const saved = await saveLeadState(state);
    return { leadId: state.id, status: state.enrichment_status, saved };
  });

  const summary = {
    processed: finalStates.length,
    enriched: finalStates.filter((s) => s.status === 'enriched').length,
    exhausted: finalStates.filter((s) => s.status === 'exhausted').length,
    saveFailures: finalStates.filter((s) => s.saved === false).length,
  };

  logger.info(summary, 'Enrichment batch complete');
  return summary;
}

module.exports = { enrichBatch, runWithConcurrencyLimit };
