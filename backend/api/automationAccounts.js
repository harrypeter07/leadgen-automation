// backend/api/automationAccounts.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const connectedAccountsRepository = require('../repositories/connectedAccountsRepository');
const auditLogRepository = require('../repositories/auditLogRepository');
const logger = require('../worker/logger');
const supabase = require('../database/connection');

// GET /api/automation/accounts - Fetch all connected accounts (scrub secrets)
router.get('/', async (req, res) => {
  try {
    const list = await connectedAccountsRepository.getAll();
    // Mask sensitive credential parameters before returning to client
    const safeList = list.map(acc => {
      const { credentials, ...rest } = acc;
      const scrubbedCredentials = {};
      if (credentials) {
        Object.keys(credentials).forEach(key => {
          const val = credentials[key];
          if (val && val.length > 4) {
            scrubbedCredentials[key] = `${val.slice(0, 3)}...${val.slice(-3)}`;
          } else {
            scrubbedCredentials[key] = '***';
          }
        });
      }
      return { ...rest, credentials_summary: scrubbedCredentials };
    });
    res.json({ accounts: safeList });
  } catch (err) {
    logger.error(`[Accounts API] GET failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/automation/accounts/logs - Fetch audit traces
router.get('/logs', async (req, res) => {
  try {
    const logs = await auditLogRepository.getRecent(100);
    res.json({ logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/automation/accounts - Create or update account connection settings
router.post('/', async (req, res) => {
  try {
    const { 
      id, platform, account_name, app_id, credentials, workspace_id,
      chatbot_enabled, chatbot_persona, auto_reply_rules,
      first_reply_delay, conversation_delay,
      static_reply_enabled, static_reply_override, is_active
    } = req.body;

    // For NEW accounts, all three fields are required.
    // For UPDATES (id present), we only need the id — credentials are already stored.
    if (!id && (!platform || !account_name || !credentials)) {
      return res.status(400).json({ error: 'Missing required platform, account_name, or credentials.' });
    }

    // If making this account active, deactivate other accounts on this platform
    if (is_active === true && id) {
      await supabase
        .from('connected_accounts')
        .update({ is_active: false })
        .eq('platform', platform)
        .neq('id', id);
    }

    if (id) {
      // ── UPDATE: build only the fields that changed ──────────────────────────
      const updateFields = {};
      if (platform)      updateFields.platform      = platform;
      if (account_name)  updateFields.account_name  = account_name;
      if (app_id != null) updateFields.app_id        = app_id;
      if (workspace_id)  updateFields.workspace_id   = workspace_id;

      // Only overwrite credentials if they look like real values (not masked/empty)
      const credsLookReal = credentials &&
        typeof credentials === 'object' &&
        Object.values(credentials).some(v => v && !String(v).includes('...'));
      if (credsLookReal) {
        updateFields.credentials = credentials;
      }

      // Always update chatbot fields
      if (chatbot_enabled  !== undefined) updateFields.chatbot_enabled        = chatbot_enabled;
      if (chatbot_persona  !== undefined) updateFields.chatbot_persona         = chatbot_persona;
      if (auto_reply_rules !== undefined) updateFields.auto_reply_rules        = auto_reply_rules;
      if (first_reply_delay   !== undefined) updateFields.first_reply_delay   = first_reply_delay;
      if (conversation_delay  !== undefined) updateFields.conversation_delay  = conversation_delay;
      if (static_reply_enabled  !== undefined) updateFields.static_reply_enabled  = static_reply_enabled;
      if (static_reply_override !== undefined) updateFields.static_reply_override = static_reply_override;
      if (is_active !== undefined) updateFields.is_active = is_active;

      const result = await connectedAccountsRepository.update(id, updateFields);
      await auditLogRepository.log('ACCOUNT_UPDATED', `Settings updated for account ${account_name || id} (${platform || '?'})`);
      return res.json({ success: true, account: result });
    }

    // ── CREATE: full fields required ───────────────────────────────────────────
    const accountFields = {
      platform,
      account_name,
      app_id: app_id || null,
      credentials,
      workspace_id: workspace_id || null,
      oauth_status: 'connected',
      health_status: 'healthy',
      chatbot_enabled: chatbot_enabled ?? false,
      chatbot_persona: chatbot_persona || 'You are a helpful, professional assistant.',
      auto_reply_rules: auto_reply_rules || [],
      first_reply_delay: first_reply_delay ?? 8,
      conversation_delay: conversation_delay ?? 4,
      static_reply_enabled: static_reply_enabled ?? false,
      static_reply_override: static_reply_override || '',
      is_active: is_active ?? false
    };

    const result = await connectedAccountsRepository.create(accountFields);
    await auditLogRepository.log('ACCOUNT_CONNECTED', `Connected new platform account: ${account_name} (${platform})`);
    res.json({ success: true, account: result });
  } catch (err) {
    logger.error(`[Accounts API] POST failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});


// DELETE /api/automation/accounts/:id - Disconnect/Delete account configuration
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const account = await connectedAccountsRepository.getById(id);
    if (!account) {
      return res.status(404).json({ error: 'Account connection record not found.' });
    }

    await connectedAccountsRepository.delete(id);
    await auditLogRepository.log('ACCOUNT_DISCONNECTED', `Disconnected account: ${account.account_name} (${account.platform})`);

    res.json({ success: true, message: 'Account successfully disconnected.' });
  } catch (err) {
    logger.error(`[Accounts API] DELETE failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/automation/accounts/:id/test - Perform connection verification tests
router.post('/:id/test', async (req, res) => {
  try {
    const { id } = req.params;
    const account = await connectedAccountsRepository.getById(id);
    if (!account) {
      return res.status(404).json({ error: 'Account not found.' });
    }

    const credentials = account.credentials || {};
    const token = credentials.system_token || credentials.access_token || credentials.waba_token || '';

    let isHealthy = false;
    let oauth_status = 'connected';
    let health_status = 'healthy';
    let permissions = ['pages_show_list', 'pages_read_engagement', 'pages_messaging'];
    let errorDetail = 'None';

    if (!token) {
      oauth_status = 'not_connected';
      health_status = 'down';
      errorDetail = 'Access Token or credentials not provided.';
    } else {
      // Connect check using Meta Graph API query
      try {
        const checkUrl = `https://graph.facebook.com/v19.0/me?access_token=${encodeURIComponent(token)}`;
        const checkRes = await axios.get(checkUrl, { timeout: 6000 });
        if (checkRes.data && checkRes.data.id) {
          isHealthy = true;
          // Optionally fetch granted permissions list
          try {
            const permUrl = `https://graph.facebook.com/v19.0/me/permissions?access_token=${encodeURIComponent(token)}`;
            const permRes = await axios.get(permUrl, { timeout: 4000 });
            if (permRes.data && Array.isArray(permRes.data.data)) {
              permissions = permRes.data.data.filter(p => p.status === 'granted').map(p => p.permission);
            }
          } catch (_) {
            // Keep default permissions if permissions API fails
          }
        }
      } catch (err) {
        errorDetail = err.response?.data?.error?.message || err.message;
        oauth_status = 'error';
        health_status = 'down';
      }
    }

    // Update results to database
    const updated = await connectedAccountsRepository.update(id, {
      oauth_status,
      health_status,
      permissions,
      last_tested_at: new Date().toISOString(),
      webhook_verification_status: isHealthy ? 'verified' : 'failed'
    });

    // Write log trace
    const logAction = isHealthy ? 'CONNECTION_TEST_SUCCESS' : 'CONNECTION_TEST_FAILED';
    const logDetails = isHealthy 
      ? `Tested connection to ${account.account_name} (${account.platform}) - Healthy.`
      : `Tested connection to ${account.account_name} (${account.platform}) - Failed: ${errorDetail}`;
    await auditLogRepository.log(logAction, logDetails);

    res.json({
      success: isHealthy,
      health_status,
      oauth_status,
      permissions,
      errorDetail
    });
  } catch (err) {
    logger.error(`[Accounts API] POST test failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/automation/accounts/:id/reconnect - Refresh connection token
router.post('/:id/reconnect', async (req, res) => {
  try {
    const { id } = req.params;
    const account = await connectedAccountsRepository.getById(id);
    if (!account) {
      return res.status(404).json({ error: 'Account not found.' });
    }

    // Mark as needing auth to prompt frontend input flow
    const updated = await connectedAccountsRepository.update(id, {
      oauth_status: 'needs_reauth',
      health_status: 'degraded'
    });

    await auditLogRepository.log('RECONNECT_REQUESTED', `Requested reconnection flow for ${account.account_name} (${account.platform})`);

    res.json({ success: true, account: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/automation/accounts/oauth/config - Fetch Meta App ID for OAuth setup
router.get('/oauth/config', async (req, res) => {
  try {
    const { data: configData, error: configError } = await supabase
      .from('meta_config')
      .select('key, value, encrypted');

    const configMap = {};
    if (!configError && configData) {
      const crypto = require('crypto');
      const getMetaConfigKey = () => {
        const raw = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
        return Buffer.from(raw.slice(0, 32).padEnd(32, '0'));
      };
      const decryptMetaConfigValue = (val) => {
        try {
          if (!val || !val.startsWith('enc:')) return val;
          const parts = val.split(':');
          if (parts.length < 3) return val;
          const iv = Buffer.from(parts[1], 'hex');
          const encrypted = Buffer.from(parts[2], 'hex');
          const decipher = crypto.createDecipheriv('aes-256-cbc', getMetaConfigKey(), iv);
          return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
        } catch {
          return val;
        }
      };

      configData.forEach(row => {
        configMap[row.key] = row.encrypted ? decryptMetaConfigValue(row.value) : row.value;
      });
    }

    const appId = configMap.META_APP_ID || '';
    res.json({ appId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/automation/accounts/oauth/exchange - Exchange code for Meta token and list profiles
router.post('/oauth/exchange', async (req, res) => {
  const { code, redirect_uri } = req.body;
  if (!code || !redirect_uri) {
    return res.status(400).json({ error: 'Missing code or redirect_uri parameters.' });
  }

  try {
    // 1. Get client ID and Secret from DB config
    const { data: configData, error: configError } = await supabase
      .from('meta_config')
      .select('key, value, encrypted');

    const configMap = {};
    if (!configError && configData) {
      const crypto = require('crypto');
      const getMetaConfigKey = () => {
        const raw = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
        return Buffer.from(raw.slice(0, 32).padEnd(32, '0'));
      };
      const decryptMetaConfigValue = (val) => {
        try {
          if (!val || !val.startsWith('enc:')) return val;
          const parts = val.split(':');
          if (parts.length < 3) return val;
          const iv = Buffer.from(parts[1], 'hex');
          const encrypted = Buffer.from(parts[2], 'hex');
          const decipher = crypto.createDecipheriv('aes-256-cbc', getMetaConfigKey(), iv);
          return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
        } catch {
          return val;
        }
      };

      configData.forEach(row => {
        configMap[row.key] = row.encrypted ? decryptMetaConfigValue(row.value) : row.value;
      });
    }

    const appId = configMap.META_APP_ID || '';
    const appSecret = configMap.META_APP_SECRET || '';

    if (!appId || !appSecret) {
      return res.status(500).json({ error: 'META_APP_ID or META_APP_SECRET is not configured in meta_config.' });
    }

    // 2. Exchange code for user access token
    logger.info(`[OAuth Exchange] Exchanging code for user access token...`);
    const tokenRes = await axios.get('https://graph.facebook.com/v20.0/oauth/access_token', {
      params: {
        client_id: appId,
        client_secret: appSecret,
        redirect_uri: redirect_uri,
        code: code
      }
    });

    const shortLivedToken = tokenRes.data.access_token;
    logger.info(`[OAuth Exchange] Successfully fetched short-lived user token. Exchanging for long-lived user token...`);

    // Exchange short-lived token for long-lived user token
    let userAccessToken = shortLivedToken;
    try {
      const longLivedRes = await axios.get('https://graph.facebook.com/v20.0/oauth/access_token', {
        params: {
          grant_type: 'fb_exchange_token',
          client_id: appId,
          client_secret: appSecret,
          fb_exchange_token: shortLivedToken
        }
      });
      if (longLivedRes.data && longLivedRes.data.access_token) {
        userAccessToken = longLivedRes.data.access_token;
        logger.info(`[OAuth Exchange] Successfully exchanged for long-lived user token.`);
      }
    } catch (err) {
      logger.warn(`[OAuth Exchange] Long-lived token exchange failed, falling back to short-lived: ${err.message}`);
    }

    logger.info(`[OAuth Exchange] Fetching linked pages and Instagram accounts using user token...`);

    // 3. Query pages and linked Instagram accounts
    const pagesRes = await axios.get('https://graph.facebook.com/v20.0/me/accounts', {
      params: {
        fields: 'name,access_token,id,category,instagram_business_account{id,username,name,profile_picture_url}',
        access_token: userAccessToken
      }
    });

    const pages = pagesRes.data.data || [];
    res.json({
      success: true,
      appId,
      userAccessToken,
      pages: pages.map(p => ({
        id: p.id,
        name: p.name,
        category: p.category,
        hasInstagram: !!p.instagram_business_account,
        instagram: p.instagram_business_account ? {
          id: p.instagram_business_account.id,
          username: p.instagram_business_account.username,
          name: p.instagram_business_account.name,
          profile_picture_url: p.instagram_business_account.profile_picture_url
        } : null,
        page_access_token: p.access_token
      }))
    });
  } catch (err) {
    const detail = err.response?.data?.error?.message || err.message;
    logger.error(`[OAuth Exchange] Exchange failed: ${detail}`);
    res.status(500).json({ error: detail });
  }
});

module.exports = router;
