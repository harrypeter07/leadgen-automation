'use client'

import React, { useState } from 'react'
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
  }
  social_links: string[]
  emails: string[]
  phone_numbers: string[]
}

export default function WebsiteAnalyzerPage() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<AuditReport | null>(null)

  async function handleAudit(e: React.FormEvent) {
    e.preventDefault()
    if (!url.trim()) return

    setLoading(true)
    const toastId = toast.loading('Running full website audit...')
    try {
      const res = await fetch('/api/backend-v3/test/website', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() })
      })

      const data = await res.json()
      if (res.ok && data.report) {
        setReport(data.report)
        toast.success('Website audit completed!', { id: toastId })
      } else {
        throw new Error(data.error || 'Audit failed')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error auditing website'
      toast.error(msg, { id: toastId })
    } finally {
      setLoading(false)
    }
  }

  function getScoreColor(score: number) {
    if (score >= 90) return 'text-green-400 border-green-500/30 bg-green-950/20'
    if (score >= 70) return 'text-yellow-400 border-yellow-500/30 bg-yellow-950/20'
    return 'text-red-400 border-red-500/30 bg-red-950/20'
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Website Audit & Analyzer</h1>
        <p className="mt-1 text-sm text-gray-400">Extract tech stack, contacts, social links, SEO indicators, and compute optimization scores.</p>
      </div>

      {/* Input panel */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6 max-w-2xl">
        <form onSubmit={handleAudit} className="flex gap-4">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            required
            className="flex-1 rounded-lg bg-gray-950 border border-gray-800 px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-colors"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-semibold text-white px-6 py-2.5 transition-colors flex items-center gap-2"
          >
            {loading && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            {loading ? 'Auditing...' : 'Run Audit'}
          </button>
        </form>
      </div>

      {/* Results Report Display */}
      {report && (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left panel: Score cards */}
          <div className="lg:col-span-1 space-y-4">
            <div className={`rounded-xl border p-6 text-center space-y-2 ${getScoreColor(report.overall_score)}`}>
              <span className="text-[10px] font-bold uppercase tracking-widest block text-gray-400">Overall Score</span>
              <p className="text-5xl font-black">{Math.round(report.overall_score)}</p>
            </div>

            <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5 space-y-4 text-xs">
              <h4 className="font-bold text-gray-200 uppercase text-[10px] border-b border-gray-850 pb-2">Subscores</h4>
              
              <div className="flex justify-between items-center border-b border-gray-850/40 pb-2">
                <span className="text-gray-400">SEO Score</span>
                <span className={`px-2 py-0.5 rounded font-bold ${getScoreColor(report.seo_score)}`}>{report.seo_score}</span>
              </div>
              <div className="flex justify-between items-center border-b border-gray-850/40 pb-2">
                <span className="text-gray-400">UX / UI Score</span>
                <span className={`px-2 py-0.5 rounded font-bold ${getScoreColor(report.ux_score)}`}>{report.ux_score}</span>
              </div>
              <div className="flex justify-between items-center border-b border-gray-850/40 pb-2">
                <span className="text-gray-400">Performance Score</span>
                <span className={`px-2 py-0.5 rounded font-bold ${getScoreColor(report.performance_score)}`}>{report.performance_score}</span>
              </div>
              <div className="flex justify-between items-center pb-1">
                <span className="text-gray-400">Accessibility Score</span>
                <span className={`px-2 py-0.5 rounded font-bold ${getScoreColor(report.accessibility_score)}`}>{report.accessibility_score}</span>
              </div>
            </div>

            {/* Tech details */}
            <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5 space-y-4 text-xs">
              <h4 className="font-bold text-gray-200 uppercase text-[10px] border-b border-gray-850 pb-2">Diagnostics</h4>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Load Time</span>
                <span className="text-gray-200 font-semibold">{report.tech_stack.load_time_ms} ms</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">SSL status</span>
                <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${report.tech_stack.ssl_enabled ? 'bg-green-950 text-green-400' : 'bg-red-950 text-red-400'}`}>
                  {report.tech_stack.ssl_enabled ? 'SECURE' : 'UNSECURE'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Total Images</span>
                <span className="text-gray-200 font-semibold">{report.tech_stack.images_count}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Missing ALT attributes</span>
                <span className="text-red-400 font-semibold">{report.tech_stack.missing_alt_count}</span>
              </div>
            </div>
          </div>

          {/* Right panel: Tech stack & Contacts */}
          <div className="lg:col-span-2 space-y-6">
            {/* Tech list */}
            <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6 space-y-4">
              <h3 className="font-bold text-gray-200 text-sm">🛠️ Detected Technologies</h3>
              {report.tech_stack.technologies.length === 0 ? (
                <p className="text-xs text-gray-500">No popular frameworks or integrations detected.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {report.tech_stack.technologies.map(t => (
                    <span key={t} className="px-3 py-1 bg-purple-950 text-purple-300 border border-purple-900 rounded-lg text-xs font-semibold">
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Contacts parsed */}
            <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6 space-y-6">
              <h3 className="font-bold text-gray-200 text-sm border-b border-gray-850 pb-2">📞 Extracted Contact Info</h3>
              
              <div className="grid gap-6 md:grid-cols-2 text-xs">
                {/* Emails list */}
                <div className="space-y-2">
                  <span className="font-semibold text-gray-400 block uppercase text-[10px]">Emails ({report.emails.length})</span>
                  {report.emails.length === 0 ? (
                    <p className="text-gray-600 italic">No email found on page.</p>
                  ) : (
                    <ul className="space-y-1 text-gray-300 font-mono">
                      {report.emails.map(e => <li key={e}>{e}</li>)}
                    </ul>
                  )}
                </div>

                {/* Phone list */}
                <div className="space-y-2">
                  <span className="font-semibold text-gray-400 block uppercase text-[10px]">Phone numbers ({report.phone_numbers.length})</span>
                  {report.phone_numbers.length === 0 ? (
                    <p className="text-gray-600 italic">No phone number parsed.</p>
                  ) : (
                    <ul className="space-y-1 text-gray-300 font-mono">
                      {report.phone_numbers.map(p => <li key={p}>{p}</li>)}
                    </ul>
                  )}
                </div>
              </div>

              {/* Social Channels */}
              <div className="space-y-2 border-t border-gray-850/50 pt-4">
                <span className="font-semibold text-gray-400 block uppercase text-[10px]">Social Channels & Anchors ({report.social_links.length})</span>
                {report.social_links.length === 0 ? (
                  <p className="text-xs text-gray-600 italic">No social media anchors parsed from DOM links.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {report.social_links.map(l => (
                      <a
                        key={l}
                        href={l}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2 py-1 bg-gray-950 border border-gray-800 rounded text-xs text-purple-400 hover:text-purple-300 transition-colors"
                      >
                        {l.split('//')[1]?.split('/')[0]} ↗
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
