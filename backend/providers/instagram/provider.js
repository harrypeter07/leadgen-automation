// backend/providers/instagram/provider.js

const logger = require('../../worker/logger');
const profileFetcher = require('./profile');
const aiService = require('../../services/aiService');
const tfSearch = require('../tinyfish/search');

class InstagramProvider {
  constructor() {
    this.name = 'instagram';
    this.profileUrls = [];
  }

  async search(page, query) {
    logger.info(`[Instagram Provider] Initiating query planning with Gemini for keyword: "${query.keyword}" in "${query.city}"`);
    
    // 1. Generate optimized Instagram search queries using Gemini decider
    const searchQueries = await aiService.planInstagramSearch(query.keyword, query.city);
    logger.info(`[Instagram Provider] Generated queries: ${JSON.stringify(searchQueries)}`);

    const harvestedUrls = new Set();
    const excludeList = ['p', 'explore', 'developer', 'about', 'legal', 'help', 'terms', 'privacy', 'accounts', 'stories', 'emails', 'explore/tags', 'tags'];

    // 2. Perform searches via TinyFish Search API to bypass Google CAPTCHAs
    for (const q of searchQueries) {
      try {
        logger.info(`[Instagram Provider] Querying TinyFish Search: "${q}"`);
        const response = await tfSearch.search(q);
        const results = (response && response.results) || [];

        for (const item of results) {
          const link = item.url || item.website || '';
          if (link.includes('instagram.com/')) {
            const match = link.match(/instagram\.com\/([a-zA-Z0-9_.-]+)/);
            if (match) {
              const username = match[1].toLowerCase();
              if (username && !excludeList.includes(username)) {
                harvestedUrls.add(`https://www.instagram.com/${username}/`);
              }
            }
          }
        }
      } catch (err) {
        logger.warn(`[Instagram Provider] TinyFish search query failed for "${q}": ${err.message}`);
      }
    }

    this.profileUrls = Array.from(harvestedUrls);
    logger.info(`[Instagram Provider] Successfully harvested ${this.profileUrls.length} Instagram profile URLs.`);
  }

  async collect(page, maxLeads) {
    const list = this.profileUrls.slice(0, maxLeads);
    this.profileUrls = list;
    return this.profileUrls.length;
  }

  async extract(page, cardIndex) {
    const url = this.profileUrls && this.profileUrls[cardIndex];
    if (!url) return null;

    const match = url.match(/instagram\.com\/([a-zA-Z0-9_.-]+)/);
    const username = match ? match[1] : 'instagram_user';

    logger.info(`[Instagram Provider] Visiting profile: ${url}`);
    
    // Visit page via Playwright
    await page.goto(url, { timeout: 20000, waitUntil: 'domcontentloaded' }).catch(() => {});
    
    // Extract metadata using profile fetcher
    let profileInfo = await profileFetcher.fetch(page);
    
    // Fallback: Fetch via TinyFish Fetch API (uses proxy pools to bypass Instagram's login redirects)
    if (!profileInfo) {
      logger.info(`[Instagram Provider] Public profile extraction blocked. Attempting TinyFish Proxy fetch for: ${url}`);
      try {
        const tfFetch = require('../tinyfish/fetch');
        const fetchRes = await tfFetch.fetchUrls([url]);
        if (fetchRes && fetchRes.results && fetchRes.results.length > 0) {
          const text = fetchRes.results[0].text || '';
          profileInfo = {
            display_name: username,
            bio: text.slice(0, 800),
            website: url,
            followers: 0,
            verified: false
          };
        }
      } catch (err) {
        logger.warn(`[Instagram Provider] TinyFish fallback fetch failed: ${err.message}`);
      }
    }

    if (!profileInfo) {
      // Return a basic placeholder if both failed
      profileInfo = {
        display_name: username,
        bio: 'Failed to retrieve profile description.',
        website: url,
        followers: 0,
        verified: false
      };
    }

    // Call Gemini to parse bio into contact info
    const aiExtracted = await aiService.extractInstagramLead(
      profileInfo.display_name,
      profileInfo.bio || '',
      ''
    );

    return {
      name: profileInfo.display_name || username,
      phone: aiExtracted.phone || null,
      email: aiExtracted.email || null,
      address: aiExtracted.address || null,
      category: aiExtracted.category || 'Instagram Profile',
      website: profileInfo.website || url,
      snippet: `Followers: ${profileInfo.followers || 0} · Bio: ${profileInfo.bio || 'None'} · Verified: ${profileInfo.verified || false}`
    };
  }

  normalize(raw, city) {
    return {
      name: raw.name,
      phone: raw.phone,
      email: raw.email,
      address: raw.address,
      city: city ? city.toLowerCase().replace(/(?:^|\s|-)\S/g, match => match.toUpperCase()).trim() : '',
      category: raw.category || 'Instagram Profile',
      website: raw.website,
      notes: raw.snippet || '',
      source: 'instagram',
      status: 'new'
    };
  }
}

module.exports = InstagramProvider;
