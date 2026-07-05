// backend/providers/tinyfish/provider.js

const logger = require('../../worker/logger');
const tfSearch = require('./search');
const tfFetch = require('./fetch');

class TinyFishProvider {
  constructor() {
    this.name = 'tinyfish';
    this.scrapedResults = [];
  }

  async search(page, query) {
    // Pure HTTP operation, bypass browser context entirely
    logger.info(`[TinyFish Provider] Performing search for keyword: "${query.keyword}"`);
    const results = await tfSearch.search(query.keyword, {
      location: query.city
    });
    this.scrapedResults = results || [];
  }

  async collect(page, maxLeads) {
    const list = Array.isArray(this.scrapedResults) ? this.scrapedResults : [];
    this.scrapedResults = list.slice(0, maxLeads);
    return this.scrapedResults.length;
  }

  async extract(page, cardIndex) {
    const item = this.scrapedResults && this.scrapedResults[cardIndex];
    if (!item) return null;

    logger.info(`[TinyFish Provider] Extracting contacts for: ${item.title || item.name} via Fetch API`);
    
    let pageText = '';
    try {
      const fetchResponse = await tfFetch.fetchUrls([item.url || item.website]);
      if (fetchResponse && fetchResponse.results && fetchResponse.results.length > 0) {
        pageText = fetchResponse.results[0].text || fetchResponse.results[0].markdown || '';
      }
    } catch (fetchErr) {
      logger.warn(`[TinyFish Provider] Failed to fetch content for ${item.url || item.website}: ${fetchErr.message}`);
    }

    const aiService = require('../../services/aiService');
    const aiExtracted = await aiService.extractLeadFromText(pageText || item.snippet || item.description || '');

    return {
      name: aiExtracted.name || item.title || item.name || 'Unknown Business',
      phone: aiExtracted.phone || null,
      email: aiExtracted.email || null,
      address: aiExtracted.address || null,
      category: aiExtracted.category || null,
      website: aiExtracted.website || item.url || item.website || '',
      snippet: item.snippet || item.description || ''
    };
  }

  normalize(raw, city) {
    return {
      name: raw.name,
      phone: raw.phone,
      email: raw.email,
      address: raw.address,
      city: city ? city.toLowerCase().replace(/(?:^|\s|-)\S/g, match => match.toUpperCase()).trim() : '',
      category: raw.category || '',
      website: raw.website,
      notes: raw.snippet || '',
      source: 'tinyfish',
      status: 'new'
    };
  }
}

module.exports = TinyFishProvider;
