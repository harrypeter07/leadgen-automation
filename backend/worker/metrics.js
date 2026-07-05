// backend/worker/metrics.js

const os = require('os');
const browserManager = require('./browserManager');

class MetricsTracker {
  constructor() {
    this.startTime = Date.now();
    this.totalJobsExecuted = 0;
    this.totalFailedJobs = 0;
    this.totalRetries = 0;
    this.totalDuration = 0;
    this.providerDurations = new Map(); // provider -> array of timings

    // AI Metrics
    this.totalAICalls = 0;
    this.totalAIInputTokens = 0;
    this.totalAIOutputTokens = 0;
    this.totalAICost = 0;
    this.totalAIDuration = 0;
  }

  recordJobExecution(provider, durationMs, success = true) {
    this.totalJobsExecuted++;
    this.totalDuration += durationMs;
    
    if (!success) {
      this.totalFailedJobs++;
    }

    if (!this.providerDurations.has(provider)) {
      this.providerDurations.set(provider, []);
    }
    this.providerDurations.get(provider).push(durationMs);
  }

  recordRetry() {
    this.totalRetries++;
  }

  recordAICall(model, durationMs, inputTokens, outputTokens, cost) {
    this.totalAICalls++;
    this.totalAIInputTokens += inputTokens;
    this.totalAIOutputTokens += outputTokens;
    this.totalAICost += cost;
    this.totalAIDuration += durationMs;
  }

  getMetrics() {
    const memory = process.memoryUsage();
    const cpus = os.cpus();
    const load = os.loadavg();

    const providerTimes = {};
    for (const [provider, list] of this.providerDurations.entries()) {
      const avg = list.reduce((a, b) => a + b, 0) / list.length;
      providerTimes[provider] = Math.round(avg);
    }

    const browserHealth = browserManager.health();
    const upTimeSeconds = Math.round((Date.now() - this.startTime) / 1000);
    const jobsPerHour = upTimeSeconds > 0 ? (this.totalJobsExecuted / (upTimeSeconds / 3600)) : 0;

    return {
      uptime_seconds: upTimeSeconds,
      cpu_count: cpus.length,
      cpu_load_1min: Math.round(load[0] * 100) / 100,
      ram_heap_used_mb: Math.round(memory.heapUsed / 1024 / 1024),
      ram_rss_mb: Math.round(memory.rss / 1024 / 1024),
      browser_status: browserHealth.status,
      open_contexts: browserHealth.openContexts,
      open_pages: browserHealth.openPages,
      jobs_executed: this.totalJobsExecuted,
      jobs_failed: this.totalFailedJobs,
      jobs_per_hour: Math.round(jobsPerHour * 100) / 100,
      success_rate_pct: this.totalJobsExecuted > 0 
        ? Math.round(((this.totalJobsExecuted - this.totalFailedJobs) / this.totalJobsExecuted) * 100)
        : 100,
      average_job_duration_ms: this.totalJobsExecuted > 0 
        ? Math.round(this.totalDuration / this.totalJobsExecuted)
        : 0,
      provider_average_times_ms: providerTimes,
      retries: this.totalRetries,

      // Export AI metrics
      ai_calls_count: this.totalAICalls,
      ai_total_input_tokens: this.totalAIInputTokens,
      ai_total_output_tokens: this.totalAIOutputTokens,
      ai_total_cost_usd: parseFloat(this.totalAICost.toFixed(6)),
      ai_average_duration_ms: this.totalAICalls > 0 ? Math.round(this.totalAIDuration / this.totalAICalls) : 0
    };
  }
}

module.exports = new MetricsTracker();
