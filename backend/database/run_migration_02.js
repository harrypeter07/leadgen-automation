// backend/database/run_migration_02.js
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const logger = require('../worker/logger');
require('dotenv').config();

const config = require('../modules/config');
const connectionString = config.databaseUrl;

if (!connectionString) {
  logger.error('[Migration 02 Runner] Connection string is not set in environment or config.');
  process.exit(1);
}

const MIGRATION_NAME = '02_meta_connected_accounts';
const UP_FILE = path.join(__dirname, 'migrations', '02_meta_connected_accounts.sql');

async function run() {
  logger.info(`[Migration 02 Runner] Starting migration run for "${MIGRATION_NAME}"...`);

  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    logger.info('[Migration 02 Runner] Connected to database.');

    // Ensure migrations_log exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations_log (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Check if already applied
    const { rows } = await client.query('SELECT * FROM migrations_log WHERE name = $1', [MIGRATION_NAME]);
    const alreadyRun = rows.length > 0;

    if (alreadyRun) {
      logger.warn(`[Migration 02 Runner] Migration "${MIGRATION_NAME}" is already applied. Skipping.`);
      console.log(`✓ Migration "${MIGRATION_NAME}" is already applied.`);
      return;
    }

    logger.info({ file: UP_FILE }, `[Migration 02 Runner] Reading migration script...`);
    const sql = fs.readFileSync(UP_FILE, 'utf8');

    logger.info('[Migration 02 Runner] Starting migration transaction...');
    await client.query('BEGIN');
    
    await client.query(sql);
    await client.query('INSERT INTO migrations_log (name) VALUES ($1)', [MIGRATION_NAME]);
    
    await client.query('COMMIT');
    logger.info(`[Migration 02 Runner] Migration "${MIGRATION_NAME}" applied successfully!`);
    console.log(`✓ Migration "${MIGRATION_NAME}" applied successfully.`);
  } catch (err) {
    try {
      await client.query('ROLLBACK');
      logger.info('[Migration 02 Runner] Rolled back transaction.');
    } catch (e) {
      // Ignore rollback failure
    }
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
    logger.info('[Migration 02 Runner] Disconnected from database.');
  }
}

run();
