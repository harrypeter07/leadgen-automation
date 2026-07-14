const express = require('express');
const router = express.Router();
const supabase = require('../database/connection');
const chatgptBrowserService = require('../services/chatgptBrowserService');
const encryptionService = require('../services/encryptionService');
const logger = require('../worker/logger');

// In-memory logger store for real-time polling during long-running Playwright jobs
let activeLogs = [];
let isRunning = false;

// GET /api/automation/chatgpt/config - Fetch ChatGPT config settings
router.get('/config', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('meta_config')
      .select('key, value')
      .in('key', [
        'CHATGPT_SESSION_TOKEN',
        'CHATGPT_TAB_MODE',
        'CHATGPT_CUSTOM_SELECTORS'
      ]);

    if (error) throw error;

    const config = {};
    (data || []).forEach(row => {
      config[row.key] = row.value;
    });

    // Decrypt the session token
    let sessionToken = '';
    if (config.CHATGPT_SESSION_TOKEN) {
      sessionToken = encryptionService.decrypt(config.CHATGPT_SESSION_TOKEN);
    }

    res.json({
      sessionToken: sessionToken ? `${sessionToken.slice(0, 8)}...${sessionToken.slice(-8)}` : '',
      hasToken: !!sessionToken,
      tabMode: config.CHATGPT_TAB_MODE || 'reuse',
      customSelectors: config.CHATGPT_CUSTOM_SELECTORS ? JSON.parse(config.CHATGPT_CUSTOM_SELECTORS) : {}
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/automation/chatgpt/config - Update ChatGPT settings
router.post('/config', async (req, res) => {
  const { sessionToken, tabMode, customSelectors } = req.body;

  try {
    const payload = [];

    // Save session token (encrypted) if provided
    if (sessionToken && !sessionToken.includes('...')) {
      const encryptedToken = encryptionService.encrypt(sessionToken.trim());
      payload.push({ key: 'CHATGPT_SESSION_TOKEN', value: encryptedToken, encrypted: true });
    }

    if (tabMode) {
      payload.push({ key: 'CHATGPT_TAB_MODE', value: tabMode, encrypted: false });
    }

    if (customSelectors) {
      payload.push({ key: 'CHATGPT_CUSTOM_SELECTORS', value: JSON.stringify(customSelectors), encrypted: false });
    }

    if (payload.length > 0) {
      for (const row of payload) {
        const { error } = await supabase
          .from('meta_config')
          .upsert({
            key: row.key,
            value: row.value,
            encrypted: row.encrypted,
            updated_at: new Date().toISOString()
          }, { onConflict: 'key' });
        
        if (error) throw error;
      }
    }

    res.json({ success: true, message: 'ChatGPT configuration updated successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/automation/chatgpt/logs - Poll logs during generation
router.get('/logs', (req, res) => {
  res.json({ logs: activeLogs, isRunning });
});

// POST /api/automation/chatgpt/generate - Automate ChatGPT generation
router.post('/generate', async (req, res) => {
  const { prompt, imageUrls = [], tabMode: overrideTabMode } = req.body;

  if (!prompt || !prompt.trim()) {
    return res.status(400).json({ error: 'Prompt is required.' });
  }

  // Clear previous logs
  activeLogs = [];
  isRunning = true;

  const addLog = (msg) => {
    const logStr = `[${new Date().toLocaleTimeString()}] ${msg}`;
    activeLogs.push(logStr);
    logger.info(`[ChatGPT Automation] ${msg}`);
  };

  try {
    addLog('Fetching active configurations...');
    const { data, error } = await supabase
      .from('meta_config')
      .select('key, value')
      .in('key', [
        'CHATGPT_SESSION_TOKEN',
        'CHATGPT_TAB_MODE',
        'CHATGPT_CUSTOM_SELECTORS'
      ]);

    if (error) throw error;

    const config = {};
    (data || []).forEach(row => {
      config[row.key] = row.value;
    });

    const sessionToken = config.CHATGPT_SESSION_TOKEN 
      ? encryptionService.decrypt(config.CHATGPT_SESSION_TOKEN)
      : '';

    if (!sessionToken) {
      throw new Error('ChatGPT session token is not configured. Please save it in settings.');
    }

    const tabMode = overrideTabMode || config.CHATGPT_TAB_MODE || 'reuse';
    const customSelectors = config.CHATGPT_CUSTOM_SELECTORS 
      ? JSON.parse(config.CHATGPT_CUSTOM_SELECTORS)
      : {};

    addLog('Starting Playwright automation pipeline...');
    const result = await chatgptBrowserService.generate(prompt, {
      sessionToken,
      imageUrls,
      tabMode,
      customSelectors
    }, addLog);

    addLog('✓ Pipeline execution succeeded.');
    isRunning = false;

    res.json({
      success: true,
      type: result.type,
      content: result.content,
      logs: activeLogs
    });
  } catch (err) {
    addLog(`❌ Pipeline failed: ${err.message}`);
    isRunning = false;
    res.status(500).json({ error: err.message, logs: activeLogs });
  }
});

module.exports = router;
