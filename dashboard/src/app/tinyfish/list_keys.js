const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://nefgezqgrfvqegmduzce.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lZmdlenFncmZ2cWVnbWR1emNlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mjc5NjkxNCwiZXhwIjoyMDk4MzcyOTE0fQ.grbcl7SPUw3dZxjhKwcc2TZEBrmmfnJOCPkKaYxnLl8';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function listKeys() {
  const { data, error } = await supabase.from('meta_config').select('key, encrypted');
  if (error) {
    console.error('Error fetching meta_config keys:', error.message);
  } else {
    console.log('Keys in meta_config table:');
    data.forEach(r => console.log(`- ${r.key} (Encrypted: ${r.encrypted})`));
  }
}

listKeys();
