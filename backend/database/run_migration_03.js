// backend/database/run_migration_03.js
const { Client } = require('pg');
const logger = require('../worker/logger');
require('dotenv').config();

const config = require('../modules/config');
const connectionString = config.databaseUrl;

async function run() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log('Connected to database for migration 03...');

    await client.query('BEGIN');

    // 1. Create automation_publishing_queue table
    await client.query(`
      CREATE TABLE IF NOT EXISTS automation_publishing_queue (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        platform TEXT NOT NULL,
        account_name TEXT NOT NULL,
        content TEXT NOT NULL,
        media_url TEXT,
        scheduled_at TIMESTAMPTZ NOT NULL,
        status TEXT NOT NULL DEFAULT 'scheduled',
        published_id TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 2. Create automation_workflow_status table
    await client.query(`
      CREATE TABLE IF NOT EXISTS automation_workflow_status (
        name TEXT PRIMARY KEY,
        active BOOLEAN NOT NULL DEFAULT true,
        last_run TIMESTAMPTZ,
        execution_time TEXT,
        status TEXT NOT NULL DEFAULT 'success'
      );
    `);

    // 3. Pre-insert workflow records
    await client.query(`
      INSERT INTO automation_workflow_status (name, active, last_run, execution_time, status)
      VALUES 
        ('Communication Hub', true, NOW() - INTERVAL '5 minutes', '180ms', 'success'),
        ('Publishing Hub', true, NOW() - INTERVAL '15 minutes', '320ms', 'success'),
        ('Sync & Monitoring Hub', true, NOW() - INTERVAL '1 hour', '1.2s', 'success'),
        ('System Dispatcher', true, NOW() - INTERVAL '10 minutes', '12ms', 'success')
      ON CONFLICT (name) DO NOTHING;
    `);

    await client.query('COMMIT');
    console.log('✓ Migration 03 completed successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration 03 failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
