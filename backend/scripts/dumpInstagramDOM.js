// backend/scripts/dumpInstagramDOM.js
// Intercepts Instagram's profile API response to find bio_links
// node scripts/dumpInstagramDOM.js basantjoshiii

const { chromium } = require('playwright');

const username = process.argv[2] || 'basantjoshiii';

async function run() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
  });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
    locale: 'en-US',
  });

  const page = await context.newPage();

  // Intercept ALL JSON responses to find the profile API call
  const capturedResponses = [];
  page.on('response', async (response) => {
    const url = response.url();
    // Instagram profile API endpoints
    if (
      url.includes('web_profile_info') ||
      url.includes('/api/v1/users/') ||
      url.includes('graphql/query') ||
      url.includes(`/${username}/?`) ||
      url.includes('instagram.com/api')
    ) {
      try {
        const body = await response.text().catch(() => '');
        if (body && (body.includes('biography') || body.includes('bio_links') || body.includes('external_url'))) {
          capturedResponses.push({ url, body: body.substring(0, 3000) });
        }
      } catch (_) {}
    }
  });

  console.log(`🌐 Navigating: https://www.instagram.com/${username}/`);
  await page.goto(`https://www.instagram.com/${username}/`, { timeout: 25000, waitUntil: 'domcontentloaded' });
  console.log(`📍 Final URL: ${page.url()}`);

  // Wait for React + API calls to complete
  await page.waitForTimeout(5000);

  console.log(`\n=== Captured API responses with profile data: ${capturedResponses.length} ===`);
  capturedResponses.forEach((r, i) => {
    console.log(`\n--- Response ${i+1}: ${r.url} ---`);
    try {
      // Try to pretty-print JSON
      const parsed = JSON.parse(r.body);
      // Extract just the user fields we care about
      const user = parsed?.data?.user || parsed?.user || parsed?.graphql?.user ||
                   parsed?.data?.xdt_api__v1__users__web_profile_info__connection?.user;
      if (user) {
        console.log(JSON.stringify({
          username: user.username,
          full_name: user.full_name,
          biography: user.biography,
          external_url: user.external_url,
          bio_links: user.bio_links,
          is_verified: user.is_verified,
          followers: user.edge_followed_by?.count || user.follower_count,
          following: user.edge_follow?.count || user.following_count,
          posts: user.edge_owner_to_timeline_media?.count || user.media_count,
        }, null, 2));
      } else {
        console.log('Keys at root:', Object.keys(parsed).join(', '));
      }
    } catch (_) {
      console.log(r.body.substring(0, 1000));
    }
  });

  if (capturedResponses.length === 0) {
    console.log('❌ No profile API responses captured. All network calls:');
    // List ALL xhr/fetch calls made
    console.log('(Try running with --headed to inspect DevTools Network tab)');
  }

  await browser.close();
}

run().catch(e => console.error('Fatal:', e.message));
