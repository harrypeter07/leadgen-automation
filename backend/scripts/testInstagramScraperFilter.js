// backend/scripts/testInstagramScraperFilter.js
require('dotenv').config();

const { chromium } = require('playwright');
const InstagramProvider = require('../providers/instagram/provider');
const logger = require('../worker/logger');

// Mock a scraper job structure with min/max followers and reach filters
const mockJob = {
  id: 'test_job_123',
  keyword: 'doctors',
  city: 'Mumbai',
  current_provider: 'instagram?minFollowers=0&maxFollowers=500&reachAmount=10',
  logs: []
};

// Target test accounts
const testProfiles = [
  'https://www.instagram.com/dr_ashish_shah/', // Doctor with specific follower range
  'https://www.instagram.com/doctor.dentist/'
];

async function run() {
  console.log('🚀 Launching Playwright browser context...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const provider = new InstagramProvider();
  provider.profileUrls = testProfiles;
  
  console.log(`🔍 Processing mock Instagram scraping job with followers filter...`);
  console.log(`Current Provider config: ${mockJob.current_provider}`);
  
  for (let i = 0; i < testProfiles.length; i++) {
    console.log(`\n📄 Visiting profile index ${i}: ${testProfiles[i]}`);
    try {
      const lead = await provider.extract(page, i, mockJob);
      if (lead) {
        console.log(`✅ MATCH FOUND AND KEPT:`, JSON.stringify(lead, null, 2));
      } else {
        console.log(`❌ Profile discarded based on filters or missing email/phone.`);
      }
    } catch (err) {
      console.error(`💥 Error processing profile: ${err.message}`);
    }
  }
  
  console.log('\n📝 Scraper mock job logs:');
  mockJob.logs.forEach(log => console.log(`  ${log}`));
  
  await browser.close();
  console.log('\n🏁 Test complete.');
}

run().catch(console.error);
