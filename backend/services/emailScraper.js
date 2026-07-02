// backend/services/emailScraper.js

const logger = require('../worker/logger');

class EmailScraper {
  /**
   * Scrapes a business website for email addresses.
   * @param {import('playwright').Page} page - Playwright page instance to reuse.
   * @param {string} url - Website URL.
   */
  async scrapeEmail(page, url) {
    if (!url || !url.startsWith('http')) return null;

    logger.info(`[Email Scraper] Checking website for email: ${url}`);
    
    try {
      // Navigate to the home page with a short timeout to save time
      await page.goto(url, { timeout: 8000, waitUntil: 'domcontentloaded' }).catch(() => {});

      // 1. Extract email from home page text
      let email = await this.extractFromPage(page);
      if (email) {
        logger.info(`[Email Scraper] Found email on homepage: ${email}`);
        return email;
      }

      // 2. If not found, look for Contact or About links on the homepage
      const contactLink = await page.evaluate(() => {
        const anchors = Array.from(document.querySelectorAll('a[href]'));
        const target = anchors.find(a => {
          const text = (a.innerText || '').toLowerCase();
          const href = (a.getAttribute('href') || '').toLowerCase();
          return text.includes('contact') || text.includes('about') || href.includes('contact') || href.includes('about');
        });
        return target ? target.href : null;
      }).catch(() => null);

      if (contactLink && contactLink.startsWith('http') && contactLink !== url) {
        logger.info(`[Email Scraper] Navigating to contact page: ${contactLink}`);
        await page.goto(contactLink, { timeout: 6000, waitUntil: 'domcontentloaded' }).catch(() => {});
        email = await this.extractFromPage(page);
        if (email) {
          logger.info(`[Email Scraper] Found email on contact page: ${email}`);
          return email;
        }
      }
    } catch (err) {
      logger.warn(`[Email Scraper] Failed to scrape ${url}: ${err.message}`);
    }

    return null;
  }

  async extractFromPage(page) {
    try {
      const pageText = await page.evaluate(() => document.body.innerText).catch(() => '');
      
      // Email matching regex
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      const matches = pageText.match(emailRegex);

      if (matches && matches.length > 0) {
        // Filter out common false positives (like images, domain extensions, template names)
        const commonFalsePositives = ['sentry.io', 'example.com', 'w3.org', 'domain.com'];
        const valid = matches.find(email => {
          const lower = email.toLowerCase();
          return !commonFalsePositives.some(domain => lower.includes(domain)) &&
                 !lower.endsWith('.png') && 
                 !lower.endsWith('.jpg') && 
                 !lower.endsWith('.webp');
        });
        return valid ? valid.toLowerCase() : null;
      }
    } catch (e) {
      logger.error(`[Email Scraper] Extraction error: ${e.message}`);
    }
    return null;
  }
}

module.exports = new EmailScraper();
