// backend/database/run_migration_04.js
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const logger = require('../worker/logger');
require('dotenv').config();

const config = require('../modules/config');
const connectionString = config.databaseUrl;

async function run() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log('Connected to database for migration 04...');

    const UP_FILE = path.join(__dirname, 'migrations', '04_automation_health_metrics.sql');
    const sql = fs.readFileSync(UP_FILE, 'utf8');

    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('✓ Migration 04 completed successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration 04 failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
