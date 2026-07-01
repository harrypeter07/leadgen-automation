// backend/providers/googleSearch/provider.js

const logger = require('../../worker/logger');

class GoogleSearchProvider {
  constructor() {
    this.name = 'google_search';
  }

  async search(page, query) {
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query.keyword + ' ' + query.city)}`;
    logger.info(`[Google Search] Searching: ${searchUrl}`);
    await page.goto(searchUrl, { timeout: 15000, waitUntil: 'domcontentloaded' });
  }

  async collect(page, maxLeads) {
    const links = await page.evalOnSelectorAll(
      '#search a[href^="http"]',
      els => els.map(e => e.href)
    );
    return links.slice(0, maxLeads);
  }

  async extract(page, url) {
    await page.goto(url, { timeout: 15000, waitUntil: 'domcontentloaded' }).catch(() => {});
    const title = await page.title().catch(() => 'Unknown Page');
    
    return {
      name: title.split('-')[0].trim(),
      website: url,
      address: null,
      phone: null,
      rating: null,
      reviews: null,
      category: 'Search Result',
    };
  }

  normalize(raw, city) {
    return {
      name: raw.name || 'Organic Lead',
      phone: null,
      email: null,
      address: null,
      city: city || null,
      category: raw.category || null,
      website: raw.website,
      rating: null,
      review_count: null,
      source: 'google_search',
      status: 'new',
    };
  }
}

module.exports = GoogleSearchProvider;
