// backend/providers/website/analyzer.js

const logger = require('../../worker/logger');

class WebsiteAnalyzer {
  constructor() {
    this.name = 'website';
  }

  async audit(page, url) {
    logger.info(`[Website Analyzer] Initiating audit on: ${url}`);
    const startTime = Date.now();

    try {
      const resp = await page.goto(url, { timeout: 20000, waitUntil: 'domcontentloaded' });
      const loadTimeMs = Date.now() - startTime;
      
      const pageTitle = await page.title().catch(() => '');
      const currentUrl = page.url();
      const isSsl = currentUrl.startsWith('https:');

      // 1. SEO elements extraction
      const seo = await page.evaluate(() => {
        const descNode = document.querySelector('meta[name="description"]');
        const ogTitle = document.querySelector('meta[property="og:title"]');
        const ogDesc = document.querySelector('meta[property="og:description"]');
        const h1s = Array.from(document.querySelectorAll('h1')).map(el => el.innerText.trim());
        
        return {
          description: descNode ? descNode.getAttribute('content') : null,
          og_title: ogTitle ? ogTitle.getAttribute('content') : null,
          og_description: ogDesc ? ogDesc.getAttribute('content') : null,
          h1_count: h1s.length,
          h1_headings: h1s
        };
      }).catch(() => ({ h1_count: 0, h1_headings: [] }));

      // 2. Contacts (Emails & Phones parsing)
      const pageContent = await page.content().catch(() => '');
      
      // Parse emails (simple regex)
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      const emails = Array.from(new Set(pageContent.match(emailRegex) || []));

      // Parse phone numbers
      const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
      const phoneNumbers = Array.from(new Set(pageContent.match(phoneRegex) || []));

      // 3. Social links & Tech stack indicators
      const links = await page.evaluate(() => {
        const anchors = Array.from(document.querySelectorAll('a[href]'));
        const hrefs = anchors.map(a => a.href.trim());

        const socialPatterns = {
          instagram: /instagram\.com/i,
          facebook: /facebook\.com/i,
          linkedin: /linkedin\.com/i,
          twitter: /(twitter\.com|x\.com)/i,
          youtube: /youtube\.com/i,
          whatsapp: /(wa\.me|api\.whatsapp\.com)/i
        };

        const socialLinks = [];
        hrefs.forEach(h => {
          for (const key in socialPatterns) {
            if (socialPatterns[key].test(h)) {
              socialLinks.push(h);
            }
          }
        });

        // Basic tech stack audits
        const html = document.documentElement.innerHTML;
        const techs = [];
        if (html.includes('wp-content')) techs.push('WordPress');
        if (html.includes('__NEXT_DATA__')) techs.push('Next.js');
        if (html.includes('googletagmanager') || html.includes('google-analytics')) techs.push('Google Analytics');
        if (html.includes('cdn.shopify.com')) techs.push('Shopify');
        if (html.includes('elementor')) techs.push('Elementor');

        // UI/UX indicators
        const ctaCount = document.querySelectorAll('button, a[href*="contact"], a[href*="book"], a[href*="quote"]').length;
        const heroExists = !!document.querySelector('.hero, #hero, section[class*="hero"]');
        const navExists = !!document.querySelector('nav, header');

        // Accessibility metrics
        const totalImages = document.querySelectorAll('img').length;
        const missingAltImages = document.querySelectorAll('img:not([alt]), img[alt=""]').length;

        return {
          socialLinks: Array.from(new Set(socialLinks)),
          techs,
          ctaCount,
          heroExists,
          navExists,
          totalImages,
          missingAltImages
        };
      }).catch(() => ({ socialLinks: [], techs: [], ctaCount: 0, heroExists: false, navExists: false, totalImages: 0, missingAltImages: 0 }));

      // 4. Score metrics calculation
      let seoScore = 100;
      if (!pageTitle) seoScore -= 20;
      if (!seo.description) seoScore -= 20;
      if (seo.h1_count === 0) seoScore -= 20;
      if (seo.h1_count > 1) seoScore -= 10;
      if (!isSsl) seoScore -= 10;

      let uxScore = 60;
      if (links.heroExists) uxScore += 20;
      if (links.navExists) uxScore += 10;
      if (links.ctaCount > 0) uxScore += 10;

      let accessibilityScore = 100;
      if (links.totalImages > 0) {
        const missingPct = links.missingAltImages / links.totalImages;
        accessibilityScore -= Math.round(missingPct * 50);
      }

      let performanceScore = 100;
      if (loadTimeMs > 4000) {
        performanceScore = 50;
      } else if (loadTimeMs > 2000) {
        performanceScore = 80;
      }

      const overallScore = Math.round((seoScore + uxScore + accessibilityScore + performanceScore) / 4);

      return {
        url,
        seo_score: seoScore,
        ux_score: uxScore,
        performance_score: performanceScore,
        accessibility_score: accessibilityScore,
        overall_score: overallScore,
        tech_stack: {
          load_time_ms: loadTimeMs,
          ssl_enabled: isSsl,
          technologies: links.techs,
          images_count: links.totalImages,
          missing_alt_count: links.missingAltImages
        },
        social_links: links.socialLinks,
        emails,
        phone_numbers: phoneNumbers,
        screenshot_url: null
      };

    } catch (err) {
      logger.error(`[Website Analyzer] Audit failed on ${url}: ${err.message}`);
      throw err;
    }
  }
}

module.exports = new WebsiteAnalyzer();
