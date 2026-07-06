// backend/services/emailScraper.js
//
// Priority pipeline:
//  1. mailto: anchor links (most reliable)
//  2. Visible body text regex scan
//  3. Find a Contact/About sub-page and repeat 1-2
//  4. Raw HTML source regex (catches JS-encoded emails)

const BLACKLIST_DOMAINS = [
  'sentry.io', 'example.com', 'w3.org', 'domain.com',
  'yourdomain', 'test.com', 'noreply', 'no-reply',
  'wixpress', 'squarespace', 'shopify', 'wordpress',
  'schema.org', 'googleapis', 'facebook', 'instagram',
];

const BLACKLIST_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.pdf'];

const CONTACT_KEYWORDS = ['contact', 'about', 'reach', 'support', 'help', 'connect', 'touch'];

class EmailScraper {
  /**
   * @param {import('playwright').Page} page - A Playwright page (stealth-configured browser context expected)
   * @param {string} url - Business website URL
   * @returns {Promise<string|null>}
   */
  async scrapeEmail(page, url) {
    if (!url || !url.startsWith('http')) return null;

    try {
      // Set realistic user-agent to reduce bot detection
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      });

      await page.goto(url, {
        timeout: 12000,
        waitUntil: 'domcontentloaded',
      }).catch(() => {});

      // Wait a bit for JS to settle
      await page.waitForTimeout(800).catch(() => {});

      // Step 1: mailto links
      const mailtoEmail = await this._extractMailto(page);
      if (mailtoEmail) return mailtoEmail;

      // Step 2: visible text
      const textEmail = await this._extractFromText(page);
      if (textEmail) return textEmail;

      // Step 3: find contact page
      const contactUrl = await this._findContactLink(page, url);
      if (contactUrl && contactUrl !== url) {
        await page.goto(contactUrl, { timeout: 10000, waitUntil: 'domcontentloaded' }).catch(() => {});
        await page.waitForTimeout(600).catch(() => {});

        const m = await this._extractMailto(page);
        if (m) return m;

        const t = await this._extractFromText(page);
        if (t) return t;
      }

      // Step 4: raw HTML
      const htmlEmail = await this._extractFromHTML(page);
      if (htmlEmail) return htmlEmail;

    } catch (_) {
      // email is a bonus — never throw
    }

    return null;
  }

  async _extractMailto(page) {
    try {
      const emails = await page.evaluate(() =>
        Array.from(document.querySelectorAll('a[href^="mailto:"]'))
          .map(a => a.getAttribute('href').replace(/^mailto:/i, '').split('?')[0].trim().toLowerCase())
          .filter(e => e.includes('@') && e.length > 5)
      ).catch(() => []);
      return this._pickBest(emails);
    } catch { return null; }
  }

  async _extractFromText(page) {
    try {
      const text = await page.evaluate(() => document.body?.innerText || '').catch(() => '');
      if (text.length < 100) return null; // page didn't load properly
      const matches = (text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) || []).map(e => e.toLowerCase());
      return this._pickBest(matches);
    } catch { return null; }
  }

  async _extractFromHTML(page) {
    try {
      const html = await page.content().catch(() => '');
      const matches = (html.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) || []).map(e => e.toLowerCase());
      return this._pickBest(matches);
    } catch { return null; }
  }

  async _findContactLink(page, baseUrl) {
    try {
      const links = await page.evaluate((keywords) => {
        return Array.from(document.querySelectorAll('a[href]'))
          .map(a => ({ text: (a.innerText || '').toLowerCase().trim(), href: a.href || '' }))
          .filter(({ text, href }) =>
            keywords.some(k => text.includes(k) || href.toLowerCase().includes(k)) &&
            href.startsWith('http') &&
            !href.includes('#')
          )
          .map(({ href }) => href)
          .slice(0, 5);
      }, CONTACT_KEYWORDS).catch(() => []);

      // Prefer same-domain links
      const sameDomain = links.find(l => {
        try { return new URL(l).hostname === new URL(baseUrl).hostname; } catch { return false; }
      });
      return sameDomain || links[0] || null;
    } catch { return null; }
  }

  _pickBest(emails) {
    if (!emails || emails.length === 0) return null;
    return emails.find(email => {
      if (!email || !email.includes('@')) return false;
      const lower = email.toLowerCase();
      if (BLACKLIST_DOMAINS.some(d => lower.includes(d))) return false;
      if (BLACKLIST_EXTENSIONS.some(ext => lower.endsWith(ext))) return false;
      const tld = lower.split('.').pop();
      if (!tld || tld.length < 2 || tld.length > 6) return false;
      // Must have something before @ (at least 2 chars)
      const local = lower.split('@')[0];
      if (!local || local.length < 2) return false;
      return true;
    }) || null;
  }

  async scrapeContactDetails(page, url) {
    if (!url || !url.startsWith('http')) return { email: null, phone: null };
    let email = null;
    let phone = null;
    try {
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      });
      await page.goto(url, { timeout: 12000, waitUntil: 'domcontentloaded' }).catch(() => {});
      await page.waitForTimeout(800).catch(() => {});

      email = await this._extractMailto(page);
      if (!email) email = await this._extractFromText(page);
      phone = await this._extractPhoneFromText(page);

      if (!email || !phone) {
        const contactUrl = await this._findContactLink(page, url);
        if (contactUrl && contactUrl !== url) {
          await page.goto(contactUrl, { timeout: 10000, waitUntil: 'domcontentloaded' }).catch(() => {});
          await page.waitForTimeout(600).catch(() => {});
          if (!email) email = await this._extractMailto(page) || await this._extractFromText(page);
          if (!phone) phone = await this._extractPhoneFromText(page);
        }
      }

      if (!email) email = await this._extractFromHTML(page);
    } catch (_) {}
    return { email, phone };
  }

  async _extractPhoneFromText(page) {
    try {
      const text = await page.evaluate(() => document.body?.innerText || '').catch(() => '');
      const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\+?\d{8,15}/g;
      const matches = text.match(phoneRegex) || [];
      const validPhone = matches.find(p => {
        const digits = p.replace(/\D/g, '');
        return digits.length >= 8 && digits.length <= 15;
      });
      return validPhone ? validPhone.trim() : null;
    } catch {
      return null;
    }
  }
}

module.exports = new EmailScraper();
