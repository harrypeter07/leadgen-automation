class PerformanceAnalyzer {
  async analyze(page, loadTimeMs, options = {}) {
    const { totalBytes = 0, resourceCount = 0 } = options;
    let performanceScore = 100;
    
    if (loadTimeMs > 4000) {
      performanceScore -= 30;
    } else if (loadTimeMs > 2000) {
      performanceScore -= 15;
    }

    // Deduct score for bloated websites (e.g. >2MB or >5MB page size)
    const sizeMB = totalBytes / (1024 * 1024);
    if (sizeMB > 5) {
      performanceScore -= 25;
    } else if (sizeMB > 2) {
      performanceScore -= 10;
    }

    if (resourceCount > 80) {
      performanceScore -= 15;
    }

    return {
      load_time_ms: loadTimeMs,
      page_size_kb: Math.round(totalBytes / 1024),
      resource_count: resourceCount,
      score: Math.max(25, performanceScore)
    };
  }
}

module.exports = new PerformanceAnalyzer();
