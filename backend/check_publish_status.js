// backend/check_publish_status.js
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
    const res = await client.query("SELECT id, platform, content, status, published_id, created_at FROM automation_publishing_queue WHERE id = '4d027bd7-5ad1-4655-9d8c-95b34ea3dcd0';");
    if (res.rows.length === 0) {
      console.log('Test post row not found.');
    } else {
      console.log('Current Post Row Status:');
      console.log(JSON.stringify(res.rows[0], null, 2));
    }
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

run();
