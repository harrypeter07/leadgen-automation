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
    const excludeList = ['p', 'reel', 'reels', 'explore', 'developer', 'about', 'legal', 'help', 'terms', 'privacy', 'accounts', 'stories', 'emails', 'tags', 'tv'];

    // 2. Perform searches via TinyFish Search API to bypass Google CAPTCHAs
    for (const q of searchQueries) {
      try {
        logger.info(`[Instagram Provider] Querying TinyFish Search: "${q}"`);
        const response = await tfSearch.search(q);
        const results = (response && response.results) || [];

        for (const item of results) {
          const link = item.url || item.website || '';
          if (link.includes('instagram.com/')) {
            try {
              const u = new URL(link);
              const parts = u.pathname.split('/').filter(Boolean);
              if (parts.length > 0) {
                const username = parts[0].toLowerCase();
                if (username && !excludeList.includes(username) && /^[a-zA-Z0-9_.-]+$/.test(username)) {
                  harvestedUrls.add(`https://www.instagram.com/${username}/`);
                }
              }
            } catch (err) {
              const match = link.match(/instagram\.com\/([a-zA-Z0-9_.-]+)/);
              if (match) {
                const username = match[1].toLowerCase();
                if (username && !excludeList.includes(username)) {
                  harvestedUrls.add(`https://www.instagram.com/${username}/`);
                }
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

  async extract(page, cardIndex, job) {
    const url = this.profileUrls && this.profileUrls[cardIndex];
    if (!url) return null;

    if (url.includes('threads.net')) {
      logger.info(`[Instagram Provider] Discarding thread profile URL: ${url}`);
      return null;
    }

    const match = url.match(/instagram\.com\/([a-zA-Z0-9_.-]+)/);
    const username = match ? match[1] : 'instagram_user';

    logger.info(`[Instagram Provider] Visiting profile: ${url}`);

    // Parse filter query parameters from CWD job specification
    let minFollowers = 0;
    let maxFollowers = Infinity;
    let reachAmount = 0;

    if (job && typeof job.current_provider === 'string' && job.current_provider.includes('?')) {
      const qStr = job.current_provider.split('?')[1];
      const params = new URLSearchParams(qStr);
      minFollowers = parseInt(params.get('minFollowers') || '0', 10);
      maxFollowers = parseInt(params.get('maxFollowers') || '999999999', 10);
      reachAmount = parseInt(params.get('reachAmount') || '0', 10);
    }
    
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
      profileInfo = {
        display_name: username,
        bio: 'Failed to retrieve profile description.',
        website: url,
        followers: 0,
        verified: false
      };
    }

    const followers = profileInfo.followers || 0;
    const estimatedReach = Math.round(followers * 0.35);

    // Apply followers count filter rules
    if (followers < minFollowers || followers > maxFollowers) {
      const logMsg = `[Instagram Scraper] Discarded @${username} (Followers: ${followers} not in range ${minFollowers}-${maxFollowers === Infinity ? 'any' : maxFollowers})`;
      logger.info(logMsg);
      if (job && Array.isArray(job.logs)) {
        job.logs.push(`[${new Date().toISOString()}] ${logMsg}`);
      }
      return null;
    }

    // Apply reach threshold filter rules
    if (estimatedReach < reachAmount) {
      const logMsg = `[Instagram Scraper] Discarded @${username} (Estimated Reach: ${estimatedReach} is below requested ${reachAmount})`;
      logger.info(logMsg);
      if (job && Array.isArray(job.logs)) {
        job.logs.push(`[${new Date().toISOString()}] ${logMsg}`);
      }
      return null;
    }

    // Call Gemini to parse bio into contact info
    const aiExtracted = await aiService.extractInstagramLead(
      profileInfo.display_name,
      profileInfo.bio || '',
      ''
    );

    let email = aiExtracted.email || null;
    let phone = aiExtracted.phone || null;

    if (!email && !phone) {
      // Check website fallback
      const website = profileInfo.website || (profileInfo.bio_links && profileInfo.bio_links[0]?.href);
      if (website && website.startsWith('http') && !website.includes('instagram.com') && !website.includes('threads.net')) {
        logger.info(`[Instagram Provider] No contact in bio of @${username}. Inspecting website: ${website}`);
        if (job && Array.isArray(job.logs)) {
          job.logs.push(`[${new Date().toISOString()}] [Website Scan] Scraping contact from website: ${website}`);
        }

        try {
          const emailScraper = require('../../services/emailScraper');
          const webPage = await page.context().newPage();
          const scraped = await emailScraper.scrapeContactDetails(webPage, website);
          await webPage.close().catch(() => {});

          if (scraped.email) {
            // Apply natural language username/name comparison check
            const matched = isEmailMatchingName(scraped.email, username, profileInfo.display_name);
            if (matched) {
              email = scraped.email;
              logger.info(`[Instagram Provider] Email matched profile name identity: ${email}`);
            } else {
              const discardMsg = `[Website Scan] Discarded scraped email ${scraped.email} (failed identity match verification for @${username}).`;
              logger.warn(discardMsg);
              if (job && Array.isArray(job.logs)) {
                job.logs.push(`[${new Date().toISOString()}] ${discardMsg}`);
              }
            }
          }
          if (scraped.phone) {
            phone = scraped.phone;
          }
        } catch (webErr) {
          logger.warn(`[Instagram Provider] Web scraping exception: ${webErr.message}`);
        }
      }
    }

    // Discard completely if still no contact details
    if (!email && !phone) {
      const discardMsg = `[Instagram Scraper] Discarded @${username} (Reason: No contact details found in bio or website link).`;
      logger.info(discardMsg);
      if (job && Array.isArray(job.logs)) {
        job.logs.push(`[${new Date().toISOString()}] ${discardMsg}`);
      }
      return null;
    }

    const logMsg = `[Instagram Scraper] Kept @${username} (Followers: ${followers}, Email: ${email || 'none'}, Phone: ${phone || 'none'})`;
    if (job && Array.isArray(job.logs)) {
      job.logs.push(`[${new Date().toISOString()}] ${logMsg}`);
    }

    return {
      name: profileInfo.display_name || username,
      phone,
      email,
      address: aiExtracted.address || null,
      category: aiExtracted.category || 'Instagram Profile',
      website: profileInfo.website || url,
      snippet: `Followers: ${followers} · Following: ${profileInfo.following || 0} · Reach: ${estimatedReach} · Bio: ${profileInfo.bio || 'None'} · Verified: ${profileInfo.verified || false}`,
      instagram_followers: followers,
      instagram_following: profileInfo.following || 0,
      instagram_reach: estimatedReach,
      instagram_bio: profileInfo.bio || '',
      instagram_verified: profileInfo.verified || false
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
      status: 'new',
      enrichment_fields: {
        instagram_followers: raw.instagram_followers,
        instagram_following: raw.instagram_following,
        instagram_reach: raw.instagram_reach,
        instagram_bio: raw.instagram_bio,
        instagram_verified: raw.instagram_verified
      },
      instagram_followers: raw.instagram_followers,
      instagram_following: raw.instagram_following,
      instagram_reach: raw.instagram_reach,
      instagram_bio: raw.instagram_bio,
      instagram_verified: raw.instagram_verified
    };
  }
}

// Natural language string matching between email address and Instagram profile name/username
function isEmailMatchingName(email, username, displayName) {
  if (!email || !email.includes('@')) return false;
  const localPart = email.split('@')[0].toLowerCase();
  const domainPart = email.split('@')[1].split('.')[0].toLowerCase();

  const clean = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
  const nameTokens = clean(displayName).split(/\s+/).filter(t => t.length >= 3 && !['doctor', 'dentist', 'clinic', 'medical'].includes(t));
  const userTokens = clean(username).split(/\s+/).filter(t => t.length >= 3 && !['doctor', 'dentist', 'clinic', 'medical'].includes(t));
  
  const tokens = Array.from(new Set([...nameTokens, ...userTokens]));
  if (tokens.length === 0) return true; // fallback if no name parts extracted

  for (const token of tokens) {
    if (localPart.includes(token) || domainPart.includes(token)) {
      return true;
    }
  }
  return false;
}

module.exports = InstagramProvider;
