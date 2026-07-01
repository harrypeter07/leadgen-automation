// backend/api/discovery.js

const express = require('express');
const discoveryService = require('../services/discoveryService');

const router = express.Router();

router.use((req, res, next) => {
  req.startTime = Date.now();
  next();
});

router.post('/socials', async (req, res, next) => {
  const { name, website, phone } = req.body || {};
  if (!name) {
    return res.status(400).json({ success: false, error: 'name is required' });
  }

  try {
    const socials = await discoveryService.discoverSocials(name, website, phone);
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      execution_time_ms: Date.now() - req.startTime,
      version: '3.0.0',
      socials
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
