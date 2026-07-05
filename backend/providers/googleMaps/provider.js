// backend/providers/googleMaps/provider.js

const logger = require('../../worker/logger');
const collector = require('./collector');
const details = require('./details');
const parser = require('./parser');

class GoogleMapsProvider {
  constructor() {
    this.name = 'google_maps';
    this.searchUrl = '';
  }

  async search(page, query) {
    let searchTerm = query.keyword;
    const cityVal = query.city || '';

    if (cityVal === 'Global') {
      searchTerm = query.keyword;
    } else if (cityVal.startsWith('Country: ')) {
      const countryName = cityVal.replace('Country: ', '');
      searchTerm = query.area
        ? `${query.keyword} in ${query.area}, ${countryName}`
        : `${query.keyword} in ${countryName}`;
    } else {
      searchTerm = query.area 
        ? `${query.keyword} in ${query.area}, ${cityVal}`
        : `${query.keyword} in ${cityVal}`;
    }

    const encoded = encodeURIComponent(searchTerm);
    const mapsUrl = `https://www.google.com/maps/search/${encoded}`;
    
    this.searchUrl = mapsUrl;
    logger.info(`[Google Maps Provider] Navigating to search: ${mapsUrl}`);
    await page.goto(mapsUrl, { timeout: 30000, waitUntil: 'domcontentloaded' });

    const title = await page.title();
    if (title.toLowerCase().includes('unusual traffic') || title.toLowerCase().includes('captcha')) {
      throw new Error('CAPTCHA_DETECTED');
    }

    try {
      await page.waitForSelector('div[role="feed"]', { timeout: 15005 });
    } catch (e) {
      logger.warn('[Google Maps Provider] Results feed container not found.');
      throw new Error('NO_RESULTS_FOUND');
    }
  }

  async collect(page, maxLeads) {
    const hrefs = await collector.collect(page, maxLeads);
    this.scrapedHrefs = hrefs || [];
    return this.scrapedHrefs.length;
  }

  async extract(page, cardIndex, version = 'v2') {
    const href = this.scrapedHrefs && this.scrapedHrefs[cardIndex];
    return await details.extract(page, cardIndex, version, this.searchUrl, href);
  }

  normalize(raw, city) {
    return parser.normalize(raw, city);
  }
}

module.exports = GoogleMapsProvider;
