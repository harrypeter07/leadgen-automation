// backend/check_instagram_data.js
const { Client } = require('pg');
require('dotenv').config();

async function run() {
  console.log('Connecting to database:', process.env.DATABASE_URL ? 'URL exists' : 'URL NOT FOUND');
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL environment variable is missing.');
    return;
  }
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected successfully to database!');

    // Check connected accounts
    console.log('\n--- Connected Accounts ---');
    const accRes = await client.query('SELECT id, platform, account_name, oauth_status, health_status, created_at FROM connected_accounts;');
    console.log(`Found ${accRes.rows.length} connected accounts:`);
    console.table(accRes.rows);

    // Check messages
    console.log('\n--- Messages (by channel) ---');
    try {
      const msgRes = await client.query('SELECT channel, count(*) as count FROM conversation_messages GROUP BY channel;');
      console.log(`Message counts by channel:`);
      console.table(msgRes.rows);

      // Show some recent messages if any
      const recentRes = await client.query('SELECT id, direction, channel, body, created_at FROM conversation_messages ORDER BY created_at DESC LIMIT 5;');
      console.log(`Recent 5 messages:`);
      console.table(recentRes.rows);
    } catch (e) {
      console.log('Error checking conversation_messages:', e.message);
    }

  } catch (err) {
    console.error('Database query error:', err.message);
  } finally {
    await client.end();
  }
}

run();
