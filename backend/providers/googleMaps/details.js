// backend/providers/googleMaps/details.js

const logger = require('../../worker/logger');

class GoogleMapsDetails {
  async extract(page, cardIndex, version = 'v2', searchUrl = '') {
    const cards = page.locator('div[role="feed"] a[href*="/maps/place/"]');
    const card = cards.nth(cardIndex);

    if (version === 'v1') {
      logger.info(`[Google Maps Details] [Legacy V1] Extracting via full page navigation on index ${cardIndex}...`);
      const href = await card.getAttribute('href').catch(() => null);
      if (!href) {
        logger.warn(`[Google Maps Details] [Legacy V1] Could not retrieve href on index ${cardIndex}.`);
        return null;
      }

      await page.goto(href, { timeout: 15000, waitUntil: 'domcontentloaded' }).catch(() => {});
    } else {
      logger.info(`[Google Maps Details] [Playwright V2] Extracting via sidebar click on index ${cardIndex}...`);
      await card.scrollIntoViewIfNeeded().catch(() => {});
      await card.click({ force: true }).catch(() => {});
    }

    try {
      await page.waitForSelector('h1.DUwDvf, [data-item-id="address"]', { timeout: 8000 });
    } catch (e) {
      logger.warn(`[Google Maps Details] Details pane timeout on item ${cardIndex}.`);
    }

    await new Promise(resolve => setTimeout(resolve, 300));

    const raw = {};

    // 1. Name
    raw.name = null;
    for (const sel of ['h1.DUwDvf', '.DUwDvf', '.fontHeadlineLarge', 'h1']) {
      try {
        const text = await page.locator(sel).first().innerText({ timeout: 1500 });
        if (text && text.trim() && !['results', 'google maps'].includes(text.toLowerCase())) {
          raw.name = text.trim();
          break;
        }
      } catch (err) {}
    }

    if (!raw.name) {
      const pageTitle = await page.title();
      if (pageTitle.includes(' - Google Maps')) {
        raw.name = pageTitle.replace(' - Google Maps', '').trim();
      }
    }

    if (!raw.name) return null;

    // 2. Address
    raw.address = null;
    for (const sel of ['[data-item-id="address"]', 'button[data-item-id="address"]', '[aria-label*="Address:"]']) {
      try {
        const label = await page.locator(sel).first().getAttribute('aria-label', { timeout: 1500 });
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
        const label = await page.locator(sel).first().getAttribute('aria-label', { timeout: 1500 });
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
        const href = await page.locator(sel).first().getAttribute('href', { timeout: 1500 });
        if (href) {
          raw.website = href.trim();
          break;
        }
      } catch (err) {}
    }

    // 5. Rating & Reviews
    raw.rating = null;
    raw.reviews = null;
    for (const sel of ['span[aria-label*="star"]', '[aria-label*="stars"]']) {
      try {
        const label = await page.locator(sel).first().getAttribute('aria-label', { timeout: 1500 });
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
        const text = await page.locator(sel).first().innerText({ timeout: 1500 });
        if (text && text.trim()) {
          raw.category = text.trim();
          break;
        }
      } catch (err) {}
    }

    if (version === 'v1' && searchUrl) {
      logger.info(`[Google Maps Details] [Legacy V1] Navigating back to search list: ${searchUrl}`);
      await page.goto(searchUrl, { timeout: 15000, waitUntil: 'domcontentloaded' }).catch(() => {});
      try {
        await page.waitForSelector('div[role="feed"]', { timeout: 8000 });
      } catch (e) {}
    }

    return raw;
  }
}

module.exports = new GoogleMapsDetails();
