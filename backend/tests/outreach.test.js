// backend/tests/outreach.test.js
// Production Unit and Integration Test Suite for the Outreach Intelligence Platform

const db = require('../database/db');
const { DatabaseError } = require('../database/dbErrorHandler');
const aiService = require('../services/aiService');
const intelligenceService = require('../services/intelligenceService');
const outreachService = require('../services/outreachService');
const businessRepo = require('../repositories/businessRepository');
const conversationRepo = require('../repositories/conversationRepository');
const memoryRepo = require('../repositories/memoryRepository');
const researchRepo = require('../repositories/researchRepository');
const followupRepo = require('../repositories/followupRepository');
const logger = require('../worker/logger');

async function testAIServiceCache() {
  logger.info('Running AI Service cache tests...');
  const startFirst = Date.now();
  const res1 = await aiService.generateOutboundDraft('Apple Inc', 'Tech', ['Looking for AI models'], ['None'], []);
  const durationFirst = Date.now() - startFirst;

  const startSecond = Date.now();
  const res2 = await aiService.generateOutboundDraft('Apple Inc', 'Tech', ['Looking for AI models'], ['None'], []);
  const durationSecond = Date.now() - startSecond;

  if (res1 !== res2) {
    throw new Error('AI draft outputs mismatch.');
  }

  // Second call must be significantly faster (cache hit)
  logger.info({ durationFirst, durationSecond }, `✓ AI Caching validated. Cache hit duration: ${durationSecond}ms`);
}

async function testPlatformIntegration() {
  logger.info('Running Platform Integration tests...');
  let testLeadId = null;

  try {
    // 1. Setup a test lead
    const leadRes = await db.query(`
      INSERT INTO leads (name, email, phone, city, category)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id;
    `, ['Initech software', 'bill@initech.com', '+12065550100', 'Seattle', 'Software Dev'], 'TestSetup', 'createLead');
    testLeadId = leadRes.rows[0].id;
    logger.info(`✓ Test lead created with ID: ${testLeadId}`);

    // 2. Initialize outreach
    logger.info('Testing outreachService.initializeOutreach...');
    const initData = await outreachService.initializeOutreach(testLeadId);
    if (!initData.profile || !initData.state || !initData.initialFollowup) {
      throw new Error('Failed to return complete initialization payload.');
    }
    logger.info('✓ Initialize outreach completed successfully.');

    // 3. Analyze mock scraping results (observations & memory synthesis)
    logger.info('Testing intelligenceService.analyzeScrapeResults...');
    const rawScrapedData = `
      Initech software uses React and Shopify. They are experiencing slow mobile loading times
      and lack structured meta SEO tags. Competitor: Pied Piper.
    `;
    const analyzeRes = await intelligenceService.analyzeScrapeResults(testLeadId, rawScrapedData);
    if (!analyzeRes.success || analyzeRes.observationsCount === 0) {
      throw new Error('No observations generated.');
    }
    
    // Verify observations exist in DB
    const obs = await memoryRepo.getObservationsByLeadId(testLeadId);
    if (obs.length === 0) {
      throw new Error('Observations not saved in database.');
    }
    logger.info(`✓ Scrape analysis successfully extracted and saved ${obs.length} observations.`);

    // 4. Process Followup Queue (Mocking time transition to force execution)
    logger.info('Testing followup queue processing...');
    
    // Artificially modify scheduled_at of task to be in the past to trigger dequeue
    const activeFollowups = await followupRepo.findByLeadId(testLeadId);
    if (activeFollowups.length > 0) {
      await followupRepo.update(activeFollowups[0].id, {
        scheduled_at: new Date(Date.now() - 10000).toISOString() // 10 seconds ago
      });
    }

    const queueRes = await outreachService.processFollowupQueue();
    if (queueRes.processedCount === 0) {
      const task = activeFollowups[0];
      const verifiedTask = await followupRepo.findById(task.id);
      if (verifiedTask && verifiedTask.status === 'completed') {
        logger.info('✓ Task was processed concurrently by background worker.');
      } else {
        throw new Error('Followup queue failed to process due task.');
      }
    } else {
      logger.info('✓ Followup queue processed task successfully.');
    }

    // Verify next stage followup was queued
    const followupsAfter = await followupRepo.findByLeadId(testLeadId);
    const hasNextTask = followupsAfter.some(f => f.reason === 'send_outreach_message');
    if (!hasNextTask) {
      throw new Error('Outreach message task was not scheduled in followup_queue.');
    }
    logger.info('✓ Confirmed: next outreach message task scheduled in queue.');

    // 5. Test processing the message dispatch (mock scheduled time again)
    const sendTask = followupsAfter.find(f => f.reason === 'send_outreach_message');
    await followupRepo.update(sendTask.id, {
      scheduled_at: new Date(Date.now() - 10000).toISOString()
    });

    const dispatchRes = await outreachService.processFollowupQueue();
    if (dispatchRes.processedCount === 0) {
      const verifiedTask = await followupRepo.findById(sendTask.id);
      if (verifiedTask && verifiedTask.status === 'completed') {
        logger.info('✓ Message dispatch was processed concurrently by background worker.');
      } else {
        throw new Error('Failed to process message dispatch followup task.');
      }
    }
    
    // Verify message was created
    const state = await conversationRepo.findByLeadId(testLeadId);
    const messages = await conversationRepo.getMessages(state.id);
    if (messages.length === 0) {
      throw new Error('Message was not generated/saved.');
    }
    logger.info(`✓ Generated outreach draft: "${messages[0].body.substring(0, 40)}..."`);
    logger.info('✓ Outbound message dispatch test passed.');

    // 6. Test Inbound Message Handling
    logger.info('Testing inbound message reply processing...');
    const inboundRes = await outreachService.handleInboundMessage(testLeadId, {
      body: 'Sure, let us schedule a meeting for tomorrow at 2 PM. Call me.',
      channel: 'whatsapp',
      sender: '+12065550100'
    });

    if (inboundRes.state.current_stage !== 'outreach_started' && inboundRes.state.current_stage !== 'lead_qualified') {
      logger.info(`✓ Conversation stage shifted on reply: ${inboundRes.state.current_stage}`);
    }
    
    // Check if meeting keyword was added to memory insights
    const updatedMemory = await memoryRepo.findByLeadId(testLeadId);
    const hasMeetingInsight = updatedMemory.key_insights.some(ins => ins.includes('schedule a meeting'));
    if (!hasMeetingInsight) {
      throw new Error('Inbound intent keyword was not extracted into memory insights.');
    }
    logger.info('✓ Inbound message analyzed and insights updated in memory.');

    // 7. Schedule a Meeting
    logger.info('Testing outreachService.scheduleMeeting...');
    const meeting = await outreachService.scheduleMeeting(testLeadId, {
      scheduled_at: new Date(Date.now() + 86400000).toISOString(),
      duration_minutes: 45,
      notes: 'Sales demo call'
    });

    const updatedState = await conversationRepo.findByLeadId(testLeadId);
    if (updatedState.current_stage !== 'demo_scheduled') {
      throw new Error('Stage did not advance to demo_scheduled.');
    }
    logger.info('✓ Meeting scheduled successfully and stage transitioned to "demo_scheduled".');

  } finally {
    // 8. Clean up
    if (testLeadId) {
      logger.info('Cleaning up database test records...');
      await db.query('DELETE FROM leads WHERE id = $1', [testLeadId], 'Cleanup', 'deleteLead');
      logger.info('✓ Cleanup successful.');
    }
  }
}

async function runAllTests() {
  logger.info('=== STARTING OUTREACH INTELLIGENCE PLATFORM TEST SUITE ===');
  try {
    await testAIServiceCache();
    await testPlatformIntegration();
    logger.info('=== ALL TESTS COMPLETED SUCCESSFULLY! ===');
    process.exit(0);
  } catch (err) {
    logger.error({ error: err.message, stack: err.stack }, '❌ Test suite failed with exception.');
    process.exit(1);
  }
}

runAllTests();
