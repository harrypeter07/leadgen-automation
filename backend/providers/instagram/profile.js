// backend/providers/instagram/profile.js
//
// Fetches Instagram profile data by intercepting the API response
// from /api/v1/users/web_profile_info/?username=<username>
// This gives us: biography, bio_links, external_url, followers, following, posts, verified
//
// Falls back to meta description parsing if the API response isn't captured.

const logger = require('../../worker/logger');

class InstagramProfileFetcher {
  /**
   * @param {import('playwright').Page} page - Page already navigated to the profile URL
   * @param {string} apiData - Optional pre-captured API JSON string (from interceptor)
   */
  async fetch(page, apiData = null) {
    // ── Strategy 1: Parse pre-captured API response ─────────────────────────
    if (apiData) {
      try {
        const parsed = JSON.parse(apiData);
        const user =
          parsed?.data?.user ||
          parsed?.graphql?.user;

        if (user) {
          logger.info(`[Profile] Extracted from intercepted API response: ${user.full_name}`);
          return this._fromApiUser(user);
        }
      } catch (e) {
        logger.warn(`[Profile] Failed to parse pre-captured API data: ${e.message}`);
      }
    }

    // ── Strategy 2: page.evaluate — read meta + DOM ──────────────────────────
    return await page.evaluate(() => {
      const descNode = document.querySelector('meta[name="description"]');
      const desc = descNode ? descNode.getAttribute('content') : '';

      const cleanNum = (str) => {
        if (!str) return 0;
        let s = str.trim().toUpperCase().replace(/,/g, '');
        if (s.includes('K')) return Math.round(parseFloat(s) * 1000);
        if (s.includes('M')) return Math.round(parseFloat(s) * 1000000);
        return parseInt(s, 10) || 0;
      };

      // DOM stats from anchors
      let domFollowers = null, domFollowing = null, domPosts = null;
      Array.from(document.querySelectorAll('a')).forEach(a => {
        const text = a.innerText || '';
        const lower = text.toLowerCase();
        if (lower.includes('follower')) {
          const m = text.match(/([\d,.\sMK]+)/i);
          if (m) domFollowers = cleanNum(m[1]);
        } else if (lower.includes('following')) {
          const m = text.match(/([\d,.\sMK]+)/i);
          if (m) domFollowing = cleanNum(m[1]);
        } else if (lower.includes('post')) {
          const m = text.match(/([\d,.\sMK]+)/i);
          if (m) domPosts = cleanNum(m[1]);
        }
      });

      // Bio links from header (DOM — works when session is active)
      const bioLinks = [];
      const headerSection = document.querySelector('main header section') || document.querySelector('header');
      if (headerSection) {
        const seen = new Set();
        Array.from(headerSection.querySelectorAll('a[href]')).forEach(a => {
          const href = a.getAttribute('href') || '';
          const text = (a.innerText || '').trim();
          let targetUrl = href;

          if (href.includes('l.instagram.com/?u=')) {
            try {
              const u = new URL(href);
              targetUrl = decodeURIComponent(u.searchParams.get('u') || href);
            } catch (_) {}
          }

          const isExternal = href.includes('l.instagram.com/?u=') ||
            (href && !href.startsWith('/') && !href.includes('instagram.com') && href !== '#');

          if (isExternal && targetUrl && !seen.has(targetUrl)) {
            seen.add(targetUrl);
            bioLinks.push({ text: text || targetUrl, href: targetUrl });
          }
        });
      }

      const isVerified = !!document.querySelector('svg[aria-label="Verified"]');

      // Bio text from spans
      const textParts = [];
      const bioSpans = Array.from(document.querySelectorAll(
        'main header section h1 ~ div span, main header section h2 ~ div span, main header section h1 ~ span, main header section h2 ~ span'
      ));
      bioSpans.forEach(el => {
        const text = (el.innerText || '').trim();
        if (text && text.length > 0 && text.length < 500 &&
            !text.includes('followers') && !text.includes('following') &&
            !text.includes('posts') && !text.includes('Follow') && !text.includes('Message') &&
            !textParts.includes(text)) {
          textParts.push(text);
        }
      });
      const combinedBio = textParts.length > 0 ? textParts.join('\n') : null;

      // Parse meta description for stats
      const regex = /([\d,.\sMK]+)\s*Followers,\s*([\d,.\sMK]+)\s*Following,\s*([\d,.\sMK]+)\s*Posts\s*-\s*([^(@]+)\s*\((@?\w+)\)\s*on Instagram(?::\s*"?(.*?)"?)?$/is;
      const matches = desc ? desc.match(regex) : null;

      if (matches) {
        return {
          display_name: matches[4].trim(),
          bio: combinedBio || matches[6]?.trim() || null,
          website: bioLinks[0]?.href || null,
          bio_links: bioLinks,
          followers: domFollowers ?? cleanNum(matches[1]),
          following: domFollowing ?? cleanNum(matches[2]),
          posts_count: domPosts ?? cleanNum(matches[3]),
          verified: isVerified,
        };
      }

      // Final fallback: h2 + DOM stats
      const headerEl = document.querySelector('h2');
      const displayName = headerEl ? headerEl.innerText.trim() : null;
      if (!displayName) return null;

      return {
        display_name: displayName,
        bio: combinedBio || null,
        website: bioLinks[0]?.href || null,
        bio_links: bioLinks,
        followers: domFollowers || 0,
        following: domFollowing || 0,
        posts_count: domPosts || 0,
        verified: isVerified,
      };
    }).catch(() => null);
  }

  /** Maps Instagram API user object → our standard profile shape */
  _fromApiUser(user) {
    const cleanBioLinks = (user.bio_links || [])
      .filter(l => l.url || l.lynx_url)
      .map(l => {
        let href = l.url || l.lynx_url || '';
        // Decode lynx_url if url is missing
        if (!l.url && l.lynx_url && l.lynx_url.includes('l.instagram.com/?u=')) {
          try {
            const u = new URL(l.lynx_url);
            href = decodeURIComponent(u.searchParams.get('u') || l.lynx_url);
          } catch (_) {}
        }
        return { text: l.title || href, href };
      });

    return {
      display_name: user.full_name || user.username,
      bio: user.biography || null,
      website: user.external_url || cleanBioLinks[0]?.href || null,
      bio_links: cleanBioLinks,
      followers: user.edge_followed_by?.count ?? user.follower_count ?? 0,
      following: user.edge_follow?.count ?? user.following_count ?? 0,
      posts_count: user.edge_owner_to_timeline_media?.count ?? user.media_count ?? 0,
      verified: user.is_verified || false,
    };
  }
}

module.exports = new InstagramProfileFetcher();
