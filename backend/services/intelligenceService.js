// backend/services/intelligenceService.js
const db = require('../database/db');
const { handleDbError } = require('../database/dbErrorHandler');
const businessRepo = require('../repositories/businessRepository');
const memoryRepo = require('../repositories/memoryRepository');
const researchRepo = require('../repositories/researchRepository');
const aiService = require('./aiService');
const logger = require('../worker/logger');

class IntelligenceService {
  /**
   * Synthesize raw scraping data for a lead into observations and memories
   * @param {string} leadId Lead ID (UUID)
   * @param {string} scrapedText Raw scraped text dump
   * @returns {Promise<{success: boolean, observationsCount: number}>}
   */
  async analyzeScrapeResults(leadId, scrapedText) {
    logger.info({ leadId }, '[Intelligence Service] Analyzing scraping findings for lead...');

    // 1. Get business profile
    const profile = await businessRepo.findByLeadId(leadId);
    if (!profile) {
      throw new Error(`Business profile not found for lead ID ${leadId}. Initiate outreach first.`);
    }

    // 2. Call Gemini via aiService to extract observations, insights, and objections
    const extracted = await aiService.extractObservationsAndObjections(scrapedText);
    logger.info({
      leadId,
      observationsFound: extracted.observations.length,
      insightsFound: extracted.insights.length,
      objectionsFound: extracted.objections.length
    }, '[Intelligence Service] AI extraction completed.');

    // 3. Persist observations & memory inside an atomic database transaction
    await db.transaction(async (tx) => {
      // 3.1 Store observations
      for (const obs of extracted.observations) {
        await memoryRepo.createObservation({
          business_id: profile.id,
          observation_type: obs.type,
          content: obs.content,
          confidence_score: 0.9,
          source: 'scraping_audit'
        }, tx);
      }

      // 3.2 Update or create business memory
      const existingMemory = await memoryRepo.findByLeadId(leadId, tx);
      
      if (existingMemory) {
        // Merge insights and objections while filtering duplicates
        const key_insights = Array.from(new Set([...(existingMemory.key_insights || []), ...extracted.insights]));
        const objections_raised = Array.from(new Set([...(existingMemory.objections_raised || []), ...extracted.objections]));
        
        await memoryRepo.update(existingMemory.id, {
          key_insights,
          objections_raised,
          summary: `Aggregated audit summary. Insights: ${key_insights.length} recorded. Objections: ${objections_raised.length} mapped.`
        }, tx);
      } else {
        await memoryRepo.create({
          business_id: profile.id,
          key_insights: extracted.insights,
          objections_raised: extracted.objections,
          summary: `Initial automated audit memory generated from scraper results.`
        }, tx);
      }
    }, 'IntelligenceService.analyzeScrapeResults');

    return {
      success: true,
      observationsCount: extracted.observations.length
    };
  }

  /**
   * Fetch complete consolidated context (profile, memory, research, observations) for a lead
   * @param {string} leadId Lead ID (UUID)
   * @returns {Promise<{profile: Object, memory: Object, research: Object[], observations: Object[]}>}
   */
  async getLeadContext(leadId) {
    const profile = await businessRepo.findByLeadId(leadId);
    if (!profile) {
      return { profile: null, memory: null, research: [], observations: [] };
    }

    const [memory, research, observations] = await Promise.all([
      memoryRepo.findByLeadId(leadId),
      researchRepo.findByLeadId(leadId),
      memoryRepo.getObservationsByLeadId(leadId)
    ]);

    return {
      profile,
      memory,
      research,
      observations
    };
  }

  /**
   * Run automated business research, social discovery, and website auditing for a lead.
   * Caches results for 24 hours to prevent redundant crawling and API queries.
   * @param {string} leadId Lead ID (UUID)
   * @returns {Promise<Object>} Consolidated research results
   */
  async runBusinessResearch(leadId) {
    logger.info({ leadId }, '[Intelligence Service] Running automated business research...');

    // 1. Check Cache (Deduplication within 24 hours)
    const existingResearch = await researchRepo.findByLeadId(leadId);
    if (existingResearch && existingResearch.length > 0) {
      const latest = existingResearch[0];
      const ageMs = Date.now() - new Date(latest.updated_at).getTime();
      if (ageMs < 24 * 60 * 60 * 1000) {
        logger.info({ leadId, ageHours: Math.round(ageMs / 3600000) }, '[Intelligence Service] Cache HIT: returning cached research data.');
        return { success: true, cached: true, research: latest };
      }
    }

    // 2. Initialize Business Profile & State if not exists (avoid circular deps)
    let profile = await businessRepo.findByLeadId(leadId);
    if (!profile) {
      logger.info({ leadId }, '[Intelligence Service] Auto-initializing business profile...');
      const leadsRepository = require('../repositories/leadsRepository');
      const conversationRepo = require('../repositories/conversationRepository');
      const lead = await leadsRepository.getById(leadId);
      
      profile = await db.transaction(async (tx) => {
        const p = await businessRepo.create({
          lead_id: leadId,
          business_name: lead.name,
          website: lead.website,
          email: lead.email,
          phone: lead.phone,
          address: lead.address
        }, tx);
        await conversationRepo.create({
          business_id: p.id,
          current_stage: 'lead_qualified',
          next_action: 'Perform automated audit'
        }, tx);
        return p;
      }, 'IntelligenceService.autoInitialize');
    }

    // 3. Playwright Website Scraper Audit
    const browserManager = require('../worker/browserManager');
    const websiteAnalyzer = require('../providers/website/analyzer');
    const discoveryService = require('./discoveryService');

    let auditResult = null;
    let socialLinks = { ...(profile.social_links || {}) };

    if (profile.website) {
      const { context, contextId } = await browserManager.newContext();
      const { page, pageId } = await browserManager.newPage(contextId, context);
      try {
        auditResult = await websiteAnalyzer.audit(page, profile.website);
        if (auditResult.social_links) {
          auditResult.social_links.forEach(link => {
            if (link.includes('facebook.com')) socialLinks.facebook = link;
            if (link.includes('instagram.com')) socialLinks.instagram = link;
            if (link.includes('linkedin.com')) socialLinks.linkedin = link;
            if (link.includes('twitter.com') || link.includes('x.com')) socialLinks.twitter = link;
            if (link.includes('youtube.com')) socialLinks.youtube = link;
          });
        }
      } catch (err) {
        logger.warn({ leadId, error: err.message }, `[Intelligence Service] Playwright website audit failed: ${err.message}`);
      } finally {
        await browserManager.releasePage(pageId);
        await browserManager.releaseContext(contextId);
      }
    }

    // 4. Social Search Finder
    try {
      const discoveredSocials = await discoveryService.discoverSocials(profile.business_name, profile.website, profile.phone);
      socialLinks = {
        ...socialLinks,
        ...Object.fromEntries(Object.entries(discoveredSocials).filter(([_, v]) => v !== null))
      };
    } catch (socialErr) {
      logger.warn({ leadId, error: socialErr.message }, `[Intelligence Service] Social discovery finder failed: ${socialErr.message}`);
    }

    // 5. Update Profile details
    const email = (auditResult && auditResult.emails && auditResult.emails.length > 0) ? auditResult.emails[0] : profile.email;
    const phone = (auditResult && auditResult.phone_numbers && auditResult.phone_numbers.length > 0) ? auditResult.phone_numbers[0] : profile.phone;
    
    await businessRepo.update(profile.id, {
      email,
      phone,
      social_links: socialLinks
    });

    // 6. Create Research findings entry
    const findings = auditResult || { socialLinks };
    const overallScore = auditResult ? auditResult.overall_score : null;
    const summary = auditResult 
      ? `Website audit completed with overall score: ${overallScore}/100. Found ${auditResult.emails.length} emails, ${auditResult.phone_numbers.length} contact phones.`
      : `Social discovery completed. Found socials: ${Object.keys(socialLinks).filter(k => socialLinks[k]).join(', ') || 'none'}`;

    const research = await researchRepo.create({
      business_id: profile.id,
      research_topic: 'website_audit',
      findings,
      summary,
      source_urls: profile.website ? [profile.website] : []
    });

    // 7. Synthesize findings text & extract observations via AI
    let findingsText = `Business Name: ${profile.business_name}\n`;
    if (profile.website) {
      findingsText += `Website: ${profile.website}\n`;
    }
    if (auditResult) {
      findingsText += `Website Audit Scores:\n- Overall Score: ${auditResult.overall_score}\n- SEO: ${auditResult.seo_score}\n- UX: ${auditResult.ux_score}\n- Performance: ${auditResult.performance_score}\n- Accessibility: ${auditResult.accessibility_score}\n`;
      if (auditResult.emails && auditResult.emails.length > 0) {
        findingsText += `Found Emails: ${auditResult.emails.join(', ')}\n`;
      }
      if (auditResult.ui_issues && auditResult.ui_issues.length > 0) {
        findingsText += `UI Layout/Heuristic Issues:\n${auditResult.ui_issues.map(i => `- ${i.message}`).join('\n')}\n`;
      }
      if (auditResult.console_errors && auditResult.console_errors.length > 0) {
        findingsText += `Console Errors:\n${auditResult.console_errors.map(e => `- ${e}`).join('\n')}\n`;
      }
      if (auditResult.broken_links && auditResult.broken_links.length > 0) {
        findingsText += `Broken Links:\n${auditResult.broken_links.map(l => `- [${l.text}] ${l.href} (Status: ${l.status})`).join('\n')}\n`;
      }
    } else {
      findingsText += `No website audit conducted. Active Social Links:\n${JSON.stringify(socialLinks, null, 2)}\n`;
    }

    await this.analyzeScrapeResults(leadId, findingsText);

    return {
      success: true,
      cached: false,
      research
    };
  }
}

module.exports = new IntelligenceService();
