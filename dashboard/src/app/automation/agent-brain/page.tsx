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
    <div className="space-y-8 text-gray-200 select-none animate-fadeIn">
      {/* Styles Injection for SVG and Synapses */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes pulseGlow {
          0%, 100% { filter: drop-shadow(0 0 4px rgba(168, 85, 247, 0.4)); opacity: 0.4; }
          50% { filter: drop-shadow(0 0 12px rgba(168, 85, 247, 0.85)); opacity: 0.95; }
        }
        @keyframes flowSignal {
          0% { stroke-dashoffset: 120; }
          100% { stroke-dashoffset: 0; }
        }
        @keyframes brainWave {
          0%, 100% { transform: scale(1) translate(0, 0); }
          50% { transform: scale(1.02) translate(1px, -1px); }
        }
        .animate-brain {
          animation: brainWave 6s ease-in-out infinite;
        }
        .synapse {
          animation: pulseGlow 3s infinite ease-in-out;
        }
        .signal-flow {
          stroke-dasharray: 8, 4;
          animation: flowSignal 4s linear infinite;
        }
      ` }} />

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-[#2D2D30] pb-6">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-2">
            🧠 Agentic Search Brain Control Center
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Configure, trigger, and inspect the ReAct reasoning loops running across your leads database in real-time.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              fetchProgress()
              fetchLeads()
              toast.success('Stats refreshed!')
            }}
            className="px-4 py-2.5 rounded-xl bg-[#141416] border border-[#2D2D30] text-xs font-bold text-gray-400 hover:text-white transition-colors flex items-center gap-2 hover:border-gray-500"
          >
            🔄 Refresh Stats
          </button>
        </div>
      </div>

      {/* Interactive Brain Animation Canvas & Flow Dashboard */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Neural Animation & Progress Panel */}
        <div className="lg:col-span-1 p-6 bg-[#0E0E10] border border-[#2D2D30] rounded-2xl shadow-xl space-y-6 flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-900/5 to-transparent pointer-events-none" />
          
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-mono text-purple-400 uppercase tracking-widest font-black">Neural Processing Engine</span>
              <span className="flex items-center gap-1.5 text-xs text-green-400 font-bold uppercase">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-ping" /> Active
              </span>
            </div>

            {/* Glowing SVG Brain & Signal Synapses */}
            <div className="flex items-center justify-center py-4 bg-[#141416]/40 border border-[#2D2D30]/80 rounded-2xl relative overflow-hidden min-h-[220px]">
              <svg className="w-48 h-48 animate-brain" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Brain Silhouette Mesh */}
                <path d="M100 30C75 30 50 45 45 70C40 85 42 105 55 120C60 125 58 135 52 145C48 153 58 165 70 162C80 160 88 165 92 170C96 175 104 175 108 170C112 165 120 160 130 162C142 165 152 153 148 145C142 135 140 125 145 120C158 105 160 85 155 70C150 45 125 30 100 30Z" stroke="rgba(147, 51, 234, 0.15)" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M100 30V170" stroke="rgba(147, 51, 234, 0.1)" strokeWidth="1" strokeDasharray="3 3" />
                
                {/* Synapse Connection Flow Paths */}
                <path d="M60 90Q100 120 140 90" className="signal-flow" stroke="rgba(168, 85, 247, 0.45)" strokeWidth="1.5" />
                <path d="M70 130Q100 70 130 130" className="signal-flow" stroke="rgba(99, 102, 241, 0.45)" strokeWidth="1.5" style={{ animationDelay: '-1.5s' }} />
                <path d="M100 45Q60 100 100 155" className="signal-flow" stroke="rgba(236, 72, 153, 0.45)" strokeWidth="1.5" style={{ animationDelay: '-3s' }} />

                {/* Synapse Nodes */}
                <circle cx="100" cy="30" r="5" className="synapse fill-purple-500" style={{ animationDelay: '0s' }} />
                <circle cx="45" cy="70" r="5" className="synapse fill-indigo-400" style={{ animationDelay: '0.4s' }} />
                <circle cx="155" cy="70" r="5" className="synapse fill-indigo-400" style={{ animationDelay: '0.8s' }} />
                <circle cx="60" cy="110" r="4.5" className="synapse fill-purple-400" style={{ animationDelay: '1.2s' }} />
                <circle cx="140" cy="110" r="4.5" className="synapse fill-purple-400" style={{ animationDelay: '1.6s' }} />
                <circle cx="70" cy="155" r="5" className="synapse fill-pink-500" style={{ animationDelay: '2s' }} />
                <circle cx="130" cy="155" r="5" className="synapse fill-pink-500" style={{ animationDelay: '2.4s' }} />
                <circle cx="100" cy="100" r="6.5" className="synapse fill-purple-300" style={{ animationDelay: '1.5s' }} />
              </svg>

              {enrichingInProgress && (
                <div className="absolute inset-0 bg-purple-950/20 backdrop-blur-[1px] flex flex-col items-center justify-center space-y-2">
                  <div className="w-8 h-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
                  <span className="text-[10px] font-mono font-bold tracking-widest text-purple-300 uppercase animate-pulse">Running ReAct...</span>
                </div>
              )}
            </div>
          </div>

          {/* Pipeline Progress Stats */}
          <div className="space-y-3 pt-4 border-t border-[#2D2D30]/60">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-gray-400">Total Enriched Progress</span>
              <span className="text-white">{totalProcessed} / {totalAvailable} Leads</span>
            </div>
            <div className="w-full bg-[#141416] h-3 rounded-full overflow-hidden border border-[#2D2D30]">
              <div
                className="bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 h-full transition-all duration-700"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="flex justify-between text-[9px] text-gray-500 font-mono">
              <span>{progressPercent}% Complete</span>
              <span>{counts.not_started} Remaining</span>
            </div>
          </div>
        </div>

        {/* Right Tab & Form Control Center */}
        <div className="lg:col-span-2 space-y-6">
          {/* Section Navigation Tabs */}
          <div className="flex flex-wrap gap-1.5 bg-[#141416] p-1.5 rounded-xl border border-[#2D2D30]">
            {([
              { id: 'control', label: '🚀 Autopilot', icon: '🤖' },
              { id: 'leads', label: '📋 Results Logs', icon: '🔍' },
              { id: 'tools', label: '🛠️ Tool Registry', icon: '⚙️' },
              { id: 'architecture', label: '🧬 Architecture', icon: '📖' },
            ] as const).map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === t.id
                    ? 'bg-purple-950/40 text-purple-300 border border-purple-900/40 shadow-inner'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                <span>{t.icon}</span>
                <span>{t.label}</span>
              </button>
            ))}
          </div>

          {/* TAB 1: Autopilot Control Panel */}
          {activeTab === 'control' && (
            <div className="space-y-6">
              {/* Form Control */}
              <div className="p-6 bg-[#0E0E10] border border-[#2D2D30] rounded-2xl shadow-xl space-y-5">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">🚀 Trigger Enrichment Batch</h3>
                  <p className="text-[10px] text-gray-500 mt-1">Configure limits and custom AI logic instructions to kick off ReAct loops.</p>
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
                        className="w-full bg-[#141416] border border-[#2D2D30] rounded-xl px-3.5 py-2.5 text-xs text-white font-mono placeholder-gray-600 focus:outline-none focus:border-gray-500 transition-colors"
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
                      placeholder="Enter instructions (e.g. 'Prioritize finding LinkedIn profiles first', 'If no website is found, fallback to Facebook Messenger queries immediately', etc.)"
                      className="w-full bg-[#141416] border border-[#2D2D30] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-gray-500 resize-none leading-relaxed font-sans"
                    />
                    <p className="text-[9px] text-gray-600">
                      *These prompts are dynamically injected into the system instruction block and override default AI tool routes.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={enrichingInProgress}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-700 via-pink-600 to-indigo-700 hover:from-purple-600 hover:via-pink-500 hover:to-indigo-600 text-white font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-40 flex items-center justify-center gap-2"
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

              {/* Status Grid Cards */}
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
          )}

          {/* TAB 2: Results & Scratchpads */}
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
                      onClick={() => setSelectedStatus(s.key)}
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
                          className="p-4 flex items-center justify-between cursor-pointer hover:bg-[#141416]/50 transition-colors"
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
                                <p className="text-[10px] text-gray-600 font-mono">No loop logs recorded.</p>
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

          {/* TAB 3: Tool Registry */}
          {activeTab === 'tools' && (
            <div className="p-6 bg-[#0E0E10] border border-[#2D2D30] rounded-2xl shadow-xl space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">🛠️ Available Agent Tools</h3>
                <p className="text-[10px] text-gray-500 mt-1">Scraping and verification tools dynamically registered in the agent-brain loop.</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {TOOLS.map(t => (
                  <div key={t.name} className="p-4 bg-[#141416] border border-[#2D2D30] rounded-xl space-y-2 relative overflow-hidden group hover:border-purple-900 transition-colors">
                    <div className="flex justify-between items-start">
                      <span className="text-xs font-bold text-white font-mono group-hover:text-purple-300 transition-colors">{t.name}</span>
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
          )}

          {/* TAB 4: Architecture Compare */}
          {activeTab === 'architecture' && (
            <div className="p-6 bg-[#0E0E10] border border-[#2D2D30] rounded-2xl shadow-xl space-y-5 leading-relaxed text-xs">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">🧬 Why Custom Backend instead of n8n for Agentic ReAct Loops?</h3>
                <p className="text-[10px] text-gray-500 mt-1">Comparison of execution architecture and pipeline efficiency.</p>
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
      </div>
    </div>
  )
}
