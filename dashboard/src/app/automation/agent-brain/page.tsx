'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import toast from 'react-hot-toast'

interface Lead {
  id: string
  name: string
  business_name?: string
  category?: string
  city?: string
  country?: string
  website?: string
  enrichment_status: string
  enrichment_fields?: Record<string, string>
  tools_tried?: string[]
  tools_failed?: string[]
  enrichment_scratchpad?: string[]
  attempts?: number
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

const ALL_TOOLS = [
  { id: 'website_email_scrape',   label: 'Website Email',    icon: '🌐', color: '#6366f1', isPaid: false },
  { id: 'tinyfish_search',        label: 'Tinyfish Search',  icon: '🔍', color: '#8b5cf6', isPaid: false },
  { id: 'tinyfish_fetch',         label: 'Tinyfish Fetch',   icon: '📄', color: '#a855f7', isPaid: false },
  { id: 'facebook_messenger_scrape', label: 'Facebook',     icon: '📘', color: '#3b82f6', isPaid: false },
  { id: 'reddit_scrape',          label: 'Reddit',           icon: '🔴', color: '#ef4444', isPaid: false },
  { id: 'linkedin_scrape',        label: 'LinkedIn',         icon: '💼', color: '#0ea5e9', isPaid: true  },
  { id: 'hunter_pattern_guess',   label: 'Hunter Pattern',   icon: '🎯', color: '#f59e0b', isPaid: true  },
  { id: 'email_verify',           label: 'Email Verify',     icon: '✅', color: '#10b981', isPaid: false },
  { id: 'instagram_profile_scrape', label: 'Instagram',     icon: '📸', color: '#ec4899', isPaid: false },
  { id: 'google_maps_scrape',     label: 'Google Maps',      icon: '🗺️', color: '#22c55e', isPaid: false },
]

type TabId = 'control' | 'leads' | 'tools' | 'architecture'
type LeadStatus = 'enriched' | 'exhausted' | 'enriching'

export default function AgentBrainPage() {
  const [counts, setCounts] = useState<ProgressCounts>({
    not_started: 0, enriching: 0, enriched: 0,
    exhausted: 0, qualified: 0, rejected: 0,
  })
  const [leads, setLeads] = useState<Lead[]>([])
  const [selectedStatus, setSelectedStatus] = useState<LeadStatus>('enriched')
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [limit, setLimit] = useState(10)
  const [customPrompt, setCustomPrompt] = useState('')
  const [enrichingInProgress, setEnrichingInProgress] = useState(false)
  const [loadingLeads, setLoadingLeads] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>('control')
  const [hoveredTool, setHoveredTool] = useState<string | null>(null)
  const [logFilter, setLogFilter] = useState<'all' | 'error' | 'success'>('all')
  const logRef = useRef<HTMLDivElement>(null)

  const fetchProgress = useCallback(async () => {
    try {
      const res = await fetch('/api/agent-brain/tasks/progress')
      const data = await res.json()
      if (res.ok && data.counts) setCounts(data.counts)
    } catch {}
  }, [])

  const fetchLeads = useCallback(async () => {
    setLoadingLeads(true)
    try {
      const res = await fetch(`/api/agent-brain/leads?status=${selectedStatus}&limit=30`)
      const data = await res.json()
      if (res.ok && data.leads) {
        setLeads(data.leads)
        if (!selectedLead && data.leads.length > 0) setSelectedLead(data.leads[0])
      }
    } catch {
      toast.error('Failed to load leads')
    } finally {
      setLoadingLeads(false)
    }
  }, [selectedStatus, selectedLead])

  useEffect(() => { fetchProgress(); fetchLeads() }, [fetchProgress, fetchLeads])
  useEffect(() => { const t = setInterval(fetchProgress, 8000); return () => clearInterval(t) }, [fetchProgress])

  // Auto-scroll logs
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [selectedLead])

  const handleLaunchEnrichment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (limit < 1 || limit > 1000) { toast.error('Limit must be between 1 and 1000'); return }
    setEnrichingInProgress(true)
    const toastId = toast.loading(`🧠 Brain enriching up to ${limit} leads…`)
    try {
      const res = await fetch('/api/agent-brain/tasks/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit, customPrompt: customPrompt.trim() }),
      })
      const data = await res.json()
      if (res.ok && !data.error) {
        toast.success(`Done! Processed: ${data.processed}, Enriched: ${data.enriched}, Exhausted: ${data.exhausted}`, { id: toastId, duration: 7000 })
        fetchProgress(); fetchLeads(); setCustomPrompt('')
      } else throw new Error(data.error || 'Failed')
    } catch (err: any) {
      toast.error(err.message || 'Action failed', { id: toastId })
    } finally {
      setEnrichingInProgress(false)
    }
  }

  const totalProcessed = counts.enriched + counts.exhausted
  const totalAvailable = counts.not_started + totalProcessed
  const successRate = totalProcessed > 0 ? Math.round((counts.enriched / totalProcessed) * 100) : 0
  const progressPct = totalAvailable > 0 ? Math.round((totalProcessed / totalAvailable) * 100) : 0

  // Tool status for selected lead
  const getToolStatus = (toolId: string): 'success' | 'failed' | 'idle' => {
    if (!selectedLead) return 'idle'
    if (selectedLead.tools_failed?.includes(toolId)) return 'failed'
    if (selectedLead.tools_tried?.includes(toolId)) return 'success'
    return 'idle'
  }

  const filteredLogs = selectedLead?.enrichment_scratchpad?.filter(log => {
    if (logFilter === 'error') return log.toLowerCase().includes('fail') || log.toLowerCase().includes('error')
    if (logFilter === 'success') return log.toLowerCase().includes('found') || log.toLowerCase().includes('success') || log.toLowerCase().includes('email')
    return true
  }) ?? []

  return (
    <div className="min-h-screen text-gray-100" style={{ background: '#09090b' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes pulse-ring { 0%,100%{transform:scale(1);opacity:.4} 50%{transform:scale(1.15);opacity:1} }
        @keyframes flow-dash { to{stroke-dashoffset:-24} }
        @keyframes slide-in { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes glow-green { 0%,100%{box-shadow:0 0 4px #10b981} 50%{box-shadow:0 0 14px #10b981,0 0 30px #10b98133} }
        @keyframes glow-red { 0%,100%{box-shadow:0 0 4px #ef4444} 50%{box-shadow:0 0 14px #ef4444,0 0 30px #ef444433} }
        .anim-slide { animation: slide-in .25s ease both; }
        .pipe-active { stroke-dasharray:12 6; animation: flow-dash 1s linear infinite; }
        .pipe-idle { stroke-dasharray:4 8; opacity:.25; }
        .node-pulse { animation: pulse-ring 2.5s ease-in-out infinite; }
        .glow-g { animation: glow-green 2s ease-in-out infinite; }
        .glow-r { animation: glow-red 2s ease-in-out infinite; }
        .log-line:hover { background: rgba(139,92,246,.12); }
        ::-webkit-scrollbar { width:4px; height:4px; }
        ::-webkit-scrollbar-track { background:transparent; }
        ::-webkit-scrollbar-thumb { background:#333; border-radius:2px; }
      ` }} />

      {/* ── TOP HEADER ── */}
      <div className="border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
            <span className="text-purple-400">⬡</span> Agentic Brain Control Center
          </h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            ReAct reasoning loops · Real-time enrichment pipeline · {totalAvailable} total leads
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-[11px] font-mono text-green-400">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-ping" />
            LIVE
          </span>
          <button
            onClick={() => { fetchProgress(); fetchLeads(); toast.success('Refreshed') }}
            className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-gray-300 hover:bg-white/10 transition-colors"
          >
            ↺ Refresh
          </button>
        </div>
      </div>

      {/* ── MAIN LAYOUT ── */}
      <div className="flex h-[calc(100vh-64px)] overflow-hidden">

        {/* ═══ LEFT SIDEBAR: LEAD LIST ═══ */}
        <aside className="w-64 border-r border-white/5 flex flex-col overflow-hidden flex-shrink-0">
          {/* Status filter pills */}
          <div className="p-3 border-b border-white/5">
            <div className="flex gap-1">
              {([
                { key: 'enriched',  label: '✓ Enriched',  color: 'text-green-400 bg-green-950/40 border-green-800/40' },
                { key: 'exhausted', label: '✗ Exhausted', color: 'text-red-400 bg-red-950/40 border-red-800/40' },
                { key: 'enriching', label: '⟳ Running',   color: 'text-purple-400 bg-purple-950/40 border-purple-800/40' },
              ] as const).map(s => (
                <button key={s.key} onClick={() => { setSelectedStatus(s.key); setSelectedLead(null) }}
                  className={`flex-1 py-1 rounded text-[9px] font-bold uppercase transition-all border ${
                    selectedStatus === s.key ? s.color : 'text-gray-600 border-transparent hover:text-gray-400'
                  }`}
                >{s.label}</button>
              ))}
            </div>
          </div>

          {/* Lead list */}
          <div className="flex-1 overflow-y-auto">
            {loadingLeads ? (
              <div className="p-4 space-y-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-14 rounded-lg bg-white/3 animate-pulse" />
                ))}
              </div>
            ) : leads.length === 0 ? (
              <div className="p-6 text-center text-gray-600 text-xs">No leads in "{selectedStatus}"</div>
            ) : (
              <div className="p-2 space-y-1">
                {leads.map(lead => (
                  <button
                    key={lead.id}
                    onClick={() => setSelectedLead(lead)}
                    className={`w-full text-left p-2.5 rounded-lg transition-all border ${
                      selectedLead?.id === lead.id
                        ? 'bg-purple-950/40 border-purple-700/40 text-white'
                        : 'border-transparent hover:bg-white/4 text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[11px] font-semibold truncate">{lead.name || lead.business_name}</span>
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                        lead.enrichment_status === 'enriched' ? 'bg-green-400' :
                        lead.enrichment_status === 'exhausted' ? 'bg-red-400' : 'bg-purple-400 animate-pulse'
                      }`} />
                    </div>
                    <div className="text-[9px] text-gray-600 mt-0.5 flex gap-2">
                      <span>{lead.city || 'N/A'}</span>
                      <span>·</span>
                      <span>{lead.tools_tried?.length ?? 0} tools</span>
                      {lead.enrichment_fields?.email && <span className="text-green-500">📧</span>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Progress footer */}
          <div className="p-3 border-t border-white/5 space-y-2">
            <div className="flex justify-between text-[9px] text-gray-500 font-mono">
              <span>{totalProcessed}/{totalAvailable} processed</span>
              <span className="text-purple-400">{successRate}% success</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-purple-600 to-pink-600 transition-all duration-700"
                style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        </aside>

        {/* ═══ CENTER: PIPELINE FLOW CANVAS ═══ */}
        <main className="flex-1 flex flex-col overflow-hidden min-w-0">

          {/* Tabs */}
          <div className="border-b border-white/5 px-4 flex items-center gap-1 pt-2">
            {([
              { id: 'control', label: '🚀 Autopilot' },
              { id: 'leads',   label: '⬡ Pipeline Flow' },
              { id: 'tools',   label: '🛠 Tool Registry' },
              { id: 'architecture', label: '🧬 Architecture' },
            ] as const).map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`px-3 py-2 text-[11px] font-bold transition-all border-b-2 -mb-px ${
                  activeTab === t.id
                    ? 'text-purple-300 border-purple-500'
                    : 'text-gray-600 border-transparent hover:text-gray-300'
                }`}
              >{t.label}</button>
            ))}
          </div>

          {/* ── TAB: AUTOPILOT ── */}
          {activeTab === 'control' && (
            <div className="flex-1 overflow-y-auto p-6 space-y-6 anim-slide">
              {/* Stats Row */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: 'Pending', value: counts.not_started, color: 'text-gray-300' },
                  { label: 'Enriched', value: counts.enriched, color: 'text-green-400' },
                  { label: 'Exhausted', value: counts.exhausted, color: 'text-red-400' },
                  { label: 'Success Rate', value: `${successRate}%`, color: 'text-purple-400' },
                ].map(s => (
                  <div key={s.label} className="p-4 rounded-xl border border-white/6 bg-white/2 space-y-1">
                    <div className="text-[9px] text-gray-500 uppercase tracking-widest font-bold">{s.label}</div>
                    <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
                  </div>
                ))}
              </div>

              {/* Launch Form */}
              <div className="p-5 rounded-xl border border-white/6 bg-white/2 space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-white">🚀 Trigger Enrichment Batch</h3>
                  <p className="text-[10px] text-gray-500 mt-1">Configure limits and custom reasoning instructions to kick off ReAct loops.</p>
                </div>
                <form onSubmit={handleLaunchEnrichment} className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest block">Leads Limit</label>
                      <input type="number" min={1} max={1000} value={limit}
                        onChange={e => setLimit(parseInt(e.target.value, 10) || 1)}
                        className="w-full bg-white/4 border border-white/8 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500/60 transition-colors font-mono" />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest block">Provider</label>
                      <div className="bg-white/4 border border-white/8 rounded-lg px-3 py-2 text-xs text-gray-400 font-mono">
                        Google Maps + Search Crawler (Active)
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest block">Custom Reasoning Instructions (Optional)</label>
                    <textarea rows={3} value={customPrompt} onChange={e => setCustomPrompt(e.target.value)}
                      placeholder="e.g. 'Prioritize LinkedIn first for B2B leads', 'Skip reddit_scrape', etc."
                      className="w-full bg-white/4 border border-white/8 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-700 focus:outline-none focus:border-purple-500/60 resize-none transition-colors" />
                  </div>
                  <button type="submit" disabled={enrichingInProgress}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-700 via-violet-600 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 text-white font-bold text-xs uppercase tracking-widest transition-all disabled:opacity-40 flex items-center justify-center gap-2">
                    {enrichingInProgress ? (
                      <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Running ReAct Loops…</>
                    ) : (
                      <><span>⬡</span> Launch Agentic Brain</>
                    )}
                  </button>
                </form>
              </div>

              {/* Pipeline Progress Visual */}
              <div className="p-5 rounded-xl border border-white/6 bg-white/2 space-y-3">
                <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Pipeline Progress</h3>
                <div className="flex items-center gap-3">
                  {[
                    { label: 'Pending', count: counts.not_started, color: '#6b7280' },
                    { label: 'Running', count: counts.enriching,  color: '#a855f7' },
                    { label: 'Done',    count: totalProcessed,     color: '#10b981' },
                  ].map((stage, i) => (
                    <React.Fragment key={stage.label}>
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-10 h-10 rounded-full border-2 flex items-center justify-center text-xs font-black"
                          style={{ borderColor: stage.color, color: stage.color }}>
                          {stage.count}
                        </div>
                        <span className="text-[9px] text-gray-600 uppercase tracking-widest">{stage.label}</span>
                      </div>
                      {i < 2 && (
                        <div className="flex-1 h-px bg-white/10 relative">
                          <div className="h-px bg-purple-600/50 transition-all duration-1000"
                            style={{ width: i === 0 ? '100%' : `${progressPct}%` }} />
                        </div>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── TAB: PIPELINE FLOW (Real Data) ── */}
          {activeTab === 'leads' && (
            <div className="flex-1 overflow-hidden flex flex-col">
              {!selectedLead ? (
                <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">
                  ← Select a lead from the sidebar
                </div>
              ) : (
                <div className="flex-1 flex flex-col overflow-hidden anim-slide">
                  {/* Lead header */}
                  <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between">
                    <div>
                      <span className="text-sm font-bold text-white">{selectedLead.name || selectedLead.business_name}</span>
                      <span className="ml-2 text-[9px] text-gray-500 font-mono">{selectedLead.city} · {selectedLead.attempts ?? 0} attempts</span>
                    </div>
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                      selectedLead.enrichment_status === 'enriched'  ? 'text-green-400 border-green-800/40 bg-green-950/30' :
                      selectedLead.enrichment_status === 'exhausted' ? 'text-red-400 border-red-800/40 bg-red-950/30' :
                      'text-purple-400 border-purple-800/40 bg-purple-950/30'
                    }`}>{selectedLead.enrichment_status}</span>
                  </div>

                  {/* ── REAL PIPELINE FLOW SVG ── */}
                  <div className="px-5 py-4 border-b border-white/5 bg-white/[0.01]">
                    <p className="text-[9px] text-gray-600 uppercase tracking-widest font-bold mb-3">Execution Pipeline</p>
                    <div className="overflow-x-auto">
                      <PipelineFlow lead={selectedLead} allTools={ALL_TOOLS} hoveredTool={hoveredTool} setHoveredTool={setHoveredTool} />
                    </div>
                  </div>

                  {/* ── BOTTOM SPLIT: LOGS + RESULTS ── */}
                  <div className="flex-1 flex overflow-hidden min-h-0">

                    {/* Logs panel */}
                    <div className="flex-1 flex flex-col border-r border-white/5 overflow-hidden">
                      <div className="px-4 py-2 border-b border-white/5 flex items-center justify-between">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                          🧠 Agent Scratchpad ({filteredLogs.length} entries)
                        </span>
                        <div className="flex gap-1">
                          {([
                            { key: 'all',     label: 'All' },
                            { key: 'error',   label: 'Errors' },
                            { key: 'success', label: 'Found' },
                          ] as const).map(f => (
                            <button key={f.key} onClick={() => setLogFilter(f.key)}
                              className={`px-2 py-0.5 rounded text-[9px] font-bold transition-all ${
                                logFilter === f.key ? 'bg-white/10 text-white' : 'text-gray-600 hover:text-gray-400'
                              }`}>{f.label}</button>
                          ))}
                        </div>
                      </div>
                      <div ref={logRef} className="flex-1 overflow-y-auto p-3 space-y-0.5 font-mono">
                        {filteredLogs.length === 0 ? (
                          <div className="text-gray-600 text-[10px] py-4 text-center">No logs recorded</div>
                        ) : filteredLogs.map((log, i) => (
                          <LogEntry key={i} index={i} log={log} />
                        ))}
                      </div>
                    </div>

                    {/* Results panel */}
                    <div className="w-56 flex flex-col overflow-hidden flex-shrink-0">
                      <div className="px-4 py-2 border-b border-white/5">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">📋 Results</span>
                      </div>
                      <div className="flex-1 overflow-y-auto p-3 space-y-2">
                        {/* Enriched fields */}
                        {selectedLead.enrichment_fields && Object.keys(selectedLead.enrichment_fields).length > 0 ? (
                          Object.entries(selectedLead.enrichment_fields).map(([k, v]) => (
                            <div key={k} className="p-2 rounded-lg bg-green-950/20 border border-green-900/30 space-y-0.5">
                              <div className="text-[8px] font-bold text-green-500 uppercase tracking-widest">{k}</div>
                              <div className="text-[10px] text-green-300 break-all font-mono">{v}</div>
                            </div>
                          ))
                        ) : (
                          <div className="text-[10px] text-gray-600 text-center py-4">No fields found</div>
                        )}

                        {/* Known info */}
                        <div className="border-t border-white/5 pt-2 space-y-1.5">
                          <div className="text-[8px] text-gray-600 uppercase tracking-widest font-bold">Known Info</div>
                          {[
                            { label: 'Website', value: selectedLead.website },
                            { label: 'City',    value: selectedLead.city },
                            { label: 'Country', value: selectedLead.country },
                          ].map(f => f.value && (
                            <div key={f.label} className="p-1.5 rounded bg-white/3 border border-white/5">
                              <div className="text-[8px] text-gray-600 uppercase">{f.label}</div>
                              <div className="text-[10px] text-gray-300 truncate" title={f.value}>{f.value}</div>
                            </div>
                          ))}
                        </div>

                        {/* Tools summary */}
                        <div className="border-t border-white/5 pt-2 space-y-1">
                          <div className="text-[8px] text-gray-600 uppercase tracking-widest font-bold">Tools Used</div>
                          {(selectedLead.tools_tried ?? []).map(t => (
                            <div key={t} className={`text-[9px] font-mono px-2 py-1 rounded flex items-center justify-between ${
                              selectedLead.tools_failed?.includes(t)
                                ? 'bg-red-950/20 text-red-400'
                                : 'bg-green-950/20 text-green-400'
                            }`}>
                              <span className="truncate">{t.replace(/_/g, ' ')}</span>
                              <span>{selectedLead.tools_failed?.includes(t) ? '✗' : '✓'}</span>
                            </div>
                          ))}
                          {(!selectedLead.tools_tried || selectedLead.tools_tried.length === 0) && (
                            <div className="text-[10px] text-gray-600">No tools ran</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── TAB: TOOL REGISTRY ── */}
          {activeTab === 'tools' && (
            <div className="flex-1 overflow-y-auto p-5 anim-slide">
              <div className="grid grid-cols-2 gap-3">
                {ALL_TOOLS.map(tool => (
                  <div key={tool.id}
                    className="p-4 rounded-xl border border-white/6 bg-white/2 hover:border-white/15 transition-all cursor-default group"
                    style={{ '--tool-color': tool.color } as React.CSSProperties}>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{tool.icon}</span>
                        <div>
                          <div className="text-[11px] font-bold text-white group-hover:text-purple-300 transition-colors">{tool.label}</div>
                          <div className="text-[9px] font-mono text-gray-600">{tool.id}</div>
                        </div>
                      </div>
                      <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded border ${
                        tool.isPaid ? 'text-amber-400 bg-amber-950/20 border-amber-800/40' : 'text-green-400 bg-green-950/20 border-green-800/40'
                      }`}>{tool.isPaid ? 'Paid' : 'Free'}</span>
                    </div>
                    {/* Usage across loaded leads */}
                    {leads.length > 0 && (
                      <div className="mt-2 space-y-1">
                        <div className="text-[8px] text-gray-600 uppercase tracking-widest">Usage across {leads.length} loaded leads</div>
                        <div className="flex gap-1 flex-wrap">
                          {(() => {
                            const tried = leads.filter(l => l.tools_tried?.includes(tool.id)).length
                            const failed = leads.filter(l => l.tools_failed?.includes(tool.id)).length
                            const succeeded = tried - failed
                            return (
                              <>
                                <span className="text-[9px] text-green-400 bg-green-950/20 px-1.5 py-0.5 rounded">{succeeded} ✓</span>
                                {failed > 0 && <span className="text-[9px] text-red-400 bg-red-950/20 px-1.5 py-0.5 rounded">{failed} ✗</span>}
                                {tried === 0 && <span className="text-[9px] text-gray-600 px-1.5 py-0.5">not used</span>}
                              </>
                            )
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── TAB: ARCHITECTURE ── */}
          {activeTab === 'architecture' && (
            <div className="flex-1 overflow-y-auto p-5 space-y-4 anim-slide">
              <div className="p-5 rounded-xl border border-white/6 bg-white/2 space-y-4">
                <h3 className="text-sm font-bold text-white">🧬 Why custom ReAct backend instead of n8n?</h3>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { icon: '⚡', title: 'Low-Latency Loops', text: 'Tool evaluations are direct memory queries. n8n adds 150–300ms DB overhead per step — crippling over 1000 iterations.' },
                    { icon: '🔒', title: 'Concurrency Locks', text: 'SELECT FOR UPDATE prevents workers from double-processing the same lead. Near-impossible to coordinate reliably in low-code.' },
                    { icon: '📦', title: 'Log Optimization', text: 'n8n logs every node execution to disk — gigabytes at scale. agent-brain stores clean scratchpad arrays in Supabase text columns.' },
                  ].map(c => (
                    <div key={c.title} className="p-4 rounded-xl border border-white/6 bg-white/2 space-y-2">
                      <span className="text-xl">{c.icon}</span>
                      <div className="text-xs font-bold text-purple-300">{c.title}</div>
                      <p className="text-[10px] text-gray-500 leading-relaxed">{c.text}</p>
                    </div>
                  ))}
                </div>
                <div className="p-4 rounded-xl border border-purple-900/30 bg-purple-950/10">
                  <div className="text-xs font-bold text-white mb-1">🏆 Your Hybrid Architecture</div>
                  <p className="text-[10px] text-gray-500">
                    n8n handles <strong className="text-gray-300">integration & trigger layer</strong> (webhooks, email, WhatsApp).
                    agent-brain handles <strong className="text-gray-300">heavy iterative ReAct enrichment loops</strong> — each service does what it&apos;s best at.
                  </p>
                </div>
              </div>

              {/* Key Rotation Status */}
              <div className="p-5 rounded-xl border border-white/6 bg-white/2 space-y-3">
                <h3 className="text-sm font-bold text-white">🔑 Gemini Key Rotation</h3>
                <p className="text-[10px] text-gray-500">
                  The agent-brain now dynamically fetches your Gemini API keys from the database (meta_config table)
                  and rotates through them automatically when a key hits its free-tier quota limit (429). 
                  Add more keys in Settings → Meta Config to increase throughput.
                </p>
                <div className="flex items-center gap-2 text-[10px] text-green-400 bg-green-950/20 border border-green-900/30 rounded-lg px-3 py-2">
                  <span>✓</span>
                  Key rotation across all saved keys + model fallback (flash → flash-lite) enabled
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

// ─── PIPELINE FLOW COMPONENT ───────────────────────────────────────────────

const PIPELINE_STAGES = [
  { id: 'input',  label: 'Lead Input',   icon: '📥', color: '#6366f1' },
  { id: 'reason', label: 'AI Reason',    icon: '🧠', color: '#8b5cf6' },
  { id: 'select', label: 'Select Tool',  icon: '⬡',  color: '#a855f7' },
  { id: 'execute', label: 'Execute',     icon: '⚙️', color: '#ec4899' },
  { id: 'verify', label: 'Verify',       icon: '✅', color: '#10b981' },
]

function PipelineFlow({ lead, allTools, hoveredTool, setHoveredTool }: {
  lead: Lead
  allTools: typeof ALL_TOOLS
  hoveredTool: string | null
  setHoveredTool: (t: string | null) => void
}) {
  const toolsUsed = allTools.filter(t => lead.tools_tried?.includes(t.id))
  const hasResults = lead.enrichment_fields && Object.keys(lead.enrichment_fields).length > 0
  const isComplete = lead.enrichment_status === 'enriched'
  const isFailed   = lead.enrichment_status === 'exhausted'

  // Stage completion logic
  const stageStatus = (stageId: string): 'done' | 'active' | 'idle' => {
    if (stageId === 'input')   return 'done'
    if (stageId === 'reason')  return lead.attempts && lead.attempts > 0 ? 'done' : 'idle'
    if (stageId === 'select')  return toolsUsed.length > 0 ? 'done' : 'idle'
    if (stageId === 'execute') return toolsUsed.length > 0 ? 'done' : 'idle'
    if (stageId === 'verify')  return isComplete ? 'done' : isFailed ? 'idle' : 'idle'
    return 'idle'
  }

  return (
    <div className="space-y-4">
      {/* Main pipeline stages */}
      <div className="flex items-center gap-0 min-w-max">
        {PIPELINE_STAGES.map((stage, i) => {
          const status = stageStatus(stage.id)
          return (
            <React.Fragment key={stage.id}>
              <div className="flex flex-col items-center gap-1.5">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg border-2 transition-all ${
                  status === 'done'   ? 'border-current shadow-lg' :
                  status === 'active' ? 'border-current node-pulse' :
                  'border-white/10 opacity-30'
                }`}
                  style={status !== 'idle' ? { borderColor: stage.color, background: `${stage.color}18` } : {}}>
                  {stage.icon}
                </div>
                <span className={`text-[9px] font-bold uppercase tracking-widest ${
                  status === 'done' ? 'text-white' : 'text-gray-600'
                }`}>{stage.label}</span>
                {status === 'done' && (
                  <span className="text-[8px] text-green-400">✓</span>
                )}
              </div>

              {i < PIPELINE_STAGES.length - 1 && (
                <svg width="48" height="20" className="flex-shrink-0 -mt-5">
                  <line x1="0" y1="10" x2="48" y2="10"
                    stroke={stageStatus(PIPELINE_STAGES[i+1].id) !== 'idle' ? '#8b5cf6' : '#333'}
                    strokeWidth="2"
                    className={stageStatus(PIPELINE_STAGES[i+1].id) !== 'idle' ? 'pipe-active' : 'pipe-idle'}
                  />
                  {stageStatus(PIPELINE_STAGES[i+1].id) !== 'idle' && (
                    <polygon points="44,6 48,10 44,14" fill="#8b5cf6" />
                  )}
                </svg>
              )}
            </React.Fragment>
          )
        })}
      </div>

      {/* Tool nodes — branching from "Execute" stage */}
      {toolsUsed.length > 0 && (
        <div className="pt-1">
          <div className="text-[8px] text-gray-600 uppercase tracking-widest font-bold mb-2">Tools Invoked ({toolsUsed.length})</div>
          <div className="flex flex-wrap gap-2">
            {toolsUsed.map(tool => {
              const failed = lead.tools_failed?.includes(tool.id)
              const isHovered = hoveredTool === tool.id
              return (
                <button
                  key={tool.id}
                  onMouseEnter={() => setHoveredTool(tool.id)}
                  onMouseLeave={() => setHoveredTool(null)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-bold transition-all ${
                    failed
                      ? 'border-red-800/50 bg-red-950/20 text-red-400 glow-r'
                      : 'border-green-800/50 bg-green-950/20 text-green-400 glow-g'
                  } ${isHovered ? 'scale-105' : ''}`}
                >
                  <span>{tool.icon}</span>
                  <span>{tool.label}</span>
                  <span>{failed ? '✗' : '✓'}</span>
                </button>
              )
            })}

            {/* Tools not tried */}
            {allTools.filter(t => !lead.tools_tried?.includes(t.id)).slice(0, 4).map(tool => (
              <button key={tool.id}
                onMouseEnter={() => setHoveredTool(tool.id)}
                onMouseLeave={() => setHoveredTool(null)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/6 bg-white/2 text-[10px] text-gray-600 opacity-50 hover:opacity-75 transition-all"
              >
                <span>{tool.icon}</span>
                <span>{tool.label}</span>
                <span className="text-gray-700">–</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Final result banner */}
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-[10px] font-bold ${
        isComplete ? 'bg-green-950/20 border-green-800/40 text-green-300' :
        isFailed   ? 'bg-red-950/20 border-red-800/40 text-red-300' :
        'bg-purple-950/20 border-purple-800/40 text-purple-300'
      }`}>
        <span>{isComplete ? '✅' : isFailed ? '❌' : '⟳'}</span>
        <span>
          {isComplete
            ? `Enriched: ${Object.keys(lead.enrichment_fields || {}).join(', ')}`
            : isFailed
            ? `Exhausted after ${lead.attempts} attempts — no email found`
            : 'Currently enriching…'}
        </span>
      </div>
    </div>
  )
}

// ─── LOG ENTRY COMPONENT ───────────────────────────────────────────────────

function LogEntry({ index, log }: { index: number; log: string }) {
  const isError   = log.toLowerCase().includes('fail') || log.toLowerCase().includes('error') || log.toLowerCase().includes('429')
  const isSuccess = log.toLowerCase().includes('found') || log.toLowerCase().includes('email') || log.toLowerCase().includes('✓')
  const isGemini  = log.toLowerCase().includes('gemini')

  return (
    <div className={`log-line flex gap-2 px-2 py-1 rounded text-[10px] font-mono leading-relaxed cursor-default transition-colors ${
      isError ? 'text-red-400' : isSuccess ? 'text-green-400' : isGemini ? 'text-purple-300' : 'text-gray-400'
    }`}>
      <span className="text-gray-700 select-none flex-shrink-0 w-5 text-right">{index + 1}</span>
      <span className="break-all">{log}</span>
    </div>
  )
}
