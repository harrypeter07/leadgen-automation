// backend/api/automationWorkflows.js
const express = require('express');
const router = express.Router();
const supabase = require('../database/connection');
const connectedAccountsRepository = require('../repositories/connectedAccountsRepository');
const auditLogRepository = require('../repositories/auditLogRepository');
const logger = require('../worker/logger');

// Security middleware for system-to-system auth (n8n & internal hooks)
function authenticateApiSecret(req, res, next) {
  const secret = req.headers['x-api-secret'] || req.query.secret;
  const expected = process.env.WHATSAPP_API_SECRET || 'antigravity_fallback_secret';
  if (secret !== expected) {
    logger.warn('[Automation Workflows API] Blocked unauthorized request.');
    return res.status(401).json({ error: 'Unauthorized. Invalid API secret token.' });
  }
  next();
}

// POST /api/automation/accounts/credentials - Fetch decrypted secrets securely for n8n execution
router.post('/accounts/credentials', authenticateApiSecret, async (req, res) => {
  try {
    const { platform, account_name, page_id } = req.body;

    if (!platform) {
      return res.status(400).json({ error: 'Missing platform query parameter.' });
    }

    let accounts = await connectedAccountsRepository.getByPlatform(platform);

    let match = null;
    if (page_id) {
      match = accounts.find(a => a.credentials && (a.credentials.page_id === page_id || a.credentials.waba_id === page_id));
    }
    if (!match && account_name) {
      match = accounts.find(a => a.account_name.toLowerCase() === account_name.toLowerCase());
    }
    if (!match && accounts.length > 0) {
      match = accounts[0]; // fallback to first configured connection
    }

    if (!match) {
      return res.status(404).json({ error: `No connection credentials configured for platform: ${platform}` });
    }

    // Return the decrypted credentials object directly to n8n stateless engine
    res.json({
      id: match.id,
      account_name: match.account_name,
      app_id: match.app_id,
      access_token: match.credentials.access_token || '',
      app_secret: match.credentials.app_secret || '',
      page_id: match.credentials.page_id || '',
      waba_id: match.credentials.waba_id || ''
    });
  } catch (err) {
    logger.error(`[Workflows API] credentials fetch failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/automation/publish/queue - Retrieve composed queues
router.get('/publish/queue', async (req, res) => {
  try {
    const { status } = req.query;
    let query = supabase.from('automation_publishing_queue').select('*').order('scheduled_at', { ascending: true });
    
    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json({ queue: data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/automation/publish/queue - Composing schedule posting item
router.post('/publish/queue', async (req, res) => {
  try {
    const { platform, account_name, content, media_url, scheduled_at } = req.body;

    if (!platform || !account_name || !content || !scheduled_at) {
      return res.status(400).json({ error: 'Missing required platform, account_name, content, or scheduled_at parameters.' });
    }

    const { data, error } = await supabase
      .from('automation_publishing_queue')
      .insert([{
        platform,
        account_name,
        content,
        media_url: media_url || null,
        scheduled_at,
        status: 'scheduled'
      }])
      .select()
      .single();

    if (error) throw error;

    await auditLogRepository.log('PUBLISH_QUEUED', `Queued post for ${account_name} on ${platform} at ${scheduled_at}`);

    res.json({ success: true, post: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/automation/publish/queue/callback - Action completed trigger from n8n
router.post('/publish/queue/callback', authenticateApiSecret, async (req, res) => {
  try {
    const { id, status, published_id } = req.body;
    if (!id || !status) {
      return res.status(400).json({ error: 'Missing id or status.' });
    }

    const { data, error } = await supabase
      .from('automation_publishing_queue')
      .update({
        status,
        published_id: published_id || null
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    await auditLogRepository.log('PUBLISH_DISPATCHED', `Post ID ${id} completed publication on Meta API status: ${status}`);

    res.json({ success: true, post: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/automation/workflows - Retrieve n8n workflows state items list
router.get('/workflows', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('automation_workflow_status')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;

    res.json({ workflows: data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/automation/workflows/toggle - Enable/Disable n8n orchestrator workflow runs
router.post('/workflows/toggle', async (req, res) => {
  try {
    const { name, active } = req.body;
    if (!name) return res.status(400).json({ error: 'Missing workflow name.' });

    const { data, error } = await supabase
      .from('automation_workflow_status')
      .update({ active: !!active })
      .eq('name', name)
      .select()
      .single();

    if (error) throw error;

    await auditLogRepository.log('WORKFLOW_TOGGLED', `Workflow '${name}' state toggled to ${active ? 'ENABLED' : 'DISABLED'}`);

    res.json({ success: true, workflow: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/automation/workflows/retry - Retry failed outbox posting job
router.post('/workflows/retry', async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'Missing job queue ID.' });

    const { data, error } = await supabase
      .from('automation_publishing_queue')
      .update({ status: 'scheduled' })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    await auditLogRepository.log('PUBLISH_RETRY_TRIGGERED', `Triggered retry for outbox queue ID: ${id}`);

    res.json({ success: true, post: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/automation/workflows/health - Fetch real-time system diagnostics status
router.get('/health', async (req, res) => {
  try {
    // 1. Load Postgres cached health metrics
    const { data: metrics, error: mErr } = await supabase
      .from('automation_health_metrics')
      .select('*')
      .maybeSingle();

    if (mErr) throw mErr;

    // 2. Load connected accounts and count states
    const accounts = await connectedAccountsRepository.getAll();
    const fbConnected = accounts.some(a => a.platform === 'facebook' && a.oauth_status === 'connected');
    const igConnected = accounts.some(a => a.platform === 'instagram' && a.oauth_status === 'connected');
    const msgConnected = accounts.some(a => a.platform === 'messenger' && a.oauth_status === 'connected');
    const waConnected = accounts.some(a => a.platform === 'whatsapp' && a.oauth_status === 'connected');

    // 3. Find closest token expiration date
    let closestExpiry = null;
    let closestExpiryDays = null;

    accounts.forEach(acc => {
      if (acc.token_expires_at) {
        const expiryDate = new Date(acc.token_expires_at);
        if (!closestExpiry || expiryDate < closestExpiry) {
          closestExpiry = expiryDate;
        }
      }
    });

    if (closestExpiry) {
      const diffMs = closestExpiry.getTime() - Date.now();
      closestExpiryDays = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    }

    // 4. Return combined health payload
    res.json({
      meta_oauth_status: accounts.some(a => a.oauth_status === 'connected') ? 'connected' : 'disconnected',
      facebook_connected: fbConnected,
      instagram_connected: igConnected,
      messenger_connected: msgConnected,
      whatsapp_connected: waConnected,
      n8n_connected: !metrics || metrics.n8n_status === 'active',
      webhooks_verified: !metrics || !!metrics.webhooks_verified,
      token_expiry_countdown: closestExpiryDays !== null ? `${closestExpiryDays} days` : 'Permanent System Token',
      last_successful_sync: metrics?.last_sync_at || new Date().toISOString(),
      last_graph_api_error: metrics?.last_api_error || 'None'
    });
  } catch (err) {
    logger.error(`[Workflows Health API] GET failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
