// backend/providers/instagram/profile.js

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

      // Exact DOM stats extraction from spans/links/buttons containing "follower", "following", "posts"
      let domFollowers = null, domFollowing = null, domPosts = null;
      
      const elements = Array.from(document.querySelectorAll('span, a, button, li'));
      elements.forEach(el => {
        const text = (el.innerText || '').trim();
        const lower = text.toLowerCase();
        
        if (lower.endsWith(' followers') || lower.endsWith(' follower') || lower === 'followers' || lower === 'follower') {
          const titleVal = el.getAttribute('title');
          if (titleVal && titleVal.match(/^[\d,]+$/)) {
            domFollowers = cleanNum(titleVal);
          } else {
            // Find parent/sibling numbers
            const m = text.match(/([\d,.\sMK]+)/i);
            if (m) domFollowers = cleanNum(m[1]);
          }
        } else if (lower.endsWith(' following') || lower === 'following') {
          const titleVal = el.getAttribute('title');
          if (titleVal && titleVal.match(/^[\d,]+$/)) {
            domFollowing = cleanNum(titleVal);
          } else {
            const m = text.match(/([\d,.\sMK]+)/i);
            if (m) domFollowing = cleanNum(m[1]);
          }
        } else if (lower.endsWith(' posts') || lower.endsWith(' post') || lower === 'posts' || lower === 'post') {
          const titleVal = el.getAttribute('title');
          if (titleVal && titleVal.match(/^[\d,]+$/)) {
            domPosts = cleanNum(titleVal);
          } else {
            const m = text.match(/([\d,.\sMK]+)/i);
            if (m) domPosts = cleanNum(m[1]);
          }
        }
      });

      // Bio links from header (Global DOM matching - works for both logged-in and public pages)
      const bioLinks = [];
      const seen = new Set();
      
      Array.from(document.querySelectorAll('a')).forEach(a => {
        const href = a.getAttribute('href') || '';
        let targetUrl = href;
        let isBioLink = false;

        if (href.includes('l.instagram.com/?u=')) {
          isBioLink = true;
          try {
            const u = new URL(href);
            targetUrl = decodeURIComponent(u.searchParams.get('u') || href);
          } catch (_) {}
        } else if (href && !href.startsWith('/') && !href.includes('instagram.com') && href !== '#') {
          isBioLink = true;
        }

        if (isBioLink && targetUrl && !seen.has(targetUrl)) {
          seen.add(targetUrl);
          const text = (a.innerText || '').trim();
          bioLinks.push({ text: text || targetUrl, href: targetUrl });
        }
      });

      const isVerified = !!document.querySelector('svg[aria-label="Verified"]');

      // Bio text from spans
      const textParts = [];
      const bioSpans = Array.from(document.querySelectorAll(
        'main header section h1 ~ div span, main header section h2 ~ div span, main header section h1 ~ span, main header section h2 ~ span, main header section h1 ~ div div, main header section h2 ~ div div'
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
