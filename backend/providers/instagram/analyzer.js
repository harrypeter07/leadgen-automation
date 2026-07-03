const logger = require('../../worker/logger');
const profileFetcher = require('./profile');
const postsFetcher = require('./posts');
const reelsFetcher = require('./reels');

class InstagramAnalyzer {
  constructor() {
    this.name = 'instagram';
  }

  async audit(page, username, options = {}) {
    logger.info(`[Instagram Analyzer] Modular Profile Audit: @${username}`);
    const profileUrl = `https://www.instagram.com/${username}/`;

    const sessionManager = require('../../worker/sessionManager');
    const crawlerUser = process.env.INSTAGRAM_ACCOUNT_USER;

    try {
      // 1. Inject INSTAGRAM_SESSION_ID cookie directly if defined in Railway variables
      if (process.env.INSTAGRAM_SESSION_ID) {
        logger.info(`[Instagram Analyzer] Injecting sessionid cookie from environment variables...`);
        await page.context().addCookies([
          {
            name: 'sessionid',
            value: process.env.INSTAGRAM_SESSION_ID,
            domain: '.instagram.com',
            path: '/',
            secure: true,
            httpOnly: true
          }
        ]);
      } else if (crawlerUser) {
        // Fallback to Supabase scraper_sessions table
        logger.info(`[Instagram Analyzer] Loading cookies for scraper account: ${crawlerUser}...`);
        const sessionLoaded = await sessionManager.loadSession(page.context(), 'instagram', crawlerUser);
        if (sessionLoaded) {
          logger.info(`[Instagram Analyzer] Active session applied to browser context.`);
        }
      }

      logger.info(`[Instagram Analyzer] Navigating to Instagram profile page: ${profileUrl}`);

      // ── Network interceptor: capture the profile API response ──────────────
      // Instagram calls /api/v1/users/web_profile_info/?username=<user> which
      // contains bio_links, external_url, biography and full stats.
      let capturedApiData = null;
      page.on('response', async (response) => {
        try {
          const url = response.url();
          if (url.toLowerCase().includes('web_profile_info')) {
            logger.info(`[Instagram Analyzer] Detected profile API network request: ${url}`);
            const body = await response.text().catch(() => '');
            if (body && (body.includes('bio_links') || body.includes('biography'))) {
              capturedApiData = body;
              logger.info(`[Instagram Analyzer] ✅ Captured profile API response (${body.length} bytes)`);
            } else {
              logger.warn(`[Instagram Analyzer] ⚠️ Profile API response was empty or lacked biography/bio_links.`);
            }
          }
        } catch (err) {
          logger.error(`[Instagram Analyzer] ❌ Error reading response text: ${err.message}`);
        }
      });
      // ─────────────────────────────────────────────────────────────────────

      try {
        await page.goto(profileUrl, { timeout: 30000, waitUntil: 'commit' });
        // Wait for profile container to appear (header, main page content or verified badge)
        await page.waitForSelector('main, h2, svg[aria-label="Verified"], div[role="main"]', { timeout: 15000 }).catch(() => {});
      } catch (err) {
        logger.warn(`[Instagram Analyzer] Navigation timed out or failed: ${err.message}. Checking DOM...`);
      }

      // 2. Detect login wall OR home redirect (expired session cookie)
      let currentUrl = page.url();
      logger.info(`[Instagram Analyzer] Loaded page URL: ${currentUrl}`);

      // If redirected to home feed or login — session cookie is expired/invalid
      let isOnProfile = currentUrl.includes(`/${username}`);
      if (!isOnProfile) {
        if (currentUrl.includes('accounts/login') || currentUrl.replace(/\/$/, '') === 'https://www.instagram.com') {
          logger.warn(`[Instagram Analyzer] Session cookie redirected away from profile (URL: ${currentUrl}). Retrying without cookie...`);
          // Clear all cookies and retry as public user
          await page.context().clearCookies();
          try {
            await page.goto(profileUrl, { timeout: 30000, waitUntil: 'commit' });
            await page.waitForSelector('main, h2, svg[aria-label="Verified"]', { timeout: 15000 }).catch(() => {});
          } catch (e) {
            logger.warn(`[Instagram Analyzer] Public retry page.goto timed out: ${e.message}`);
          }
          currentUrl = page.url();
          logger.info(`[Instagram Analyzer] Retry URL: ${currentUrl}`);
        }
      }

      // Still on login after retry? Try auto-login
      if (currentUrl.includes('accounts/login') && crawlerUser) {
        logger.info(`[Instagram Analyzer] Initiating automated login sequence...`);
        const loginSuccess = await this.login(page);
        if (loginSuccess) {
          try {
            await page.goto(profileUrl, { timeout: 30000, waitUntil: 'commit' });
            await page.waitForSelector('main, h2, svg[aria-label="Verified"]', { timeout: 15000 }).catch(() => {});
          } catch (e) {
            logger.warn(`[Instagram Analyzer] Post-login page.goto timed out: ${e.message}`);
          }
          currentUrl = page.url();
        }
      }

      // 3. Final check — verify profile exists by inspecting title and text contents
      const isNotFound = await page.evaluate(() => {
        const title = document.title || '';
        const bodyText = document.body ? document.body.innerText : '';
        return title.includes('Page Not Found') ||
               bodyText.includes("isn't available") ||
               bodyText.includes("broken, or the page may have been removed");
      });

      if (isNotFound) {
        logger.warn(`[Instagram Analyzer] Profile @${username} does not exist on Instagram.`);
        return { success: false, error: 'profile_not_found' };
      }

      if (!page.url().includes(`/${username}`)) {
        logger.warn(`[Instagram Analyzer] Could not reach profile page @${username}.`);
        return { success: false, error: 'profile_not_found' };
      }

      // Wait for Instagram API calls to fire and be captured
      await new Promise(resolve => setTimeout(resolve, 3500));

      // Invoke scraper modules — pass captured API data to profileFetcher
      logger.info(`[Instagram Analyzer] Fetching profile metadata (followers, following, bio)...`);
      const profile = await profileFetcher.fetch(page, capturedApiData);
      if (!profile || !profile.display_name) {
        logger.warn(`[Instagram Analyzer] Profile elements not found for @${username}.`);
        return { success: false, error: 'profile_not_found' };
      }
      
      logger.info(`[Instagram Analyzer] Extracted: Name="${profile.display_name}", Followers=${profile.followers}, Following=${profile.following}`);

      const scrapeHistory = options.scrapeHistory !== false;
      const scrapeReels = options.scrapeReels !== false;

      let posts = [];
      if (scrapeHistory) {
        logger.info(`[Instagram Analyzer] Fetching public posts metrics...`);
        posts = await postsFetcher.fetch(page);
      } else {
        logger.info(`[Instagram Analyzer] Skipping post scraping per configuration.`);
      }
      
      let reels = [];
      if (scrapeReels) {
        logger.info(`[Instagram Analyzer] Fetching public reels metrics...`);
        reels = await reelsFetcher.fetch(page);
      } else {
        logger.info(`[Instagram Analyzer] Skipping reels scraping per configuration.`);
      }
      
      logger.info(`[Instagram Analyzer] Completed audit successfully for @${username}`);
      return {
        success: true,
        username,
        display_name: profile.display_name,
        bio: profile.bio,
        website: profile.website,
        bio_links: profile.bio_links || [],
        followers: profile.followers,
        following: profile.following,
        posts_count: profile.posts_count,
        verified: profile.verified,
        posts: posts || [],
        reels: reels || []
      };

    } catch (err) {
      logger.error(`[Instagram Analyzer] Modular Profile Audit failed on ${username}: ${err.message}`);
      return { success: false, error: err.message || 'audit_failed' };
    }
  }

  async login(page) {
    const username = process.env.INSTAGRAM_ACCOUNT_USER;
    const password = process.env.INSTAGRAM_ACCOUNT_PASS;

    if (!username || !password) {
      logger.warn('[Instagram Analyzer] Scraper credentials missing. Skipping automated login.');
      return false;
    }

    try {
      logger.info(`[Instagram Analyzer] Loading Instagram Login Page...`);
      await page.goto('https://www.instagram.com/accounts/login/', { timeout: 20000, waitUntil: 'domcontentloaded' });
      await new Promise(resolve => setTimeout(resolve, 2000));

      const isLoginInputPresent = await page.$('input[name="username"]');
      if (!isLoginInputPresent) {
        logger.info('[Instagram Analyzer] Session already authenticated.');
        return true;
      }

      logger.info(`[Instagram Analyzer] Entering credentials for account: ${username}...`);
      await page.fill('input[name="username"]', username);
      await page.fill('input[name="password"]', password);
      
      logger.info(`[Instagram Analyzer] Submitting login form...`);
      await Promise.all([
        page.click('button[type="submit"]'),
        page.waitForNavigation({ timeout: 20000, waitUntil: 'networkidle' }).catch(() => {})
      ]);

      await new Promise(resolve => setTimeout(resolve, 3000));

      const currentUrl = page.url();
      if (currentUrl.includes('accounts/login')) {
        logger.error('[Instagram Analyzer] Automated login submission failed. Page remained on login URL.');
        return false;
      }

      logger.info('[Instagram Analyzer] Authentication succeeded. Saving session back to database...');
      const sessionManager = require('../../worker/sessionManager');
      await sessionManager.saveSession(page.context(), 'instagram', username);
      return true;
    } catch (err) {
      logger.error(`[Instagram Analyzer] Dynamic login sequence exception: ${err.message}`);
      return false;
    }
  }
}

module.exports = new InstagramAnalyzer();
