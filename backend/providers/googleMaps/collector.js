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
    const accumulatedHrefs = new Set();

    // Initial check
    const initialHrefs = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('div[role="feed"] a.hfpxzc'))
        .map(a => a.getAttribute('href'))
        .filter(Boolean);
    });
    initialHrefs.forEach(h => accumulatedHrefs.add(h));

    while (accumulatedHrefs.size < maxLeads) {
      const currentCount = await page.locator('div[role="feed"] a.hfpxzc').count();
      logger.info(`   [Scroll] Loaded ${currentCount} listings in view, accumulated ${accumulatedHrefs.size}...`);

      await feed.evaluate(el => el.scrollTop += 900).catch(() => {});
      
      // Dynamic wait: wait slightly longer if loading more leads to let network catch up
      const pauseTime = maxLeads > 30 ? 2000 : SCROLL_PAUSE;
      await new Promise(resolve => setTimeout(resolve, pauseTime));

      const scrollHrefs = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('div[role="feed"] a.hfpxzc'))
          .map(a => a.getAttribute('href'))
          .filter(Boolean);
      });
      
      let addedAny = false;
      scrollHrefs.forEach(h => {
        if (!accumulatedHrefs.has(h)) {
          accumulatedHrefs.add(h);
          addedAny = true;
        }
      });

      if (!addedAny) {
        staleCount++;
        if (staleCount >= MAX_STALE_SCROLLS) {
          break;
        }
      } else {
        staleCount = 0;
      }
    }

    // Scroll back to the top of the feed to ensure first elements are clickable
    await feed.evaluate(el => el.scrollTop = 0).catch(() => {});
    await new Promise(resolve => setTimeout(resolve, 500));

    const uniqueHrefs = Array.from(accumulatedHrefs).slice(0, maxLeads);
    logger.info(`[Google Maps Collector] Finished scrolling. Collected ${uniqueHrefs.length} unique listing URLs.`);
    return uniqueHrefs;
  }
}

module.exports = new GoogleMapsCollector();
