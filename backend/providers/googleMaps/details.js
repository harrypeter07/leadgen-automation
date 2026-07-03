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
    let clickSuccess = false;
    let expectedName = null;

    // ── Check for CAPTCHA page ──────────────────────────────────────────────
    const pageTitle = await page.title().catch(() => '');
    if (pageTitle.toLowerCase().includes('unusual traffic') || pageTitle.toLowerCase().includes('captcha') || pageTitle.toLowerCase().includes('sorry')) {
      logger.error('[Google Maps Details] CAPTCHA page detected!');
      throw new Error('CAPTCHA_DETECTED');
    }

    // ── Strategy 1: Synchronized Sidebar Click (Highly Preferred to avoid CAPTCHAs) ──
    try {
      const cards = page.locator('div[role="feed"] a.hfpxzc');
      const count = await cards.count().catch(() => 0);
      if (cardIndex < count) {
        const card = cards.nth(cardIndex);
        expectedName = await card.getAttribute('aria-label').catch(() => null);
        
        await card.scrollIntoViewIfNeeded({ timeout: 2500 }).catch(() => {});
        await card.click({ force: true, timeout: 2500 });

        // Wait for details pane title to match the expected name
        if (expectedName) {
          const cleanExpected = expectedName.replace(/^Details for\s+/i, '').trim();
          await page.waitForFunction((name) => {
            const h1 = document.querySelector('h1.DUwDvf, .DUwDvf');
            return h1 && h1.innerText.trim().toLowerCase().includes(name.toLowerCase());
          }, cleanExpected, { timeout: 6000 });
          clickSuccess = true;
          logger.info(`[Google Maps Details] Click transition succeeded for: ${cleanExpected}`);
        }
      }
    } catch (clickErr) {
      logger.warn(`[Google Maps Details] Click transition failed on index ${cardIndex}: ${clickErr.message}`);
    }

    // ── Strategy 2: Direct Page Navigation Fallback ─────────────────────────
    if (!clickSuccess) {
      if (href) {
        logger.info(`[Google Maps Details] [Fallback] Direct navigation to: ${href.substring(0, 80)}...`);
        await page.goto(href, { timeout: 20000, waitUntil: 'domcontentloaded' }).catch(() => {});
      } else if (version === 'v1') {
        logger.info(`[Google Maps Details] [V1 Fallback] Extracting via page navigation on index ${cardIndex}...`);
        const cards = page.locator('div[role="feed"] a.hfpxzc');
        const card = cards.nth(cardIndex);
        const cardHref = await card.getAttribute('href').catch(() => null);
        if (!cardHref) {
          logger.warn(`[Google Maps Details] Could not retrieve href on index ${cardIndex}. Skipping.`);
          return null;
        }
        await page.goto(cardHref, { timeout: 20000, waitUntil: 'domcontentloaded' }).catch(() => {});
      } else {
        // Ultimate fallback click without sync
        logger.info(`[Google Maps Details] [Fallback Click] Simple click card index ${cardIndex}...`);
        const cards = page.locator('div[role="feed"] a.hfpxzc');
        const card = cards.nth(cardIndex);
        await card.scrollIntoViewIfNeeded().catch(() => {});
        await card.click({ force: true }).catch(() => {});
      }

      // Wait for business detail panel to load
      try {
        await page.waitForSelector('h1.DUwDvf, [data-item-id="address"]', { timeout: 8000 });
      } catch (e) {
        logger.warn(`[Google Maps Details] Detail pane timeout on item ${cardIndex}.`);
      }
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

    // Fallback: extract from page title
    if (!raw.name) {
      try {
        const pageTitle = await page.title();
        if (pageTitle && pageTitle.includes(' - Google Maps')) {
          raw.name = pageTitle.replace(' - Google Maps', '').trim();
        }
      } catch (err) {}
    }

    if (!raw.name) {
      logger.warn(`[Google Maps Details] Could not extract name on index ${cardIndex}. Skipping.`);
      return null;
    }

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
        const siteHref = await page.locator(sel).first().getAttribute('href', { timeout: 1500 });
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

    // After direct navigation, return to the search results page (only needed for v1/click modes without href)
    if (!href && searchUrl) {
      logger.info(`[Google Maps Details] Navigating back to search list: ${searchUrl}`);
      await page.goto(searchUrl, { timeout: 15000, waitUntil: 'domcontentloaded' }).catch(() => {});
      try {
        await page.waitForSelector('div[role="feed"]', { timeout: 8000 });
      } catch (e) {}
    }

    return raw;
  }
}

module.exports = new GoogleMapsDetails();
