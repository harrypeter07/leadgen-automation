const logger = require('../../worker/logger');
const db = require('../../database/db');

class InstagramBotScanner {
  constructor() {
    this.name = 'instagramBotScanner';
  }

  // Scoring function
  scoreAccount(profile, interactions = []) {
    const signals = [];
    const username = profile.username || '';
    const bio = profile.biography || '';
    const followers = profile.followers_count ?? 0;
    const follows = profile.follows_count ?? 0;
    const posts = profile.media_count ?? 0;
    const displayName = profile.name || '';

    // 1. Username digit ratio
    const digits = (username.match(/\d/g) || []).length;
    const digitRatio = digits / Math.max(username.length, 1);
    if (digitRatio > 0.4) {
      signals.push({
        rule: 'high_digit_ratio',
        description: `Username is ${Math.round(digitRatio * 100)}% numbers`,
        score: 25,
        severity: 'high'
      });
    }

    // 2. Random number suffix
    if (/\d{4,}$/.test(username)) {
      signals.push({
        rule: 'number_suffix_pattern',
        description: 'Username ends with a sequence of 4+ digits (telltale bot signature)',
        score: 20,
        severity: 'high'
      });
    }

    // 3. Username has weird formatting (too many consecutive underscores or dots)
    if (/__/.test(username) || /\.\./.test(username) || (username.match(/[\._]/g) || []).length > 2) {
      signals.push({
        rule: 'weird_formatting',
        description: 'Username has unnatural formatting (multiple dots/underscores)',
        score: 10,
        severity: 'medium'
      });
    }

    // 4. No bio / empty biography
    if (!bio || bio.trim().length === 0) {
      signals.push({
        rule: 'empty_bio',
        description: 'Profile has no bio description',
        score: 15,
        severity: 'medium'
      });
    }

    // 5. Spam phrases in bio
    const spamWords = ['follow for follow', 'f4f', 'follow back', 'follow me', 'earn money', 'dm me', 'check link', 'fast cash'];
    const bioLower = bio.toLowerCase();
    const hitSpam = spamWords.find(w => bioLower.includes(w));
    if (hitSpam) {
      signals.push({
        rule: 'spam_bio',
        description: `Bio contains promotional/spam phrase: "${hitSpam}"`,
        score: 15,
        severity: 'medium'
      });
    }

    // 6. Zero posts
    if (posts === 0) {
      signals.push({
        rule: 'zero_posts',
        description: 'Account has zero posts',
        score: 25,
        severity: 'high'
      });
    } else if (posts < 3) {
      signals.push({
        rule: 'low_posts',
        description: 'Very low posts count (< 3 posts)',
        score: 12,
        severity: 'medium'
      });
    }

    // 7. Extreme following to follower ratio
    const ratio = follows / Math.max(followers, 1);
    if (ratio > 15 && follows > 100) {
      signals.push({
        rule: 'extreme_following_ratio',
        description: `Following ${follows} accounts but has only ${followers} followers (${ratio.toFixed(1)}x ratio)`,
        score: 35,
        severity: 'high'
      });
    } else if (ratio > 5 && follows > 200) {
      signals.push({
        rule: 'high_following_ratio',
        description: `Following-to-follower ratio is high (${ratio.toFixed(1)}x)`,
        score: 18,
        severity: 'medium'
      });
    }

    // 8. Mass following count
    if (follows > 1500) {
      signals.push({
        rule: 'mass_following',
        description: `Following a massive number of accounts (${follows})`,
        score: 20,
        severity: 'high'
      });
    }

    // 9. Ghost account (no followers, no posts)
    if (followers < 15 && posts < 2) {
      signals.push({
        rule: 'ghost_account',
        description: 'Extremely inactive/ghost profile (low followers & low posts)',
        score: 15,
        severity: 'medium'
      });
    }

    // 10. Display name matches username (default fallback)
    if (displayName && displayName.toLowerCase().replace(/[^a-z0-9]/g, '') === username.toLowerCase().replace(/[^a-z0-9]/g, '')) {
      signals.push({
        rule: 'generic_display_name',
        description: 'Display name is identical to username (no personalization)',
        score: 8,
        severity: 'low'
      });
    }

    const totalScore = Math.min(signals.reduce((sum, s) => sum + s.score, 0), 100);
    
    let verdict = 'real';
    if (totalScore >= 60) verdict = 'likely_bot';
    else if (totalScore >= 35) verdict = 'suspicious';
    else if (totalScore >= 15) verdict = 'probably_real';

    return {
      botScore: totalScore,
      verdict,
      signals
    };
  }

  async scanFollowers(page, targetUsername, limit = 30) {
    logger.info(`[Instagram Analyzer] Starting Follower Bot Audit for user: @${targetUsername}`);
    
    // 1. Get session ID dynamically
    const database = require('../../database/connection');
    let dbSessionId = null;
    if (database) {
      try {
        const { data } = await database
          .from('meta_config')
          .select('value')
          .eq('key', 'INSTAGRAM_SESSION_ID')
          .maybeSingle();
        if (data && data.value) {
          dbSessionId = data.value.trim();
        }
      } catch (err) {
        logger.warn(`[Instagram Analyzer] DB session ID load error: ${err.message}`);
      }
    }

    const activeSessionId = process.env.INSTAGRAM_SESSION_ID || dbSessionId;

    if (activeSessionId) {
      logger.info(`[Instagram Analyzer] Injecting sessionid cookie...`);
      await page.context().addCookies([
        {
          name: 'sessionid',
          value: activeSessionId,
          domain: '.instagram.com',
          path: '/',
          secure: true,
          httpOnly: true
        }
      ]);
    } else {
      logger.warn('[Instagram Analyzer] No active session ID found. Private profiles will be inaccessible.');
    }

    // 2. Navigate to home first to prime the session
    logger.info(`[Instagram Analyzer] Priming session on instagram.com...`);
    await page.goto('https://www.instagram.com/', { timeout: 30000, waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    // 3. Get user ID from profile info API
    logger.info(`[Instagram Analyzer] Fetching profile info for @${targetUsername}...`);
    const profileData = await page.evaluate(async (username) => {
      try {
        const res = await fetch(
          `https://www.instagram.com/api/v1/users/web_profile_info/?username=${username}`,
          { headers: { 'x-ig-app-id': '936619743392459' } }
        );
        if (!res.ok) return null;
        const json = await res.json();
        return json.data?.user || null;
      } catch (e) {
        return null;
      }
    }, targetUsername);

    if (!profileData) {
      logger.error('[Instagram Analyzer] ❌ Could not fetch profile info. Session may be expired.');
      return { success: false, error: 'profile_fetch_failed', message: 'Could not load profile info. Session cookie may be expired.' };
    }

    const userId = profileData.id;
    logger.info(`[Instagram Analyzer] Target user ID: ${userId}. Fetching followers via API...`);

    // 4. Fetch followers via friendships API (paginated)
    const allFollowers = [];
    let nextMaxId = null;
    let page_num = 0;

    while (allFollowers.length < limit) {
      const url = nextMaxId
        ? `https://www.instagram.com/api/v1/friendships/${userId}/followers/?count=50&max_id=${nextMaxId}`
        : `https://www.instagram.com/api/v1/friendships/${userId}/followers/?count=50`;

      const batchResult = await page.evaluate(async (fetchUrl) => {
        try {
          const res = await fetch(fetchUrl, {
            headers: {
              'x-ig-app-id': '936619743392459',
              'x-csrftoken': document.cookie.split('; ').find(r => r.startsWith('csrftoken='))?.split('=')[1] || '',
            }
          });
          if (!res.ok) {
            const text = await res.text();
            return { error: `HTTP ${res.status}: ${text.substring(0, 200)}` };
          }
          const json = await res.json();
          return json;
        } catch (e) {
          return { error: e.message };
        }
      }, url);

      if (batchResult.error) {
        logger.warn(`[Instagram Analyzer] Followers API error: ${batchResult.error}`);
        // Fallback: try the mobile API endpoint
        break;
      }

      const users = batchResult.users || [];
      logger.info(`[Instagram Analyzer] Page ${page_num + 1}: fetched ${users.length} followers`);

      if (users.length === 0) break;
      allFollowers.push(...users);

      nextMaxId = batchResult.next_max_id;
      if (!nextMaxId) break;
      page_num++;
      await page.waitForTimeout(1500); // rate limit buffer
    }

    const followersToAudit = allFollowers.slice(0, limit);
    logger.info(`[Instagram Analyzer] Collected ${followersToAudit.length} followers. Starting audit...`);

    if (followersToAudit.length === 0) {
      // Fallback: try to get follower usernames from DOM (public page)
      logger.warn('[Instagram Analyzer] API returned 0 followers. Trying DOM fallback...');
      return await this.scanFollowersDOMFallback(page, targetUsername, userId, limit);
    }

    // 5. Score each follower
    const auditedFollowers = [];
    
    for (let i = 0; i < followersToAudit.length; i++) {
      const follower = followersToAudit[i];
      const username = follower.username;
      logger.info(`[Instagram Analyzer] Auditing follower [${i + 1}/${followersToAudit.length}]: @${username}...`);

      try {
        // Fetch detailed profile stats
        const profileInfo = await page.evaluate(async (user) => {
          try {
            const res = await fetch(`https://www.instagram.com/api/v1/users/web_profile_info/?username=${user}`, {
              headers: { 'x-ig-app-id': '936619743392459' }
            });
            if (!res.ok) return null;
            const payload = await res.json();
            return payload.data?.user || null;
          } catch (e) {
            return null;
          }
        }, username);

        // Build user object from follower data + optional detailed profile
        const userObj = {
          username,
          name: profileInfo?.full_name || follower.full_name || username,
          biography: profileInfo?.biography || '',
          followers_count: profileInfo?.edge_followed_by?.count ?? follower.follower_count ?? 0,
          follows_count: profileInfo?.edge_follow?.count ?? follower.following_count ?? 0,
          media_count: profileInfo?.edge_owner_to_timeline_media?.count ?? 0,
          profile_picture_url: follower.profile_pic_url || null,
          is_verified: follower.is_verified || false,
          is_private: follower.is_private || false,
        };

        const analysis = this.scoreAccount(userObj);

        const result = {
          target_username: targetUsername,
          follower_username: username,
          display_name: userObj.name,
          profile_pic: userObj.profile_picture_url,
          followers_count: userObj.followers_count,
          following_count: userObj.follows_count,
          posts_count: userObj.media_count,
          bio: userObj.biography,
          bot_score: analysis.botScore,
          verdict: analysis.verdict,
          signals: JSON.stringify(analysis.signals)
        };

        // Save to database
        try {
          await db.query(`
            INSERT INTO instagram_bot_audit 
            (target_username, follower_username, display_name, profile_pic, followers_count, following_count, posts_count, bio, bot_score, verdict, signals, scanned_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
            ON CONFLICT (target_username, follower_username) 
            DO UPDATE SET 
              display_name = EXCLUDED.display_name,
              profile_pic = EXCLUDED.profile_pic,
              followers_count = EXCLUDED.followers_count,
              following_count = EXCLUDED.following_count,
              posts_count = EXCLUDED.posts_count,
              bio = EXCLUDED.bio,
              bot_score = EXCLUDED.bot_score,
              verdict = EXCLUDED.verdict,
              signals = EXCLUDED.signals,
              scanned_at = NOW()
          `, [
            result.target_username,
            result.follower_username,
            result.display_name,
            result.profile_pic,
            result.followers_count,
            result.following_count,
            result.posts_count,
            result.bio,
            result.bot_score,
            result.verdict,
            result.signals
          ], 'Database', 'upsert_bot_audit');
        } catch (dbErr) {
          logger.warn(`[Instagram Analyzer] DB save failed for @${username}: ${dbErr.message}`);
        }

        auditedFollowers.push({
          follower_username: result.follower_username,
          display_name: result.display_name,
          profile_pic: result.profile_pic,
          followers_count: result.followers_count,
          following_count: result.following_count,
          posts_count: result.posts_count,
          bio: result.bio,
          bot_score: result.bot_score,
          verdict: result.verdict,
          is_verified: userObj.is_verified,
          is_private: userObj.is_private,
          signals: analysis.signals
        });
      } catch (err) {
        logger.error(`[Instagram Analyzer] Error auditing @${username}: ${err.message}`);
      }

      // Safe delay between user fetches to avoid rate limit
      if (i < followersToAudit.length - 1) {
        await page.waitForTimeout(1500);
      }
    }

    logger.info(`[Instagram Analyzer] ✅ Follower Bot Audit completed. Audited ${auditedFollowers.length} followers.`);
    return { success: true, count: auditedFollowers.length, followers: auditedFollowers };
  }

  /**
   * DOM fallback: Extracts follower usernames from the followers link on a public profile page.
   * Only works for a small batch since it relies on what's visible in the UI.
   */
  async scanFollowersDOMFallback(page, targetUsername, userId, limit) {
    logger.info('[Instagram Analyzer] DOM Fallback: Navigating to profile to click followers...');

    await page.goto(`https://www.instagram.com/${targetUsername}/`, { timeout: 30000, waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);

    // Find followers link by text content (href is just /#)
    const clicked = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      const followersLink = links.find(a => /\d+\s+followers/i.test(a.textContent));
      if (followersLink) {
        followersLink.click();
        return true;
      }
      return false;
    });

    if (!clicked) {
      logger.error('[Instagram Analyzer] ❌ DOM fallback: Could not find followers link.');
      return { success: false, error: 'followers_link_not_found' };
    }

    logger.info('[Instagram Analyzer] Clicked followers link. Waiting for dialog...');
    await page.waitForTimeout(2000);

    // Wait for dialog or login prompt
    const dialogVisible = await page.locator('div[role="dialog"]').count();
    if (!dialogVisible) {
      logger.error('[Instagram Analyzer] ❌ DOM fallback: Followers dialog did not open (may require login).');
      return {
        success: false,
        error: 'auth_required',
        message: 'Opening followers list requires authentication. Please update the Instagram Session Cookie in Meta Settings.'
      };
    }

    logger.info('[Instagram Analyzer] Dialog opened. Scrolling to collect follower usernames...');

    const usernames = await page.evaluate(async (maxLimit) => {
      const dialogEl = document.querySelector('div[role="dialog"]');
      if (!dialogEl) return [];

      const scrollable = Array.from(dialogEl.querySelectorAll('div')).find(
        el => window.getComputedStyle(el).overflowY === 'auto' || window.getComputedStyle(el).overflowY === 'scroll'
      ) || dialogEl;

      const collected = new Set();
      let scrollAttempts = 0;
      const maxScrolls = 20;

      while (collected.size < maxLimit && scrollAttempts < maxScrolls) {
        const anchors = Array.from(dialogEl.querySelectorAll('a'));
        anchors.forEach(a => {
          const href = a.getAttribute('href') || '';
          const match = href.match(/^\/([a-zA-Z0-9_\.]+)\/$/)
          if (match) {
            const user = match[1];
            const ignore = ['explore', 'about', 'developer', 'directory', 'legal', 'privacy', 'terms'];
            if (!ignore.includes(user)) collected.add(user);
          }
        });

        if (collected.size >= maxLimit) break;
        scrollable.scrollTop = scrollable.scrollHeight;
        await new Promise(r => setTimeout(r, 1200));
        scrollAttempts++;
      }

      return Array.from(collected).slice(0, maxLimit);
    }, limit);

    logger.info(`[Instagram Analyzer] DOM fallback collected ${usernames.length} followers.`);

    if (usernames.length === 0) {
      return { success: false, error: 'no_followers_found' };
    }

    // Score them without detailed profile (we only have the username)
    const auditedFollowers = [];
    for (const username of usernames) {
      const basicProfile = { username, name: username, biography: '', followers_count: 0, follows_count: 0, media_count: 0 };
      const analysis = this.scoreAccount(basicProfile);
      auditedFollowers.push({
        follower_username: username,
        display_name: username,
        profile_pic: null,
        followers_count: 0,
        following_count: 0,
        posts_count: 0,
        bio: '',
        bot_score: analysis.botScore,
        verdict: analysis.verdict,
        signals: analysis.signals
      });
    }

    return { success: true, count: auditedFollowers.length, followers: auditedFollowers };
  }
}

module.exports = new InstagramBotScanner();
