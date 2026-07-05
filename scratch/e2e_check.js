/**
 * End-to-end diagnostic for the deployed agent-brain + agentic backend.
 * Domain: agentic-brain.up.railway.app
 */

const https = require('https');

// From the logs, the backend IS running — try both agent-brain routes and backend routes
const BASE_URL = 'https://agentic-brain.railway.app';

function request(method, url, body, { timeoutMs = 30000 } = {}) {
  return new Promise((resolve, reject) => {
    const parsed  = new URL(url);
    const payload = body ? JSON.stringify(body) : undefined;

    const options = {
      hostname : parsed.hostname,
      port     : 443,
      path     : parsed.pathname + parsed.search,
      method,
      headers  : {
        'Content-Type'  : 'application/json',
        'Accept'        : 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    };

    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', (c) => raw += c);
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(raw); } catch { parsed = raw; }
        resolve({ status: res.statusCode, body: parsed, raw });
      });
    });

    req.setTimeout(timeoutMs, () => req.destroy(new Error(`Timeout after ${timeoutMs}ms`)));
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function banner(n, title) { console.log('\n' + '═'.repeat(55) + `\n  CHECK ${n} — ${title}\n` + '═'.repeat(55)); }

async function main() {
  console.log('\n🚀  agent-brain E2E Diagnostic');
  console.log(`    Base URL: ${BASE_URL}\n`);

  // ── CHECK 1 — health ────────────────────────────────────
  banner(1, 'GET /health');
  try {
    const r = await request('GET', `${BASE_URL}/health`);
    console.log(`HTTP ${r.status}:`, JSON.stringify(r.body, null, 2));
    if (r.status !== 200) { console.error('❌ FAIL — non-200'); process.exit(1); }
    console.log('✅ PASS');
  } catch (e) { console.error('❌ FAIL — network:', e.message); process.exit(1); }

  // ── CHECK 2 — Supabase via /api/tasks/progress ──────────
  banner(2, 'GET /api/tasks/progress  (Supabase connectivity)');
  let notStartedBefore = 0;
  try {
    const r = await request('GET', `${BASE_URL}/api/tasks/progress`);
    console.log(`HTTP ${r.status}:`, JSON.stringify(r.body, null, 2));
    if (r.status === 200 && r.body?.counts) {
      notStartedBefore = r.body.counts.not_started || 0;
      console.log(`✅ PASS — not_started before scrape: ${notStartedBefore}`);
    } else {
      console.error('❌ FAIL — unexpected shape');
      // Try /api/leads as fallback (in case this is the main backend not agent-brain)
      console.log('\n  Trying /api/leads as fallback...');
      const r2 = await request('GET', `${BASE_URL}/api/leads`);
      console.log(`HTTP ${r2.status}:`, JSON.stringify(r2.body, null, 2));
    }
  } catch (e) { console.error('❌ FAIL — network:', e.message); }

  // ── CHECK 3 — Trigger scrape batch ──────────────────────
  banner(3, 'POST /api/jobs/start-batch  (trigger scrape)');
  let jobIds = [];
  try {
    const r = await request('POST', `${BASE_URL}/api/jobs/start-batch`, {
      keywords : ['cafe'],
      areas    : ['Orchard'],
      city     : 'Singapore',
      maxLeads : 5,
    }, { timeoutMs: 20000 });
    console.log(`HTTP ${r.status}:`, JSON.stringify(r.body, null, 2));
    if (r.status === 200) {
      jobIds = (r.body?.jobs || []).map(j => j.jobId || j.id);
      console.log(`✅ PASS — Job IDs: ${jobIds.join(', ')}`);
    } else {
      console.error('❌ FAIL');
    }
  } catch (e) { console.error('❌ FAIL — network:', e.message); }

  // ── Poll jobs until done (max 3 min) ────────────────────
  if (jobIds.length) {
    console.log('\n⏳  Polling /api/jobs until completion (max 3 min)...');
    for (let i = 0; i < 36; i++) {
      await sleep(5000);
      try {
        const r = await request('GET', `${BASE_URL}/api/jobs`);
        if (r.status !== 200) { console.log(`  Poll ${i+1}: HTTP ${r.status}`); continue; }
        const jobs = r.body?.jobs || [];
        const rel  = jobs.filter(j => jobIds.includes(j.id));
        const statuses = rel.map(j => `${j.id?.slice(0,8)}…→${j.status}`).join(', ');
        console.log(`  Poll ${i+1}: ${statuses || 'not found yet'}`);
        const pending = rel.filter(j => !['completed','failed'].includes(j.status));
        if (pending.length === 0 && rel.length > 0) { console.log('  ✅ Jobs complete'); break; }
        if (rel.length === 0 && i > 4) { console.log('  ⚠️  Not in list — assuming completed'); break; }
      } catch (e) { console.log(`  Poll ${i+1}: error — ${e.message}`); }
    }
  }

  // ── CHECK 4 — confirm not_started increased ──────────────
  banner(4, 'GET /api/tasks/progress  (confirm leads landed)');
  let notStartedAfter = 0;
  try {
    const r = await request('GET', `${BASE_URL}/api/tasks/progress`);
    console.log(`HTTP ${r.status}:`, JSON.stringify(r.body, null, 2));
    if (r.status === 200 && r.body?.counts) {
      notStartedAfter = r.body.counts.not_started || 0;
      const diff = notStartedAfter - notStartedBefore;
      console.log(`✅ PASS — before: ${notStartedBefore}, after: ${notStartedAfter}, diff: +${diff}`);
    }
  } catch (e) { console.error('❌ FAIL — network:', e.message); }

  // ── CHECK 5 — run enrichment batch ──────────────────────
  banner(5, 'POST /api/tasks/enrich  { limit: 3 }');
  try {
    const r = await request('POST', `${BASE_URL}/api/tasks/enrich`, { limit: 3 }, { timeoutMs: 120000 });
    console.log(`HTTP ${r.status}:`, JSON.stringify(r.body, null, 2));
    if (r.status === 200) console.log('✅ PASS');
    else console.error('❌ FAIL');
  } catch (e) { console.error('❌ FAIL — network/timeout:', e.message); }

  // ── CHECK 6 — inspect one processed lead ────────────────
  banner(6, 'GET /api/leads?status=enriched  (inspect one lead)');
  try {
    let r = await request('GET', `${BASE_URL}/api/leads?status=enriched&limit=1`);
    if (r.status === 200 && (!r.body?.leads || r.body.leads.length === 0)) {
      r = await request('GET', `${BASE_URL}/api/leads?status=exhausted&limit=1`);
    }
    console.log(`HTTP ${r.status}:`, JSON.stringify(r.body, null, 2));
    if (r.status === 200 && r.body?.leads?.length > 0) {
      const lead = r.body.leads[0];
      console.log('\n── Lead Detail ──');
      console.log('id               :', lead.id);
      console.log('name             :', lead.name);
      console.log('enrichment_status:', lead.enrichment_status);
      console.log('enrichment_fields:', JSON.stringify(lead.enrichment_fields, null, 2));
      console.log('tools_tried      :', JSON.stringify(lead.tools_tried));
      console.log('tools_failed     :', JSON.stringify(lead.tools_failed));
      console.log('attempts         :', lead.attempts);
      console.log('scratchpad       :', JSON.stringify(lead.enrichment_scratchpad, null, 2));
      console.log('\n✅ PASS');
    } else {
      console.log('⚠️  No enriched/exhausted leads found yet');
    }
  } catch (e) { console.error('❌ FAIL — network:', e.message); }

  console.log('\n' + '═'.repeat(55));
  console.log('  DIAGNOSTIC COMPLETE');
  console.log('═'.repeat(55) + '\n');
  process.exit(0);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
