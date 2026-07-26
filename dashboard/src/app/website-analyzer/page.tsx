// dashboard/src/app/website-analyzer/page.tsx
'use client'

import React, { useState, useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import { Globe, Search, Terminal, Activity, ShieldCheck, Mail, Phone, ExternalLink } from 'lucide-react'

interface AuditReport {
  url: string
  seo_score: number
  ux_score: number
  performance_score: number
  accessibility_score: number
  overall_score: number
  tech_stack: {
    load_time_ms: number
    ssl_enabled: boolean
    technologies: string[]
    images_count: number
    missing_alt_count: number
    page_size_kb?: number
    resource_count?: number
  }
  social_links: string[]
  emails: string[]
  phone_numbers: string[]
  screenshot_url?: string | null
  broken_links?: { text: string; href: string; status: number }[]
  console_errors?: string[]
  failed_requests?: { url: string; error: string }[]
  ui_issues?: { type: string; selector: string; message: string }[]
}

interface LogEntry {
  timestamp: string
  level: string
  message: string
}

export default function WebsiteAnalyzerPage() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<AuditReport | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  
  const logEndRef = useRef<HTMLDivElement | null>(null)

  // Auto-scroll logs terminal
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs])

  async function handleAudit(e: React.FormEvent) {
    e.preventDefault()
    if (!url.trim()) return

    setLoading(true)
    setReport(null)
    setLogs(['[System] Initializing website audit connection...'])
    const toastId = toast.loading('Running full website audit...')

    let pollCount = 0
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch('/api/backend-v3/logs')
        if (res.ok) {
          const data = await res.json()
          if (data.logs) {
            const webLogs = data.logs
              .filter((log: LogEntry) => log.message.includes('[Website Analyzer]'))
              .map((log: LogEntry) => {
                const time = new Date(log.timestamp).toLocaleTimeString()
                return `[${time}] ${log.message.replace('[Website Analyzer] ', '')}`
              })
            
            if (webLogs.length > 0) {
              setLogs(webLogs)
            }
          }
        }
      } catch (err) {
        console.error('Failed to poll active logs:', err)
      }
      
      pollCount++
      if (pollCount > 45) {
        clearInterval(pollInterval)
      }
    }, 1000)

    try {
      const res = await fetch('/api/backend-v3/test/website', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() })
      })

      const data = await res.json()
      clearInterval(pollInterval)

      if (res.ok && data.report) {
        setReport(data.report)
        const logsRes = await fetch('/api/backend-v3/logs')
        if (logsRes.ok) {
          const logsData = await logsRes.json()
          if (logsData.logs) {
            const webLogs = logsData.logs
              .filter((log: LogEntry) => log.message.includes('[Website Analyzer]'))
              .map((log: LogEntry) => {
                const time = new Date(log.timestamp).toLocaleTimeString()
                return `[${time}] ${log.message.replace('[Website Analyzer] ', '')}`
              })
            setLogs(webLogs)
          }
        }
        toast.success('Website audit completed!', { id: toastId })
      } else {
        throw new Error(data.error || 'Audit failed')
      }
    } catch (err: unknown) {
      clearInterval(pollInterval)
      const msg = err instanceof Error ? err.message : 'Error auditing website'
      setLogs(prev => [...prev, `❌ Error: ${msg}`])
      toast.error(msg, { id: toastId })
    } finally {
      setLoading(false)
    }
  }

  function getScoreColor(score: number) {
    if (score >= 90) return 'text-emerald-400 bg-emerald-950/20 border-emerald-500/30'
    if (score >= 70) return 'text-amber-300 bg-amber-950/20 border-amber-500/30'
    return 'text-rose-400 bg-rose-950/20 border-rose-500/30'
  }

  return (
    <div className="p-4 sm:p-8 space-y-8 select-none text-foreground max-w-7xl mx-auto">
      {/* Header */}
      <div className="border-b border-blue-500/15 pb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
          <Globe className="w-7 h-7 text-blue-400" /> Website Audit & Analyzer
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-zinc-400 font-medium">Extract tech stack, contacts, social links, SEO indicators, and compute optimization scores.</p>
      </div>

      {/* Input panel */}
      <div className="rounded-2xl glass glow-border p-6 max-w-2xl shadow-xl">
        <form onSubmit={handleAudit} className="flex flex-col sm:flex-row gap-3">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            required
            className="flex-1 rounded-xl bg-black/50 border border-white/10 px-4 py-3 text-xs text-zinc-200 font-mono focus:outline-none focus:border-blue-500 placeholder-zinc-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold uppercase font-mono tracking-wider text-white px-6 py-3 transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 shrink-0"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            {loading ? 'Auditing...' : 'Run Audit'}
          </button>
        </form>
      </div>

      {/* Real-time Logger Console Terminal */}
      {(loading || logs.length > 0) && (
        <div className="rounded-2xl glass glow-border overflow-hidden max-w-2xl flex flex-col h-[200px] shadow-xl">
          <div className="bg-blue-950/40 px-4 py-3 border-b border-blue-500/15 flex items-center justify-between">
            <span className="font-bold text-[10px] text-zinc-400 uppercase tracking-wider font-mono flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-blue-400" /> Audit Engine Console Logs
            </span>
            {loading && (
              <span className="text-[10px] text-purple-300 font-mono font-bold uppercase tracking-wider animate-pulse flex items-center gap-1.5 bg-purple-500/15 px-2 py-0.5 rounded border border-purple-500/30">
                Live streaming...
              </span>
            )}
          </div>
          <div className="flex-1 p-4 font-mono text-[10px] text-zinc-300 overflow-y-auto space-y-1.5 bg-zinc-950 select-text">
            {logs.map((log, index) => (
              <div key={index} className="leading-relaxed break-all">
                <span className={log.startsWith('❌') ? 'text-rose-400 font-bold' : 'text-zinc-300'}>{log}</span>
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        </div>
      )}

      {/* Results Report Display */}
      {report && (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left panel: Score cards */}
          <div className="lg:col-span-1 space-y-4">
            <div className={`rounded-2xl border p-6 text-center space-y-2 shadow-xl ${getScoreColor(report.overall_score)}`}>
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest block opacity-80">Overall Score</span>
              <span className="text-5xl font-black font-mono">{report.overall_score}</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl glass glow-border p-4 text-center">
                <span className="text-[9px] font-mono text-zinc-400 uppercase block">SEO</span>
                <span className="text-xl font-bold font-mono text-blue-400">{report.seo_score}</span>
              </div>
              <div className="rounded-xl glass glow-border p-4 text-center">
                <span className="text-[9px] font-mono text-zinc-400 uppercase block">UX</span>
                <span className="text-xl font-bold font-mono text-blue-400">{report.ux_score}</span>
              </div>
              <div className="rounded-xl glass glow-border p-4 text-center">
                <span className="text-[9px] font-mono text-zinc-400 uppercase block">Performance</span>
                <span className="text-xl font-bold font-mono text-blue-400">{report.performance_score}</span>
              </div>
              <div className="rounded-xl glass glow-border p-4 text-center">
                <span className="text-[9px] font-mono text-zinc-400 uppercase block">Accessibility</span>
                <span className="text-xl font-bold font-mono text-blue-400">{report.accessibility_score}</span>
              </div>
            </div>
          </div>

          {/* Right panel: Tech stack & contacts */}
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-2xl glass glow-border p-6 shadow-xl space-y-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-blue-400" /> Tech Stack & Metadata
              </h3>
              <div className="flex flex-wrap gap-2">
                {report.tech_stack.technologies.map((tech, idx) => (
                  <span key={idx} className="px-2.5 py-1 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-300 font-mono text-xs">
                    {tech}
                  </span>
                ))}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs font-mono text-zinc-400 pt-2 border-t border-blue-500/15">
                <div>Load Time: <span className="text-white font-bold">{report.tech_stack.load_time_ms}ms</span></div>
                <div>SSL: <span className="text-emerald-400 font-bold">{report.tech_stack.ssl_enabled ? 'Active' : 'Missing'}</span></div>
                <div>Images: <span className="text-white font-bold">{report.tech_stack.images_count}</span></div>
              </div>
            </div>

            {/* Extracted Contacts */}
            <div className="rounded-2xl glass glow-border p-6 shadow-xl space-y-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-1.5">
                <Mail className="w-4 h-4 text-blue-400" /> Extracted Contact Information
              </h3>
              <div className="grid sm:grid-cols-2 gap-4 text-xs font-mono">
                <div>
                  <span className="text-zinc-400 block mb-1">Emails ({report.emails.length})</span>
                  {report.emails.length === 0 ? (
                    <span className="text-zinc-600">None found</span>
                  ) : (
                    report.emails.map((e, idx) => (
                      <div key={idx} className="text-blue-300 underline">{e}</div>
                    ))
                  )}
                </div>
                <div>
                  <span className="text-zinc-400 block mb-1">Phone Numbers ({report.phone_numbers.length})</span>
                  {report.phone_numbers.length === 0 ? (
                    <span className="text-zinc-600">None found</span>
                  ) : (
                    report.phone_numbers.map((p, idx) => (
                      <div key={idx} className="text-emerald-300">{p}</div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
