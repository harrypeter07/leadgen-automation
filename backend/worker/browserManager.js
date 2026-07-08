const path = require('path');

// Enforce browser binary directory relative path before loading playwright if not already set
if (!process.env.PLAYWRIGHT_BROWSERS_PATH) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = path.resolve(__dirname, '../node_modules/playwright-core/.local-browsers');
}

const playwright = require('playwright');
const logger = require('./logger');
const eventBus = require('./eventBus');

class BrowserManager {
  constructor() {
    this.browser = null;
    this.contexts = new Map(); // contextId -> context
    this.pages = new Map(); // pageId -> page
    this.maxPagesPerBrowser = 100;
    this.pageCount = 0;
    this.memoryThreshold = 250 * 1024 * 1024; // 250MB
    this.isLaunching = false;
  }

  async launch() {
    if (this.browser) return this.browser;
    if (this.isLaunching) {
      while (this.isLaunching) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return this.browser;
    }

    this.isLaunching = true;
    logger.info('[BROWSER] Launching Chromium...');
    
    try {
      this.browser = await playwright.chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-zygote'
        ]
      });
      
      logger.info('[BROWSER] Browser launched successfully.');
      eventBus.publish('browser.started', { pid: 'unknown' });
    } catch (err) {
      logger.error(`[BROWSER] Launch failed: ${err.message}`);
      eventBus.publish('browser.crashed', { error: err.message });
      throw err;
    } finally {
      this.isLaunching = false;
    }
    return this.browser;
  }

  async shutdown() {
    logger.info('[BROWSER] Shutting down browser pool...');
    for (const [pageId, page] of this.pages.entries()) {
      await page.close().catch(() => {});
    }
    this.pages.clear();

    for (const [contextId, context] of this.contexts.entries()) {
      await context.close().catch(() => {});
    }
    this.contexts.clear();

    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
    }
    logger.info('[BROWSER] Browser pool shut down complete.');
  }

  async restart() {
    logger.warn('[BROWSER] Memory exceeded threshold or limit reached. Restarting Browser...');
    await this.shutdown();
    await this.launch();
  }

  async newContext(options = {}) {
    await this.launch();
    const contextId = `context_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    logger.info(`[BROWSER] New Context Created. ${contextId}`);
    
    const proxyConfig = process.env.PROXY_SERVER ? {
      proxy: {
        server: process.env.PROXY_SERVER,
        username: process.env.PROXY_USERNAME,
        password: process.env.PROXY_PASSWORD
      }
    } : {};
    
    const context = await this.browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      locale: 'en-US',
      timezoneId: 'America/New_York',
      viewport: { width: 1280, height: 800 },
      deviceScaleFactor: 1,
      extraHTTPHeaders: {
        'Accept-Language': 'en-US,en;q=0.9',
      },
      ...proxyConfig,
      ...options
    });

    this.contexts.set(contextId, context);
    return { context, contextId };
  }

  async newPage(contextId, contextInstance = null) {
    let context = contextInstance || this.contexts.get(contextId);
    if (!context) {
      const res = await this.newContext();
      context = res.context;
      contextId = res.contextId;
    }

    const pageId = `page_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    logger.info(`[BROWSER] New Page Created. Page ${pageId} under context ${contextId}`);
    
    const page = await context.newPage();
    this.pages.set(pageId, page);
    this.pageCount++;

    // Track for memory recycle trigger
    if (this.pageCount >= this.maxPagesPerBrowser) {
      await this.recycle();
    }

    return { page, pageId };
  }

  async releasePage(pageId) {
    const page = this.pages.get(pageId);
    if (page) {
      logger.info(`[BROWSER] Releasing Page ${pageId}...`);
      await page.close().catch(() => {});
      this.pages.delete(pageId);
    }
  }

  async releaseContext(contextId) {
    const context = this.contexts.get(contextId);
    if (context) {
      logger.info(`[BROWSER] Context recycled. Releasing Context ${contextId}...`);
      await context.close().catch(() => {});
      this.contexts.delete(contextId);
    }
  }

  async recycle() {
    logger.info('[BROWSER] Browser context recycling triggered.');
    this.pageCount = 0;
    await this.restart();
  }

  health() {
    return {
      status: this.browser ? 'healthy' : 'uninitialized',
      openContexts: this.contexts.size,
      openPages: this.pages.size,
      pageLoadCount: this.pageCount,
    };
  }

  metrics() {
    const usage = process.memoryUsage();
    return {
      ramUsageMB: Math.round(usage.heapUsed / 1024 / 1024),
      contexts: this.contexts.size,
      pages: this.pages.size
    };
  }
}

module.exports = new BrowserManager();
