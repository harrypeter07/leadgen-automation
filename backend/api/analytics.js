// backend/api/analytics.js
const express = require('express');
const router = express.Router();
const db = require('../database/db');
const metrics = require('../worker/metrics');
const ResponseHelper = require('../modules/response');

/**
 * GET /api/analytics
 * Retrieve platform analytics, stage distributions, and system metrics
 */
router.get('/', async (req, res, next) => {
  try {
    // 1. Fetch stage distributions
    const stageQuery = `
      SELECT current_stage, COUNT(*) as count 
      FROM conversation_states 
      GROUP BY current_stage;
    `;
    const stageRes = await db.query(stageQuery, [], 'Analytics', 'getStages');
    const stageDistribution = {};
    stageRes.rows.forEach(row => {
      stageDistribution[row.current_stage] = parseInt(row.count, 10);
    });

    // 2. Fetch followup queue statistics
    const followupQuery = `
      SELECT status, COUNT(*) as count 
      FROM followup_queue 
      GROUP BY status;
    `;
    const followupRes = await db.query(followupQuery, [], 'Analytics', 'getFollowups');
    const followupStats = { pending: 0, completed: 0, cancelled: 0 };
    followupRes.rows.forEach(row => {
      followupStats[row.status] = parseInt(row.count, 10);
    });

    // 3. Fetch conversion rate metrics
    const conversionQuery = `
      SELECT 
        COUNT(*) FILTER (WHERE current_stage = 'converted') as converted,
        COUNT(*) FILTER (WHERE current_stage = 'lost') as lost,
        COUNT(*) as total
      FROM conversation_states;
    `;
    const convRes = await db.query(conversionQuery, [], 'Analytics', 'getConversions');
    const { converted, lost, total } = convRes.rows[0];
    const conversionRatePct = total > 0 ? Math.round((parseInt(converted, 10) / parseInt(total, 10)) * 100) : 0;

    // 4. Fetch system execution & AI cost counters
    const liveMetrics = metrics.getMetrics();

    const data = {
      stages: stageDistribution,
      followups: followupStats,
      conversions: {
        converted: parseInt(converted, 10),
        lost: parseInt(lost, 10),
        total: parseInt(total, 10),
        rate_pct: conversionRatePct
      },
      ai_metrics: {
        calls_count: liveMetrics.ai_calls_count || 0,
        input_tokens: liveMetrics.ai_total_input_tokens || 0,
        output_tokens: liveMetrics.ai_total_output_tokens || 0,
        total_cost_usd: liveMetrics.ai_total_cost_usd || 0,
        average_latency_ms: liveMetrics.ai_average_duration_ms || 0
      },
      system: {
        uptime_seconds: liveMetrics.uptime_seconds,
        cpu_load_pct: liveMetrics.cpu_load_1min * 100,
        ram_used_mb: liveMetrics.ram_heap_used_mb,
        browser_pool: {
          status: liveMetrics.browser_status,
          contexts: liveMetrics.open_contexts,
          pages: liveMetrics.open_pages
        }
      }
    };

    return ResponseHelper.success(res, data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
