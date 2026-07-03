// backend/scripts/testInstagram.js
//
// Standalone test for Instagram profile scraper.
// Run from /backend:
//   node scripts/testInstagram.js hassanmansurii
//   node scripts/testInstagram.js hassanmansurii --headed

const { chromium } = require('playwright');

const username = process.argv[2] || 'hassanmansurii';
const HEADED = process.argv.includes('--headed');

async function run() {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  📸  Instagram Profile Scraper Test — @${username}`);
  console.log(`  Mode: ${HEADED ? '👁  HEADED' : '🤖 Headless'}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  const browser = await chromium.launch({
    headless: !HEADED,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-blink-features=AutomationControlled'],
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
    locale: 'en-US',
    timezoneId: 'Asia/Kolkata',
  });

  // Inject session cookie if available in .env
  require('dotenv').config();
  if (process.env.INSTAGRAM_SESSION_ID) {
    console.log(`🍪 Injecting INSTAGRAM_SESSION_ID cookie...`);
    await context.addCookies([{
      name: 'sessionid',
      value: process.env.INSTAGRAM_SESSION_ID,
      domain: '.instagram.com',
      path: '/',
      secure: true,
      httpOnly: true,
    }]);
  } else {
    console.log(`⚠️  No INSTAGRAM_SESSION_ID in .env — will load without session (public data only)`);
  }

  const page = await context.newPage();
  const url = `https://www.instagram.com/${username}/`;

  // Set up network interceptor BEFORE navigation
  let capturedApiData = null;
  page.on('response', async (response) => {
    try {
      const rUrl = response.url();
      if (rUrl.includes('web_profile_info') && rUrl.includes(username)) {
        const body = await response.text().catch(() => '');
        if (body && (body.includes('bio_links') || body.includes('biography'))) {
          capturedApiData = body;
          console.log(`📡 Captured API response (${body.length} bytes)`);
        }
      }
    } catch (_) {}
  });

  console.log(`🌐 Navigating to: ${url}`);
  await page.goto(url, { timeout: 25000, waitUntil: 'domcontentloaded' }).catch(e => console.log(`  Navigate error: ${e.message}`));

  let finalUrl = page.url();
  console.log(`📍 Final URL: ${finalUrl}`);

  // Expired session cookie redirects to home — detect and retry without cookie
  if (!finalUrl.includes(`/${username}`) && process.env.INSTAGRAM_SESSION_ID) {
    console.log(`⚠️  Session cookie caused redirect — clearing cookies and retrying as public user...`);
    await context.clearCookies();
    await page.goto(url, { timeout: 25000, waitUntil: 'domcontentloaded' }).catch(() => {});
    finalUrl = page.url();
    console.log(`📍 Retry URL: ${finalUrl}`);
  }

  if (finalUrl.includes('accounts/login') || !finalUrl.includes(`/${username}`)) {
    console.log(`\n🔐 Could not reach profile page — URL: ${finalUrl}`);
    await browser.close();
    return;
  }

  // Wait for React + API calls to complete
  await page.waitForTimeout(3500);

  // ─── Dump diagnostics ────────────────────────────────────────────────────────
  console.log(`\n📋 Page Title: ${await page.title().catch(() => 'N/A')}`);

  const metaDesc = await page.$eval('meta[name="description"]', el => el.content).catch(() => null);
  console.log(`\n📄 Meta description:\n   ${metaDesc || '(none)'}`);

  // What does the profile.js fetcher actually see?
  const profileFetcher = require('../providers/instagram/profile');
  console.log(`\n⚙️  Running profileFetcher.fetch() with${capturedApiData ? '' : 'out'} API data...`);
  const profile = await profileFetcher.fetch(page, capturedApiData);

  if (!profile) {
    console.log(`\n❌ profileFetcher returned null`);
    
    // Dump raw DOM hints
    console.log(`\n🔍 DOM Diagnostics:`);
    const h1 = await page.$eval('h1', el => el.innerText).catch(() => null);
    const h2 = await page.$eval('h2', el => el.innerText).catch(() => null);
    const mainText = await page.$eval('main', el => el.innerText?.substring(0, 500)).catch(() => null);
    console.log(`   h1: ${h1}`);
    console.log(`   h2: ${h2}`);
    console.log(`   main text (first 500 chars):\n${mainText}`);
  } else {
    console.log(`\n✅ Profile Data Extracted:`);
    console.log(JSON.stringify(profile, null, 2));
  }

  // Check if bio links section exists in DOM at all
  console.log(`\n🔗 Bio Links DOM check:`);
  const bioLinkElements = await page.$$eval('main header section a[href]', els =>
    els.map(a => ({ href: a.getAttribute('href'), text: a.innerText?.trim() }))
  ).catch(() => []);
  console.log(`   Found ${bioLinkElements.length} links in main>header>section:`);
  bioLinkElements.slice(0, 20).forEach(l => console.log(`   - [${l.text}] ${l.href}`));

  // Check what mailto/external links exist
  const externalLinks = bioLinkElements.filter(l =>
    l.href && (l.href.includes('l.instagram.com') || (!l.href.startsWith('/') && !l.href.includes('instagram.com')))
  );
  console.log(`\n🌍 External/bio links: ${externalLinks.length}`);
  externalLinks.forEach(l => console.log(`   → ${l.href}  (text: "${l.text}")`));

  if (HEADED) {
    console.log(`\n⏸  Browser staying open for 30s for inspection (--headed mode)...`);
    await page.waitForTimeout(30000);
  }

  await browser.close();
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
}

run().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
