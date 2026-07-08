// backend/test_publish_trigger.js
const { Client } = require('pg');
require('dotenv').config();

async function run() {
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
    console.log('Connected to database.');

    // 1. Check if the Smriti Facebook Page exists
    const accRes = await client.query("SELECT * FROM connected_accounts WHERE platform = 'facebook' LIMIT 1;");
    if (accRes.rows.length === 0) {
      console.error('❌ No Facebook account connected in the DB to test publishing.');
      return;
    }
    const account = accRes.rows[0];
    console.log(`✓ Using connected account: ${account.account_name} (${account.platform})`);

    // 2. Insert a test post into the publishing queue
    const content = `[Test Auto-Post] Verification from Antigravity Agent - ${new Date().toLocaleString()}`;
    const scheduledAt = new Date().toISOString();
    
    console.log('Inserting test post into automation_publishing_queue...');
    const insertRes = await client.query(`
      INSERT INTO automation_publishing_queue (platform, account_name, content, scheduled_at, status)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `, [account.platform, account.account_name, content, scheduledAt, 'scheduled']);
    
    const post = insertRes.rows[0];
    console.log('✓ Test post inserted successfully:');
    console.log(JSON.stringify(post, null, 2));
    console.log('\n👉 Go to your n8n console and trigger/run the "Publishing Hub" workflow now.');
    console.log('Then check if this post gets published on your Facebook Page feed and status updates to "published".');

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

run();
