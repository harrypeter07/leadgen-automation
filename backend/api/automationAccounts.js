// backend/api/automationAccounts.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const connectedAccountsRepository = require('../repositories/connectedAccountsRepository');
const auditLogRepository = require('../repositories/auditLogRepository');
const logger = require('../worker/logger');

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
    const { id, platform, account_name, app_id, credentials, workspace_id } = req.body;

    if (!platform || !account_name || !credentials) {
      return res.status(400).json({ error: 'Missing required platform, account_name, or credentials.' });
    }

    let result;
    if (id) {
      // Update account
      result = await connectedAccountsRepository.update(id, {
        platform,
        account_name,
        app_id: app_id || null,
        credentials,
        workspace_id: workspace_id || null,
        oauth_status: 'connected',
        health_status: 'healthy'
      });
      await auditLogRepository.log('ACCOUNT_UPDATED', `Settings updated for account ${account_name} (${platform})`);
    } else {
      // Create new account
      result = await connectedAccountsRepository.create({
        platform,
        account_name,
        app_id: app_id || null,
        credentials,
        workspace_id: workspace_id || null,
        oauth_status: 'connected',
        health_status: 'healthy'
      });
      await auditLogRepository.log('ACCOUNT_CONNECTED', `Connected new platform account: ${account_name} (${platform})`);
    }

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

module.exports = router;
