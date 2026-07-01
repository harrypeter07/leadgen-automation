// backend/providers/googleMaps/provider.js

const fs = require('fs');
const path = require('path');
const logger = require('../../worker/logger');

const SCROLL_PAUSE = 1500; // ms
const MAX_STALE_SCROLLS = 3;

class GoogleMapsProvider {
  constructor() {
    this.name = 'google_maps';
  }

  /**
   * Search for businesses matching the keyword and city.
   */
  async search(page, query) {
    const searchTerm = `${query.keyword} in ${query.city}`;
    const encoded = encodeURIComponent(searchTerm);
    const mapsUrl = `https://www.google.com/maps/search/${encoded}`;
    
    logger.info(`[Google Maps Provider] Navigating to search: ${mapsUrl}`);
    await page.goto(mapsUrl, { timeout: 30000, waitUntil: 'domcontentloaded' });

    // CAPTCHA check
    const title = await page.title();
    if (title.toLowerCase().includes('unusual traffic') || title.toLowerCase().includes('captcha')) {
      throw new Error('CAPTCHA_DETECTED');
    }

    // Wait for feed sidebar container to render
    try {
      await page.waitForSelector('div[role="feed"]', { timeout: 15005 });
    } catch (e) {
      logger.warn('[Google Maps Provider] Results feed container not found. No results available.');
      throw new Error('NO_RESULTS_FOUND');
    }
  }

  /**
   * Scrolls the sidebar feed to load at least maxLeads.
   * Returns the count of card links available.
   */
  async collect(page, maxLeads) {
    logger.info(`[Google Maps Provider] Scrolling sidebar to load up to ${maxLeads} leads...`);
    const feed = page.locator('div[role="feed"]');
    
    let prevCount = 0;
    let staleCount = 0;

    while (true) {
      const currentCount = await page.locator('a[href*="/maps/place/"]').count();
      logger.info(`   [Scroll] Loaded ${currentCount} listings...`);

      if (currentCount >= maxLeads) {
        break;
      }

      // Scroll the sidebar down
      await feed.evaluate(el => el.scrollTop += 900).catch(() => {});
      await new Promise(resolve => setTimeout(resolve, SCROLL_PAUSE));

      const newCount = await page.locator('a[href*="/maps/place/"]').count();
      if (newCount <= prevCount) {
        staleCount++;
        if (staleCount >= MAX_STALE_SCROLLS) {
          logger.info(`   [Scroll] No new results loaded after ${MAX_STALE_SCROLLS} attempts. Stopping.`);
          break;
        }
      } else {
        staleCount = 0;
      }
      prevCount = newCount;
    }

    const finalCount = await page.locator('a[href*="/maps/place/"]').count();
    logger.info(`[Google Maps Provider] Finished scrolling. Found ${finalCount} total listings.`);
    return finalCount;
  }

  /**
   * Clicks a card link index, loads details, and extracts raw fields.
   */
  async extract(page, cardIndex) {
    const cards = page.locator('a[href*="/maps/place/"]');
    const card = cards.nth(cardIndex);

    // Scroll into view & click
    await card.scrollIntoViewIfNeeded().catch(() => {});
    await card.click({ force: true }).catch(() => {});

    // Wait for the side details pane to load
    try {
      await page.waitForSelector('h1.DUwDvf, [data-item-id="address"]', { timeout: 8000 });
    } catch (e) {
      logger.warn(`[Google Maps Provider] Details pane load timeout on item ${cardIndex}. Extracting anyway.`);
    }

    // Small settle time
    await new Promise(resolve => setTimeout(resolve, 300));

    const raw = {};

    // 1. Business Name
    raw.name = null;
    for (const sel of ['h1.DUwDvf', '.DUwDvf', '.fontHeadlineLarge', '.lMbq3e h1', 'h1']) {
      try {
        const text = await page.locator(sel).first().innerText({ timeout: 1500 });
        if (text && text.trim() && !['results', 'google maps'].includes(text.toLowerCase())) {
          raw.name = text.trim();
          break;
        }
      } catch (err) {}
    }

    // Fallback: title text
    if (!raw.name) {
      const pageTitle = await page.title();
      if (pageTitle.includes(' - Google Maps')) {
        raw.name = pageTitle.replace(' - Google Maps', '').trim();
      }
    }

    // If we can't get a name, this is a failed extract
    if (!raw.name) {
      return null;
    }

    // 2. Address
    raw.address = null;
    for (const sel of ['[data-item-id="address"]', 'button[data-item-id="address"]', '[aria-label*="Address:"]', 'button[aria-label*="ddress"]']) {
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
    for (const sel of ['[data-item-id^="phone"]', 'button[data-item-id^="phone"]', '[aria-label*="Phone:"]', 'button[aria-label*="hone"]']) {
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
    for (const sel of ['a[data-item-id="authority"]', '[data-item-id="authority"]', 'a[aria-label*="website"]', 'a[aria-label*="Website"]']) {
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
    for (const sel of ['span[aria-label*="star"]', '[aria-label*="stars"]', 'div[aria-label*="stars"]']) {
      try {
        const label = await page.locator(sel).first().getAttribute('aria-label', { timeout: 1500 });
        if (label && (label.toLowerCase().includes('star') || label.toLowerCase().includes('review'))) {
          const ratingMatch = label.match(/([0-5]\.[0-9]|[0-5])/);
          if (ratingMatch) {
            raw.rating = ratingMatch[1];
          }
          const reviewsMatch = label.match(/(\d+[,.\d]*)\s*reviews?/i);
          if (reviewsMatch) {
            raw.reviews = reviewsMatch[1].replace(/,/g, '');
          }
          break;
        }
      } catch (err) {}
    }

    // Fallback reviews
    if (!raw.reviews) {
      try {
        const label = await page.locator('[aria-label*="review"]').first().getAttribute('aria-label', { timeout: 1500 });
        if (label) {
          const m = label.match(/(\d+[,.\d]*)/);
          if (m) raw.reviews = m[1].replace(/,/g, '');
        }
      } catch (err) {}
    }

    // 6. Category
    raw.category = null;
    for (const sel of ['button.DkEaL', '.DkEaL', 'button.fontBodyMedium', '[jsaction*="category"]']) {
      try {
        const text = await page.locator(sel).first().innerText({ timeout: 1500 });
        if (text && text.trim()) {
          raw.category = text.trim();
          break;
        }
      } catch (err) {}
    }

    return raw;
  }

  /**
   * Normalizes the extracted raw fields to the Unified Lead model.
   */
  normalize(raw, city) {
    let cleanPhone = null;
    if (raw.phone) {
      cleanPhone = raw.phone.replace(/[^\d+]/g, '');
    }

    let reviewCount = null;
    if (raw.reviews) {
      reviewCount = parseInt(raw.reviews, 10) || null;
    }

    let rating = null;
    if (raw.rating) {
      const f = parseFloat(raw.rating);
      if (!isNaN(f) && f >= 1.0 && f <= 5.0) {
        rating = f;
      }
    }

    let cleanWebsite = null;
    if (raw.website && raw.website.trim().startsWith('http')) {
      cleanWebsite = raw.website.trim();
    }

    return {
      name: raw.name ? raw.name.trim() : 'Unknown Business',
      phone: cleanPhone,
      email: null,
      address: raw.address ? raw.address.trim() : null,
      city: city ? city.trim() : null,
      category: raw.category ? raw.category.trim() : null,
      website: cleanWebsite,
      rating: rating,
      review_count: reviewCount,
      source: 'google_maps',
      status: 'new',
    };
  }
}

module.exports = GoogleMapsProvider;
