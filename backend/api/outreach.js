// backend/api/outreach.js
const express = require('express');
const outreachController = require('../controllers/outreachController');

const router = express.Router();

// 1. Initialize outreach tracking and schedule first mockup audit followup
router.post('/initialize', (req, res, next) => outreachController.initialize(req, res, next));

// 2. Fetch conversation state for a lead
router.get('/conversation/:leadId', (req, res, next) => outreachController.getConversationState(req, res, next));

// 3. Process all due items in followup_queue (automated audit/message dispatches)
router.post('/followups/process', (req, res, next) => outreachController.processFollowups(req, res, next));

// 4. Handle incoming messages from leads (simulate inbound WhatsApp/Email)
router.post('/message/inbound', (req, res, next) => outreachController.handleInbound(req, res, next));

// 5. Schedule/record meeting logs
router.post('/meetings', (req, res, next) => outreachController.scheduleMeeting(req, res, next));

// 6. Fetch memory records, observations, and research context for a lead
router.get('/memory/:leadId', (req, res, next) => outreachController.getMemory(req, res, next));

// 7. Trigger manual website audit & social discovery research
router.post('/research', (req, res, next) => outreachController.runResearch(req, res, next));

// 8. Get system outreach and ICP settings
router.get('/settings', (req, res, next) => outreachController.getSettings(req, res, next));

// 9. Update system outreach and ICP settings
router.post('/settings', (req, res, next) => outreachController.updateSettings(req, res, next));

module.exports = router;
