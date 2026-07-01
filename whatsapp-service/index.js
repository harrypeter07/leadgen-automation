require('dotenv').config();

const fs = require('fs');
const path = require('path');
const express = require('express');
const qrcode = require('qrcode-terminal');
let makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion;

async function loadBaileys() {
  const baileys = await import('@whiskeysockets/baileys');
  makeWASocket = baileys.default;
  useMultiFileAuthState = baileys.useMultiFileAuthState;
  DisconnectReason = baileys.DisconnectReason;
  fetchLatestBaileysVersion = baileys.fetchLatestBaileysVersion;
}
const pino = require('pino');
const { Boom } = require('@hapi/boom');

const QR_FILE = path.join(__dirname, 'qr.txt');

let isReady = false;
let isStable = false;
let sendInProgress = false;
let isInitializing = false;

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

let sock = null;
let reconnectTimeout = null;

function resetConnectionState() {
  addLog('info', 'Resetting connection state...');
  isReady = false;
  isStable = false;
  isInitializing = false;
  sessionAuthenticatedAt = null;
  lastDisconnectReason = null;
  qrGeneratedAt = null;
  if (fs.existsSync(QR_FILE)) {
    try {
      fs.unlinkSync(QR_FILE);
      addLog('info', 'Deleted stale qr.txt file');
    } catch (e) {
      // ignore
    }
  }
}

async function destroySocket() {
  if (!sock) {
    addLog('info', 'No socket active to destroy.');
    return;
  }
  addLog('info', 'Destroying previous socket...');
  
  // Clear any pending reconnect timers
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
    addLog('info', 'Cleared pending reconnect timer.');
  }

  // Remove old listeners
  try {
    addLog('info', 'Removing old listeners...');
    sock.ev.removeAllListeners('connection.update');
    sock.ev.removeAllListeners('creds.update');
  } catch (e) {
    addLog('warn', `Failed to remove listeners: ${e.message}`);
  }

  // Close socket
  try {
    addLog('info', 'Closing old socket connection...');
    sock.end();
    if (sock.ws) {
      sock.ws.close();
    }
    addLog('info', 'Old socket closed.');
  } catch (e) {
    addLog('warn', `Failed to close socket: ${e.message}`);
  }

  sock = null;
  addLog('info', 'Socket destroyed.');
}

function scheduleReconnect() {
  if (reconnectTimeout) {
    addLog('info', 'Reconnect already scheduled. Skipping.');
    return;
  }
  addLog('info', 'Scheduling reconnect in 2000ms...');
  reconnectTimeout = setTimeout(async () => {
    reconnectTimeout = null;
    addLog('info', 'Executing scheduled reconnect...');
    await destroySocket();
    resetConnectionState();
    await startWhatsApp();
  }, 2000);
}

async function startWhatsApp() {
  if (isInitializing) {
    addLog('info', 'startWhatsApp called but initialization is already in progress. Skipping.');
    return;
  }
  isInitializing = true;

  if (!makeWASocket) {
    try {
      await loadBaileys();
    } catch (e) {
      isInitializing = false;
      addLog('error', `Failed to load Baileys module: ${e.message}`);
      console.error('❌ Failed to load Baileys module:', e.message);
      return;
    }
  }

  // PART 3: Prevent duplicate sockets - if one exists, destroy it first
  if (sock) {
    addLog('info', 'startWhatsApp detected duplicate socket. Running cleanup first.');
    await destroySocket();
  }

  addLog('info', 'Creating new Baileys socket...');

  // Watchdog setup (PART 8 & 10)
  let reachedQR = false;
  let reachedCredsUpdate = false;
  let reachedOpenConnection = false;

  const watchdogTimer = setTimeout(() => {
    const statusMsg = `[WATCHDOG 30s] Milestones: QR=${reachedQR}, creds.update=${reachedCredsUpdate}, open=${reachedOpenConnection}`;
    addLog('warn', statusMsg);
    console.log(statusMsg);
    
    if (!reachedQR) {
      addLog('error', '[WATCHDOG FAIL] Milestone not reached: QR code generation (no qr event received)');
      console.error('[WATCHDOG FAIL] Milestone not reached: QR code generation (no qr event received)');
    }
    if (!reachedCredsUpdate) {
      addLog('error', '[WATCHDOG FAIL] Milestone not reached: creds.update (no credentials saved)');
      console.error('[WATCHDOG FAIL] Milestone not reached: creds.update (no credentials saved)');
    }
    if (!reachedOpenConnection) {
      addLog('error', '[WATCHDOG FAIL] Milestone not reached: Connection state open');
      console.error('[WATCHDOG FAIL] Milestone not reached: Connection state open');
    }
  }, 30000);

  try {
    let authStateData = null;
    try {
      console.log('📂 [DIAGNOSTIC] Directory BEFORE useMultiFileAuthState:');
      try {
        const files = fs.readdirSync("/app/.wwebjs_auth");
        console.log('   Files:', files);
      } catch (e) {
        console.error('   Failed to read directory:', e.message);
      }

      console.log('🔄 [DIAGNOSTIC] Calling useMultiFileAuthState("/app/.wwebjs_auth")...');
      authStateData = await useMultiFileAuthState('/app/.wwebjs_auth');
      console.log('✅ [DIAGNOSTIC] useMultiFileAuthState returned successfully');

      console.log('📂 [DIAGNOSTIC] Directory AFTER useMultiFileAuthState:');
      try {
        const files = fs.readdirSync("/app/.wwebjs_auth");
        console.log('   Files:', files);
      } catch (e) {
        console.error('   Failed to read directory:', e.message);
      }
    } catch (err) {
      isInitializing = false;
      clearTimeout(watchdogTimer);
      addLog('error', `useMultiFileAuthState failed: ${err.message}\nStack: ${err.stack}`);
      console.error('❌ [CRITICAL] useMultiFileAuthState failed:', err);
      return;
    }

    const { state, saveCreds } = authStateData;

    let versionData = null;
    try {
      console.log('🔄 [DIAGNOSTIC] Calling fetchLatestBaileysVersion()...');
      versionData = await fetchLatestBaileysVersion();
      console.log('✅ [DIAGNOSTIC] fetchLatestBaileysVersion returned version:', versionData);
    } catch (err) {
      isInitializing = false;
      clearTimeout(watchdogTimer);
      addLog('error', `fetchLatestBaileysVersion failed: ${err.message}\nStack: ${err.stack}`);
      console.error('❌ [CRITICAL] fetchLatestBaileysVersion failed:', err);
      return;
    }

    const { version } = versionData;

    try {
      console.log('🔄 [DIAGNOSTIC] Calling makeWASocket()...');
      sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
      });
      console.log('✅ [DIAGNOSTIC] makeWASocket created socket successfully.');
    } catch (err) {
      isInitializing = false;
      clearTimeout(watchdogTimer);
      addLog('error', `makeWASocket failed: ${err.message}\nStack: ${err.stack}`);
      console.error('❌ [CRITICAL] makeWASocket failed:', err);
      return;
    }

    sock.ev.on('creds.update', () => {
      reachedCredsUpdate = true;
      console.log('⚡ [EVENT] creds.update fired. Calling saveCreds()...');
      try {
        saveCreds();
        addLog('info', 'Credentials updated.');
      } catch (e) {
        addLog('error', `saveCreds failed: ${e.message}\nStack: ${e.stack}`);
        console.error('❌ saveCreds failed:', e);
      }
    });

    sock.ev.on('connection.update', (update) => {
      console.log('⚡ [EVENT] connection.update received:');
      console.dir(update, { depth: null });

      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        reachedQR = true;
        addLog('info', 'Waiting for QR...');
        if (fs.existsSync(QR_FILE)) {
          try {
            fs.unlinkSync(QR_FILE);
          } catch (e) {}
        }
        qrGeneratedAt = new Date().toISOString();
        addLog('info', 'QR generated.');
        fs.writeFileSync(QR_FILE, qr, 'utf8');
        addLog('info', 'QR written to qr.txt.');
        qrcode.generate(qr, { small: true });
        console.log('📱 QR code saved to qr.txt — scan with WhatsApp');
      }

      if (connection === 'open') {
        reachedOpenConnection = true;
        clearTimeout(watchdogTimer);
        isReady = true;
        isStable = false;
        isInitializing = false;
        sessionAuthenticatedAt = new Date().toISOString();
        addLog('success', 'Connected.');
        console.log('✅ WhatsApp client ready');
        if (fs.existsSync(QR_FILE)) {
          try {
            fs.unlinkSync(QR_FILE);
          } catch (e) {}
        }
        setTimeout(() => {
          isStable = true;
          addLog('info', 'Client stabilized, ready for sends');
        }, 3000);
      }

      if (connection === 'close') {
        isReady = false;
        isStable = false;
        isInitializing = false;
        clearTimeout(watchdogTimer);

        const statusCode = lastDisconnect?.error instanceof Boom 
          ? lastDisconnect.error.output.statusCode 
          : null;

        console.log('⚠️ [EVENT] connection closed. lastDisconnect dump:');
        console.dir(lastDisconnect, { depth: null });

        const reason = lastDisconnect?.error?.message || 'unknown';
        lastDisconnectReason = reason;
        addLog('warn', `Disconnected: ${reason}`);

        const isLoggedOut = statusCode === DisconnectReason.loggedOut;
        if (isLoggedOut) {
          addLog('warn', 'Logged out — will not auto-reconnect. Scan new QR via Connect WhatsApp after login restart.');
        } else {
          addLog('info', `Connection closed (status: ${statusCode}). Attempting auto-reconnect.`);
          scheduleReconnect();
        }
      }
    });
  } catch (err) {
    isInitializing = false;
    clearTimeout(watchdogTimer);
    addLog('error', `Initialization failed: ${err.message}\nStack: ${err.stack}`);
    console.error('❌ WhatsApp init failed with unexpected exception:', err);
  }
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', whatsapp_ready: isReady });
});

app.get('/diagnostics', async (_req, res) => {
  try {
    res.json({
      isReady,
      isStable,
      client_state: isReady ? 'open' : 'closed',
      page_exists: false,
      page_metrics: null,
      wid: sock?.user?.id || null,
      user_info: sock?.user || null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/store-check', (_req, res) => {
  res.json({ store_ready: isReady && isStable, connection_state: isReady ? 'open' : 'closed' });
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

app.post('/reconnect', async (req, res) => {
  const apiSecret = (req.headers['x-api-secret'] || '').trim();
  const expectedSecret = (process.env.API_SECRET || '').trim();
  if (apiSecret !== expectedSecret) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  
  addLog('warn', 'Manual reconnect triggered from dashboard');
  try {
    // Attempt graceful logout if socket exists (ignore failures)
    if (sock) {
      addLog('info', 'Attempting graceful logout for reconnect...');
      await sock.logout().catch((err) => {
        addLog('info', `Logout skipped (likely already disconnected): ${err.message}`);
      });
    }

    // Close socket, remove listeners, sock = null
    await destroySocket();

    // Reset connection state
    resetConnectionState();

    // Immediately start WhatsApp
    startWhatsApp();

    addLog('info', 'Reconnect complete.');
    res.json({ success: true, message: 'Reconnect initiated' });
  } catch (err) {
    addLog('error', `Reconnect failed: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/disconnect', async (req, res) => {
  const apiSecret = (req.headers['x-api-secret'] || '').trim();
  const expectedSecret = (process.env.API_SECRET || '').trim();
  if (apiSecret !== expectedSecret) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  addLog('warn', 'Manual disconnect triggered from dashboard');
  try {
    if (sock) {
      addLog('info', 'Attempting graceful logout for disconnect...');
      await sock.logout().catch((err) => {
        addLog('info', `Logout skipped during disconnect: ${err.message}`);
      });
    }
    
    // Close socket, remove listeners, clear timeouts, nullify sock
    await destroySocket();

    // Reset connection state
    resetConnectionState();

    res.json({ success: true, message: 'Disconnected. Scan a new QR to reconnect.' });
  } catch (err) {
    addLog('error', `Disconnect failed: ${err.message}`);
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

  if (!isReady || !sock) {
    return res.status(503).json({ success: false, error: 'WhatsApp not ready. Scan QR first.' });
  }
  if (!isStable) {
    return res.status(503).json({ success: false, error: 'WhatsApp session is stabilizing, retry in a few seconds' });
  }

  const cleanedPhone = String(phone).replace(/\D/g, '');
  const jid = `${cleanedPhone}@s.whatsapp.net`;

  console.log(`📤 Sending message to ${jid}...`);

  addLog('info', `Pre-send client state: open`);
  addLog('info', `Pre-send wid: ${sock.user?.id || 'unknown'}, pushname: ${sock.user?.name || 'unknown'}`);

  sendInProgress = true;
  const sendStartTime = Date.now();
  try {
    const sendPromise = sock.sendMessage(jid, { text: message });
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Send timed out after 45s')), 45000)
    );

    await Promise.race([sendPromise, timeoutPromise]);
    const sendDuration = Date.now() - sendStartTime;
    addLog('info', `Message sent in ${sendDuration}ms to ${jid}`);
    console.log(`✅ Message sent to ${jid}`);
    return res.status(200).json({ success: true, chatId: jid });
  } catch (error) {
    console.error('❌ Send failed:', error.message);
    if (error.message === 'Send timed out after 45s') {
      const sendDuration = Date.now() - sendStartTime;
      addLog('error', `Send timed out after ${sendDuration}ms to ${jid}`);
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

const QRCode = require('qrcode');

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
  if (!isInitializing) {
    startWhatsApp();
  }
});