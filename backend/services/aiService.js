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
    // Minimize history context (send max last 3 messages)
    const contextHistory = lastMessages.slice(-3).map(m => `${m.direction === 'inbound' ? 'Lead' : 'Sales'}: ${m.body}`).join('\n');

    const prompt = `
      You are an expert sales outreach assistant. Write a highly personalized, natural-sounding message to a lead.
      Avoid corporate speak, buzzwords, or sounding robotic. Keep it under 3-4 sentences.

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

      Website content:
      ${content.substring(0, 4000)}

      JSON format expected:
      {
        "name": "string",
        "phone": "string" or null,
        "email": "string" or null,
        "address": "string" or null,
        "category": "string" or null,
        "website": "string" or null
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
        website: null
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
}

module.exports = new AIService();
