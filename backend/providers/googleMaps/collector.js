// backend/providers/googleMaps/collector.js

const logger = require('../../worker/logger');

const SCROLL_PAUSE = 1500;
const MAX_STALE_SCROLLS = 3;

class GoogleMapsCollector {
  async collect(page, maxLeads) {
    logger.info(`[Google Maps Collector] Scrolling sidebar to load up to ${maxLeads} leads...`);
    const feed = page.locator('div[role="feed"]');
    
    let prevCount = 0;
    let staleCount = 0;

    while (true) {
      const currentCount = await page.locator('div[role="feed"] a[href*="/maps/place/"]').count();
      logger.info(`   [Scroll] Loaded ${currentCount} listings...`);

      if (currentCount >= maxLeads) {
        break;
      }

      await feed.evaluate(el => el.scrollTop += 900).catch(() => {});
      await new Promise(resolve => setTimeout(resolve, SCROLL_PAUSE));

      const newCount = await page.locator('div[role="feed"] a[href*="/maps/place/"]').count();
      if (newCount <= prevCount) {
        staleCount++;
        if (staleCount >= MAX_STALE_SCROLLS) {
          break;
        }
      } else {
        staleCount = 0;
      }
      prevCount = newCount;
    }

    return await page.locator('div[role="feed"] a[href*="/maps/place/"]').count();
  }
}

module.exports = new GoogleMapsCollector();
