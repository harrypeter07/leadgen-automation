/**
 * Migration:
 * 1. Add account-specific settings columns to `connected_accounts` table.
 * 2. Migrate current global chatbot settings (from `meta_config`) into the existing `Smriti` account records.
 * 3. Seed `Kashi Singh` accounts (facebook, instagram, messenger) into `connected_accounts` with their verified credentials.
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { pool } = require('../db');
const encryptionService = require('../../services/encryptionService');

// Verified Kashi Singh Credentials
const KASHI_PAGE_ID = '1283378884848005';
const KASHI_PAGE_NAME = 'Kashi Singh';
const KASHI_IG_ID = '17841441378827572';
const KASHI_IG_USERNAME = 'kashii.singh';
const KASHI_APP_ID = '1942455143138800'; // Reuse existing FlowFyp app id
const KASHI_APP_SECRET = '9dcb73e56c8eda32d1871f13b261e66d';
const KASHI_PAGE_TOKEN = 'EAAbmpxTMhfABR1uDNWmUbx0ZC7eHpkzxNMmRXz8XqqOiii0iM5gJa5ZAFxngoW6UbWd1Shdyp49H7Bh5iiml6J5GsW1XOTbXfLkUFGnQc5AESmIKKbzaDGqmyW2tZCKrvc26Glj4KjBQYKNJNLnrB2th9B1pJmgEje1H7noc4OHxS4blXueZCqTGvCUUDW3YD8YXifsOoYlkttXCZAlZCHZCgH40YBgAved29c6V6pW0mCcdgZDZD';

async function run() {
  console.log('=== DB Schema Update: Account-Specific Settings ===');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Add columns to `connected_accounts` table
    console.log('Altering `connected_accounts` table to add settings columns...');
    const columns = [
      'chatbot_enabled BOOLEAN DEFAULT false',
      'chatbot_persona TEXT',
      'auto_reply_rules JSONB DEFAULT \'[]\'::jsonb',
      'first_reply_delay INTEGER DEFAULT 8',
      'conversation_delay INTEGER DEFAULT 4',
      'static_reply_enabled BOOLEAN DEFAULT false',
      'static_reply_override TEXT',
      'is_active BOOLEAN DEFAULT false'
    ];

    for (const col of columns) {
      await client.query(`ALTER TABLE connected_accounts ADD COLUMN IF NOT EXISTS ${col}`);
    }
    console.log('✓ Columns added successfully.');

    // 2. Fetch current global settings from `meta_config`
    console.log('Fetching existing global settings from `meta_config`...');
    const configRes = await client.query('SELECT key, value FROM meta_config WHERE key IN (\'AI_CHATBOT_ENABLED\', \'AI_CHATBOT_PERSONA\', \'AUTO_REPLY_RULES\', \'AI_FIRST_REPLY_DELAY\', \'AI_CONVERSATION_DELAY\', \'AI_STATIC_REPLY_ENABLED\', \'AI_STATIC_REPLY_OVERRIDE\')');
    
    const globalSettings = {};
    configRes.rows.forEach(r => {
      globalSettings[r.key] = r.value;
    });

    const chatbotEnabled = globalSettings.AI_CHATBOT_ENABLED === 'true';
    const chatbotPersona = globalSettings.AI_CHATBOT_PERSONA || 'You are a helpful, professional assistant.';
    const autoReplyRules = globalSettings.AUTO_REPLY_RULES || '[]';
    const firstReplyDelay = parseInt(globalSettings.AI_FIRST_REPLY_DELAY || '8', 10);
    const conversationDelay = parseInt(globalSettings.AI_CONVERSATION_DELAY || '4', 10);
    const staticReplyEnabled = globalSettings.AI_STATIC_REPLY_ENABLED === 'true';
    const staticReplyOverride = globalSettings.AI_STATIC_REPLY_OVERRIDE || '';

    // 3. Migrate settings to existing Smriti accounts and set them to active
    console.log('Migrating settings to existing Smriti accounts...');
    await client.query(`
      UPDATE connected_accounts 
      SET 
        chatbot_enabled = $1,
        chatbot_persona = $2,
        auto_reply_rules = $3,
        first_reply_delay = $4,
        conversation_delay = $5,
        static_reply_enabled = $6,
        static_reply_override = $7,
        is_active = true
      WHERE platform IN ('facebook', 'instagram', 'messenger')
    `, [
      chatbotEnabled,
      chatbotPersona,
      autoReplyRules,
      firstReplyDelay,
      conversationDelay,
      staticReplyEnabled,
      staticReplyOverride
    ]);
    console.log('✓ Existing Smriti accounts settings migrated and activated.');

    // 4. Check if Kashi Singh accounts already exist to prevent duplicates
    console.log('Adding Kashi Singh accounts...');
    const existingKashiRes = await client.query('SELECT id FROM connected_accounts WHERE account_name LIKE $1', ['%Kashi%']);
    
    if (existingKashiRes.rows.length === 0) {
      // Create Facebook Page Account
      const fbCreds = JSON.stringify({
        access_token: KASHI_PAGE_TOKEN,
        app_secret: KASHI_APP_SECRET,
        page_id: KASHI_PAGE_ID
      });
      const encFbCreds = encryptionService.encrypt(fbCreds);
      await client.query(`
        INSERT INTO connected_accounts (platform, account_name, app_id, encrypted_credentials, oauth_status, webhook_verification_status, is_active, chatbot_enabled, chatbot_persona, auto_reply_rules)
        VALUES ('facebook', 'Kashi Singh (Facebook Page)', $1, $2, 'connected', 'verified', false, false, 'You are a helpful representative for Kashi Singh.', '[]'::jsonb)
      `, [KASHI_APP_ID, encFbCreds]);

      // Create Instagram Business Account
      const igCreds = JSON.stringify({
        access_token: KASHI_PAGE_TOKEN,
        app_secret: KASHI_APP_SECRET,
        page_id: KASHI_IG_ID // page_id holds IG business ID for instagram platform
      });
      const encIgCreds = encryptionService.encrypt(igCreds);
      await client.query(`
        INSERT INTO connected_accounts (platform, account_name, app_id, encrypted_credentials, oauth_status, webhook_verification_status, is_active, chatbot_enabled, chatbot_persona, auto_reply_rules)
        VALUES ('instagram', 'kashii.singh (Instagram Business)', $1, $2, 'connected', 'verified', false, false, 'You are a helpful representative for Kashi Singh.', '[]'::jsonb)
      `, [KASHI_APP_ID, encIgCreds]);

      // Create Messenger Account
      const msgCreds = JSON.stringify({
        access_token: KASHI_PAGE_TOKEN,
        app_secret: KASHI_APP_SECRET,
        page_id: KASHI_PAGE_ID
      });
      const encMsgCreds = encryptionService.encrypt(msgCreds);
      await client.query(`
        INSERT INTO connected_accounts (platform, account_name, app_id, encrypted_credentials, oauth_status, webhook_verification_status, is_active, chatbot_enabled, chatbot_persona, auto_reply_rules)
        VALUES ('messenger', 'Kashi Singh (Messenger Chat)', $1, $2, 'connected', 'verified', false, false, 'You are a helpful representative for Kashi Singh.', '[]'::jsonb)
      `, [KASHI_APP_ID, encMsgCreds]);

      console.log('✓ Kashi Singh accounts created successfully.');
    } else {
      console.log('⚠️ Kashi Singh accounts already exist in connected_accounts table.');
    }

    await client.query('COMMIT');
    console.log('✅ Migration Transaction Committed successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err.message);
  } finally {
    client.release();
  }
  process.exit(0);
}

run();
