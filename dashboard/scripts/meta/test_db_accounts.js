const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Custom env parser to avoid dependency on dotenv
const envPath = 'C:\\Users\\ASUS\\Documents\\SECOND SEMISTER\\INTERNSHIP\\auto-mt\\leadgen\\dashboard\\.env.local';
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const parts = trimmed.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
      process.env[key] = val;
    }
  });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Supabase URL or Service Key missing.');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  const { data: accounts, error } = await supabaseAdmin
    .from('connected_accounts')
    .select('*');

  if (error) {
    console.error('Error fetching accounts:', error.message);
  } else {
    console.log('Connected Accounts in Database:');
    console.log(JSON.stringify(accounts, null, 2));
  }

  const { data: queue, error: qErr } = await supabaseAdmin
    .from('automation_publishing_queue')
    .select('*')
    .limit(5);

  if (qErr) {
    console.error('Error fetching queue:', qErr.message);
  } else {
    console.log('Publishing Queue:');
    console.log(JSON.stringify(queue, null, 2));
  }

  const { data: workflowStatus, error: wErr } = await supabaseAdmin
    .from('automation_workflow_status')
    .select('*');

  if (wErr) {
    console.error('Error fetching workflow status:', wErr.message);
  } else {
    console.log('Workflow Statuses:');
    console.log(JSON.stringify(workflowStatus, null, 2));
  }
}

run();
