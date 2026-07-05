// backend/providers/googleMaps/details.js

const logger = require('../../worker/logger');

class GoogleMapsDetails {
  /**
   * Extract business details from Google Maps.
   * 
   * Strategy: Always navigate directly to the business URL (via href) when available.
   * This completely avoids sidebar click timing issues, DOM index shifts, and browser crashes.
   * Falls back to sidebar click (v2) only when no href is provided.
   */
  async extract(page, cardIndex, version = 'v2', searchUrl = '', href = null) {
    if (!href) {
      logger.warn(`[Google Maps Details] No href provided for card ${cardIndex}. Skipping.`);
      return null;
    }

    // Check for CAPTCHA page on the main search page
    const pageTitle = await page.title().catch(() => '');
    if (pageTitle.toLowerCase().includes('unusual traffic') || pageTitle.toLowerCase().includes('captcha')) {
      logger.error('[Google Maps Details] CAPTCHA page detected on search page!');
      throw new Error('CAPTCHA_DETECTED');
    }

    logger.info(`[Google Maps Details] Direct tab extraction for index ${cardIndex}: ${href.substring(0, 80)}...`);

    let detailPage = null;
    try {
      detailPage = await page.context().newPage();
      
      // Navigate to details page directly
      await detailPage.goto(href, { timeout: 30000, waitUntil: 'domcontentloaded' });

      const detailTitle = await detailPage.title().catch(() => '');
      if (detailTitle.toLowerCase().includes('unusual traffic') || detailTitle.toLowerCase().includes('captcha')) {
        logger.warn('[Google Maps Details] CAPTCHA detected on detail tab. Skipping item.');
        return null;
      }

      // Wait for name or address to load
      try {
        await detailPage.waitForSelector('h1.DUwDvf, [data-item-id="address"]', { timeout: 8000 });
      } catch (e) {
        logger.warn(`[Google Maps Details] Timeout waiting for details pane on card ${cardIndex}.`);
      }

      const raw = {};

      // 1. Name
      raw.name = null;
      for (const sel of ['h1.DUwDvf', '.DUwDvf', '.fontHeadlineLarge', 'h1']) {
        try {
          const text = await detailPage.locator(sel).first().innerText({ timeout: 1500 });
          if (text && text.trim() && !['results', 'google maps'].includes(text.toLowerCase())) {
            raw.name = text.trim();
            break;
          }
        } catch (err) {}
      }

      // Fallback: extract from page title
      if (!raw.name) {
        if (detailTitle && detailTitle.includes(' - Google Maps')) {
          raw.name = detailTitle.replace(' - Google Maps', '').trim();
        }
      }

      if (!raw.name) {
        logger.warn(`[Google Maps Details] Could not extract name on index ${cardIndex}. Skipping.`);
        return null;
      }

      // 2. Address
      raw.address = null;
      for (const sel of ['[data-item-id="address"]', 'button[data-item-id="address"]', '[aria-label*="Address:"]']) {
        try {
          const label = await detailPage.locator(sel).first().getAttribute('aria-label', { timeout: 1500 });
          if (label) {
            raw.address = label.replace(/^address:\s*/i, '').trim();
            break;
          }
        } catch (err) {}
      }

      // 3. Phone
      raw.phone = null;
      for (const sel of ['[data-item-id^="phone"]', 'button[data-item-id^="phone"]', '[aria-label*="Phone:"]']) {
        try {
          const label = await detailPage.locator(sel).first().getAttribute('aria-label', { timeout: 1500 });
          if (label) {
            raw.phone = label.replace(/^phone:\s*/i, '').trim();
            break;
          }
        } catch (err) {}
      }

      // 4. Website
      raw.website = null;
      for (const sel of ['a[data-item-id="authority"]', '[data-item-id="authority"]', 'a[aria-label*="website"]']) {
        try {
          const siteHref = await detailPage.locator(sel).first().getAttribute('href', { timeout: 1500 });
          if (siteHref) {
            raw.website = siteHref.trim();
            break;
          }
        } catch (err) {}
      }

      // 5. Rating & Reviews
      raw.rating = null;
      raw.reviews = null;
      for (const sel of ['span[aria-label*="star"]', '[aria-label*="stars"]']) {
        try {
          const label = await detailPage.locator(sel).first().getAttribute('aria-label', { timeout: 1500 });
          if (label && (label.toLowerCase().includes('star') || label.toLowerCase().includes('review'))) {
            const ratingMatch = label.match(/([0-5]\.[0-9]|[0-5])/);
            if (ratingMatch) raw.rating = ratingMatch[1];

            const reviewsMatch = label.match(/(\d+[,.\d]*)\s*reviews?/i);
            if (reviewsMatch) raw.reviews = reviewsMatch[1].replace(/,/g, '');
            break;
          }
        } catch (err) {}
      }

      // 6. Category
      raw.category = null;
      for (const sel of ['button.DkEaL', '.DkEaL', '[jsaction*="category"]']) {
        try {
          const text = await detailPage.locator(sel).first().innerText({ timeout: 1500 });
          if (text && text.trim()) {
            raw.category = text.trim();
            break;
          }
        } catch (err) {}
      }

      return raw;
    } catch (err) {
      logger.error(`[Google Maps Details] Failed to extract card details for index ${cardIndex}: ${err.message}`);
      return null;
    } finally {
      if (detailPage) {
        await detailPage.close().catch(() => {});
      }
    }
  }
}

module.exports = new GoogleMapsDetails();
