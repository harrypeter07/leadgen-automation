const { createClient } = require('@supabase/supabase-js');
const logger = require('../utils/logger');

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  logger.error('SUPABASE_URL / SUPABASE_SERVICE_KEY not set — agent-brain cannot function without these.');
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } }
);

/**
 * Pulls leads that haven't started enrichment yet, or are mid-enrichment
 * from a previous run that got interrupted (status 'enriching' but process died).
 */
async function getPendingEnrichmentBatch(limit = 10) {
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .in('enrichment_status', ['not_started', 'enriching'])
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    logger.error({ error }, 'Failed to fetch pending enrichment batch');
    throw new Error(`Supabase query failed: ${error.message}`);
  }
  return data || [];
}

async function saveLeadState(state) {
  const { error } = await supabase
    .from('leads')
    .update({
      enrichment_fields: state.enrichment_fields,
      tools_tried: state.tools_tried,
      tools_failed: state.tools_failed,
      enrichment_scratchpad: state.enrichment_scratchpad,
      enrichment_status: state.enrichment_status,
      attempts: state.attempts,
      updated_at: new Date().toISOString(),
    })
    .eq('id', state.id);

  if (error) {
    // Don't throw here — a failed save shouldn't crash the batch. Log loudly
    // so it's visible, since a silently-lost enrichment result is worse than
    // a logged one, but the batch runner should continue with other leads.
    logger.error({ leadId: state.id, error }, 'Failed to save lead state — result may be lost');
    return false;
  }
  return true;
}

async function getLeadsByStatus(status, { limit = 50, offset = 0 } = {}) {
  const { data, error, count } = await supabase
    .from('leads')
    .select('*', { count: 'exact' })
    .eq('enrichment_status', status)
    .order('confidence_score', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw new Error(`Supabase query failed: ${error.message}`);
  return { data: data || [], count: count || 0 };
}

async function getTaskProgress() {
  const statuses = ['not_started', 'enriching', 'enriched', 'exhausted', 'qualified', 'rejected'];
  const counts = {};
  for (const status of statuses) {
    const { count, error } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('enrichment_status', status);
    counts[status] = error ? null : count;
  }
  return counts;
}

module.exports = { supabase, getPendingEnrichmentBatch, saveLeadState, getLeadsByStatus, getTaskProgress };
