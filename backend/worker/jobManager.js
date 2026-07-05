// backend/worker/jobManager.js
// JSONB approach: leads are accumulated in memory and stored on the job record.
// No per-lead DB writes. User explicitly saves leads from the frontend.

const scrapeJobRepository = require('../repositories/scrapeJobRepository');
const leadsRepository = require('../repositories/leadsRepository');
const browserManager = require('./browserManager');
const eventBus = require('./eventBus');
const logger = require('./logger');

const GoogleMapsProvider = require('../providers/googleMaps/provider');
const GoogleSearchProvider = require('../providers/googleSearch/provider');
const FacebookProvider = require('../providers/facebook/provider');
const RedditProvider = require('../providers/reddit/provider');
const LinkedInProvider = require('../providers/linkedin/provider');
const TinyFishProvider = require('../providers/tinyfish/provider');
const InstagramProvider = require('../providers/instagram/provider');
const emailScraper = require('../services/emailScraper');

class JobManager {
  constructor() {
    this.activeAborts = new Map(); // jobId -> boolean flag
    this.providers = {
      'google_maps': new GoogleMapsProvider(),
      'google_search': new GoogleSearchProvider(),
      'facebook': new FacebookProvider(),
      'reddit': new RedditProvider(),
      'linkedin': new LinkedInProvider(),
      'tinyfish': new TinyFishProvider(),
      'instagram': new InstagramProvider()
    };
  }

  async executeJob(job, workerId) {
    const startTime = Date.now();
    const fullProviderName = job.current_provider || 'google_maps';
    const providerName = fullProviderName.split(':')[0];
    const provider = this.providers[providerName];

    if (!provider) {
      throw new Error(`PROVIDER_NOT_REGISTERED: ${providerName}`);
    }

    const enrichEmails = fullProviderName.includes(':email');
    logger.info(`[JobManager] Initiating job ${job.id} on worker #${workerId} using provider ${providerName} (Enrich Emails: ${enrichEmails})`);
    this.activeAborts.set(job.id, false);

    const { context, contextId } = await browserManager.newContext();
    const { page, pageId } = await browserManager.newPage(contextId, context);

    const scrapedLeads = [];

    try {
      // 1. Search Query phase
      const freshJob = await scrapeJobRepository.getById(job.id);
      const logs = freshJob.logs || [];
      logs.push(`[${new Date().toISOString()}] Initiating provider search query...`);

      // Parse brackets notation to extract area if present
      let searchKeyword = job.keyword;
      let searchArea = null;
      const areaMatch = job.keyword.match(/^(.*?)\s*\[Area:\s*(.*?)\]$/);
      if (areaMatch) {
        searchKeyword = areaMatch[1];
        searchArea = areaMatch[2];
      }

      await provider.search(page, { keyword: searchKeyword, city: job.city, area: searchArea });

      // 2. Collection Scroll phase
      logs.push(`[${new Date().toISOString()}] Scrolling list for listings elements...`);
      await scrapeJobRepository.update(job.id, { logs });

      const totalItems = await provider.collect(page, job.max_leads || 10);
      const limit = Math.min(totalItems, job.max_leads || 10);

      logs.push(`[${new Date().toISOString()}] Found ${totalItems} elements. Extracting ${limit} leads...`);
      await scrapeJobRepository.update(job.id, { logs });

      // 3. Details Extraction Loop — seenKeys prevents any in-memory duplicates (Concurrent Pool Execution!)
      const seenKeys = new Set();
      const concurrencyLimit = job.worker_count || 1;
      const indices = Array.from({ length: limit }, (_, idx) => idx);

      const processIndex = async (i) => {
        if (this.activeAborts.get(job.id) === true) {
          return;
        }

        try {
          const raw = await provider.extract(page, i, job.version || 'v2');
          if (!raw) return;

          const lead = provider.normalize(raw, job.city);

          // Deduplicate in memory: skip if same name+phone seen before
          const dedupeKey = `${(lead.name || '').toLowerCase().trim()}|${(lead.phone || '').replace(/\s/g, '')}`;
          if (seenKeys.has(dedupeKey)) {
            logger.warn(`[JobManager] Duplicate skipped in-memory: ${lead.name} (${lead.phone})`);
            return;
          }
          seenKeys.add(dedupeKey);

          // Email Enrichment if enabled
          if (enrichEmails && lead.website) {
            const emailPage = await context.newPage().catch(() => null);
            if (emailPage) {
              try {
                logger.info(`[JobManager] Scraping email for ${lead.name} from: ${lead.website}`);
                // Enforce 30-second absolute timeout for email scraping
                const scrapePromise = emailScraper.scrapeEmail(emailPage, lead.website);
                const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(null), 30000));
                
                const email = await Promise.race([scrapePromise, timeoutPromise]);
                if (email) {
                  lead.email = email;
                  logger.info(`[JobManager] ✅ Found email: ${email}`);
                }
              } catch (e) {
                logger.warn(`[JobManager] Email enrichment failed for ${lead.website}: ${e.message}`);
              } finally {
                await emailPage.close().catch(() => {});
              }
            }
          }

          // Write to leads database in real-time
          try {
            await leadsRepository.upsert({ ...lead, job_id: job.id });
          } catch (dbErr) {
            logger.error(`[JobManager] Real-time save failed for ${lead.name}: ${dbErr.message}`);
          }

          scrapedLeads.push(lead);

          const elapsed = (Date.now() - startTime) / 1000;
          const avg = elapsed / scrapedLeads.length;
          const estRemaining = Math.round(avg * (limit - scrapedLeads.length));

          // Single update: progress + accumulated leads
          const currentFresh = await scrapeJobRepository.getById(job.id);
          const loopLogs = currentFresh ? (currentFresh.logs || []) : [];
          loopLogs.push(`[${new Date().toISOString()}] Extracted: ${lead.name} (${lead.phone || 'no phone'})`);

          await scrapeJobRepository.update(job.id, {
            progress: scrapedLeads.length,
            current_business: lead.name,
            estimated_remaining_seconds: estRemaining,
            duration_seconds: Math.round(elapsed),
            scraped_leads: scrapedLeads,
            logs: loopLogs
          });

          eventBus.publish('job.progress', { jobId: job.id, progress: scrapedLeads.length, maxLeads: limit });
          logger.info(`[JobManager] [${scrapedLeads.length}/${limit}] Extracted: ${lead.name}`);
        } catch (err) {
          logger.error(`[JobManager] Error extracting lead at index ${i}: ${err.message}`);
        }
      };

      // Simple concurrent queue execution pool
      const pool = [];
      const queue = [...indices];

      const worker = async () => {
        while (queue.length > 0) {
          const item = queue.shift();
          if (item !== undefined) {
            await processIndex(item);
          }
        }
      };

      for (let w = 0; w < Math.min(concurrencyLimit, limit); w++) {
        pool.push(worker());
      }
      await Promise.all(pool);

      // 4. Mark Job completed — keep scraped_leads for user to review & save
      const finalFresh = await scrapeJobRepository.getById(job.id);
      const finalLogs = finalFresh.logs || [];
      finalLogs.push(`[${new Date().toISOString()}] Job completed. ${scrapedLeads.length} leads ready to save.`);

      await scrapeJobRepository.update(job.id, {
        status: 'completed',
        completed_at: new Date().toISOString(),
        logs: finalLogs
        // scraped_leads stays on the record for the user to review
      });

      eventBus.publish('job.completed', { jobId: job.id, status: 'completed', count: scrapedLeads.length });

    } catch (err) {
      const freshJob = await scrapeJobRepository.getById(job.id);
      const logs = freshJob ? (freshJob.logs || []) : [];

      if (err.message === 'JOB_ABORTED') {
        logs.push(`[${new Date().toISOString()}] Job stopped by user. ${scrapedLeads.length} partial leads saved on job record.`);
        await scrapeJobRepository.update(job.id, {
          status: 'stopped',
          completed_at: new Date().toISOString(),
          scraped_leads: scrapedLeads, // Keep partial results
          logs
        });
        eventBus.publish('job.completed', { jobId: job.id, status: 'stopped' });
      } else {
        logs.push(`[${new Date().toISOString()}] Execution Error: ${err.message}`);
        await scrapeJobRepository.update(job.id, {
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_count: (freshJob?.error_count || 0) + 1,
          scraped_leads: scrapedLeads, // Keep whatever was extracted before crash
          logs
        });
        eventBus.publish('job.failed', { jobId: job.id, error: err.message });
        throw err;
      }
    } finally {
      await browserManager.releasePage(pageId);
      await browserManager.releaseContext(contextId);
      this.activeAborts.delete(job.id);
    }
  }

  stop(jobId) {
    if (this.activeAborts.has(jobId)) {
      this.activeAborts.set(jobId, true);
      return true;
    }
    return false;
  }
}

module.exports = new JobManager();
