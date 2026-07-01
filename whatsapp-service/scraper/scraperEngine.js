// whatsapp-service/scraper/scraperEngine.js

const GoogleMapsProvider = require('./providers/google_maps');
const dbWriter = require('./dbWriter');

class ScraperEngine {
  constructor() {
    this.providers = {
      'google_maps': new GoogleMapsProvider()
    };
    this.activeRuns = new Map(); // jobId -> abort state
  }

  /**
   * Run a scraping job by ID.
   */
  async runJob(job, onProgress, onLog, onError) {
    const provider = this.providers[job.current_provider || 'google_maps'];
    if (!provider) {
      throw new Error(`Unsupported provider: ${job.current_provider}`);
    }

    const loadBaileysPlaywright = async () => {
      // Lazy load playwright ESM module inside CJS
      const playwright = await import('playwright');
      return playwright.chromium;
    };

    onLog('Creating browser session...');
    const chromium = await loadBaileysPlaywright();
    const browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--single-process',
        '--no-zygote'
      ]
    });

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      locale: 'en-US',
      viewport: { width: 1280, height: 900 }
    });

    // Register job abort controller
    const abortState = { aborted: false, paused: false };
    this.activeRuns.set(job.id, abortState);

    const mainPage = await context.newPage();
    
    try {
      onLog(`Searching on ${provider.name} for "${job.keyword}" in "${job.city}"...`);
      await provider.search(mainPage, { keyword: job.keyword, city: job.city });

      if (abortState.aborted) throw new Error('ABORTED');

      // Scroll and collect cards
      const availableCards = await provider.collect(mainPage, job.max_leads);
      const totalToScrape = Math.min(availableCards, job.max_leads);
      onLog(`Found ${availableCards} business listings. Commencing details extraction for ${totalToScrape} items...`);

      // Determine concurrency setup
      const concurrency = job.worker_count || 1;
      
      if (concurrency === 1) {
        // High-performance single page sidebar clicking (no page reloads)
        for (let i = 0; i < totalToScrape; i++) {
          while (abortState.paused && !abortState.aborted) {
            onLog('Job paused. Waiting to resume...');
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          if (abortState.aborted) throw new Error('ABORTED');

          onLog(`Scraping listing [${i + 1}/${totalToScrape}]...`);
          try {
            const rawLead = await provider.extract(mainPage, i);
            if (rawLead) {
              const normalized = provider.normalize(rawLead, job.city);
              onLog(`   [+] Extracted: ${normalized.name}`);
              
              // Queue database upsert in the background
              dbWriter.enqueue(normalized, job.id, async (jId, name) => {
                await onProgress(jId, name);
              });
            } else {
              onError(job.id, new Error(`Could not extract info for index ${i}`));
            }
          } catch (err) {
            onError(job.id, err);
          }
        }
      } else {
        // Multi-tab concurrency using card hrefs directly (places direct load)
        onLog(`Initializing concurrent worker pool with ${concurrency} tabs...`);
        const cardHrefs = await mainPage.evalOnSelectorAll(
          'a[href*="/maps/place/"]',
          "els => els.map(e => e.href)"
        );
        const targets = cardHrefs.slice(0, totalToScrape);

        // Spawn worker pages/tabs sharing browser context (cookies/cache shared)
        const workers = [];
        for (let w = 0; w < concurrency; w++) {
          workers.push(await context.newPage());
        }

        let targetIndex = 0;
        const promises = workers.map(async (workerPage, wId) => {
          while (targetIndex < targets.length) {
            while (abortState.paused && !abortState.aborted) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
            if (abortState.aborted) return;

            const currentIndex = targetIndex++;
            if (currentIndex >= targets.length) break;

            const href = targets[currentIndex];
            onLog(`[Worker Tab ${wId + 1}] Loading details for listing [${currentIndex + 1}/${targets.length}]...`);
            
            try {
              await workerPage.goto(href, { timeout: 15000, waitUntil: 'domcontentloaded' }).catch(() => {});
              await workerPage.waitForSelector('[data-item-id="address"], h1', { timeout: 5000 }).catch(() => {});
              
              // Call provider extraction directly against page context
              const rawLead = await provider.extract(workerPage, 0); // index 0 since direct page goto
              if (rawLead) {
                const normalized = provider.normalize(rawLead, job.city);
                onLog(`[Worker Tab ${wId + 1}] [+] Extracted: ${normalized.name}`);
                dbWriter.enqueue(normalized, job.id, async (jId, name) => {
                  await onProgress(jId, name);
                });
              }
            } catch (err) {
              onError(job.id, err);
            }
          }
        });

        await Promise.all(promises);
      }

    } catch (e) {
      if (e.message === 'ABORTED') {
        onLog('Job aborted by user.');
      } else if (e.message === 'CAPTCHA_DETECTED') {
        onLog('⚠️ CAPTCHA detected. Scraper blocked. Job paused.');
        abortState.paused = true;
        throw e;
      } else {
        onLog(`Exception during execution: ${e.message}`);
        throw e;
      }
    } finally {
      onLog('Terminating browser session...');
      await browser.close().catch(() => {});
      this.activeRuns.delete(job.id);
    }
  }

  /**
   * Abort/stop a running job.
   */
  abortJob(jobId) {
    const run = this.activeRuns.get(jobId);
    if (run) {
      run.aborted = true;
      run.paused = false;
      return true;
    }
    return false;
  }

  /**
   * Pause a running job.
   */
  pauseJob(jobId) {
    const run = this.activeRuns.get(jobId);
    if (run) {
      run.paused = true;
      return true;
    }
    return false;
  }

  /**
   * Resume a paused job.
   */
  resumeJob(jobId) {
    const run = this.activeRuns.get(jobId);
    if (run) {
      run.paused = false;
      return true;
    }
    return false;
  }
}

module.exports = new ScraperEngine();
