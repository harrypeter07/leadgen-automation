// backend/providers/website/analyzer.js

const logger = require('../../worker/logger');
const seoAnalyzer = require('../../modules/website/seo');
const uiuxAnalyzer = require('../../modules/website/uiux');
const performanceAnalyzer = require('../../modules/website/performance');
const accessibilityAnalyzer = require('../../modules/website/accessibility');
const technologyAnalyzer = require('../../modules/website/technology');
const contactsAnalyzer = require('../../modules/website/contacts');

class WebsiteAnalyzer {
  constructor() {
    this.name = 'website';
  }

  async audit(page, url) {
    logger.info(`[Website Analyzer] Modular Audit Initiated on: ${url}`);
    const startTime = Date.now();

    // Track page weight and resource count
    let totalBytes = 0;
    let resourceCount = 0;
    const responseHandler = response => {
      resourceCount++;
      const headers = response.headers();
      if (headers['content-length']) {
        totalBytes += parseInt(headers['content-length'], 10) || 0;
      }
    };
    page.on('response', responseHandler);

    // Setup console error and request failure event hooks
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (text && !text.includes('favicon.ico') && consoleErrors.length < 15) {
          consoleErrors.push(text);
        }
      }
    });

    const failedRequests = [];
    page.on('requestfailed', request => {
      const fail = request.failure();
      const reqUrl = request.url();
      // Skip static assets timeouts if they aren't critical
      if (reqUrl && !reqUrl.endsWith('.png') && !reqUrl.endsWith('.jpg') && failedRequests.length < 15) {
        failedRequests.push({
          url: reqUrl,
          error: fail ? fail.errorText : 'Failed to resolve endpoint'
        });
      }
    });

    try {
      logger.info(`[Website Analyzer] Navigating to target site: ${url}`);
      await page.goto(url, { timeout: 30000, waitUntil: 'commit' });
      
      // Wait up to 10s for DOM settlements
      await page.waitForSelector('body, h1, nav', { timeout: 10000 }).catch(() => {});
      const loadTimeMs = Date.now() - startTime;
      logger.info(`[Website Analyzer] Target loaded. Page load time: ${loadTimeMs}ms`);

      // 1. Invoke individual modular scorers
      logger.info(`[Website Analyzer] Running SEO structural audit...`);
      const seo = await seoAnalyzer.analyze(page).catch(() => ({ score: 70, ssl_enabled: url.startsWith('https') }));
      
      logger.info(`[Website Analyzer] Running UI/UX heuristic audit...`);
      const uiux = await uiuxAnalyzer.analyze(page).catch(() => ({ score: 60, cta_count: 0, hero_exists: false, navigation_exists: false }));
      
      logger.info(`[Website Analyzer] Running client-side performance benchmarks...`);
      const perf = await performanceAnalyzer.analyze(page, loadTimeMs, { totalBytes, resourceCount }).catch(() => ({ score: 70 }));
      
      logger.info(`[Website Analyzer] Running accessibility compliance scans...`);
      const access = await accessibilityAnalyzer.analyze(page).catch(() => ({ score: 70, total_images: 0, missing_alt_images: 0 }));
      
      logger.info(`[Website Analyzer] Analyzing client-side framework & package stack...`);
      const tech = await technologyAnalyzer.analyze(page).catch(() => ({ technologies: [] }));
      
      logger.info(`[Website Analyzer] Scraping email addresses, phone contacts, and social media handles...`);
      const contacts = await contactsAnalyzer.analyze(page).catch(() => ({ social_links: [], emails: [], phone_numbers: [] }));

      // 2. Perform DOM UI Issues Analysis (Layout Overlaps, Empty CTAs, Image Errors)
      logger.info(`[Website Analyzer] Analysing layout integrity and non-functional items...`);
      const uiIssues = await page.evaluate(() => {
        const issues = [];
        
        // Check for broken images
        const imgs = Array.from(document.querySelectorAll('img'));
        imgs.forEach(img => {
          if (!img.complete || img.naturalWidth === 0) {
            issues.push({
              type: 'broken_image',
              selector: img.outerHTML.substring(0, 80),
              message: `Image failed to load: ${img.src || 'Empty source attribute'}`
            });
          }
        });

        // Check for non-functional/empty CTAs
        const ctas = Array.from(document.querySelectorAll('button, a.btn, a.button'));
        ctas.forEach(cta => {
          const text = (cta.innerText || '').trim();
          if (!text && !cta.querySelector('svg, img')) {
            issues.push({
              type: 'empty_cta',
              selector: cta.outerHTML.substring(0, 80),
              message: 'Interactive button has no text or graphics inside, making it non-functional.'
            });
          }
        });

        return issues.slice(0, 10);
      }).catch(() => []);

      // 3. Crawl anchors and verify links (up to 12 unique links verified concurrently on the backend)
      logger.info(`[Website Analyzer] Fetching and verifying outbound/internal links...`);
      const linksToVerify = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a[href]'))
          .map(a => ({ text: (a.innerText || '').trim(), href: a.href }))
          .filter(l => l.href.startsWith('http') && !l.href.includes('javascript:'))
          .slice(0, 25);
      }).catch(() => []);

      const uniqueLinks = Array.from(new Map(linksToVerify.map(l => [l.href, l])).values());
      const brokenLinks = [];

      // Concurrently verify unique links using Node fetch on backend to prevent captcha/timeouts
      if (uniqueLinks.length > 0) {
        logger.info(`[Website Analyzer] Verifying ${uniqueLinks.length} unique links...`);
        const limit = Math.min(uniqueLinks.length, 12);
        
        const promises = uniqueLinks.slice(0, limit).map(async (link) => {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 6000);
            
            const res = await fetch(link.href, {
              method: 'GET',
              headers: { 'User-Agent': 'Mozilla/5.0' },
              signal: controller.signal
            });
            clearTimeout(timeoutId);
            
            if (res.status === 404 || res.status >= 500) {
              brokenLinks.push({
                text: link.text || 'Untitled Link',
                href: link.href,
                status: res.status
              });
            }
          } catch (err) {
            brokenLinks.push({
              text: link.text || 'Untitled Link',
              href: link.href,
              status: 504 // Timeout or resolution error
            });
          }
        });

        await Promise.all(promises);
      }

      // 4. Capture screenshot
      logger.info(`[Website Analyzer] Taking page screenshot...`);
      const screenshotBase64 = await page.screenshot({
        type: 'jpeg',
        quality: 60,
        encoding: 'base64'
      }).catch((err) => {
        logger.error(`[Website Analyzer] Failed to capture screenshot: ${err.message}`);
        return null;
      });

      // 5. Aggregate overall metrics
      logger.info(`[Website Analyzer] Aggregating overall score...`);
      const scoreDeductions = (brokenLinks.length * 5) + (consoleErrors.length * 4) + (uiIssues.length * 5);
      const calculatedUxScore = Math.max(25, uiux.score - scoreDeductions);
      const overallScore = Math.round((seo.score + calculatedUxScore + access.score + perf.score) / 4);

      logger.info(`[Website Analyzer] Completed audit successfully for: ${url}`);
      return {
        url,
        seo_score: seo.score,
        ux_score: calculatedUxScore,
        performance_score: perf.score,
        accessibility_score: access.score,
        overall_score: overallScore,
        tech_stack: {
          load_time_ms: loadTimeMs,
          page_size_kb: perf.page_size_kb || 0,
          resource_count: perf.resource_count || 0,
          ssl_enabled: seo.ssl_enabled,
          technologies: tech.technologies,
          images_count: access.total_images,
          missing_alt_count: access.missing_alt_images
        },
        social_links: contacts.social_links,
        emails: contacts.emails,
        phone_numbers: contacts.phone_numbers,
        screenshot_url: screenshotBase64 ? `data:image/jpeg;base64,${screenshotBase64}` : null,
        broken_links: brokenLinks,
        console_errors: consoleErrors,
        failed_requests: failedRequests,
        ui_issues: uiIssues
      };

    } catch (err) {
      logger.error(`[Website Analyzer] Modular Audit failed on ${url}: ${err.message}`);
      throw err;
    } finally {
      page.off('response', responseHandler);
    }
  }
}

module.exports = new WebsiteAnalyzer();
