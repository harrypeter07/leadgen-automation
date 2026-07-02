// backend/database/connection.js

// Polyfill global WebSocket for older Node runtimes (like Node 20) before importing Supabase
if (typeof global.WebSocket === 'undefined') {
  try {
    global.WebSocket = require('ws');
  } catch (e) {
    // Ignore fallback failure
  }
}

const { createClient } = require('@supabase/supabase-js');
const logger = require('../worker/logger');

require('dotenv').config();

const supabaseUrl = (process.env.SUPABASE_URL || '').trim();
const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

let supabase = null;

if (!supabaseUrl || !supabaseKey) {
  logger.error('[Database] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment variables.');
} else {
  try {
    supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      realtime: {
        WebSocket: global.WebSocket,
      }
    });
  } catch (err) {
    logger.error(`[Database] Supabase client initialization failed: ${err.message}`);
  }
}

module.exports = supabase;
