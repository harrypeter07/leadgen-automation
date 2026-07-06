// backend/scripts/scrapeDoctorsInstagram.js
require('dotenv').config();

const { chromium } = require('playwright');
const InstagramProvider = require('../providers/instagram/provider');
const logger = require('../worker/logger');
const leadsRepository = require('../repositories/leadsRepository');

// Mock scraper job with target settings: Doctors, Max 25, under 500 followers, with contact info
const mockJob = {
  id: `manual_run_${Date.now()}`,
  keyword: 'doctors',
  city: 'Mumbai',
  current_provider: 'instagram?minFollowers=0&maxFollowers=500&reachAmount=0',
  logs: [],
  max_leads: 25,
  worker_count: 1
};

async function run() {
  console.log('🏁 Starting targeted Instagram Scrape execution...');
  console.log(`Job configuration: ${mockJob.current_provider}`);
  console.log(`Keyword: "${mockJob.keyword}" | City: "${mockJob.city}" | Target: ${mockJob.max_leads} leads\n`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const provider = new InstagramProvider();
  
  // 1. Plan and search
  await provider.search(page, { keyword: mockJob.keyword, city: mockJob.city });
  const harvestedCount = provider.profileUrls.length;
  console.log(`\n🔍 Harvested ${harvestedCount} initial doctor profile links matching criteria.`);

  if (harvestedCount === 0) {
    console.log('❌ No links harvested. Ensure TinyFish credentials/connection is active.');
    await browser.close();
    return;
  }

  // 2. Loop through profiles to collect 25 qualified doctor leads
  const qualifiedLeads = [];
  
  for (let i = 0; i < harvestedCount; i++) {
    const url = provider.profileUrls[i];
    console.log(`\n[${qualifiedLeads.length + 1}/25] Processing: ${url}`);
    
    try {
      const rawLead = await provider.extract(page, i, mockJob);
      if (rawLead) {
        const lead = provider.normalize(rawLead, mockJob.city);
        
        // Save to leads database in real-time
        await leadsRepository.upsert({ ...lead, job_id: mockJob.id });
        qualifiedLeads.push(lead);
        console.log(`✅ QUALIFIED LEAD RETAINED: ${lead.name} | Email: ${lead.email} | Phone: ${lead.phone}`);
        
        if (qualifiedLeads.length >= mockJob.max_leads) {
          console.log('\n🎯 Reached the requested target of 25 qualified doctors!');
          break;
        }
      } else {
        console.log(`❌ Profile discarded (failed follower range check, threads filter, or missing contact info).`);
      }
    } catch (err) {
      console.error(`💥 Execution error on profile ${url}: ${err.message}`);
    }
  }

  console.log(`\n🏁 Scraping finished. Total qualified doctor leads saved to DB: ${qualifiedLeads.length}`);
  console.log('\n📝 Execution logs output:');
  mockJob.logs.slice(-20).forEach(log => console.log(`  ${log}`));

  await browser.close();
}

run().catch(console.error);
