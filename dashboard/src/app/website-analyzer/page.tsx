// dashboard/src/app/website-analyzer/page.tsx
'use client'

import React, { useState, useEffect, useRef } from 'react'
import toast from 'react-hot-toast'

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

    // Polling function for active logs
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
      
      // Safety limit: stop polling after 45 seconds if request hangs
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
        // Fetch logs one final time to capture completeness
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
    if (score >= 90) return 'text-[#3B4D3C] bg-[#D4E0CD] border-[#B8C8B0]'
    if (score >= 70) return 'text-[#5C451F] bg-[#F9D99A] border-[#E8C584]'
    return 'text-red-700 bg-red-50 border-red-200'
  }

  return (
    <div className="space-y-8 text-[#2D2D2D] select-none">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-[#1C1C1E] tracking-tight">Website Audit & Analyzer</h1>
        <p className="mt-1 text-sm text-gray-500 font-medium">Extract tech stack, contacts, social links, SEO indicators, and compute optimization scores.</p>
      </div>

      {/* Input panel */}
      <div className="rounded-2xl border border-[#E4E3DD] bg-white p-6 max-w-2xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)]">
        <form onSubmit={handleAudit} className="flex gap-4">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            required
            className="flex-1 rounded-xl bg-[#F4F3EF] border border-[#E4E3DD] px-4 py-3 text-xs text-[#2D2D2D] font-bold focus:outline-none focus:border-gray-500 placeholder-gray-400"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-[#1C1C1E] hover:bg-[#252528] disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold uppercase tracking-wider text-white px-6 py-3 transition-colors flex items-center gap-2"
          >
            {loading && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            {loading ? 'Auditing...' : 'Run Audit'}
          </button>
        </form>
      </div>

      {/* Real-time Logger Console Terminal */}
      {(loading || logs.length > 0) && (
        <div className="rounded-2xl border border-[#E4E3DD] bg-white overflow-hidden max-w-2xl flex flex-col h-[200px] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)]">
          <div className="bg-gray-50 px-4 py-3 border-b border-[#E4E3DD] flex items-center justify-between">
            <span className="font-bold text-[10px] text-gray-400 uppercase tracking-wider">📡 Audit Engine Console Logs</span>
            {loading && (
              <span className="text-[10px] text-purple-600 font-bold uppercase tracking-wider animate-pulse flex items-center gap-1.5 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                Live streaming...
              </span>
            )}
          </div>
          <div className="flex-1 p-4 font-mono text-[10px] text-gray-600 overflow-y-auto space-y-1.5 bg-[#F4F3EF]/30 select-none">
            {logs.map((log, index) => (
              <div key={index} className="leading-relaxed break-all">
                <span className={log.startsWith('❌') ? 'text-red-650 font-bold' : 'text-gray-650'}>{log}</span>
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
            <div className={`rounded-2xl border p-6 text-center space-y-2 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] ${getScoreColor(report.overall_score)}`}>
              <span className="text-[10px] font-bold uppercase tracking-widest block opacity-70">Overall Score</span>
              <span className="text-5xl font-black">{report.overall_score}</span>
            </div>

            <div className="rounded-2xl border border-[#E4E3DD] bg-white p-5 space-y-3.5 text-xs shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)]">
              <h4 className="font-bold text-gray-400 uppercase text-[9px] tracking-wider border-b border-[#E4E3DD] pb-2">Individual Pillars</h4>
              <div className="flex justify-between items-center border-b border-gray-50 pb-2">
                <span className="text-gray-500 font-semibold">SEO Structure</span>
                <span className="font-bold text-gray-800">{report.seo_score}/100</span>
              </div>
              <div className="flex justify-between items-center border-b border-gray-50 pb-2">
                <span className="text-gray-500 font-semibold">User Experience</span>
                <span className="font-bold text-gray-800">{report.ux_score}/100</span>
              </div>
              <div className="flex justify-between items-center border-b border-gray-50 pb-2">
                <span className="text-gray-500 font-semibold">Performance Index</span>
                <span className="font-bold text-gray-800">{report.performance_score}/100</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 font-semibold">Accessibility Rating</span>
                <span className="font-bold text-gray-800">{report.accessibility_score}/100</span>
              </div>
            </div>
          </div>

          {/* Right panel: Data Extraction Lists */}
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-2xl border border-[#E4E3DD] bg-white p-6 space-y-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)]">
              <h3 className="font-bold text-[#1C1C1E] text-xs uppercase tracking-wider text-gray-500 border-b border-[#E4E3DD] pb-3">🛠️ Technology & Security Audit</h3>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                <div className="bg-[#F4F3EF] p-4.5 rounded-2xl border border-[#E4E3DD] space-y-1">
                  <span className="text-gray-400 font-bold uppercase text-[9px] block">Load Time</span>
                  <span className="text-gray-800 font-black text-sm">{report.tech_stack.load_time_ms} ms</span>
                </div>
                <div className="bg-[#F4F3EF] p-4.5 rounded-2xl border border-[#E4E3DD] space-y-1">
                  <span className="text-gray-400 font-bold uppercase text-[9px] block">SSL Connection</span>
                  <span className="text-gray-800 font-black text-sm">{report.tech_stack.ssl_enabled ? '🔒 HTTPS Secure' : '⚠️ Unsecure HTTP'}</span>
                </div>
                <div className="bg-[#F4F3EF] p-4.5 rounded-2xl border border-[#E4E3DD] space-y-1">
                  <span className="text-gray-400 font-bold uppercase text-[9px] block">Page Size</span>
                  <span className="text-gray-800 font-black text-sm">
                    {report.tech_stack.page_size_kb ? `${(report.tech_stack.page_size_kb / 1024).toFixed(2)} MB` : '0 KB'}
                  </span>
                </div>
                <div className="bg-[#F4F3EF] p-4.5 rounded-2xl border border-[#E4E3DD] space-y-1">
                  <span className="text-gray-400 font-bold uppercase text-[9px] block">Request Count</span>
                  <span className="text-gray-800 font-black text-sm">{report.tech_stack.resource_count || 0} assets</span>
                </div>
              </div>

              {/* Technologies list */}
              {report.tech_stack.technologies.length > 0 && (
                <div className="space-y-3 pt-2">
                  <span className="text-gray-500 text-xs font-bold uppercase tracking-wider text-[9px]">Detected Frameworks & Libraries</span>
                  <div className="flex flex-wrap gap-2">
                    {report.tech_stack.technologies.map(t => (
                      <span key={t} className="px-3 py-1 bg-[#F4F3EF] border border-[#E4E3DD] text-gray-700 rounded-lg font-mono font-bold text-[10px]">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Contacts & Social links */}
            <div className="rounded-2xl border border-[#E4E3DD] bg-white p-6 space-y-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)]">
              <h3 className="font-bold text-[#1C1C1E] text-xs uppercase tracking-wider text-gray-500 border-b border-[#E4E3DD] pb-3">📞 Contact details & Social Footprints</h3>

              <div className="grid md:grid-cols-2 gap-6 text-xs">
                <div className="space-y-3.5">
                  <h4 className="font-bold text-gray-400 uppercase text-[9px] tracking-wider">Contact Channels</h4>
                  <div className="space-y-2">
                    {report.emails.map(e => (
                      <div key={e} className="text-gray-700 font-bold break-all bg-[#F4F3EF] px-3.5 py-2.5 rounded-xl border border-[#E4E3DD]">✉️ {e}</div>
                    ))}
                    {report.phone_numbers.map(p => (
                      <div key={p} className="text-gray-700 font-bold break-all bg-[#F4F3EF] px-3.5 py-2.5 rounded-xl border border-[#E4E3DD]">📞 {p}</div>
                    ))}
                    {report.emails.length === 0 && report.phone_numbers.length === 0 && (
                      <span className="text-gray-450 italic font-semibold">No emails or phone numbers found on the homepage.</span>
                    )}
                  </div>
                </div>

                <div className="space-y-3.5">
                  <h4 className="font-bold text-gray-400 uppercase text-[9px] tracking-wider">Social Footprints</h4>
                  <div className="space-y-2">
                    {report.social_links.map(s => (
                      <a
                        key={s}
                        href={s}
                        target="_blank"
                        rel="noreferrer"
                        className="block text-blue-600 hover:text-blue-500 font-bold hover:underline break-all bg-[#F4F3EF] px-3.5 py-2.5 rounded-xl border border-[#E4E3DD]"
                      >
                        🔗 {s.replace(/^https?:\/\/(www\.)?/, '')}
                      </a>
                    ))}
                    {report.social_links.length === 0 && (
                      <span className="text-gray-450 italic font-semibold">No social media links detected.</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* QA Diagnostics: Broken Links, UI bugs & console exceptions */}
            <div className="grid gap-6 md:grid-cols-2">
              {/* Broken Links Table */}
              {report.broken_links && report.broken_links.length > 0 && (
                <div className="rounded-2xl border border-orange-200 bg-orange-50/10 p-6 space-y-4 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.02)]">
                  <h3 className="font-bold text-orange-800 text-xs uppercase tracking-wider border-b border-orange-250 pb-2.5 flex items-center justify-between">
                    <span>🔗 Broken Web Links ({report.broken_links.length})</span>
                  </h3>
                  <div className="overflow-x-auto max-h-[220px] overflow-y-auto">
                    <table className="w-full text-left text-[11px] border-collapse">
                      <thead>
                        <tr className="border-b border-orange-200 text-orange-950 font-bold uppercase tracking-wider text-[8px] sticky top-0 bg-white">
                          <th className="pb-2">Label</th>
                          <th className="pb-2">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-orange-100/50 text-gray-700">
                        {report.broken_links.map((link, idx) => (
                          <tr key={idx} className="hover:bg-orange-50/50">
                            <td className="py-2 pr-3 truncate max-w-[120px] font-semibold text-orange-950" title={link.href}>
                              {link.text || link.href}
                            </td>
                            <td className="py-2 font-mono font-bold text-red-650">
                              {link.status === 504 ? 'Timeout' : `${link.status}`}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Heuristic UI Layout Bugs */}
              {report.ui_issues && report.ui_issues.length > 0 && (
                <div className="rounded-2xl border border-yellow-200 bg-yellow-50/10 p-6 space-y-4 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.02)]">
                  <h3 className="font-bold text-yellow-800 text-xs uppercase tracking-wider border-b border-yellow-250 pb-2.5">
                    ⚠️ UI Layout & UX Warnings ({report.ui_issues.length})
                  </h3>
                  <div className="space-y-3.5 max-h-[220px] overflow-y-auto">
                    {report.ui_issues.map((issue, idx) => (
                      <div key={idx} className="text-[11px] leading-relaxed flex flex-col gap-1 border-b border-yellow-100/55 pb-2.5 last:border-b-0">
                        <span className="font-bold text-yellow-950 capitalize">
                          {issue.type.replace('_', ' ')}
                        </span>
                        <span className="text-gray-600">{issue.message}</span>
                        <code className="text-[9px] font-mono bg-yellow-50 text-yellow-750 px-2 py-0.5 rounded truncate select-all">
                          {issue.selector}
                        </code>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Network Failed Requests & JS Console Errors */}
            {((report.console_errors && report.console_errors.length > 0) || (report.failed_requests && report.failed_requests.length > 0)) && (
              <div className="rounded-2xl border border-red-200 bg-red-50/10 p-6 space-y-4 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.02)]">
                <h3 className="font-bold text-red-800 text-xs uppercase tracking-wider border-b border-red-250 pb-2.5">
                  🚨 Console Errors & Broken Endpoints
                </h3>
                <div className="grid md:grid-cols-2 gap-6 text-xs">
                  {/* Failed Network Requests */}
                  {report.failed_requests && report.failed_requests.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-[9px] font-bold text-red-700 uppercase tracking-wider block">Failed API/Resource Requests</span>
                      <div className="space-y-1.5 max-h-[160px] overflow-y-auto">
                        {report.failed_requests.map((req, idx) => (
                          <div key={idx} className="bg-red-50/60 p-2.5 rounded-xl border border-red-100 flex flex-col gap-0.5">
                            <span className="font-mono text-[9px] text-gray-500 truncate" title={req.url}>{req.url}</span>
                            <span className="font-bold text-red-950 text-[10px]">{req.error}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* JS Exceptions Console */}
                  {report.console_errors && report.console_errors.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-[9px] font-bold text-red-700 uppercase tracking-wider block">JS Script Exceptions (Stderr)</span>
                      <div className="bg-[#1C1C1E] text-red-400 p-3.5 rounded-xl font-mono text-[9px] max-h-[160px] overflow-y-auto space-y-1.5 leading-relaxed select-all">
                        {report.console_errors.map((err, idx) => (
                          <div key={idx} className="break-all border-b border-red-950 pb-1 last:border-b-0">
                            ❌ {err}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Desktop Page Capture */}
            {report.screenshot_url && (
              <div className="rounded-2xl border border-[#E4E3DD] bg-white p-6 space-y-4 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)]">
                <h3 className="font-bold text-[#1C1C1E] text-xs uppercase tracking-wider text-gray-500 border-b border-[#E4E3DD] pb-3">
                  📸 Webpage Visual Desktop Capture
                </h3>
                <div className="border border-[#E4E3DD] rounded-2xl overflow-hidden bg-gray-50 shadow-inner">
                  {/* Browser Header frame */}
                  <div className="bg-[#F4F3EF] border-b border-[#E4E3DD] px-4 py-2.5 flex items-center gap-2">
                    <div className="flex gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-red-400" />
                      <div className="w-2 h-2 rounded-full bg-yellow-400" />
                      <div className="w-2 h-2 rounded-full bg-green-400" />
                    </div>
                    <div className="flex-1 bg-white rounded-lg border border-[#E4E3DD] px-3.5 py-0.5 text-[9px] text-gray-400 truncate max-w-sm font-mono">
                      {report.url}
                    </div>
                  </div>
                  {/* Screenshot render */}
                  <img
                    src={report.screenshot_url}
                    alt="Audited homepage screenshot"
                    className="w-full h-auto object-top object-cover max-h-[480px] bg-white"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
