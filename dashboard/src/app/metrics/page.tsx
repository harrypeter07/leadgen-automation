// dashboard/src/app/metrics/page.tsx
'use client'

import React, { useState, useEffect, useRef } from 'react'

interface WorkerHealth {
  workerId: number
  status: 'Idle' | 'Busy' | 'Paused' | 'Stopped' | 'Recovering'
  currentJobId: string | null
  currentProvider: string | null
  elapsedSeconds: number
}

interface LogEntry {
  timestamp: string
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG'
  message: string
}

interface Metrics {
  uptime_seconds: number
  cpu_count: number
  cpu_load_1min: number
  ram_heap_used_mb: number
  ram_rss_mb: number
  browser_status: string
  open_contexts: number
  open_pages: number
  jobs_executed: number
  jobs_failed: number
  jobs_per_hour: number
  success_rate_pct: number
  average_job_duration_ms: number
  provider_average_times_ms: Record<string, number>
  retries: number
}

interface QueueStats {
  queued: number
  running: number
  completed: number
  failed: number
  total: number
  isPaused: boolean
}

export default function MetricsPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [workers, setWorkers] = useState<WorkerHealth[]>([])
  const [queue, setQueue] = useState<QueueStats | null>(null)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [logFilter, setLogFilter] = useState<'ALL' | 'INFO' | 'WARN' | 'ERROR' | 'DEBUG'>('ALL')
  const [loading, setLoading] = useState(true)

  const consoleEndRef = useRef<HTMLDivElement | null>(null)

  async function fetchMetricsData() {
    try {
      const [mRes, wRes, qRes, lRes] = await Promise.all([
        fetch('/api/backend-v3/metrics'),
        fetch('/api/backend-v3/metrics/workers'),
        fetch('/api/backend-v3/metrics/queue'),
        fetch('/api/backend-v3/logs')
      ])

      if (mRes.ok && wRes.ok && qRes.ok && lRes.ok) {
        const mData = await mRes.json()
        const wData = await wRes.json()
        const qData = await qRes.json()
        const lData = await lRes.json()
        
        setMetrics(mData.metrics)
        setWorkers(wData.workers)
        setQueue(qData.queue)
        setLogs(lData.logs || [])
      }
    } catch (err) {
      console.error('Failed to poll V3 backend metrics:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMetricsData()
    // Optimized Polling: Poll metrics every 10 seconds to decrease backend CPU/DB load
    const interval = setInterval(fetchMetricsData, 10000)
    return () => clearInterval(interval)
  }, [])

  // Auto-scroll terminal console to bottom
  useEffect(() => {
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs, logFilter])

  function formatUptime(sec: number) {
    const hrs = Math.floor(sec / 3600)
    const mins = Math.floor((sec % 3600) / 60)
    const secs = sec % 60
    return `${hrs}h ${mins}m ${secs}s`
  }

  function getLogLevelStyle(level: string) {
    switch (level) {
      case 'ERROR': return 'text-red-700 font-bold bg-red-50 border-red-200'
      case 'WARN': return 'text-amber-700 font-bold bg-amber-50 border-amber-200'
      case 'DEBUG': return 'text-blue-700 bg-blue-50 border-blue-200'
      default: return 'text-gray-500 bg-gray-50 border-gray-200'
    }
  }

  const filteredLogs = logs.filter(log => {
    if (logFilter === 'ALL') return true
    return log.level === logFilter
  })

  return (
    <div className="space-y-8 text-[#2D2D2D] select-none">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-[#1C1C1E] tracking-tight">System Metrics & Engine</h1>
          <p className="mt-1 text-sm text-gray-500 font-medium font-sans">Live operational telemetry and browser worker pools from Backend V3.</p>
        </div>
        <div className="flex items-center gap-2 bg-white border border-[#E4E3DD] rounded-xl px-4 py-2 text-xs text-gray-500 font-semibold shadow-sm self-start md:self-auto">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
          </span>
          Live Engine Feeds (10s refresh)
        </div>
      </div>

      {loading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-28 rounded-2xl bg-white border border-[#E4E3DD] animate-pulse shadow-sm" />
          ))}
        </div>
      ) : !metrics ? (
        <div className="text-center py-12 rounded-2xl border border-[#E4E3DD] bg-white text-gray-500 text-sm shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)]">
          <p className="font-bold text-lg text-gray-600 mb-1">Failed to Connect to Backend V3</p>
          <p className="font-semibold text-xs mt-1">Verify that your V3 Backend service is deployed and running on Railway.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Main Resource Stats Row */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-[#E4E3DD] bg-white p-5 space-y-2 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)]">
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">Uptime</span>
              <p className="text-xl font-black text-gray-800 tracking-tight">{formatUptime(metrics.uptime_seconds)}</p>
            </div>
            <div className="rounded-2xl border border-[#E4E3DD] bg-white p-5 space-y-2 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)]">
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">CPU Load (1m Avg)</span>
              <div className="flex items-center justify-between">
                <p className="text-xl font-black text-gray-800 tracking-tight">{Math.round(metrics.cpu_load_1min * 100)}%</p>
                <span className="text-[10px] text-gray-400 font-bold uppercase">{metrics.cpu_count} Cores</span>
              </div>
              <div className="w-full bg-[#F4F3EF] rounded-full h-2 mt-2">
                <div className="bg-[#1C1C1E] h-1.5 rounded-full" style={{ width: `${Math.min(100, metrics.cpu_load_1min * 100)}%` }} />
              </div>
            </div>
            <div className="rounded-2xl border border-[#E4E3DD] bg-white p-5 space-y-2 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)]">
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">RAM RSS Heap</span>
              <div className="flex items-center justify-between">
                <p className="text-xl font-black text-gray-800 tracking-tight">{metrics.ram_heap_used_mb} MB</p>
                <span className="text-[10px] text-gray-400 font-bold uppercase">RSS {metrics.ram_rss_mb}MB</span>
              </div>
              <div className="w-full bg-[#F4F3EF] rounded-full h-2 mt-2">
                <div className="bg-[#1C1C1E] h-1.5 rounded-full" style={{ width: `${Math.min(100, (metrics.ram_heap_used_mb / 350) * 100)}%` }} />
              </div>
            </div>
            <div className="rounded-2xl border border-[#E4E3DD] bg-[#D4E0CD] p-5 space-y-2 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] text-[#2E3A2F]">
              <span className="text-[9px] font-bold text-[#3B4D3C] uppercase tracking-wider block">Job Success Rate</span>
              <p className="text-xl font-black text-[#2E3A2F] tracking-tight">{metrics.success_rate_pct}%</p>
              <span className="text-[9px] text-[#3B4D3C] block font-bold uppercase">
                Success: {metrics.jobs_executed - metrics.jobs_failed} | Failed: {metrics.jobs_failed}
              </span>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {/* Left Panel: Workers Status */}
            <div className="rounded-2xl border border-[#E4E3DD] bg-white md:col-span-2 overflow-hidden shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)]">
              <div className="border-b border-[#E4E3DD] px-5 py-4 bg-gray-50/50">
                <h3 className="font-bold text-[#1C1C1E] text-xs uppercase tracking-wider text-gray-500">👷 Worker Pool Status</h3>
              </div>
              <div className="divide-y divide-[#E4E3DD]/60">
                {workers.map(w => (
                  <div key={w.workerId} className="px-5 py-4 flex items-center justify-between hover:bg-[#F4F3EF]/30 transition-colors">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-800 text-sm">Worker #{w.workerId}</span>
                        <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border
                          ${w.status === 'Idle' ? 'bg-gray-100 text-gray-400 border-gray-200' : ''}
                          ${w.status === 'Busy' ? 'bg-purple-50 text-purple-700 border-purple-200' : ''}
                          ${w.status === 'Paused' ? 'bg-yellow-50 text-yellow-750 border-yellow-200' : ''}
                          ${w.status === 'Stopped' ? 'bg-red-50 text-red-700 border-red-200' : ''}
                        `}>
                          {w.status}
                        </span>
                      </div>
                      {w.status === 'Busy' && (
                        <p className="text-xs text-gray-500 font-semibold">
                          Scraping provider <span className="text-purple-650 font-bold uppercase tracking-wider text-[10px]">{w.currentProvider}</span>
                        </p>
                      )}
                    </div>

                    <div className="text-right text-xs text-gray-400 font-semibold">
                      {w.status === 'Busy' && (
                        <>
                          <p className="font-mono text-gray-500">{w.currentJobId?.substr(0, 8)}...</p>
                          <p className="text-[10px] text-purple-600 font-bold">Elapsed: {w.elapsedSeconds}s</p>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Panel: Browser Pool & Queue stats */}
            <div className="space-y-6">
              {/* Browser Pool Info */}
              <div className="rounded-2xl border border-[#E4E3DD] bg-white p-5 space-y-4 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)]">
                <h3 className="font-bold text-[#1C1C1E] text-xs uppercase tracking-wider text-gray-500 border-b border-[#E4E3DD] pb-2">🌐 Browser Pool Status</h3>
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="bg-[#F4F3EF] p-3 rounded-xl border border-[#E4E3DD]">
                    <span className="text-[9px] text-gray-400 uppercase font-bold block">Contexts</span>
                    <span className="text-lg font-black text-gray-800 tracking-tight">{metrics.open_contexts}</span>
                  </div>
                  <div className="bg-[#F4F3EF] p-3 rounded-xl border border-[#E4E3DD]">
                    <span className="text-[9px] text-gray-400 uppercase font-bold block">Pages</span>
                    <span className="text-lg font-black text-gray-800 tracking-tight">{metrics.open_pages}</span>
                  </div>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-400 font-bold uppercase text-[9px]">Pool Health:</span>
                  <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-green-50 border border-green-200 text-green-700 uppercase">
                    {metrics.browser_status}
                  </span>
                </div>
              </div>

              {/* Queue Statistics */}
              {queue && (
                <div className="rounded-2xl border border-[#E4E3DD] bg-white p-5 space-y-4 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)]">
                  <h3 className="font-bold text-[#1C1C1E] text-xs uppercase tracking-wider text-gray-500 border-b border-[#E4E3DD] pb-2">📦 Queue Distribution</h3>
                  <div className="grid grid-cols-2 gap-3 text-xs font-semibold text-gray-600">
                    <div className="flex justify-between border-b border-gray-100 pb-1.5">
                      <span className="text-gray-400">Queued:</span>
                      <span className="font-bold text-gray-700">{queue.queued}</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-100 pb-1.5">
                      <span className="text-gray-400">Running:</span>
                      <span className="font-bold text-blue-600">{queue.running}</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-100 pb-1.5">
                      <span className="text-gray-400">Completed:</span>
                      <span className="font-bold text-green-700">{queue.completed}</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-100 pb-1.5">
                      <span className="text-gray-400">Failed:</span>
                      <span className="font-bold text-red-600">{queue.failed}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Retro Developer Terminal Logs Section */}
          <div className="rounded-2xl border border-[#E4E3DD] bg-white overflow-hidden flex flex-col h-[400px] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)]">
            {/* Terminal Header */}
            <div className="bg-gray-50 px-5 py-3 border-b border-[#E4E3DD] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/80" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-400/80" />
                <span className="ml-2 font-mono text-[10px] text-gray-400 font-bold uppercase tracking-wider">leadgen-v3-system-console.log</span>
              </div>

              {/* Filters */}
              <div className="flex gap-1.5">
                {(['ALL', 'INFO', 'WARN', 'ERROR', 'DEBUG'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setLogFilter(f)}
                    className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold transition-colors uppercase border ${
                      logFilter === f
                        ? 'bg-[#1C1C1E] border-[#1C1C1E] text-white'
                        : 'bg-white border-[#E4E3DD] text-gray-400 hover:text-gray-700'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Terminal Screen */}
            <div className="flex-1 p-5 font-mono text-[10px] text-gray-600 overflow-y-auto space-y-1.5 bg-[#F4F3EF]/30 leading-relaxed">
              {filteredLogs.length === 0 ? (
                <p className="text-gray-400 italic">Console output is empty. Polling for logs...</p>
              ) : (
                filteredLogs.map((log, index) => (
                  <div key={index} className="flex gap-4 items-start leading-relaxed hover:bg-gray-150/40 py-0.5 px-1 rounded">
                    <span className="text-gray-400 select-none text-[9px]">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <span className={`w-14 shrink-0 uppercase text-[9px] font-bold px-1 text-center rounded border ${getLogLevelStyle(log.level)}`}>
                      {log.level}
                    </span>
                    <span className="text-gray-700 break-all">{log.message}</span>
                  </div>
                ))
              )}
              <div ref={consoleEndRef} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
