// backend/api/enrich.js

const express = require('express');
const dns = require('dns').promises;
const axios = require('axios');
const logger = require('../worker/logger');
const browserManager = require('../worker/browserManager');
const emailScraper = require('../services/emailScraper');
const tfSearch = require('../providers/tinyfish/search');
const tfFetch = require('../providers/tinyfish/fetch');

const router = express.Router();

function formatResponse(res, data) {
  res.json(data);
}

// 1. POST /api/enrich/website-email
router.post('/website-email', async (req, res) => {
  const { website } = req.body || {};
  if (!website) {
    return res.status(400).json({ error: 'website parameter is required' });
  }

  try {
    const { context, contextId } = await browserManager.newContext();
    const { page, pageId } = await browserManager.newPage(contextId, context);
    
    let email = null;
    try {
      email = await emailScraper.scrapeEmail(page, website);
    } finally {
      await browserManager.releasePage(pageId);
      await browserManager.releaseContext(contextId);
    }

    formatResponse(res, { email });
  } catch (err) {
    logger.error(`[Enrich API] website-email failed: ${err.message}`);
    formatResponse(res, { error: err.message });
  }
});

// 2. POST /api/enrich/facebook
router.post('/facebook', async (req, res) => {
  const { business_name, city } = req.body || {};
  if (!business_name) {
    return res.status(400).json({ error: 'business_name parameter is required' });
  }

  try {
    const query = `site:facebook.com "${business_name}" "${city || ''}"`;
    logger.info(`[Enrich API] Querying TinyFish Search for Facebook page: "${query}"`);
    const searchRes = await tfSearch.search(query);
    const results = (searchRes && searchRes.results) || [];
    
    let facebookUrl = null;
    for (const item of results) {
      const link = item.url || item.website || '';
      if (link.includes('facebook.com/')) {
        facebookUrl = link;
        break;
      }
    }

    if (!facebookUrl) {
      return formatResponse(res, { email: null, phone: null, website: null });
    }

    const cleanUrl = facebookUrl.endsWith('/') ? facebookUrl.slice(0, -1) : facebookUrl;
    const aboutUrl = cleanUrl.includes('?') ? `${cleanUrl}&v=info` : `${cleanUrl}/about`;
    logger.info(`[Enrich API] Fetching Facebook About Page: "${aboutUrl}"`);
    
    let text = '';
    try {
      const fetchRes = await tfFetch.fetchUrls([aboutUrl]);
      if (fetchRes && fetchRes.results && fetchRes.results.length > 0) {
        text = fetchRes.results[0].text || '';
      }
    } catch (fetchErr) {
      logger.warn(`[Enrich API] TinyFish Fetch failed, falling back to Playwright: ${fetchErr.message}`);
      const { context, contextId } = await browserManager.newContext();
      const { page, pageId } = await browserManager.newPage(contextId, context);
      try {
        await page.goto(aboutUrl, { timeout: 15000, waitUntil: 'domcontentloaded' }).catch(() => {});
        text = await page.evaluate(() => document.body ? document.body.innerText : '');
      } finally {
        await browserManager.releasePage(pageId);
        await browserManager.releaseContext(contextId);
      }
    }

    // Extract details via regex
    const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    
    // Support US 10-digit, SG 8-digit, and general international phone numbers
    const phoneMatch = text.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{4}/) || text.match(/\+?\d[\d\s.-]{7,15}\d/);
    
    let website = null;
    const urlMatches = text.match(/https?:\/\/[^\s$.?#].[^\s]*/g) || [];
    for (const u of urlMatches) {
      if (!u.includes('facebook.com') && !u.includes('fb.me')) {
        website = u.replace(/[.,;]$/, '');
        break;
      }
    }

    formatResponse(res, {
      email: emailMatch ? emailMatch[0] : null,
      phone: phoneMatch ? phoneMatch[0] : null,
      website: website || null
    });
  } catch (err) {
    logger.error(`[Enrich API] facebook failed: ${err.message}`);
    formatResponse(res, { error: err.message });
  }
});

// 3. POST /api/enrich/reddit
router.post('/reddit', async (req, res) => {
  const { query } = req.body || {};
  if (!query) {
    return res.status(400).json({ error: 'query parameter is required' });
  }

  try {
    let mentions = [];
    try {
      const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&sort=new&limit=25`;
      const response = await axios.get(url, {
        headers: { 'User-Agent': 'LeadGenBot/3.0.0 (by /u/leadgen_automation)' },
        timeout: 8000
      });
      const children = response.data?.data?.children || [];
      mentions = children.map(c => ({
        text: (c.data.title || '') + '\n' + (c.data.selftext || ''),
        subreddit: c.data.subreddit || '',
        permalink: `https://reddit.com${c.data.permalink}`
      }));
    } catch (apiErr) {
      logger.warn(`[Enrich API] Reddit direct API failed (${apiErr.message}), falling back to TinyFish Search...`);
      const searchQuery = `site:reddit.com ${query}`;
      const searchRes = await tfSearch.search(searchQuery);
      const results = (searchRes && searchRes.results) || [];
      mentions = results.map(r => ({
        text: (r.title || '') + '\n' + (r.snippet || ''),
        subreddit: (r.url || r.website || '').match(/reddit\.com\/r\/([^/]+)/)?.[1] || 'reddit',
        permalink: r.url || r.website || ''
      }));
    }

    formatResponse(res, { mentions });
  } catch (err) {
    logger.error(`[Enrich API] reddit failed: ${err.message}`);
    formatResponse(res, { error: err.message });
  }
});

// 4. POST /api/enrich/linkedin
router.post('/linkedin', async (req, res) => {
  const { business_name } = req.body || {};
  if (!business_name) {
    return res.status(400).json({ error: 'business_name parameter is required' });
  }

  try {
    let owner_name = null;
    let linkedinUrl = null;
    
    try {
      const apiKey = process.env.TINYFISH_API_KEY || 'sk-tinyfish-0YxHuvbi-dw9Hfh7ynR7mRI9HixoEoQS';
      const goalText = `Find the LinkedIn profile and owner/executive name of the business "${business_name}". Return a JSON object with: owner_name (string), linkedin (url).`;
      
      const response = await axios.post('https://api.agent.tinyfish.ai',
        {
          goal: goalText,
          provider: 'linkedin',
          options: { temperature: 0.2 }
        },
        {
          headers: {
            'X-API-Key': apiKey,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        }
      );
      
      if (response.data && response.data.results) {
        const result = response.data.results;
        owner_name = result.owner_name || null;
        linkedinUrl = result.linkedin || null;
      }
    } catch (agentErr) {
      logger.warn(`[Enrich API] TinyFish Agent API call failed: ${agentErr.message}`);
    }

    if (!linkedinUrl) {
      const query = `site:linkedin.com "${business_name}" (owner OR CEO OR founder OR director)`;
      logger.info(`[Enrich API] Querying TinyFish Search for LinkedIn: "${query}"`);
      const searchRes = await tfSearch.search(query);
      const results = (searchRes && searchRes.results) || [];
      
      if (results.length > 0) {
        const first = results[0];
        linkedinUrl = first.url || first.website || null;
        
        try {
          const prompt = `Extract only the person name from this LinkedIn search result title: "${first.title}". Return a JSON object: {"name": "string"}`;
          const responseJsonText = await require('../providers/gemini/client').generateContent(prompt, true);
          const parsed = JSON.parse(responseJsonText);
          owner_name = parsed.name || first.title.split('-')[0].trim();
        } catch (_) {
          owner_name = first.title.split('-')[0].trim();
        }
      }
    }

    formatResponse(res, {
      owner_name: owner_name || null,
      linkedin: linkedinUrl || null
    });
  } catch (err) {
    logger.error(`[Enrich API] linkedin failed: ${err.message}`);
    formatResponse(res, { error: err.message });
  }
});

// 5. POST /api/enrich/email-pattern
router.post('/email-pattern', async (req, res) => {
  const { owner_name, domain } = req.body || {};
  if (!owner_name || !domain) {
    return res.status(400).json({ error: 'owner_name and domain parameters are required' });
  }

  try {
    const prompt = `
      Given the business owner name "${owner_name}" and the website domain "${domain}",
      guess the most likely professional business email address for this person.
      
      Return a clean JSON object containing:
      {
        "email": "guessed@domain.com"
      }
    `;

    let email = `${owner_name.toLowerCase().replace(/\s+/g, '')}@${domain}`;
    try {
      const responseJsonText = await require('../providers/gemini/client').generateContent(prompt, true);
      const parsed = JSON.parse(responseJsonText);
      email = parsed.email || email;
    } catch (_) {}

    formatResponse(res, { email });
  } catch (err) {
    logger.error(`[Enrich API] email-pattern failed: ${err.message}`);
    formatResponse(res, { error: err.message });
  }
});

// 6. POST /api/enrich/email-verify
router.post('/email-verify', async (req, res) => {
  const { email } = req.body || {};
  if (!email) {
    return res.status(400).json({ error: 'email parameter is required' });
  }

  try {
    const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!regex.test(email)) {
      return formatResponse(res, { valid: false, reason: 'Invalid email syntax format' });
    }

    const domain = email.split('@')[1];
    try {
      const mxRecords = await dns.resolveMx(domain);
      if (!mxRecords || mxRecords.length === 0) {
        return formatResponse(res, { valid: false, reason: 'No MX records found for domain' });
      }
      formatResponse(res, { valid: true });
    } catch (err) {
      formatResponse(res, { valid: false, reason: `MX record lookup failed: ${err.message}` });
    }
  } catch (err) {
    logger.error(`[Enrich API] email-verify failed: ${err.message}`);
    formatResponse(res, { error: err.message });
  }
});

module.exports = router;
