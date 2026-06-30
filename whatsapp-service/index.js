require('dotenv').config();

const fs = require('fs');
const path = require('path');
const express = require('express');
const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');

const QR_FILE = path.join(__dirname, 'qr.txt');

let isReady = false;

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: '.wwebjs_auth' }),
  puppeteer: {
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  },
  webVersionCache: {
    type: 'remote',
    remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.3000.1023994097-alpha.html',
  },
});

client.on('qr', (qr) => {
  qrcode.generate(qr, { small: true });
  fs.writeFileSync(QR_FILE, qr, 'utf8');
  console.log('📱 QR code saved to qr.txt — scan with WhatsApp');
});

client.on('loading_screen', (percent, message) => {
  console.log(`⏳ Loading WhatsApp: ${percent}% - ${message}`);
});

client.on('authenticated', () => {
  console.log('🔐 Authenticated — session saved');
});

client.on('ready', () => {
  isReady = true;
  console.log('✅ WhatsApp client ready');
  if (fs.existsSync(QR_FILE)) {
    fs.unlinkSync(QR_FILE);
  }
});

client.on('auth_failure', (msg) => {
  console.error('❌ Auth failure:', msg);
  isReady = false;
});

client.on('disconnected', (reason) => {
  isReady = false;
  console.log('⚠️ WhatsApp disconnected:', reason);
});

console.log('🚀 Initializing WhatsApp client...');
client.initialize();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', whatsapp_ready: isReady });
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
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { phone, message } = req.body || {};

  if (!phone || !message) {
    return res.status(400).json({ error: 'phone and message are required' });
  }

  if (!isReady) {
    return res.status(503).json({ error: 'WhatsApp not ready. Scan QR first.' });
  }

  const cleanedPhone = String(phone).replace(/\D/g, '');
  const chatId = `${cleanedPhone}@c.us`;

  console.log(`📤 Sending message to ${chatId}...`);
  try {
    await client.sendMessage(chatId, message);
    console.log(`✅ Message sent to ${chatId}`);
    return res.status(200).json({ success: true, chatId });
  } catch (error) {
    console.error('❌ Send failed:', error.message);
    return res.status(500).json({ error: error.message });
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

app.listen(PORT, () => {
  console.log(`🌐 WhatsApp service running on port ${PORT}`);
});