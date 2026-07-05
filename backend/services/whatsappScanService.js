// backend/services/whatsappScanService.js
//
// Background service that scans leads one-by-one to check WhatsApp registration.
// Uses the Baileys WhatsApp microservice (already authenticated by the user's QR scan).
// Runs fully in-process on the V3 backend — survives dashboard tab closes.

const supabase = require('../database/connection');
const logger = require('../worker/logger');

const WHATSAPP_SERVICE_URL = () => (process.env.WHATSAPP_SERVICE_URL || '').replace(/\/$/, '');
const WHATSAPP_API_SECRET = () => process.env.WHATSAPP_API_SECRET || '';

// ─────────────────────────────────────────────────────────────────────────────
// Scan state (singleton — one scan at a time per backend process)
// ─────────────────────────────────────────────────────────────────────────────
const scanState = {
  running: false,
  aborted: false,
  startedAt: null,
  total: 0,
  checked: 0,
  waCount: 0,
  noWaCount: 0,
  errCount: 0,
  currentName: null,
  currentPhone: null,
  intervalMs: 5000,   // safe delay between checks (ms)
  logs: [],           // last 50 log entries
  filter: {},         // filter applied when scan was started
};

function addLog(msg) {
  const entry = `[${new Date().toISOString()}] ${msg}`;
  logger.info(`[WAScan] ${msg}`);
  scanState.logs.push(entry);
  if (scanState.logs.length > 50) scanState.logs.shift();
}

// ─────────────────────────────────────────────────────────────────────────────
// Core scan loop
// ─────────────────────────────────────────────────────────────────────────────
async function runScan(filter = {}) {
  if (scanState.running) {
    logger.warn('[WAScan] Scan already running — ignoring duplicate start.');
    return;
  }

  // Reset state
  Object.assign(scanState, {
    running: true,
    aborted: false,
    startedAt: new Date().toISOString(),
    total: 0,
    checked: 0,
    waCount: 0,
    noWaCount: 0,
    errCount: 0,
    currentName: null,
    currentPhone: null,
    logs: [],
    filter,
  });

  addLog('WhatsApp scan started.');

  try {
    // 1. Fetch unchecked leads (no [WhatsApp: Yes] or [WhatsApp: No] tag in notes)
    let query = supabase
      .from('leads')
      .select('id, name, phone, notes')
      .not('phone', 'is', null)
      .neq('phone', '');

    if (filter.job_id)  query = query.eq('job_id', filter.job_id);
    if (filter.city)    query = query.ilike('city', `%${filter.city}%`);

    const { data: allLeads, error: fetchErr } = await query;

    if (fetchErr) throw new Error(`DB fetch failed: ${fetchErr.message}`);

    // Only keep leads that haven't been tagged yet
    const unchecked = (allLeads || []).filter(
      l => !l.notes?.includes('[WhatsApp: Yes]') && !l.notes?.includes('[WhatsApp: No]')
    );

    scanState.total = unchecked.length;
    addLog(`Found ${unchecked.length} unchecked leads to scan.`);

    if (unchecked.length === 0) {
      addLog('Nothing to scan — all leads already identified.');
      scanState.running = false;
      return;
    }

    // 2. Iterate one-by-one with safe interval
    for (const lead of unchecked) {
      if (scanState.aborted) {
        addLog('Scan aborted by user.');
        break;
      }

      scanState.currentName  = lead.name;
      scanState.currentPhone = lead.phone;

      try {
        const cleanedPhone = String(lead.phone).replace(/\D/g, '');
        const res = await fetch(`${WHATSAPP_SERVICE_URL()}/on-whatsapp`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-secret': WHATSAPP_API_SECRET(),
          },
          body: JSON.stringify({ phone: cleanedPhone }),
          signal: AbortSignal.timeout(10000),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          if (res.status === 503) {
            addLog('WhatsApp service not connected. Connect and scan QR first. Aborting scan.');
            scanState.errCount++;
            break;
          }
          if (res.status === 404) {
            addLog(`[ERROR] HTTP 404 from WhatsApp Service. The service is likely running an outdated codebase version. Please go to your Railway Dashboard and manually trigger a redeploy of the 'whatsapp-service' container.`);
            scanState.errCount++;
            scanState.checked++;
            await sleep(scanState.intervalMs);
            continue;
          }
          addLog(`${lead.name}: HTTP ${res.status} — ${body.error || 'unknown error'}. Skipping.`);
          scanState.errCount++;
          scanState.checked++;
          await sleep(scanState.intervalMs);
          continue;
        }

        const data = await res.json();
        const isWA = !!data.exists;

        const tag = isWA ? '[WhatsApp: Yes]' : '[WhatsApp: No]';
        const existing = (lead.notes || '').trim();
        const newNotes = existing ? `${tag}\n${existing}` : tag;

        // Save to database
        const { error: updateErr } = await supabase
          .from('leads')
          .update({ notes: newNotes })
          .eq('id', lead.id);

        if (updateErr) {
          addLog(`${lead.name}: DB update failed — ${updateErr.message}`);
          scanState.errCount++;
        } else {
          addLog(`${lead.name} (${lead.phone}): ${isWA ? '✅ WhatsApp' : '❌ Not WA'}`);
          if (isWA) scanState.waCount++; else scanState.noWaCount++;
        }
      } catch (err) {
        let msg = err.name === 'TimeoutError' ? 'Request timed out' : err.message;
        if (msg.includes('fetch failed')) {
          msg = `[ERROR] Connection failed. Please check that your WHATSAPP_SERVICE_URL (${WHATSAPP_SERVICE_URL()}) environment variable is correct and the service is online.`;
        }
        addLog(`${lead.name}: ${msg}. Skipping.`);
        scanState.errCount++;
      }

      scanState.checked++;

      // Safe interval between checks (skip wait on last item or if aborted)
      if (!scanState.aborted && scanState.checked < scanState.total) {
        await sleep(scanState.intervalMs);
      }
    }

    addLog(`Scan complete. ✅ WA: ${scanState.waCount} | ❌ No-WA: ${scanState.noWaCount} | ⚠️ Errors: ${scanState.errCount}`);
  } catch (err) {
    addLog(`Fatal scan error: ${err.message}`);
    logger.error(`[WAScan] Fatal error: ${err.message}`);
  } finally {
    scanState.running = false;
    scanState.currentName  = null;
    scanState.currentPhone = null;
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────
module.exports = {
  /**
   * Start scan in background. Returns immediately.
   * @param {object} filter  Optional { job_id, city }
   * @param {number} intervalMs  Delay between checks in ms (default 5000)
   */
  startScan(filter = {}, intervalMs = 5000) {
    if (scanState.running) return { alreadyRunning: true };
    scanState.intervalMs = Math.max(2000, parseInt(intervalMs) || 5000);
    // Fire and forget — runs in background
    runScan(filter).catch(err => logger.error(`[WAScan] Unhandled: ${err.message}`));
    return { started: true };
  },

  /** Signals the running scan to stop after the current lead. */
  stopScan() {
    if (!scanState.running) return { wasRunning: false };
    scanState.aborted = true;
    return { stopped: true };
  },

  /** Returns current scan state snapshot for polling. */
  getStatus() {
    return {
      running: scanState.running,
      aborted: scanState.aborted,
      startedAt: scanState.startedAt,
      total: scanState.total,
      checked: scanState.checked,
      waCount: scanState.waCount,
      noWaCount: scanState.noWaCount,
      errCount: scanState.errCount,
      currentName: scanState.currentName,
      currentPhone: scanState.currentPhone,
      intervalMs: scanState.intervalMs,
      filter: scanState.filter,
      logs: [...scanState.logs].reverse(), // newest first
    };
  },
};
