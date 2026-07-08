const { fetchWithRetry, safeJson } = require('../utils/httpClient');
const logger = require('../utils/logger');

const BACKEND_URL = process.env.AGENTIC_BACKEND_URL;
const TINYFISH_URL = process.env.TINYFISH_BASE_URL || 'https://api.tinyfish.ai';
const TOOL_TIMEOUT_MS = Number(process.env.TOOL_CALL_TIMEOUT_MS || 20000);

/**
 * IMPORTANT: the backend endpoints referenced below (/api/enrich/*) are PROPOSED
 * in the backend build-out prompt but may not exist yet depending on build order.
 * Each dispatch function fails gracefully (returns { error, skip: true }) rather
 * than throwing, so the loop treats a missing endpoint the same as "tool tried,
 * no result" instead of crashing. Confirm/adjust these paths once the backend
 * build-out is actually done.
 */

const TOOLS = [
  {
    name: 'website_email_scrape',
    description: 'Extract an email address from a business website (homepage + contact/about pages). Cheapest option — always try first if a website URL is known.',
    parameters: {
      type: 'OBJECT',
      properties: { website: { type: 'STRING', description: 'Full website URL' } },
      required: ['website'],
    },
    isPaid: false,
    dispatch: async (args) => callBackend('/api/enrich/website-email', { website: args.website }),
  },
  {
    name: 'facebook_messenger_scrape',
    description: 'Search Facebook for the business page and extract Messenger contact link, email, or phone from the About section. Best for local retail/restaurants with weak websites.',
    parameters: {
      type: 'OBJECT',
      properties: {
        business_name: { type: 'STRING' },
        city: { type: 'STRING' },
      },
      required: ['business_name'],
    },
    isPaid: false,
    dispatch: async (args) => callBackend('/api/enrich/facebook', { business_name: args.business_name, city: args.city }),
  },
  {
    name: 'reddit_scrape',
    description: 'Search Reddit for mentions of this business/niche as an intent signal. Does NOT return contact info directly — use only for qualification signal, not email/phone discovery.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: { type: 'STRING', description: 'Search terms, e.g. business name or niche + city' },
      },
      required: ['query'],
    },
    isPaid: false,
    dispatch: async (args) => callBackend('/api/enrich/reddit', { query: args.query }),
  },
  {
    name: 'linkedin_scrape',
    description: 'Find a decision-maker (owner/manager name + title) for a business via LinkedIn. Best for B2B/professional services. Skip for retail/restaurants — low yield, and this is a paid call.',
    parameters: {
      type: 'OBJECT',
      properties: { business_name: { type: 'STRING' } },
      required: ['business_name'],
    },
    isPaid: true,
    dispatch: async (args) => callBackend('/api/enrich/linkedin', { business_name: args.business_name }),
  },
  {
    name: 'tinyfish_search',
    description: 'Open-web search for a business to find its website, listings, or social profiles when nothing else is known yet.',
    parameters: {
      type: 'OBJECT',
      properties: { query: { type: 'STRING' } },
      required: ['query'],
    },
    isPaid: false,
    dispatch: async (args) => callTinyFish('/search', { query: args.query }),
  },
  {
    name: 'tinyfish_fetch',
    description: 'Render and fetch a specific URL as clean markdown, for JS-heavy pages. Use when you already have a URL to inspect (e.g. a website found via search) but need its rendered content.',
    parameters: {
      type: 'OBJECT',
      properties: { url: { type: 'STRING' } },
      required: ['url'],
    },
    isPaid: false,
    dispatch: async (args) => callTinyFish('/fetch', { urls: [args.url] }),
  },
  {
    name: 'hunter_pattern_guess',
    description: 'Guess an email using a known name + company domain email pattern. Only useful once owner_name AND a domain are both already known.',
    parameters: {
      type: 'OBJECT',
      properties: {
        owner_name: { type: 'STRING' },
        domain: { type: 'STRING' },
      },
      required: ['owner_name', 'domain'],
    },
    isPaid: true,
    dispatch: async (args) => callBackend('/api/enrich/email-pattern', { owner_name: args.owner_name, domain: args.domain }),
  },
  {
    name: 'email_verify',
    description: 'Verify an email address is deliverable before marking a lead as complete. ALWAYS call this once, right before finishing, if any email was found.',
    parameters: {
      type: 'OBJECT',
      properties: { email: { type: 'STRING' } },
      required: ['email'],
    },
    isPaid: false,
    dispatch: async (args) => callBackend('/api/enrich/email-verify', { email: args.email }),
  },
];

async function callBackend(path, body) {
  if (!BACKEND_URL) {
    return { error: 'AGENTIC_BACKEND_URL not configured', skip: true };
  }
  try {
    const res = await fetchWithRetry(
      `${BACKEND_URL}${path}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
      { timeoutMs: TOOL_TIMEOUT_MS, retries: 1 }
    );
    const { ok, data, error } = await safeJson(res);
    if (!ok) return { error, skip: false };
    return data;
  } catch (err) {
    logger.warn({ path, error: err.message }, 'Tool call to backend failed');
    return { error: err.message, skip: false };
  }
}

async function callTinyFish(path, body) {
  const apiKey = process.env.TINYFISH_API_KEY;
  if (!apiKey) {
    return { error: 'TINYFISH_API_KEY not configured', skip: true };
  }
  try {
    const res = await fetchWithRetry(
      `${TINYFISH_URL}${path}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(body),
      },
      { timeoutMs: TOOL_TIMEOUT_MS, retries: 1 }
    );
    const { ok, data, error } = await safeJson(res);
    if (!ok) return { error, skip: false };
    return data;
  } catch (err) {
    logger.warn({ path, error: err.message }, 'Tool call to TinyFish failed');
    return { error: err.message, skip: false };
  }
}

function getFunctionDeclarations() {
  return TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: t.parameters,
  }));
}

function getToolByName(name) {
  return TOOLS.find((t) => t.name === name);
}

module.exports = { TOOLS, getFunctionDeclarations, getToolByName };
