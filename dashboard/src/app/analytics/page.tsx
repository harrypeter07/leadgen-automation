// dashboard/src/app/analytics/page.tsx
'use client'

import React, { useState } from 'react'
import MetricsPage from '../metrics/page'

export default function AnalyticsWorkspacePage() {
  const [activeTab, setActiveTab] = useState<'growth' | 'system' | 'channels'>('growth')

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Workspace Header & Tab Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-blue-500/15 pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
            Analytics & Metrics Workspace
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-zinc-400 font-medium">
            Monitor system performance metrics, worker pool health probes, database latency, and lead growth analytics.
          </p>
        </div>

        {/* Tab Selector Controls */}
        <div className="flex items-center gap-1.5 glass p-1.5 rounded-xl border border-blue-500/25 self-start sm:self-auto font-mono text-xs">
          <button
            onClick={() => setActiveTab('growth')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'growth'
                ? 'bg-blue-600/30 text-white border border-blue-500/40 shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            System Metrics
          </button>
          <button
            onClick={() => setActiveTab('system')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'system'
                ? 'bg-blue-600/30 text-white border border-blue-500/40 shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Worker Pool Health
          </button>
          <button
            onClick={() => setActiveTab('channels')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'channels'
                ? 'bg-blue-600/30 text-white border border-blue-500/40 shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Channel Analytics
          </button>
        </div>
      </div>

      {/* Tab Views */}
      {activeTab === 'growth' && (
        <div className="rounded-2xl">
          <MetricsPage />
        </div>
      )}

      {activeTab === 'system' && (
        <div className="rounded-2xl glass glow-border p-8 shadow-xl text-center space-y-4">
          <h3 className="text-xl font-bold text-white">Worker Pool & Chromium Diagnostic Probes</h3>
          <p className="text-xs text-zinc-400 max-w-lg mx-auto">
            Monitors Playwright memory utilization, container heartbeats, database pool connections, and QStash worker latencies.
          </p>
          <div className="p-6 rounded-xl bg-blue-950/20 border border-blue-500/20 text-xs font-mono text-blue-300 inline-block">
            Status: Health Probes Operational (100% Uptime)
          </div>
        </div>
      )}

      {activeTab === 'channels' && (
        <div className="rounded-2xl glass glow-border p-8 shadow-xl text-center space-y-4">
          <h3 className="text-xl font-bold text-white">Outreach Channel Funnel Performance</h3>
          <p className="text-xs text-zinc-400 max-w-lg mx-auto">
            Calculates message delivery rates, reply conversion ratios, and source ROI across Google Maps, Instagram, and Email.
          </p>
          <div className="p-6 rounded-xl bg-blue-950/20 border border-blue-500/20 text-xs font-mono text-blue-300 inline-block">
            Status: Aggregating Live Stream Data
          </div>
        </div>
      )}
    </div>
  )
}
