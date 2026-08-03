'use client'

import React, { useState, useEffect, useRef } from 'react'
import { 
  Button, 
  Badge, 
  Card, 
  StatCard, 
  HeroCard,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell
} from '@/components'
import { Activity, Cpu, HardDrive, Terminal } from 'lucide-react'

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
    const interval = setInterval(fetchMetricsData, 10000)
    return () => clearInterval(interval)
  }, [])

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

  const filteredLogs = logs.filter(log => {
    if (logFilter === 'ALL') return true
    return log.level === logFilter
  })

  return (
    <div className="space-y-10 max-w-7xl mx-auto">
      {/* Hero Header */}
      <HeroCard
        eyebrow="SYSTEM METRICS"
        title="Operational Telemetry & Worker Pools"
        description="Live operational health, Playwright browser instances, CPU load, and background workers."
        variant="sage"
      />

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-32 rounded-lg bg-page-alt animate-pulse" />
          ))}
        </div>
      ) : !metrics ? (
        <Card variant="page-alt" className="p-10 text-center text-text-muted">
          <p className="font-bold text-lg text-ink">Backend V3 Offline or Unreachable</p>
          <p className="text-xs mt-1">Verify that your V3 Backend service is deployed on Railway.</p>
        </Card>
      ) : (
        <div className="space-y-8">
          {/* KPI Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <StatCard
              label="System Uptime"
              value={formatUptime(metrics.uptime_seconds)}
              variant="lavender"
            />
            <StatCard
              label="CPU Load (1m Avg)"
              value={`${Math.round(metrics.cpu_load_1min * 100)}%`}
              variant="cream"
              subtext={`${metrics.cpu_count} Cores`}
            />
            <StatCard
              label="RAM RSS Heap"
              value={`${metrics.ram_heap_used_mb} MB`}
              variant="sage"
              subtext={`RSS: ${metrics.ram_rss_mb} MB`}
            />
            <StatCard
              label="Job Success Rate"
              value={`${metrics.success_rate_pct}%`}
              variant="lavender"
              subtext={`Executed: ${metrics.jobs_executed} | Failed: ${metrics.jobs_failed}`}
            />
          </div>

          {/* Workers & Queue Status Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card variant="page-alt" className="lg:col-span-2 p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-border-subtle pb-3">
                <h3 className="font-bold text-lg text-ink font-display">Worker Pool Status</h3>
                <Badge variant="dark">{workers.length} Workers</Badge>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Worker ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead className="text-right">Elapsed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workers.map(w => (
                    <TableRow key={w.workerId}>
                      <TableCell className="font-bold text-ink">Worker #{w.workerId}</TableCell>
                      <TableCell>
                        <Badge variant={w.status === 'Busy' ? 'lime' : 'muted'}>
                          {w.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-text-body font-mono text-xs">{w.currentProvider || '—'}</TableCell>
                      <TableCell className="text-right font-mono font-bold">{w.elapsedSeconds ? `${w.elapsedSeconds}s` : '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>

            <Card variant="page-alt" className="p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-border-subtle pb-3">
                <h3 className="font-bold text-lg text-ink font-display">Browser Pool</h3>
                <Badge variant="lime">HEALTHY</Badge>
              </div>

              <div className="space-y-4 text-sm font-semibold text-ink">
                <div className="flex justify-between border-b border-border-subtle/60 pb-2">
                  <span className="text-text-muted">Open Contexts:</span>
                  <span className="font-mono font-bold">{metrics.open_contexts}</span>
                </div>
                <div className="flex justify-between border-b border-border-subtle/60 pb-2">
                  <span className="text-text-muted">Open Pages:</span>
                  <span className="font-mono font-bold">{metrics.open_pages}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Status:</span>
                  <span className="font-mono font-bold">{metrics.browser_status}</span>
                </div>
              </div>
            </Card>
          </div>

          {/* Dark Console Terminal */}
          <Card variant="ink" className="p-8 space-y-4">
            <div className="flex items-center justify-between border-b border-border-subtle/20 pb-4">
              <div className="flex items-center gap-2">
                <Terminal className="w-5 h-5 text-lime" />
                <h3 className="font-bold text-lg text-page font-display">System Console Log Stream</h3>
              </div>
              <div className="flex items-center gap-2">
                {(['ALL', 'INFO', 'WARN', 'ERROR', 'DEBUG'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setLogFilter(f)}
                    className={`px-3 py-1 rounded-pill text-[10px] font-bold uppercase tracking-eyebrow transition-colors ${
                      logFilter === f ? 'bg-lime text-ink' : 'text-text-onDarkMuted hover:text-page'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-ink-soft p-4 rounded-lg font-mono text-xs text-text-onDarkMuted space-y-2 max-h-64 overflow-y-auto border border-border-subtle/20">
              {filteredLogs.length === 0 ? (
                <p className="text-text-onDarkMuted/60">No log entries matching filter criteria.</p>
              ) : (
                filteredLogs.map((log, index) => (
                  <div key={index} className="flex gap-4 items-start">
                    <span className="text-text-onDarkMuted/50 shrink-0">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <span className="font-bold text-lime shrink-0">[{log.level}]</span>
                    <span className="text-page break-all">{log.message}</span>
                  </div>
                ))
              )}
              <div ref={consoleEndRef} />
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
