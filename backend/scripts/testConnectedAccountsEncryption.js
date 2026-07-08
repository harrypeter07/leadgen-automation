// backend/scripts/testConnectedAccountsEncryption.js
require('dotenv').config();
const connectedAccountsRepository = require('../repositories/connectedAccountsRepository');
const auditLogRepository = require('../repositories/auditLogRepository');
const encryptionService = require('../services/encryptionService');
const supabase = require('../database/connection');

async function test() {
  console.log('🏁 Starting Connected Accounts & Encryption Layer test...');

  try {
    // 1. Assert Encryption works correctly
    const sensitiveToken = 'EAAasdf89as7df98asd7f98as7df98as7df98';
    const encrypted = encryptionService.encrypt(sensitiveToken);
    console.log('✓ Encrypted Token Output Format:', encrypted);
    
    if (!encrypted.includes(':')) {
      throw new Error('Encryption format incorrect. Missing IV separator.');
    }

    const decrypted = encryptionService.decrypt(encrypted);
    console.log('✓ Decrypted Token Output:', decrypted);

    if (decrypted !== sensitiveToken) {
      throw new Error('Decrypted output does not match original token!');
    }

    // 2. Create connected account in database
    console.log('🚀 Creating test Facebook connection settings in database...');
    const created = await connectedAccountsRepository.create({
      platform: 'facebook',
      account_name: 'Antigravity Verification Page',
      app_id: '1234567890',
      credentials: {
        access_token: 'EAASensitiveMetaAccessTokenValue',
        app_secret: 'SuperSecretAppSecretValue'
      }
    });

    console.log('✓ Database Connected Account created successfully. ID:', created.id);
    console.log('✓ Decrypted credentials returned on insert:', created.credentials);

    if (created.credentials.access_token !== 'EAASensitiveMetaAccessTokenValue') {
      throw new Error('Decrypted access token returned on insert does not match original!');
    }

    // 3. Inspect raw DB value to prove it is stored encrypted
    const { data: rawRow, error } = await supabase
      .from('connected_accounts')
      .select('encrypted_credentials')
      .eq('id', created.id)
      .single();

    if (error) throw error;
    console.log('✓ Raw encrypted string in PostgreSQL:', rawRow.encrypted_credentials);

    if (rawRow.encrypted_credentials.includes('EAASensitiveMetaAccessTokenValue')) {
      throw new Error('CRITICAL WARNING: Credentials stored in PLAINTEXT in database!');
    }
    console.log('🔒 Verification successful: Credentials are encrypted in the database.');

    // 4. Log audit event
    console.log('🚀 Writing action to system audit log table...');
    await auditLogRepository.log('INTEGRATION_TEST_RUN', 'Executed automated verification script successfully.');
    
    const logs = await auditLogRepository.getRecent(5);
    const testLog = logs.find(l => l.action === 'INTEGRATION_TEST_RUN');
    
    if (!testLog) {
      throw new Error('Audit log was not successfully saved/queried from database!');
    }
    console.log('✓ Audit log successfully saved and retrieved:', testLog.details);

    // 5. Clean up
    console.log('🗑️ Cleaning up test connected account...');
    await connectedAccountsRepository.delete(created.id);
    console.log('✓ Test account disconnected and removed.');

    console.log('🎉 ALL TESTS PASSED SUCCESSFULLY! Security layer and CRUD repos fully ready.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Integration test failed:', err.message);
    process.exit(1);
  }
}

test();
