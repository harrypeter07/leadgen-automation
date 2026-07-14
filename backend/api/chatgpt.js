const express = require('express');
const router = express.Router();
const supabase = require('../database/connection');
const chatgptBrowserService = require('../services/chatgptBrowserService');
const encryptionService = require('../services/encryptionService');
const logger = require('../worker/logger');

// In-memory logger store for real-time polling during long-running Playwright jobs
let activeLogs = [];
let isRunning = false;

/**
 * Safely parse a raw cookie string (semicolon-separated key=value pairs)
 * into a Playwright-compatible cookie array for a given domain.
 * Skips cookie-directive tokens (path, domain, expires, samesite, httponly, secure).
 */
function parseCookiesForPlaywright(rawCookieString, domain) {
  if (!rawCookieString || !rawCookieString.includes('=')) {
    // Treat the whole string as the value of the main session token
    return [
      {
        name: '__Secure-next-auth.session-token',
        value: rawCookieString.trim(),
        domain,
        path: '/',
        secure: true,
        httpOnly: true,
        sameSite: 'None'
      }
    ];
  }

  const SKIP_DIRECTIVES = new Set(['path', 'domain', 'expires', 'max-age', 'samesite', 'httponly', 'secure', 'priority', 'version']);
  const cookies = [];
  const parts = rawCookieString.split(';');

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue; // skip bare directives like "HttpOnly"

    const name = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();

    // Skip cookie attribute directives
    if (SKIP_DIRECTIVES.has(name.toLowerCase())) continue;
    // Skip empty names or values
    if (!name || value === undefined) continue;

    cookies.push({
      name,
      value,
      domain,
      path: '/',
      secure: true,
      httpOnly: true,
      sameSite: 'None'
    });
  }

  return cookies;
}

// GET /api/automation/chatgpt/config - Fetch ChatGPT config settings
router.get('/config', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('meta_config')
      .select('key, value')
      .in('key', [
        'CHATGPT_SESSION_TOKEN',
        'CHATGPT_TAB_MODE',
        'CHATGPT_CUSTOM_SELECTORS',
        'CHATGPT_PROXY_URL'
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
      customSelectors: config.CHATGPT_CUSTOM_SELECTORS ? JSON.parse(config.CHATGPT_CUSTOM_SELECTORS) : {},
      proxyUrl: config.CHATGPT_PROXY_URL || ''
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// POST /api/automation/chatgpt/config - Update ChatGPT settings
router.post('/config', async (req, res) => {
  const { sessionToken, tabMode, customSelectors, proxyUrl } = req.body;

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

    // Save proxy URL (plain, not encrypted — it's a server-side URL only)
    if (proxyUrl !== undefined) {
      payload.push({ key: 'CHATGPT_PROXY_URL', value: proxyUrl.trim(), encrypted: false });
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

// GET /api/automation/chatgpt/debug-screenshot - Diagnostic: take a live screenshot on the server
// Returns a PNG image showing exactly what the Railway browser sees (Cloudflare block, login page, etc.)
router.get('/debug-screenshot', async (req, res) => {
  const browserManager = require('../worker/browserManager');
  const encryptionService = require('../services/encryptionService');
  let page = null;
  let context = null;
  let contextId = null;
  try {
    // Fetch session token from DB
    const { data } = await supabase
      .from('meta_config')
      .select('key, value')
      .eq('key', 'CHATGPT_SESSION_TOKEN')
      .single();
    const sessionToken = data ? encryptionService.decrypt(data.value) : '';

    const browser = await browserManager.launch();
    const ctxRes = await browserManager.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 }
    });
    context = ctxRes.context;
    contextId = ctxRes.contextId;

    // Inject session cookie safely (handles both raw token and full cookie header strings)
    if (sessionToken) {
      const cookiesToInject = parseCookiesForPlaywright(sessionToken, '.chatgpt.com');
      for (const cookie of cookiesToInject) {
        try {
          await context.addCookies([cookie]);
        } catch (cookieErr) {
          logger.warn(`[Debug Screenshot] Skipping invalid cookie "${cookie.name}": ${cookieErr.message}`);
        }
      }
    }

    // Stealth init
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
      Object.defineProperty(navigator, 'platform', { get: () => 'Win32' });
      if (!window.chrome) window.chrome = { runtime: {} };
    });

    const pageRes = await browserManager.newPage(contextId, context);
    page = pageRes.page;

    await page.goto('https://chatgpt.com/', { waitUntil: 'load', timeout: 45000 });
    // Wait a bit for JS to settle
    await page.waitForTimeout(3000);

    const pageTitle = await page.title();
    const pageUrl = page.url();

    // Take screenshot
    const screenshotBuffer = await page.screenshot({ fullPage: false });

    // Cleanup
    await page.close();
    await context.close();

    // Return as PNG with diagnostic headers
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('X-Page-Title', encodeURIComponent(pageTitle));
    res.setHeader('X-Page-URL', encodeURIComponent(pageUrl));
    res.setHeader('X-Token-Present', sessionToken ? 'yes' : 'no');
    res.send(screenshotBuffer);
  } catch (err) {
    try { if (page) await page.close(); } catch (_) {}
    try { if (context) await context.close(); } catch (_) {}
    res.status(500).json({ error: err.message, hint: 'Check X-Page-Title / X-Page-URL headers in successful cases.' });
  }
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
