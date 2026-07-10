// dashboard/src/app/automation/agent-brain/page.tsx
'use client'

import React, { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'

interface Lead {
  id: string
  name: string
  category?: string
  city?: string
  enrichment_status: string
  enrichment_fields?: Record<string, string>
  tools_tried?: string[]
  tools_failed?: string[]
  enrichment_scratchpad?: string[]
  updated_at: string
}

interface ProgressCounts {
  not_started: number
  enriching: number
  enriched: number
  exhausted: number
  qualified: number
  rejected: number
}

interface ToolInfo {
  name: string
  description: string
  isPaid: boolean
}

export default function AgentBrainPage() {
  const [counts, setCounts] = useState<ProgressCounts>({
    not_started: 0,
    enriching: 0,
    enriched: 0,
    exhausted: 0,
    qualified: 0,
    rejected: 0,
  })
  const [leads, setLeads] = useState<Lead[]>([])
  const [selectedStatus, setSelectedStatus] = useState<'enriched' | 'exhausted' | 'enriching'>('enriched')
  const [limit, setLimit] = useState(10)
  const [customPrompt, setCustomPrompt] = useState('')
  const [enrichingInProgress, setEnrichingInProgress] = useState(false)
  const [loadingLeads, setLoadingLeads] = useState(false)
  const [activeTab, setActiveTab] = useState<'control' | 'leads' | 'tools' | 'architecture'>('control')
  const [expandedLead, setExpandedLead] = useState<string | null>(null)

  // Registered tools matching agent-brain toolRegistry.js
  const TOOLS: ToolInfo[] = [
    { name: 'website_email_scrape', description: 'Extracts email address from homepage + contact/about pages. Cheapest option — runs first when URL is known.', isPaid: false },
    { name: 'facebook_messenger_scrape', description: 'Searches Facebook for pages and extracts Messenger contact, email, or phone. Best for local businesses.', isPaid: false },
    { name: 'reddit_scrape', description: 'Searches Reddit for mentions of the business name or niche as an intent signal. Does NOT discover contact details.', isPaid: false },
    { name: 'linkedin_scrape', description: 'Finds a decision-maker (owner/manager name + title) via LinkedIn. Best for B2B/professional services.', isPaid: true },
    { name: 'tinyfish_search', description: 'Open-web search engine query to find business websites, listings, or social profiles.', isPaid: false },
    { name: 'tinyfish_fetch', description: 'Renders and fetches a specific URL as clean markdown. Useful for parsing JS-heavy pages.', isPaid: false },
    { name: 'hunter_pattern_guess', description: 'Guesses domain email patterns based on known owner names and domain structures.', isPaid: true },
    { name: 'email_verify', description: 'Verifies email deliverability to detect and filter out bounces before campaigns start.', isPaid: false },
  ]

  const fetchProgress = useCallback(async () => {
    try {
      const res = await fetch('/api/agent-brain/tasks/progress')
      const data = await res.json()
      if (res.ok && data.counts) {
        setCounts(data.counts)
      }
    } catch (err) {
      console.error('Failed to load progress counts:', err)
    }
  }, [])

  const fetchLeads = useCallback(async () => {
    setLoadingLeads(true)
    try {
      const res = await fetch(`/api/agent-brain/leads?status=${selectedStatus}&limit=20`)
      const data = await res.json()
      if (res.ok && data.leads) {
        setLeads(data.leads)
      }
    } catch (err) {
      console.error('Failed to load enriched leads:', err)
      toast.error('Failed to load leads list')
    } finally {
      setLoadingLeads(false)
    }
  }, [selectedStatus])

  // Load progress and leads on mount
  useEffect(() => {
    fetchProgress()
    fetchLeads()
  }, [fetchProgress, fetchLeads])

  // Poll progress status every 6 seconds
  useEffect(() => {
    const interval = setInterval(fetchProgress, 6000)
    return () => clearInterval(interval)
  }, [fetchProgress])

  const handleLaunchEnrichment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (limit < 1 || limit > 1000) {
      toast.error('Limit must be between 1 and 1000')
      return
    }
    setEnrichingInProgress(true)
    const toastId = toast.loading(`Agentic Brain: Enriching up to ${limit} leads...`)
    try {
      const res = await fetch('/api/agent-brain/tasks/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit, customPrompt: customPrompt.trim() }),
      })
      const data = await res.json()
      if (res.ok && !data.error) {
        toast.success(
          `Enrichment Batch Complete! Processed: ${data.processed}, Enriched: ${data.enriched}, Exhausted: ${data.exhausted}`,
          { id: toastId, duration: 6000 }
        )
        fetchProgress()
        fetchLeads()
        setCustomPrompt('')
      } else {
        throw new Error(data.error || 'Failed to execute enrichment task')
      }
    } catch (err: any) {
      toast.error(err.message || 'Action failed', { id: toastId })
    } finally {
      setEnrichingInProgress(false)
    }
  }

  const totalProcessed = counts.enriched + counts.exhausted
  const totalAvailable = counts.not_started + totalProcessed
  const enrichmentSuccessRate = totalProcessed > 0 ? Math.round((counts.enriched / totalProcessed) * 100) : 0
  const progressPercent = totalAvailable > 0 ? Math.round((totalProcessed / totalAvailable) * 100) : 0

  return (
    <div className="space-y-6 text-gray-200">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between border-b border-[#2D2D30] pb-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
            🧠 Agentic Search Brain Control Center
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Configure, trigger, and inspect the ReAct reasoning loops running across your leads database in real-time
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              fetchProgress()
              fetchLeads()
              toast.success('Stats refreshed!')
            }}
            className="px-3 py-1.5 rounded-xl bg-[#141416] border border-[#2D2D30] text-xs font-bold text-gray-400 hover:text-white transition-colors"
          >
            🔄 Refresh Stats
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#141416] p-1 rounded-xl border border-[#2D2D30] max-w-md">
        {([
          { id: 'control', label: '🚀 Autopilot', icon: '🤖' },
          { id: 'leads', label: '📋 Results Logs', icon: '🔍' },
          { id: 'tools', label: '🛠️ Tool Registry', icon: '⚙️' },
          { id: 'architecture', label: '📖 Architecture', icon: '🧬' },
        ] as const).map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
              activeTab === t.id
                ? 'bg-purple-950/40 text-purple-300 border border-purple-900/40'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Tab CONTENT: Autopilot Trigger */}
      {activeTab === 'control' && (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Form Control */}
          <div className="lg:col-span-2 space-y-6">
            <div className="p-6 bg-[#0E0E10] border border-[#2D2D30] rounded-2xl shadow-xl space-y-5">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">🚀 Trigger Enrichment Batch</h3>
                <p className="text-[10px] text-gray-500 mt-1">Configure limits and dynamic system instructions to run scraping tasks</p>
              </div>

              <form onSubmit={handleLaunchEnrichment} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="sm:col-span-1 space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Leads Limit (1 - 1000)</label>
                    <input
                      type="number"
                      min={1}
                      max={1000}
                      value={limit}
                      onChange={e => setLimit(parseInt(e.target.value, 10) || 1)}
                      className="w-full bg-[#141416] border border-[#2D2D30] rounded-xl px-3.5 py-2.5 text-xs text-white font-mono placeholder-gray-600 focus:outline-none focus:border-gray-500"
                    />
                  </div>
                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Predefined Scraper Provider</label>
                    <div className="w-full bg-[#141416] border border-[#2D2D30] rounded-xl px-3.5 py-2.5 text-xs text-gray-400 font-mono">
                      Google Maps + Search Crawler Plugin (Active)
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                    Dynamic Agent Instructions / Custom Prompt (Optional)
                  </label>
                  <textarea
                    rows={4}
                    value={customPrompt}
                    onChange={e => setCustomPrompt(e.target.value)}
                    placeholder="Enter instructions to append (e.g. 'Prioritize finding LinkedIn profiles first', 'If no website is found, fallback to Facebook Messenger queries immediately', etc.)"
                    className="w-full bg-[#141416] border border-[#2D2D30] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-gray-500 resize-none leading-relaxed"
                  />
                  <p className="text-[9px] text-gray-600">
                    *These prompts are dynamically injected into the system instruction block and override default AI tool routes.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={enrichingInProgress}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 text-white font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {enrichingInProgress ? (
                    <>
                      <span className="animate-spin">⏳</span> Running ReAct Loops...
                    </>
                  ) : (
                    <>
                      <span>🧠</span> Launch Agentic Search Brain
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Quick Status Cards */}
            <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
              <div className="p-4 bg-[#0E0E10] border border-[#2D2D30] rounded-2xl flex flex-col justify-between">
                <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">Pending Leads</span>
                <span className="text-xl font-black text-white mt-2">{counts.not_started}</span>
              </div>
              <div className="p-4 bg-[#0E0E10] border border-[#2D2D30] rounded-2xl flex flex-col justify-between">
                <span className="text-[9px] font-bold text-green-500 uppercase tracking-wider">Enriched (Success)</span>
                <span className="text-xl font-black text-green-400 mt-2">{counts.enriched}</span>
              </div>
              <div className="p-4 bg-[#0E0E10] border border-[#2D2D30] rounded-2xl flex flex-col justify-between">
                <span className="text-[9px] font-bold text-amber-500 uppercase tracking-wider">Exhausted (Failed)</span>
                <span className="text-xl font-black text-amber-400 mt-2">{counts.exhausted}</span>
              </div>
              <div className="p-4 bg-[#0E0E10] border border-[#2D2D30] rounded-2xl flex flex-col justify-between">
                <span className="text-[9px] font-bold text-purple-500 uppercase tracking-wider">Success Rate</span>
                <span className="text-xl font-black text-purple-400 mt-2">{enrichmentSuccessRate}%</span>
              </div>
            </div>
          </div>

          {/* Sidebar Status Log */}
          <div className="space-y-6">
            <div className="p-6 bg-[#0E0E10] border border-[#2D2D30] rounded-2xl shadow-xl space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">📊 Pipeline Progress</h3>
                <p className="text-[10px] text-gray-500 mt-1">Percentage of leads processed by the AI Agent</p>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-gray-400">Total Processed</span>
                  <span className="text-white">{totalProcessed} / {totalAvailable} Leads</span>
                </div>
                <div className="w-full bg-[#141416] h-2.5 rounded-full overflow-hidden border border-[#2D2D30]">
                  <div
                    className="bg-gradient-to-r from-purple-600 to-indigo-600 h-full transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <div className="flex justify-between text-[9px] text-gray-600">
                  <span>{progressPercent}% Complete</span>
                  <span>{counts.not_started} Leads remaining</span>
                </div>
              </div>

              <div className="border-t border-[#2D2D30]/60 pt-4 space-y-3">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">⚡ Live Backend Connection</span>
                <div className="flex items-center justify-between text-xs bg-[#141416] border border-[#2D2D30] rounded-xl px-3 py-2">
                  <span className="text-gray-500 font-mono">agent-brain:</span>
                  <span className="flex items-center gap-1 text-green-400 text-[10px] font-bold uppercase">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" /> Active
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab CONTENT: Results & Scratchpads */}
      {activeTab === 'leads' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-[#141416] border border-[#2D2D30] p-2.5 rounded-xl">
            <div className="flex gap-1.5">
              {([
                { key: 'enriched', label: 'Enriched', color: 'text-green-400 bg-green-950/20 border-green-900/30' },
                { key: 'exhausted', label: 'Exhausted', color: 'text-amber-400 bg-amber-950/20 border-amber-900/30' },
                { key: 'enriching', label: 'Running', color: 'text-purple-400 bg-purple-950/20 border-purple-900/30' },
              ] as const).map(s => (
                <button
                  key={s.key}
                  onClick={() => {
                    setSelectedStatus(s.key)
                  }}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${
                    selectedStatus === s.key ? s.color + ' border' : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <span className="text-[10px] text-gray-500 font-mono">Showing latest 20</span>
          </div>

          {loadingLeads ? (
            <div className="py-12 text-center text-gray-500 animate-pulse text-xs">Loading logs...</div>
          ) : leads.length === 0 ? (
            <div className="py-12 text-center text-gray-500 border border-dashed border-[#2D2D30] rounded-2xl text-xs">
              No leads found with status "{selectedStatus}".
            </div>
          ) : (
            <div className="space-y-3">
              {leads.map(lead => {
                const isExpanded = expandedLead === lead.id
                return (
                  <div
                    key={lead.id}
                    className="bg-[#0E0E10] border border-[#2D2D30] rounded-xl overflow-hidden shadow-md transition-all"
                  >
                    <div
                      onClick={() => setExpandedLead(isExpanded ? null : lead.id)}
                      className="p-4 flex items-center justify-between cursor-pointer hover:bg-[#141416]/55 transition-colors"
                    >
                      <div className="flex-1 min-w-0 pr-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-white truncate max-w-[200px]">{lead.name}</span>
                          <span className="text-[9px] bg-[#141416] border border-[#2D2D30] rounded px-1.5 py-0.5 text-gray-500">
                            {lead.category || 'Local Business'}
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-500 mt-1">{lead.city || 'India'} · Updated: {new Date(lead.updated_at).toLocaleString()}</p>
                      </div>

                      <div className="flex items-center gap-3">
                        {/* Enriched fields previews */}
                        {lead.enrichment_fields && Object.keys(lead.enrichment_fields).length > 0 && (
                          <div className="hidden sm:flex gap-1.5">
                            {Object.entries(lead.enrichment_fields).map(([k, v]) => (
                              <span key={k} className="text-[9px] bg-purple-950/20 border border-purple-900/30 text-purple-300 rounded px-1.5 py-0.5" title={`${k}: ${v}`}>
                                {k === 'email' ? '📧 Email' : k === 'phone' ? '📞 Phone' : k === 'linkedin' ? '🔗 LinkedIn' : k}
                              </span>
                            ))}
                          </div>
                        )}
                        <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                          lead.enrichment_status === 'enriched'
                            ? 'text-green-400 bg-green-950/20 border-green-900/20'
                            : lead.enrichment_status === 'exhausted'
                            ? 'text-amber-400 bg-amber-950/20 border-amber-900/20'
                            : 'text-purple-400 bg-purple-950/20 border-purple-900/20'
                        }`}>
                          {lead.enrichment_status}
                        </span>
                        <span className="text-gray-500 text-xs font-mono">{isExpanded ? '▲' : '▼'}</span>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-[#2D2D30] bg-[#141416] p-4 space-y-4">
                        {/* Fields Details Grid */}
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1.5">
                            <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider block">Enriched Fields Output</span>
                            {lead.enrichment_fields && Object.keys(lead.enrichment_fields).length > 0 ? (
                              <div className="space-y-1.5">
                                {Object.entries(lead.enrichment_fields).map(([k, v]) => (
                                  <div key={k} className="flex justify-between items-center text-xs bg-[#0E0E10] border border-[#2D2D30] rounded-lg px-3 py-2 font-mono">
                                    <span className="text-gray-500 capitalize">{k}:</span>
                                    <span className="text-white truncate max-w-[200px]" title={v}>{v}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-[10px] text-gray-600">No fields were found for this lead.</p>
                            )}
                          </div>

                          <div className="space-y-1.5">
                            <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider block">Tools Performance</span>
                            <div className="space-y-1 text-[10px]">
                              <div className="flex justify-between">
                                <span className="text-gray-500">Tools Attempted:</span>
                                <span className="text-white font-mono">{JSON.stringify(lead.tools_tried || [])}</span>
                              </div>
                              <div className="flex justify-between mt-1">
                                <span className="text-gray-500">Tools Failed:</span>
                                <span className="text-red-400 font-mono">{JSON.stringify(lead.tools_failed || [])}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Scratchpad Logs Sequence */}
                        <div className="space-y-1.5 border-t border-[#2D2D30]/60 pt-3">
                          <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider block">🧠 Agent reasoning steps (Live Scratchpad)</span>
                          {lead.enrichment_scratchpad && lead.enrichment_scratchpad.length > 0 ? (
                            <div className="space-y-1 bg-[#0E0E10] border border-[#2D2D30] rounded-xl p-3 max-h-48 overflow-y-auto">
                              {lead.enrichment_scratchpad.map((step, idx) => (
                                <div key={idx} className="text-[10px] leading-relaxed text-gray-300 border-b border-[#2D2D30]/30 pb-1 last:border-0 font-mono">
                                  <span className="text-purple-400 font-bold mr-1">[{idx + 1}]</span> {step}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[10px] text-gray-600 font-mono">No loops logs recorded.</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab CONTENT: Tool Registry */}
      {activeTab === 'tools' && (
        <div className="space-y-6">
          <div className="p-6 bg-[#0E0E10] border border-[#2D2D30] rounded-2xl shadow-xl space-y-4">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">🛠️ Available Agent Tools</h3>
              <p className="text-[10px] text-gray-500 mt-1">Below are the scraping and verification tools dynamically registered in the agent-brain loop</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {TOOLS.map(t => (
                <div key={t.name} className="p-4 bg-[#141416] border border-[#2D2D30] rounded-xl space-y-2 relative overflow-hidden">
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-bold text-white font-mono">{t.name}</span>
                    <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                      t.isPaid ? 'bg-red-950/20 border border-red-900/30 text-red-400' : 'bg-green-950/20 border border-green-900/30 text-green-400'
                    }`}>
                      {t.isPaid ? 'Paid' : 'Free'}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-500 leading-relaxed">{t.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab CONTENT: Architecture */}
      {activeTab === 'architecture' && (
        <div className="p-6 bg-[#0E0E10] border border-[#2D2D30] rounded-2xl shadow-xl space-y-5 leading-relaxed text-xs">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">🧬 Why Custom Backend instead of n8n for Agentic ReAct Loops?</h3>
            <p className="text-[10px] text-gray-500 mt-1">Comparison of execution architecture and pipeline efficiency</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="p-4 bg-[#141416] border border-[#2D2D30] rounded-xl space-y-2">
              <span className="text-xs font-bold text-purple-400 block">⚡ Low-Latency Loop</span>
              <p className="text-[10px] text-gray-500">
                In `agent-brain`, agent tool evaluations are direct memory queries and standard JS callbacks. In n8n, every step transition goes through the database, adding 150ms-300ms overhead. Over hundreds of iterations, this lag becomes massive.
              </p>
            </div>

            <div className="p-4 bg-[#141416] border border-[#2D2D30] rounded-xl space-y-2">
              <span className="text-xs font-bold text-purple-400 block">🔒 Concurrency Locks</span>
              <p className="text-[10px] text-gray-500">
                Custom code easily implements database locks (`SELECT FOR UPDATE`) inside SQL queries to prevent multiple workers from grabbing the same leads. Coordinating row-level concurrency in low-code is highly complex and error-prone.
              </p>
            </div>

            <div className="p-4 bg-[#141416] border border-[#2D2D30] rounded-xl space-y-2">
              <span className="text-xs font-bold text-purple-400 block">📦 Log Optimization</span>
              <p className="text-[10px] text-gray-500">
                n8n stores raw node execution data for every loop iteration. Running ReAct loops on thousands of leads results in gigabytes of SQLite/Postgres logs inside n8n, which quickly runs out of memory. `agent-brain` logs cleanly to Supabase text columns.
              </p>
            </div>
          </div>

          <div className="bg-[#141416] border border-[#2D2D30] rounded-xl p-4 space-y-2">
            <span className="text-xs font-bold text-white uppercase tracking-wider block">🏆 The Ideal Hybrid Model (Active in Your Pipeline)</span>
            <p className="text-[10px] text-gray-500">
              Your system keeps n8n as the <strong>Integration / Trigger layer</strong> (dispatching webhooks, emailing outreach, sending WhatsApp texts) where its low-code nodes are highly effective, while delegating the heavy, iterative <strong>agentic search/enrichment loop</strong> to the code-based `agent-brain`.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
