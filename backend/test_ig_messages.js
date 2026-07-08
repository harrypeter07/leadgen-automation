// backend/test_ig_messages.js
const connectedAccountsRepository = require('./repositories/connectedAccountsRepository');
const axios = require('axios');

async function test() {
  console.log('Fetching Instagram account credentials from DB...');
  try {
    const accounts = await connectedAccountsRepository.getByPlatform('instagram');
    if (accounts.length === 0) {
      console.log('❌ No Instagram accounts connected in DB.');
      return;
    }
    const account = accounts[0];
    console.log('✓ Found connected Instagram account:', account.account_name);
    const token = account.credentials.access_token;
    if (!token) {
      console.log('❌ No access_token found in credentials.');
      return;
    }
    
    // Call Meta API for Instagram conversations
    const url = `https://graph.facebook.com/v19.0/me/conversations?fields=id,participants,messages{message,from,created_time}&platform=instagram&access_token=${encodeURIComponent(token)}`;
    console.log('Fetching conversations from Meta API...');
    
    const res = await axios.get(url);
    console.log('✓ API Response Status:', res.status);
    console.log('Conversations data:');
    console.log(JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.error('❌ Error fetching conversations:', err.response?.data || err.message);
  }
}

test().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
