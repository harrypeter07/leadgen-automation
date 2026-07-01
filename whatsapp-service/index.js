require('dotenv').config();

const fs = require('fs');
const path = require('path');
const express = require('express');
const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');
const { execSync } = require('child_process');

const QR_FILE = path.join(__dirname, 'qr.txt');

let isReady = false;
let isStable = false;
let sendInProgress = false;

const MAX_LOGS = 200;
const eventLog = [];
let qrGeneratedAt = null;
let sessionAuthenticatedAt = null;
let lastDisconnectReason = null;
const serviceStartedAt = new Date().toISOString();

function addLog(level, message) {
  eventLog.push({ timestamp: new Date().toISOString(), level, message });
  if (eventLog.length > MAX_LOGS) eventLog.shift();
}

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: '/app/.wwebjs_auth' }),
  puppeteer: {
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/root/.nix-profile/bin/chromium',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  },
});

client.on('qr', (qr) => {
  qrGeneratedAt = new Date().toISOString();
  addLog('info', 'QR code generated, saved to qr.txt');
  qrcode.generate(qr, { small: true });
  fs.writeFileSync(QR_FILE, qr, 'utf8');
  console.log('📱 QR code saved to qr.txt — scan with WhatsApp');
});

client.on('loading_screen', (percent, message) => {
  if (isReady) {
    isStable = false;
    addLog('warn', `Page reloading after ready (${percent}%) — sends paused`);
  }
  addLog('info', `Loading WhatsApp: ${percent}% - ${message}`);
  console.log(`⏳ Loading WhatsApp: ${percent}% - ${message}`);
});

client.on('authenticated', () => {
  sessionAuthenticatedAt = new Date().toISOString();
  addLog('success', 'Authenticated — session saved');
  console.log('🔐 Authenticated — session saved');
});

client.on('ready', () => {
  addLog('success', 'WhatsApp client ready');
  isReady = true;
  isStable = false;
  console.log('✅ WhatsApp client ready');
  if (fs.existsSync(QR_FILE)) {
    fs.unlinkSync(QR_FILE);
  }
  setTimeout(() => {
    isStable = true;
    addLog('info', 'Client stabilized, ready for sends');
  }, 8000);
});

client.on('auth_failure', (msg) => {
  addLog('error', `Auth failure: ${msg}`);
  console.error('❌ Auth failure:', msg);
  isReady = false;
});

client.on('disconnected', (reason) => {
  lastDisconnectReason = reason;
  addLog('warn', `Disconnected: ${reason}`);
  isReady = false;
  console.log('⚠️ WhatsApp disconnected:', reason);
});

const QRCode = require('qrcode');

// Synchronously delete all Chromium lock files before init
try {
  execSync('find /app/.wwebjs_auth -name "Singleton*" -delete 2>/dev/null || true');
  execSync('find /app/.wwebjs_auth -name "*.lock" -delete 2>/dev/null || true');
  execSync('find /app/.wwebjs_auth -name "lockfile" -delete 2>/dev/null || true');
  console.log('🧹 Cleared stale Chromium lock files');
} catch(e) {
  console.log('🧹 Lock cleanup skipped:', e.message);
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', whatsapp_ready: isReady });
});

app.get('/diagnostics', async (_req, res) => {
  try {
    const state = await client.getState().catch(e => `error: ${e.message}`);
    const pageMetrics = client.pupPage ? await client.pupPage.metrics().catch(e => `error: ${e.message}`) : 'no page';
    res.json({
      isReady,
      isStable,
      client_state: state,
      page_exists: !!client.pupPage,
      page_metrics: pageMetrics,
      wid: client.info?.wid?.user || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/store-check', async (_req, res) => {
  try {
    if (!client.pupPage) return res.json({ store_ready: false, reason: 'no page' });
    const result = await Promise.race([
      client.pupPage.evaluate(() => {
        return typeof window.Store !== 'undefined' && typeof window.Store.Chat !== 'undefined';
      }),
      new Promise((resolve) => setTimeout(() => resolve('timeout'), 10000))
    ]);
    res.json({ store_ready: result === true, raw_result: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/status', (_req, res) => {
  res.json({
    whatsapp_ready: isReady,
    service_started_at: serviceStartedAt,
    qr_generated_at: qrGeneratedAt,
    qr_file_exists: fs.existsSync(QR_FILE),
    session_authenticated_at: sessionAuthenticatedAt,
    last_disconnect_reason: lastDisconnectReason,
  });
});

app.get('/logs', (_req, res) => {
  res.json({ logs: eventLog.slice().reverse() });
});

app.post('/reconnect', (req, res) => {
  const apiSecret = (req.headers['x-api-secret'] || '').trim();
  const expectedSecret = (process.env.API_SECRET || '').trim();
  if (apiSecret !== expectedSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  addLog('warn', 'Manual reconnect triggered from dashboard');
  try {
    client.logout().catch(() => {}).finally(() => {
      isReady = false;
      sessionAuthenticatedAt = null;
      setTimeout(() => client.initialize(), 1000);
    });
    res.json({ success: true, message: 'Reconnect initiated' });
  } catch (err) {
    addLog('error', `Reconnect failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

app.post('/disconnect', async (req, res) => {
  const apiSecret = (req.headers['x-api-secret'] || '').trim();
  const expectedSecret = (process.env.API_SECRET || '').trim();
  if (apiSecret !== expectedSecret) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  try {
    await client.logout();
    isReady = false;
    if (fs.existsSync(QR_FILE)) fs.unlinkSync(QR_FILE);
    addLog('warn', 'Manual disconnect — logged out, no auto-reconnect');
    sessionAuthenticatedAt = null;
    res.json({ success: true, message: 'Disconnected. Scan a new QR to reconnect.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/send', async (req, res) => {
  const apiSecret = (req.headers['x-api-secret'] || '').trim();
  const expectedSecret = (process.env.API_SECRET || '').trim();

  console.log('🔑 Auth check:', {
    receivedLength: apiSecret.length,
    expectedLength: expectedSecret.length,
    match: apiSecret === expectedSecret,
  });

  if (apiSecret !== expectedSecret) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  const { phone, message } = req.body || {};

  if (!phone || !message) {
    return res.status(400).json({ success: false, error: 'phone and message are required' });
  }

  if (sendInProgress) {
    return res.status(429).json({ success: false, error: 'Another send is already in progress, try again shortly' });
  }

  if (!isReady) {
    return res.status(503).json({ success: false, error: 'WhatsApp not ready. Scan QR first.' });
  }
  if (!isStable) {
    return res.status(503).json({ success: false, error: 'WhatsApp session is stabilizing, retry in a few seconds' });
  }

  const cleanedPhone = String(phone).replace(/\D/g, '');
  const chatId = `${cleanedPhone}@c.us`;

  console.log(`📤 Sending message to ${chatId}...`);

  try {
    const state = await client.getState();
    addLog('info', `Pre-send client state: ${state}`);
  } catch (e) {
    addLog('warn', `Could not get client state: ${e.message}`);
  }

  try {
    const info = client.info;
    addLog('info', `Pre-send wid: ${info?.wid?.user || 'unknown'}, pushname: ${info?.pushname || 'unknown'}`);
  } catch (e) {
    addLog('warn', `Could not read client.info: ${e.message}`);
  }

  sendInProgress = true;
  const sendStartTime = Date.now();
  try {
    const sendPromise = client.sendMessage(chatId, message);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Send timed out after 45s')), 45000)
    );

    await Promise.race([sendPromise, timeoutPromise]);
    const sendDuration = Date.now() - sendStartTime;
    addLog('info', `Message sent in ${sendDuration}ms to ${chatId}`);
    console.log(`✅ Message sent to ${chatId}`);
    return res.status(200).json({ success: true, chatId });
  } catch (error) {
    console.error('❌ Send failed:', error.message);
    if (error.message === 'Send timed out after 45s') {
      const sendDuration = Date.now() - sendStartTime;
      addLog('error', `Send timed out after ${sendDuration}ms to ${chatId}`);
      return res.status(504).json({ success: false, error: 'Send timed out after 45s' });
    }
    return res.status(500).json({ success: false, error: error.message });
  } finally {
    sendInProgress = false;
  }
});

app.get('/qr', (_req, res) => {
  if (!fs.existsSync(QR_FILE)) {
    return res.status(404).json({
      error: 'No QR available yet or already authenticated',
    });
  }

  const qrContent = fs.readFileSync(QR_FILE, 'utf8');
  res.type('text/plain').send(qrContent);
});

app.get('/qr-image', async (_req, res) => {
  if (!fs.existsSync(QR_FILE)) {
    return res.status(404).send('<h2>No QR available — already authenticated or not ready yet</h2>');
  }
  try {
    const qrText = fs.readFileSync(QR_FILE, 'utf8').trim();
    const qrDataUrl = await QRCode.toDataURL(qrText);
    res.send(`<html><body style="display:flex;justify-content:center;align-items:center;height:100vh;background:#000">
      <img src="${qrDataUrl}" style="width:300px;height:300px"/>
    </body></html>`);
  } catch (err) {
    res.status(500).send('<h2>Error generating QR image</h2>');
  }
});

app.get('/qr-scan', (_req, res) => {
  if (!fs.existsSync(QR_FILE)) {
    return res.send(`<html><body style="background:#111;color:#fff;font-family:sans-serif;text-align:center;padding:50px">
      <h2>No QR available</h2>
      <p>WhatsApp may already be authenticated, or QR hasn't generated yet.</p>
      <p><a href="/health" style="color:#25D366">Check health status</a></p>
      <script>setTimeout(()=>location.reload(),3000)</script>
    </body></html>`);
  }
  const qrContent = fs.readFileSync(QR_FILE, 'utf8');
  res.send(`<html><head><title>WhatsApp QR</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
  </head>
  <body style="background:#111;color:#fff;font-family:sans-serif;text-align:center;padding:50px">
    <h2>📱 Scan with WhatsApp</h2>
    <p>Open WhatsApp → Linked Devices → Link a Device</p>
    <div id="qrcode" style="display:inline-block;background:white;padding:20px;border-radius:12px;margin:20px"></div>
    <p style="color:#888">Page auto-refreshes every 15 seconds</p>
    <script>
      new QRCode(document.getElementById("qrcode"), {
        text: ${JSON.stringify(qrContent)},
        width: 256,
        height: 256
      });
    </script>
    <script>setTimeout(()=>location.reload(),15000)</script>
  </body></html>`);
});

app.listen(PORT, () => {
  console.log(`🌐 WhatsApp service running on port ${PORT}`);
  console.log('🚀 Initializing WhatsApp client...');
  try {
    client.initialize();
  } catch(err) {
    console.error('❌ WhatsApp init failed:', err.message);
  }
});