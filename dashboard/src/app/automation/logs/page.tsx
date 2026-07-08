'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import toast from 'react-hot-toast'

interface LogEntry {
  id: string
  timestamp: string
  level: 'info' | 'warn' | 'error' | 'debug'
  source: string
  event: string
  method?: string
  endpoint?: string
  status_code?: number
  duration_ms?: number
  error?: string
  graph_error?: { message: string; type: string; code: number }
  retry_count?: number
  workflow_source?: string
  request_id?: string
}

const LEVEL_STYLES: Record<string, string> = {
  info:  'bg-sky-500/10 text-sky-300 border border-sky-500/20',
  warn:  'bg-amber-500/10 text-amber-300 border border-amber-500/20',
  error: 'bg-red-500/10 text-red-300 border border-red-500/20',
  debug: 'bg-violet-500/10 text-violet-300 border border-violet-500/20',
}

const LEVEL_DOT: Record<string, string> = {
  info:  'bg-sky-400',
  warn:  'bg-amber-400',
  error: 'bg-red-400',
  debug: 'bg-violet-400',
}

const SOURCES = ['All Sources', 'FacebookService', 'InstagramService', 'MessengerService', 'MetaClient', 'WebhookService', 'OAuthService']
const LEVELS  = ['all', 'info', 'warn', 'error', 'debug']

function relativeTime(ts: string) {
  const diff = (Date.now() - new Date(ts).getTime()) / 1000
  if (diff < 60)    return `${Math.round(diff)}s ago`
  if (diff < 3600)  return `${Math.round(diff / 60)}m ago`
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`
  return new Date(ts).toLocaleDateString()
}

export default function AuditLogsPage() {
  const [logs, setLogs]           = useState<LogEntry[]>([])
  const [loading, setLoading]     = useState(true)
  const [total, setTotal]         = useState(0)
  const [level, setLevel]         = useState('all')
  const [source, setSource]       = useState('All Sources')
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null)
  const [hint, setHint]           = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const pollRef   = useRef<NodeJS.Timeout | null>(null)

  const fetchLogs = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '200' })
      if (level !== 'all')             params.set('level', level)
      if (source !== 'All Sources')    params.set('source', source)
      const res  = await fetch(`/api/automation/logs?${params}`)
      const data = await res.json()
      if (data.logs) {
        setLogs(data.logs)
        setTotal(data.total ?? data.logs.length)
        if (data.hint) setHint(data.hint)
      }
    } catch {
      if (!silent) toast.error('Failed to load logs.')
    } finally {
      setLoading(false)
    }
  }, [level, source])

  // Initial load + re-fetch when filters change
  useEffect(() => { fetchLogs() }, [fetchLogs])

  // Auto-refresh polling
  useEffect(() => {
    if (!autoRefresh) { if (pollRef.current) clearInterval(pollRef.current); return }
    pollRef.current = setInterval(() => fetchLogs(true), 4000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [autoRefresh, fetchLogs])

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoRefresh) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs.length, autoRefresh])

  function exportCSV() {
    const header = 'timestamp,level,source,event,method,endpoint,status_code,duration_ms,error\n'
    const rows = logs.map(l =>
      [l.timestamp, l.level, l.source, l.event, l.method || '', l.endpoint || '', l.status_code ?? '', l.duration_ms ?? '', l.error || '']
        .map(v => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    ).join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `meta-logs-${Date.now()}.csv`; a.click()
    URL.revokeObjectURL(url)
    toast.success('CSV exported!')
  }

  const statsInfo  = logs.filter(l => l.level === 'info').length
  const statsWarn  = logs.filter(l => l.level === 'warn').length
  const statsError = logs.filter(l => l.level === 'error').length

  return (
    <div className="space-y-6 text-white select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight">📋 API Request Logs</h1>
          <p className="mt-1 text-sm text-gray-500">Live Meta Graph API request/response log from all services. Updates every 4s.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchLogs()}
            className="px-3 py-2 rounded-xl bg-[#222225] border border-[#2D2D30] text-xs font-bold text-gray-300 hover:text-white transition-colors"
          >🔄 Refresh</button>
          <button
            onClick={() => setAutoRefresh(v => !v)}
            className={`px-3 py-2 rounded-xl border text-xs font-bold transition-colors ${autoRefresh ? 'bg-green-900/40 border-green-800/40 text-green-300' : 'bg-[#222225] border-[#2D2D30] text-gray-400'}`}
          >{autoRefresh ? '⏸ Live' : '▶ Paused'}</button>
          <button
            onClick={exportCSV}
            className="px-3 py-2 rounded-xl bg-[#222225] border border-[#2D2D30] text-xs font-bold text-gray-300 hover:text-white transition-colors"
          >⬇️ CSV</button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total', value: total, color: 'text-white' },
          { label: 'Info',  value: statsInfo,  color: 'text-sky-400' },
          { label: 'Warn',  value: statsWarn,  color: 'text-amber-400' },
          { label: 'Error', value: statsError, color: 'text-red-400' },
        ].map(s => (
          <div key={s.label} className="rounded-xl bg-[#18181A] border border-[#2D2D30] p-4 text-center">
            <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex gap-1 bg-[#141416] rounded-xl border border-[#2D2D30] p-1">
          {LEVELS.map(l => (
            <button
              key={l}
              onClick={() => setLevel(l)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-colors ${level === l ? 'bg-[#2D2D30] text-white' : 'text-gray-500 hover:text-white'}`}
            >{l}</button>
          ))}
        </div>
        <select
          value={source}
          onChange={e => setSource(e.target.value)}
          className="bg-[#141416] border border-[#2D2D30] rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none"
        >
          {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="ml-auto text-[10px] text-gray-500 font-mono">Showing {logs.length} / {total}</span>
      </div>

      {/* Hint for missing table */}
      {hint && (
        <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-800/30 text-amber-300 text-xs font-mono">
          ⚠️ {hint}
        </div>
      )}

      {/* Log table */}
      <div className="rounded-2xl border border-[#2D2D30] bg-[#0E0E10] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-[#2D2D30]">
          <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Meta Graph API Trace</span>
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-green-400 animate-pulse' : 'bg-gray-600'}`}></span>
            <span className="text-[10px] text-gray-500 font-mono">{autoRefresh ? 'Live' : 'Paused'}</span>
          </div>
        </div>

        <div className="overflow-y-auto" style={{ maxHeight: '520px' }}>
          {loading && logs.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-gray-500 text-sm animate-pulse">Loading logs…</div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-gray-600">
              <span className="text-3xl">🪵</span>
              <span className="text-sm">No logs yet — run a Meta API test to generate entries.</span>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="bg-[#141416] text-gray-500 uppercase tracking-wider text-[10px] font-bold border-b border-[#2D2D30]">
                  <th className="p-3 pl-4">Time</th>
                  <th className="p-3">Level</th>
                  <th className="p-3">Source</th>
                  <th className="p-3">Event</th>
                  <th className="p-3">Endpoint</th>
                  <th className="p-3">Code</th>
                  <th className="p-3 pr-4">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1A1A1C]">
                {logs.map(log => (
                  <tr
                    key={log.id}
                    onClick={() => setSelectedLog(selectedLog?.id === log.id ? null : log)}
                    className={`cursor-pointer transition-colors hover:bg-[#1A1A1C] ${selectedLog?.id === log.id ? 'bg-[#1A1A1C]' : ''} ${log.level === 'error' ? 'border-l-2 border-l-red-500/50' : ''}`}
                  >
                    <td className="p-3 pl-4 font-mono text-gray-500">{relativeTime(log.timestamp)}</td>
                    <td className="p-3">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${LEVEL_STYLES[log.level] || LEVEL_STYLES.info}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${LEVEL_DOT[log.level] || 'bg-gray-400'}`}></span>
                        {log.level}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-purple-400 text-[11px]">{log.source}</td>
                    <td className="p-3 font-mono text-gray-300">{log.event}</td>
                    <td className="p-3 font-mono text-gray-400 max-w-[200px] truncate">{log.endpoint || '—'}</td>
                    <td className="p-3">
                      {log.status_code ? (
                        <span className={`font-mono font-bold ${log.status_code < 300 ? 'text-green-400' : log.status_code < 500 ? 'text-amber-400' : 'text-red-400'}`}>
                          {log.status_code}
                        </span>
                      ) : <span className="text-gray-600">—</span>}
                    </td>
                    <td className="p-3 pr-4 font-mono text-gray-500">
                      {log.duration_ms != null ? `${log.duration_ms}ms` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Detail panel */}
      {selectedLog && (
        <div className="rounded-2xl border border-[#2D2D30] bg-[#141416] p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">🔍 Log Detail — {selectedLog.id}</h3>
            <button onClick={() => setSelectedLog(null)} className="text-gray-500 hover:text-white text-xs">✕ Close</button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            {[
              ['Timestamp',  new Date(selectedLog.timestamp).toLocaleString()],
              ['Level',      selectedLog.level],
              ['Source',     selectedLog.source],
              ['Event',      selectedLog.event],
              ['Method',     selectedLog.method || '—'],
              ['Endpoint',   selectedLog.endpoint || '—'],
              ['HTTP Code',  selectedLog.status_code?.toString() || '—'],
              ['Duration',   selectedLog.duration_ms != null ? `${selectedLog.duration_ms}ms` : '—'],
            ].map(([k, v]) => (
              <div key={k} className="space-y-0.5">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">{k}</span>
                <span className="font-mono text-white text-[11px]">{v}</span>
              </div>
            ))}
          </div>
          {selectedLog.error && (
            <div className="p-3 rounded-xl bg-red-950/30 border border-red-800/30 text-red-400 font-mono text-xs">
              ❌ {selectedLog.error}
            </div>
          )}
          {selectedLog.graph_error && (
            <div className="p-3 rounded-xl bg-red-950/30 border border-red-800/30 text-red-400 font-mono text-xs">
              Graph Error [{selectedLog.graph_error.code}] {selectedLog.graph_error.type}: {selectedLog.graph_error.message}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
