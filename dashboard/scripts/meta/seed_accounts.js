const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const fs = require('fs');

// 1. Read env variables
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

// 2. Encryption Helper (Identical to backend/services/encryptionService.js)
const rawKey = process.env.ENCRYPTION_KEY || process.env.WHATSAPP_API_SECRET || 'antigravity_fallback_encryption_key_32_bytes_long';
const ENCRYPTION_KEY = crypto.createHash('sha256').update(rawKey).digest();
const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

function encrypt(text) {
  if (text === null || text === undefined) return '';
  const textStr = typeof text === 'object' ? JSON.stringify(text) : String(text);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(textStr, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Supabase configuration missing.');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// 3. Real Meta credentials
const PAGE_TOKEN = 'EAAbmpxTMhfABRxjOhwXJDe8T0DVmr9QeZABdQRJPM8JFnRSyP0VgizWwGLVFLgDd2EfYW2ZCAx92q0gqnBaBC9609BTMrjffD1OAMNJiUzEgKDT4YZAP0z2ZBN1s0IFtyIiv92cSYbCiI48Q6hYqZB4lh260rL1sjjH3oiTpLK9OUjpRAuier92JTwPyox3bLnZCnZBrVI9BQZDZD';
const PAGE_ID = '1165738093294228';
const APP_ID = '1942455143138800';
const APP_SECRET = '9dcb73e56c8eda32d1871f13b261e66d';
const IG_BIZ_ID = '17841411718913026';

const accountsToSeed = [
  {
    platform: 'facebook',
    account_name: 'Smriti (Facebook Page)',
    app_id: APP_ID,
    credentials: {
      access_token: PAGE_TOKEN,
      app_secret: APP_SECRET,
      page_id: PAGE_ID
    },
    oauth_status: 'connected',
    health_status: 'healthy',
    webhook_verification_status: 'verified',
    permissions: [
      'read_insights',
      'pages_show_list',
      'business_management',
      'pages_messaging',
      'instagram_basic',
      'instagram_manage_comments',
      'instagram_manage_insights',
      'instagram_content_publish',
      'instagram_manage_messages',
      'pages_read_engagement',
      'pages_manage_metadata',
      'pages_read_user_content',
      'pages_manage_posts',
      'pages_manage_engagement',
      'whatsapp_business_messaging',
      'public_profile'
    ]
  },
  {
    platform: 'instagram',
    account_name: 'smritifyp (Instagram Business)',
    app_id: APP_ID,
    credentials: {
      access_token: PAGE_TOKEN,
      app_secret: APP_SECRET,
      page_id: IG_BIZ_ID
    },
    oauth_status: 'connected',
    health_status: 'healthy',
    webhook_verification_status: 'verified',
    permissions: [
      'instagram_basic',
      'instagram_manage_comments',
      'instagram_manage_insights',
      'instagram_content_publish',
      'instagram_manage_messages',
      'public_profile'
    ]
  },
  {
    platform: 'messenger',
    account_name: 'Smriti (Messenger Chat)',
    app_id: APP_ID,
    credentials: {
      access_token: PAGE_TOKEN,
      app_secret: APP_SECRET,
      page_id: PAGE_ID
    },
    oauth_status: 'connected',
    health_status: 'healthy',
    webhook_verification_status: 'verified',
    permissions: [
      'pages_messaging',
      'public_profile'
    ]
  }
];

async function seed() {
  console.log('Seeding connected accounts into database...');
  for (const acc of accountsToSeed) {
    const { credentials, ...rest } = acc;
    const encrypted_credentials = encrypt(JSON.stringify(credentials));

    // Check if account already exists for this platform
    const { data: existing, error: getError } = await supabaseAdmin
      .from('connected_accounts')
      .select('id')
      .eq('platform', acc.platform)
      .maybeSingle();

    if (getError) {
      console.error(`Error querying existing ${acc.platform} account:`, getError.message);
      continue;
    }

    const payload = {
      ...rest,
      encrypted_credentials,
      updated_at: new Date().toISOString()
    };

    if (existing && existing.id) {
      // Update
      const { error } = await supabaseAdmin
        .from('connected_accounts')
        .update(payload)
        .eq('id', existing.id);

      if (error) {
        console.error(`Failed updating ${acc.account_name}:`, error.message);
      } else {
        console.log(`✓ Updated existing ${acc.account_name}`);
      }
    } else {
      // Insert
      payload.created_at = new Date().toISOString();
      const { error } = await supabaseAdmin
        .from('connected_accounts')
        .insert([payload]);

      if (error) {
        console.error(`Failed inserting ${acc.account_name}:`, error.message);
      } else {
        console.log(`✓ Inserted new ${acc.account_name}`);
      }
    }
  }
  console.log('Done.');
}

seed();
