const db = require('../backend/database/db');

async function check() {
  try {
    const res = await db.query('SELECT * FROM followup_queue ORDER BY created_at DESC LIMIT 5;');
    console.log('FOLLOWUPS:', res.rows);
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

check();
