// backend/services/discoveryService.js

const browserManager = require('../worker/browserManager');
const logger = require('../worker/logger');

class DiscoveryService {
  /**
   * Search and locate social profiles for a business using Google organic search.
   */
  async discoverSocials(name, website, phone) {
    logger.info(`[Discovery Service] Initiating search discovery for: ${name}`);
    
    const { context, contextId } = await browserManager.newContext();
    const { page, pageId } = await browserManager.newPage(contextId, context);

    const socials = {
      instagram: null,
      facebook: null,
      linkedin: null,
      twitter: null,
      youtube: null
    };

    try {
      // 1. Google search query to find socials in one go
      const query = `site:instagram.com OR site:facebook.com OR site:linkedin.com OR site:twitter.com "${name}"`;
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
      
      logger.info(`[Discovery Service] Navigating to Google Search: ${searchUrl}`);
      await page.goto(searchUrl, { timeout: 20000, waitUntil: 'domcontentloaded' });

      // Extract search result links
      const links = await page.evaluate(() => {
        const anchors = Array.from(document.querySelectorAll('#search a[href^="http"]'));
        return anchors.map(a => a.href);
      }).catch(() => []);

      logger.info(`[Discovery Service] Found ${links.length} potential index anchors on Google search.`);

      // 2. Parse links matching social domains
      links.forEach(l => {
        if (!socials.instagram && /instagram\.com\/[a-zA-Z0-9._]+/i.test(l) && !l.includes('/p/') && !l.includes('/tags/')) {
          socials.instagram = this.cleanLink(l);
        }
        if (!socials.facebook && /facebook\.com\/[a-zA-Z0-9._]+/i.test(l) && !l.includes('/sharer/')) {
          socials.facebook = this.cleanLink(l);
        }
        if (!socials.linkedin && /linkedin\.com\/(company|in)\/[a-zA-Z0-9._-]+/i.test(l)) {
          socials.linkedin = this.cleanLink(l);
        }
        if (!socials.twitter && /(twitter\.com|x\.com)\/[a-zA-Z0-9._]+/i.test(l) && !l.includes('/intent/')) {
          socials.twitter = this.cleanLink(l);
        }
        if (!socials.youtube && /youtube\.com\/(channel|c|user)\/[a-zA-Z0-9._-]+/i.test(l)) {
          socials.youtube = this.cleanLink(l);
        }
      });

    } catch (err) {
      logger.error(`[Discovery Service] Social discovery failed: ${err.message}`);
    } finally {
      await browserManager.releasePage(pageId);
      await browserManager.releaseContext(contextId);
    }

    logger.info(`[Discovery Service] Completed. Results: ${JSON.stringify(socials)}`);
    return socials;
  }

  cleanLink(url) {
    try {
      const u = new URL(url);
      return `${u.protocol}//${u.hostname}${u.pathname}`;
    } catch {
      return url;
    }
  }
}

module.exports = new DiscoveryService();
