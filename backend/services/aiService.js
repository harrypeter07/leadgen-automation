// backend/services/aiService.js
const geminiClient = require('../providers/gemini/client');
const logger = require('../worker/logger');

class AIService {
  /**
   * Draft a personalized outbound message based on structured business profile information and memory
   * @param {string} leadName Name of the lead/business
   * @param {string} industry Primary industry
   * @param {string[]} insights Array of key memory insights
   * @param {string[]} objections Array of objections raised so far
   * @param {Array<{direction: string, body: string}>} [lastMessages=[]] Last messages for conversation flow context
   * @returns {Promise<string>} Drafted outreach message body
   */
  async generateOutboundDraft(leadName, industry, insights, objections, lastMessages = []) {
    let settings = {
      company_name: "Zarss Dev",
      icp_description: "Singapore-based local businesses that have slow loading websites or poor SEO visibility.",
      offering_pitch: "We build a free custom homepage mockup showing how a modern, fast, and optimized design will improve conversions.",
      system_instructions: "You are a professional, helpful outreach assistant from Zarss. Write a friendly, highly-personalized message. Reference their business name and industry. Do not sound spammy or robotic. Keep it under 3 sentences."
    };

    try {
      const fs = require('fs');
      const path = require('path');
      const configPath = path.join(__dirname, '../config/outreach_settings.json');
      if (fs.existsSync(configPath)) {
        settings = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      }
    } catch (e) {
      logger.warn(`[AI Service] Failed to read dynamic outreach settings: ${e.message}`);
    }

    // Minimize history context (send max last 3 messages)
    const contextHistory = lastMessages.slice(-3).map(m => `${m.direction === 'inbound' ? 'Lead' : 'Sales'}: ${m.body}`).join('\n');

    const prompt = `
      ${settings.system_instructions}

      Sending Context:
      * Company Name: ${settings.company_name}
      * Ideal Customer Profile (ICP): ${settings.icp_description}
      * Our Offering / Pitch: ${settings.offering_pitch}

      Lead Info:
      * Name: ${leadName}
      * Industry: ${industry || 'Business Services'}
      * Custom Context/Insights: ${insights.join(', ') || 'None'}
      * Objections to address (if any): ${objections.join(', ') || 'None'}

      ${contextHistory ? `Recent conversation context:\n${contextHistory}\n` : ''}
      
      Draft the next message to send (just output the message text directly):
    `;

    return geminiClient.generateContent(prompt, false);
  }

  /**
   * Extract key business details from raw website page text
   * @param {string} pageText Visible text content of website homepage
   * @param {string} businessName Name of the business
   * @returns {Promise<{business_description: string|null, key_offerings: string[], contact_person: string|null, contact_position: string|null, scraped_email: string|null}>}
   */
  async extractBusinessDetails(pageText, businessName) {
    const prompt = `
      Analyze the following visible text from the website of "${businessName}" and extract key details for personalized sales outreach.
      Return the output as a clean, valid JSON object containing exactly these fields:
      1. "business_description": A professional 1-2 sentence description of what they do and who they serve. Keep it natural and objective.
      2. "key_offerings": An array of up to 4 key products, services, or solutions they specialize in.
      3. "contact_person": Name of a contact person, founder, owner, or executive if mentioned. Otherwise null.
      4. "contact_position": Position/title of the contact person if found (e.g. Owner, Founder, CEO, Manager). Otherwise null.
      5. "scraped_email": Any contact/sales email address visible in the text. Otherwise null.

      Website visible text:
      ${pageText.substring(0, 3500)}

      JSON format expected:
      {
        "business_description": "string" or null,
        "key_offerings": ["string"],
        "contact_person": "string" or null,
        "contact_position": "string" or null,
        "scraped_email": "string" or null
      }
    `;

    try {
      const responseJsonText = await geminiClient.generateContent(prompt, true);
      return JSON.parse(responseJsonText);
    } catch (err) {
      logger.warn({ error: err.message }, '[AI Service] Failed to parse business details from Gemini. Returning fallbacks.');
      return {
        business_description: null,
        key_offerings: [],
        contact_person: null,
        contact_position: null,
        scraped_email: null
      };
    }
  }

  /**
   * Synthesize raw scraper findings into structured observations, key insights, and objections
   * @param {string} scrapedContent Raw text extracted from profile, SEO data, or audit logs
   * @returns {Promise<{observations: Array<{type: string, content: string}>, insights: string[], objections: string[]}>}
   */
  async extractObservationsAndObjections(scrapedContent) {
    const prompt = `
      Analyze the following raw website scraper data / social audit dump and synthesize key findings.
      Return the output as a clean JSON object containing:
      1. "observations": Array of objects, each with "type" (e.g., 'tech_stack', 'pain_point', 'social_presence') and "content" (the specific finding details). Keep content concise. Limit to 3 items.
      2. "insights": Array of strings representing key insights/opportunities for sales outreach (limit to 2).
      3. "objections": Array of strings representing potential objections or hurdles (e.g. price, security, complexity) that might arise based on their setup.

      Raw Data Dump:
      ${scrapedContent.substring(0, 3000)} -- (truncated for context limit)

      JSON format expected:
      {
        "observations": [{"type": "string", "content": "string"}],
        "insights": ["string"],
        "objections": ["string"]
      }
    `;

    try {
      const responseJsonText = await geminiClient.generateContent(prompt, true);
      return JSON.parse(responseJsonText);
    } catch (err) {
      logger.warn({ error: err.message }, '[AI Service] Failed to parse JSON observations from Gemini. Returning fallback structure.');
      return {
        observations: [{ type: 'audit', content: 'Manual audit required due to processing failure.' }],
        insights: [],
        objections: []
      };
    }
  }

  /**
   * Classify user inbound message sentiment/intent
   * @param {string} body Message body
   * @returns {Promise<{classification: string, explanation: string}>}
   */
  async classifyInboundMessage(body) {
    const prompt = `
      Classify the following user message intent into one of these categories:
      - 'positive': The user is interested, wants a meeting, demo, or to book a call.
      - 'neutral': The user is asking questions, requesting more details, or neither positive nor negative.
      - 'negative': The user is not interested, or declined the offer.
      - 'stop': The user explicitly asks to stop messaging, unsubscribe, or remove from the list.

      User Message: "${body}"

      Return a JSON object:
      {
        "classification": "positive|neutral|negative|stop",
        "explanation": "brief reason"
      }
    `;

    try {
      const responseJsonText = await geminiClient.generateContent(prompt, true);
      return JSON.parse(responseJsonText);
    } catch (err) {
      return { classification: 'neutral', explanation: 'Fallback classification on parse failure.' };
    }
  }

  /**
   * Extract structured lead contact details from raw page content fetched via TinyFish
   * @param {string} content Raw webpage text/markdown
   * @returns {Promise<{name: string, phone: string|null, email: string|null, address: string|null, category: string|null, website: string|null}>}
   */
  async extractLeadFromText(content) {
    const prompt = `
      Extract key contact details from the following website content.
      Return the output as a clean JSON object containing:
      1. "name": The business name / title (string, e.g. "Netlight Consulting").
      2. "phone": Main contact phone number normalized (string or null).
      3. "email": General contact email address (string or null).
      4. "address": Street address or office location (string or null).
      5. "category": Industry / Category (string or null, e.g. "Software Consultant").
      6. "website": The official website URL (string or null).
      7. "contact_name": The key contact person's name (e.g. founder, owner, CEO, manager, director) if mentioned (string or null).
      8. "contact_role": The job role/title of this key contact person (string or null).
      9. "social_links": Array of social media URLs (LinkedIn, Facebook, Instagram, Twitter/X) found on the page (array of strings).

      Website content:
      ${content.substring(0, 5000)}

      JSON format expected:
      {
        "name": "string",
        "phone": "string" or null,
        "email": "string" or null,
        "address": "string" or null,
        "category": "string" or null,
        "website": "string" or null,
        "contact_name": "string" or null,
        "contact_role": "string" or null,
        "social_links": ["string"]
      }
    `;

    try {
      const responseJsonText = await geminiClient.generateContent(prompt, true);
      return JSON.parse(responseJsonText);
    } catch (err) {
      logger.warn({ error: err.message }, '[AI Service] Failed to parse JSON contact info from Gemini.');
      return {
        name: 'Unknown Business',
        phone: null,
        email: null,
        address: null,
        category: null,
        website: null,
        contact_name: null,
        contact_role: null,
        social_links: []
      };
    }
  }

  /**
   * Classify the next conversation stage based on memory and chat logs
   * @param {string} currentStage Current stage
   * @param {Array<{direction: string, body: string}>} messages Recent message logs
   * @returns {Promise<{nextStage: string, nextAction: string}>}
   */
  async classifyStage(currentStage, messages) {
    if (messages.length === 0) {
      return { nextStage: currentStage, nextAction: 'Initiate initial outreach contact.' };
    }

    const contextHistory = messages.slice(-3).map(m => `${m.direction === 'inbound' ? 'Lead' : 'Sales'}: ${m.body}`).join('\n');
    
    const prompt = `
      Classify the next stage and next action of a sales conversation.
      Current Stage: ${currentStage}
      
      Conversation History:
      ${contextHistory}
      
      Select the next logical stage from: ['lead_qualified', 'outreach_started', 'demo_scheduled', 'closed_won', 'closed_lost'].
      Also determine a brief description of the "nextAction".

      Return a JSON object:
      {
        "nextStage": "stage_name",
        "nextAction": "action_description"
      }
    `;

    try {
      const responseJsonText = await geminiClient.generateContent(prompt, true);
      return JSON.parse(responseJsonText);
    } catch (err) {
      return { nextStage: currentStage, nextAction: 'Follow up with lead on previous message.' };
    }
  }

  /**
   * Plan Instagram search queries targeted at finding profiles
   */
  async planInstagramSearch(keyword, city) {
    const prompt = `
      You are an expert lead generation assistant. Your goal is to find Instagram profiles of businesses or professionals matching the keyword "${keyword}" in "${city}".
      Generate exactly 3 different Google search queries using search operators (like site:instagram.com) that will return matching profiles.
      Make sure to target profile bios, usernames, and relevant hashtags in your queries.
      
      Return the output as a clean JSON object containing:
      "queries": ["string", "string", "string"]
      
      Example output format:
      {
        "queries": [
          "site:instagram.com \\"dentist\\" \\"Stockholm\\"",
          "site:instagram.com \\"dental clinic\\" Stockholm",
          "site:instagram.com \\"#stockholmdentist\\""
        ]
      }
    `;

    try {
      const responseJsonText = await geminiClient.generateContent(prompt, true);
      const parsed = JSON.parse(responseJsonText);
      return Array.isArray(parsed.queries) ? parsed.queries : [];
    } catch (err) {
      logger.warn({ error: err.message }, '[AI Service] Failed to plan Instagram search queries via Gemini.');
      return [
        `site:instagram.com ${keyword} "${city}"`,
        `site:instagram.com "${city}" ${keyword} profile`,
        `site:instagram.com "#${keyword.replace(/\s+/g, '').toLowerCase()}" "${city}"`
      ];
    }
  }

  /**
   * Extract contact information and lead details from Instagram profile bio text
   */
  async extractInstagramLead(displayName, bio, text) {
    const prompt = `
      Extract contact information and lead details from this Instagram profile.
      Display Name: ${displayName}
      Bio: ${bio}
      Additional text: ${text}
      
      Return a clean JSON object containing:
      1. "phone": Any phone number or WhatsApp contact (string or null).
      2. "email": Any email address found (string or null).
      3. "address": Location / city / address details (string or null).
      4. "category": Business category or industry (string or null).
      
      JSON format expected:
      {
        "phone": "string" or null,
        "email": "string" or null,
        "address": "string" or null,
        "category": "string" or null
      }
    `;

    try {
      const responseJsonText = await geminiClient.generateContent(prompt, true);
      return JSON.parse(responseJsonText);
    } catch (err) {
      logger.warn({ error: err.message }, '[AI Service] Failed to parse Instagram lead via Gemini.');
      return { phone: null, email: null, address: null, category: null };
    }
  }
}

module.exports = new AIService();
