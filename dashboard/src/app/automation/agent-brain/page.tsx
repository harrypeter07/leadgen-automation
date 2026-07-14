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
  { id: 'website_email_scrape',      label: 'Website Email',    icon: '🌐', color: '#6366f1', isPaid: false },
  { id: 'tinyfish_search',           label: 'Tinyfish Search',  icon: '🔍', color: '#8b5cf6', isPaid: false },
  { id: 'tinyfish_fetch',            label: 'Tinyfish Fetch',   icon: '📄', color: '#a855f7', isPaid: false },
  { id: 'facebook_messenger_scrape', label: 'Facebook',         icon: '📘', color: '#3b82f6', isPaid: false },
  { id: 'reddit_scrape',             label: 'Reddit',           icon: '🔴', color: '#ef4444', isPaid: false },
  { id: 'linkedin_scrape',           label: 'LinkedIn',         icon: '💼', color: '#0ea5e9', isPaid: true  },
  { id: 'hunter_pattern_guess',      label: 'Hunter Pattern',   icon: '🎯', color: '#f59e0b', isPaid: true  },
  { id: 'email_verify',              label: 'Email Verify',     icon: '✅', color: '#10b981', isPaid: false },
  { id: 'instagram_profile_scrape',  label: 'Instagram',        icon: '📸', color: '#ec4899', isPaid: false },
  { id: 'google_maps_scrape',        label: 'Google Maps',      icon: '🗺️', color: '#22c55e', isPaid: false },
]

type TabId = 'control' | 'leads' | 'tools' | 'keys' | 'architecture'
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

  // Gemini keys state
  const [geminiKeys, setGeminiKeys] = useState<string[]>([''])
  const [keyStatuses, setKeyStatuses] = useState<Record<number, { loading: boolean; status?: string; error?: string; models?: string[] }>>({})
  const [savingKeys, setSavingKeys] = useState(false)

  const fetchGeminiKeys = useCallback(async () => {
    try {
      const res = await fetch('/api/meta/settings')
      const data = await res.json()
      if (data.settings?.SAVED_GEMINI_API_KEYS) {
        const parsed = JSON.parse(data.settings.SAVED_GEMINI_API_KEYS)
        setGeminiKeys(parsed.length > 0 ? parsed : [''])
      }
    } catch {}
  }, [])


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

  useEffect(() => { fetchProgress(); fetchLeads(); fetchGeminiKeys() }, [fetchProgress, fetchLeads, fetchGeminiKeys])
  useEffect(() => { const t = setInterval(fetchProgress, 8000); return () => clearInterval(t) }, [fetchProgress])

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

  const filteredLogs = selectedLead?.enrichment_scratchpad?.filter(log => {
    if (logFilter === 'error') return log.toLowerCase().includes('fail') || log.toLowerCase().includes('error')
    if (logFilter === 'success') return log.toLowerCase().includes('found') || log.toLowerCase().includes('success') || log.toLowerCase().includes('email')
    return true
  }) ?? []

  return (
    // ← No custom layout wrapper. This renders inside the existing automation layout's <main>.
    <div className="space-y-5 text-gray-800">
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes flow-dash { to { stroke-dashoffset: -24 } }
        @keyframes slide-in  { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:translateY(0) } }
        .anim-slide   { animation: slide-in .2s ease both; }
        .pipe-active  { stroke-dasharray:12 6; animation: flow-dash 1s linear infinite; }
        .pipe-idle    { stroke-dasharray:4 8; opacity:.2; }
        .log-entry:hover { background: rgba(99,102,241,.06); }
      ` }} />

      {/* ── PAGE HEADER ── */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span className="text-purple-600">⬡</span> Agentic Search Brain
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">
            ReAct reasoning loops · {totalAvailable} total leads · {successRate}% success rate
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-[10px] font-bold text-green-600 bg-green-50 border border-green-200 px-2 py-1 rounded-lg">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-ping" />
            LIVE
          </span>
          <button
            onClick={() => { fetchProgress(); fetchLeads(); toast.success('Refreshed') }}
            className="px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-[11px] font-bold text-slate-600 hover:bg-slate-200 transition-colors"
          >
            ↺ Refresh
          </button>
        </div>
      </div>

      {/* ── TABS ── */}
      <div className="flex gap-0 border-b border-slate-200">
        {([
          { id: 'control',      label: '🚀 Autopilot' },
          { id: 'leads',        label: '⬡ Pipeline Flow' },
          { id: 'tools',        label: '🛠 Tool Registry' },
          { id: 'keys',         label: '🔑 Gemini Keys' },
          { id: 'architecture', label: '🧬 Architecture' },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 text-[11px] font-bold transition-all border-b-2 -mb-px ${
              activeTab === t.id
                ? 'text-purple-700 border-purple-600'
                : 'text-slate-500 border-transparent hover:text-slate-800'
            }`}
          >{t.label}</button>
        ))}
      </div>

      {/* ════ TAB: AUTOPILOT ════ */}
      {activeTab === 'control' && (
        <div className="space-y-5 anim-slide">
          {/* Stat cards */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Pending',     value: counts.not_started, color: 'text-slate-700',  bg: 'bg-slate-50',   border: 'border-slate-200' },
              { label: 'Enriched',    value: counts.enriched,    color: 'text-green-700',  bg: 'bg-green-50',   border: 'border-green-200' },
              { label: 'Exhausted',   value: counts.exhausted,   color: 'text-red-600',    bg: 'bg-red-50',     border: 'border-red-200'   },
              { label: 'Success Rate',value: `${successRate}%`,  color: 'text-purple-700', bg: 'bg-purple-50',  border: 'border-purple-200'},
            ].map(s => (
              <div key={s.label} className={`p-4 rounded-xl border ${s.border} ${s.bg} space-y-1`}>
                <div className="text-[9px] text-slate-400 uppercase tracking-widest font-bold">{s.label}</div>
                <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
            <div className="flex justify-between text-[10px] font-semibold text-slate-500">
              <span>Pipeline Progress</span>
              <span>{totalProcessed} / {totalAvailable} leads processed</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
              <div className="h-full rounded-full bg-gradient-to-r from-purple-600 to-pink-600 transition-all duration-700"
                style={{ width: `${progressPct}%` }} />
            </div>
            <div className="text-[9px] text-slate-400">{progressPct}% complete · {counts.not_started} remaining</div>
          </div>

          {/* Launch form */}
          <div className="p-5 rounded-xl border border-slate-200 bg-white space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">🚀 Trigger Enrichment Batch</h3>
              <p className="text-[10px] text-slate-400 mt-1">Configure limits and custom reasoning instructions to kick off ReAct loops.</p>
            </div>
            <form onSubmit={handleLaunchEnrichment} className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block">Leads Limit</label>
                  <input type="number" min={1} max={1000} value={limit}
                    onChange={e => setLimit(parseInt(e.target.value, 10) || 1)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-purple-500 transition-colors font-mono" />
                </div>
                <div className="col-span-2 space-y-1">
                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block">Provider</label>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-500 font-mono">
                    Google Maps + Search Crawler (Active)
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block">Custom Reasoning Instructions (Optional)</label>
                <textarea rows={3} value={customPrompt} onChange={e => setCustomPrompt(e.target.value)}
                  placeholder="e.g. 'Prioritize LinkedIn first for B2B leads', 'Skip reddit_scrape', etc."
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-purple-500 resize-none transition-colors" />
              </div>
              <button type="submit" disabled={enrichingInProgress}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs uppercase tracking-widest transition-all disabled:opacity-40 flex items-center justify-center gap-2 shadow-lg shadow-purple-200">
                {enrichingInProgress ? (
                  <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Running ReAct Loops…</>
                ) : (
                  <><span>⬡</span> Launch Agentic Brain</>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ════ TAB: PIPELINE FLOW ════ */}
      {activeTab === 'leads' && (
        <div className="anim-slide space-y-4">
          {/* Lead selector + status filter */}
          <div className="flex items-center gap-3">
            <div className="flex gap-1">
              {([
                { key: 'enriched',  label: '✓ Enriched',  cls: 'text-green-700 bg-green-50 border-green-200' },
                { key: 'exhausted', label: '✗ Exhausted', cls: 'text-red-600   bg-red-50   border-red-200'   },
                { key: 'enriching', label: '⟳ Running',   cls: 'text-purple-700 bg-purple-50 border-purple-200' },
              ] as const).map(s => (
                <button key={s.key} onClick={() => { setSelectedStatus(s.key); setSelectedLead(null) }}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${
                    selectedStatus === s.key ? s.cls : 'text-slate-400 border-transparent hover:text-slate-700'
                  }`}>{s.label}</button>
              ))}
            </div>
            <div className="flex-1 min-w-0">
              {loadingLeads ? (
                <div className="h-8 bg-slate-100 rounded-lg animate-pulse w-48" />
              ) : (
                <select
                  value={selectedLead?.id || ''}
                  onChange={e => {
                    const lead = leads.find(l => l.id === e.target.value)
                    setSelectedLead(lead || null)
                  }}
                  className="bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 rounded-lg px-3 py-1.5 focus:outline-none focus:border-purple-500 w-72"
                >
                  <option value="" disabled>Select a lead to inspect…</option>
                  {leads.map(l => (
                    <option key={l.id} value={l.id}>
                      {l.name || l.business_name} — {l.city || 'N/A'} ({l.tools_tried?.length ?? 0} tools)
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {!selectedLead ? (
            <div className="py-16 text-center text-slate-400 border border-dashed border-slate-200 rounded-2xl text-sm">
              Select a lead above to inspect its pipeline execution
            </div>
          ) : (
            <div className="space-y-4">
              {/* Lead info header */}
              <div className="p-4 rounded-xl border border-slate-200 bg-white flex items-center justify-between">
                <div>
                  <span className="text-sm font-bold text-slate-900">{selectedLead.name || selectedLead.business_name}</span>
                  <span className="ml-2 text-[10px] text-slate-400 font-mono">{selectedLead.city} · {selectedLead.attempts ?? 0} attempts</span>
                  {selectedLead.website && (
                    <span className="ml-2 text-[10px] text-blue-500 font-mono">{selectedLead.website}</span>
                  )}
                </div>
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                  selectedLead.enrichment_status === 'enriched'  ? 'text-green-700 border-green-300 bg-green-50' :
                  selectedLead.enrichment_status === 'exhausted' ? 'text-red-600   border-red-300   bg-red-50'   :
                  'text-purple-700 border-purple-300 bg-purple-50'
                }`}>{selectedLead.enrichment_status}</span>
              </div>

              {/* Pipeline flow SVG */}
              <div className="p-4 rounded-xl border border-slate-200 bg-white">
                <p className="text-[9px] text-slate-400 uppercase tracking-widest font-bold mb-4">Execution Pipeline</p>
                <PipelineFlow lead={selectedLead} allTools={ALL_TOOLS} hoveredTool={hoveredTool} setHoveredTool={setHoveredTool} />
              </div>

              {/* Logs + Results side by side */}
              <div className="grid grid-cols-3 gap-4">
                {/* Logs — 2/3 width */}
                <div className="col-span-2 rounded-xl border border-slate-200 bg-white overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                    <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">
                      🧠 Agent Scratchpad ({filteredLogs.length})
                    </span>
                    <div className="flex gap-1">
                      {([
                        { key: 'all', label: 'All' },
                        { key: 'error', label: 'Errors' },
                        { key: 'success', label: 'Found' },
                      ] as const).map(f => (
                        <button key={f.key} onClick={() => setLogFilter(f.key)}
                          className={`px-2 py-0.5 rounded text-[9px] font-bold transition-all ${
                            logFilter === f.key ? 'bg-purple-100 text-purple-700 border border-purple-200' : 'text-slate-400 hover:text-slate-700'
                          }`}>{f.label}</button>
                      ))}
                    </div>
                  </div>
                  <div ref={logRef} className="p-3 space-y-0.5 font-mono max-h-64 overflow-y-auto">
                    {filteredLogs.length === 0 ? (
                      <div className="text-slate-400 text-[10px] py-4 text-center">No logs recorded</div>
                    ) : filteredLogs.map((log, i) => (
                      <LogEntry key={i} index={i} log={log} />
                    ))}
                  </div>
                </div>

                {/* Results — 1/3 width */}
                <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50">
                    <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">📋 Results</span>
                  </div>
                  <div className="p-3 space-y-2 max-h-64 overflow-y-auto">
                    {selectedLead.enrichment_fields && Object.keys(selectedLead.enrichment_fields).length > 0 ? (
                      Object.entries(selectedLead.enrichment_fields).map(([k, v]) => (
                        <div key={k} className="p-2 rounded-lg bg-green-50 border border-green-200 space-y-0.5">
                          <div className="text-[8px] font-bold text-green-600 uppercase tracking-widest">{k}</div>
                          <div className="text-[10px] text-green-800 break-all font-mono">{v}</div>
                        </div>
                      ))
                    ) : (
                      <div className="text-[10px] text-slate-400 text-center py-4">No fields enriched</div>
                    )}
                    {/* Tools tried */}
                    <div className="border-t border-slate-100 pt-2 space-y-1">
                      <div className="text-[8px] text-slate-400 uppercase tracking-widest font-bold">Tools Run</div>
                      {(selectedLead.tools_tried ?? []).map(t => (
                        <div key={t} className={`text-[9px] font-mono px-2 py-1 rounded flex items-center justify-between ${
                          selectedLead.tools_failed?.includes(t)
                            ? 'bg-red-50 text-red-600 border border-red-200'
                            : 'bg-green-50 text-green-700 border border-green-200'
                        }`}>
                          <span className="truncate">{t.replace(/_/g, ' ')}</span>
                          <span>{selectedLead.tools_failed?.includes(t) ? '✗' : '✓'}</span>
                        </div>
                      ))}
                      {!selectedLead.tools_tried?.length && (
                        <div className="text-[10px] text-slate-400">No tools ran</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════ TAB: TOOL REGISTRY ════ */}
      {activeTab === 'tools' && (
        <div className="anim-slide grid grid-cols-2 gap-3">
          {ALL_TOOLS.map(tool => (
            <div key={tool.id} className="p-4 rounded-xl border border-slate-200 bg-white hover:border-purple-300 transition-all group">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{tool.icon}</span>
                  <div>
                    <div className="text-[11px] font-bold text-slate-800 group-hover:text-purple-700 transition-colors">{tool.label}</div>
                    <div className="text-[9px] font-mono text-slate-400">{tool.id}</div>
                  </div>
                </div>
                <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded border ${
                  tool.isPaid ? 'text-amber-600 bg-amber-50 border-amber-200' : 'text-green-600 bg-green-50 border-green-200'
                }`}>{tool.isPaid ? 'Paid' : 'Free'}</span>
              </div>
              {leads.length > 0 && (() => {
                const tried    = leads.filter(l => l.tools_tried?.includes(tool.id)).length
                const failed   = leads.filter(l => l.tools_failed?.includes(tool.id)).length
                const succeeded = tried - failed
                return (
                  <div className="flex gap-1.5 mt-2 flex-wrap">
                    {tried > 0 ? (
                      <>
                        <span className="text-[9px] text-green-600 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded">{succeeded} ✓</span>
                        {failed > 0 && <span className="text-[9px] text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded">{failed} ✗</span>}
                      </>
                    ) : (
                      <span className="text-[9px] text-slate-400">not used in loaded leads</span>
                    )}
                  </div>
                )
              })()}
            </div>
          ))}
        </div>
      )}

      {/* ════ TAB: ARCHITECTURE ════ */}
      {activeTab === 'architecture' && (
        <div className="anim-slide space-y-4">
          <div className="p-5 rounded-xl border border-slate-200 bg-white space-y-4">
            <h3 className="text-sm font-bold text-slate-900">🧬 Why custom ReAct backend instead of n8n?</h3>
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: '⚡', title: 'Low-Latency Loops',  text: 'Tool evaluations are direct memory queries. n8n adds 150–300ms DB overhead per step — crippling over 1000 iterations.' },
                { icon: '🔒', title: 'Concurrency Locks',  text: 'SELECT FOR UPDATE prevents workers from double-processing the same lead. Near-impossible to coordinate reliably in low-code.' },
                { icon: '📦', title: 'Log Optimization',   text: 'n8n logs every node execution to disk — gigabytes at scale. agent-brain stores clean scratchpad arrays in Supabase.' },
              ].map(c => (
                <div key={c.title} className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                  <span className="text-xl">{c.icon}</span>
                  <div className="text-xs font-bold text-purple-700">{c.title}</div>
                  <p className="text-[10px] text-slate-500 leading-relaxed">{c.text}</p>
                </div>
              ))}
            </div>
            <div className="p-4 rounded-xl border border-purple-200 bg-purple-50">
              <div className="text-xs font-bold text-slate-900 mb-1">🏆 Your Hybrid Architecture</div>
              <p className="text-[10px] text-slate-600">
                n8n handles <strong>integration & trigger layer</strong> (webhooks, email, WhatsApp).
                agent-brain handles <strong>heavy iterative ReAct enrichment loops</strong>.
              </p>
            </div>
          </div>
          <div className="p-5 rounded-xl border border-green-200 bg-green-50 space-y-2">
            <h3 className="text-sm font-bold text-slate-900">🔑 Gemini Key Rotation — Active</h3>
            <p className="text-[10px] text-slate-600">
              The iterative ReAct loop rotates through all keys saved on the <strong>Gemini Keys</strong> tab, automatically cascading to fallback models (e.g. flash-lite) if one hits limit/unauthorized errors.
            </p>
            <div className="text-[10px] text-green-700 font-bold">✓ Rotation & model fallback cascade fully configured</div>
          </div>
        </div>
      )}

      {/* ════ TAB: GEMINI KEYS ════ */}
      {activeTab === 'keys' && (
        <div className="anim-slide space-y-4">
          <div className="p-5 rounded-xl border border-slate-200 bg-white space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">🔑 Gemini API Key Rotation & Quota Cascade</h3>
              <p className="text-[10px] text-slate-400 mt-1">
                Configure your Gemini API keys here. The ReAct Agent rotates through these keys automatically to prevent quota failures (429), switching to fallback models if needed.
              </p>
            </div>

            <div className="space-y-3">
              {geminiKeys.map((key, index) => {
                const status = keyStatuses[index]
                const isMasked = key.includes('•') || (key.length > 20 && key.startsWith('AIza'))
                return (
                  <div key={index} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex-1 space-y-1.5">
                      <div className="flex justify-between items-center">
                        <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block font-mono">API Key #{index + 1}</label>
                        {status && (
                          <span className={`text-[8px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                            status.status === 'active'
                              ? 'bg-green-50 border-green-200 text-green-700'
                              : status.status === 'error'
                              ? 'bg-red-50 border-red-200 text-red-600'
                              : 'bg-slate-100 border-slate-200 text-slate-500 animate-pulse'
                          }`}>
                            {status.loading ? 'Checking...' : status.status === 'active' ? 'Active' : status.error || 'Inactive'}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="password"
                          value={key}
                          onChange={e => {
                            const updated = [...geminiKeys]
                            updated[index] = e.target.value
                            setGeminiKeys(updated)
                          }}
                          placeholder={isMasked ? '(stored — type to update)' : 'AIzaSy...'}
                          className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono text-slate-800 placeholder-slate-400 focus:outline-none focus:border-purple-500 transition-colors"
                        />
                      </div>
                    </div>

                    <div className="flex items-end gap-2 md:pt-4">
                      <button
                        type="button"
                        disabled={status?.loading || !key.trim() || key.includes('•')}
                        onClick={() => {
                          const keyToTest = key.trim()
                          if (keyToTest.includes('•')) {
                            toast.error('Stored keys cannot be re-tested. Enter a new key to check status.')
                            return
                          }
                          setKeyStatuses(prev => ({ ...prev, [index]: { loading: true } }))
                          fetch('/api/meta/gemini-status', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ apiKey: keyToTest }),
                          })
                            .then(r => r.json())
                            .then(data => {
                              setKeyStatuses(prev => ({
                                ...prev,
                                [index]: {
                                  loading: false,
                                  status: data.status,
                                  error: data.error,
                                  models: data.models,
                                }
                              }))
                              if (data.status === 'active') {
                                toast.success(`Key #${index + 1} is Active!`)
                              } else {
                                toast.error(`Key #${index + 1} status: ${data.error || 'inactive'}`)
                              }
                            })
                            .catch(err => {
                              setKeyStatuses(prev => ({
                                ...prev,
                                [index]: { loading: false, status: 'error', error: err.message }
                              }))
                              toast.error(err.message)
                            })
                        }}
                        className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-[10px] font-bold text-slate-600 transition-colors"
                      >
                        ⚡ Check Key
                      </button>

                      {geminiKeys.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const updated = geminiKeys.filter((_, i) => i !== index)
                            setGeminiKeys(updated)
                            const updatedStatuses = { ...keyStatuses }
                            delete updatedStatuses[index]
                            setKeyStatuses(updatedStatuses)
                          }}
                          className="px-3 py-2 rounded-lg bg-red-50 hover:bg-red-100 border border-red-200 text-[10px] font-bold text-red-600 transition-colors"
                        >
                          🗑 Delete
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setGeminiKeys([...geminiKeys, ''])}
                className="px-4 py-2 rounded-lg bg-slate-50 border border-slate-200 hover:bg-slate-100 text-[11px] font-bold text-slate-600 transition-colors"
              >
                + Add Another Key
              </button>

              <button
                type="button"
                disabled={savingKeys}
                onClick={async () => {
                  setSavingKeys(true)
                  const toastId = toast.loading('Saving Gemini keys...')
                  try {
                    const cleanKeys = geminiKeys.filter(Boolean)
                    const payload = {
                      SAVED_GEMINI_API_KEYS: JSON.stringify(cleanKeys),
                      GEMINI_API_KEY: cleanKeys[0] || '',
                    }
                    const res = await fetch('/api/meta/settings', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ settings: payload }),
                    })
                    if (res.ok) {
                      toast.success('Gemini API keys updated successfully!', { id: toastId })
                      fetchGeminiKeys()
                    } else {
                      const data = await res.json()
                      throw new Error(data.error || 'Failed to save')
                    }
                  } catch (err: any) {
                    toast.error(err.message || 'Save failed', { id: toastId })
                  } finally {
                    setSavingKeys(false)
                  }
                }}
                className="px-5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-bold uppercase tracking-wider transition-colors disabled:opacity-40"
              >
                {savingKeys ? 'Saving...' : '💾 Save Gemini Keys'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── PIPELINE FLOW ─────────────────────────────────────────────────────────

const PIPELINE_STAGES = [
  { id: 'input',   label: 'Lead Input',  icon: '📥', color: '#6366f1' },
  { id: 'reason',  label: 'AI Reason',   icon: '🧠', color: '#8b5cf6' },
  { id: 'select',  label: 'Tool Select', icon: '⬡',  color: '#a855f7' },
  { id: 'execute', label: 'Execute',     icon: '⚙️', color: '#ec4899' },
  { id: 'verify',  label: 'Verify',      icon: '✅', color: '#10b981' },
]

function PipelineFlow({ lead, allTools, hoveredTool, setHoveredTool }: {
  lead: Lead
  allTools: typeof ALL_TOOLS
  hoveredTool: string | null
  setHoveredTool: (t: string | null) => void
}) {
  const toolsUsed    = allTools.filter(t => lead.tools_tried?.includes(t.id))
  const isComplete   = lead.enrichment_status === 'enriched'
  const isFailed     = lead.enrichment_status === 'exhausted'

  const stageStatus = (stageId: string): 'done' | 'idle' => {
    if (stageId === 'input')   return 'done'
    if (stageId === 'reason')  return (lead.attempts ?? 0) > 0 ? 'done' : 'idle'
    if (stageId === 'select')  return toolsUsed.length > 0 ? 'done' : 'idle'
    if (stageId === 'execute') return toolsUsed.length > 0 ? 'done' : 'idle'
    if (stageId === 'verify')  return isComplete ? 'done' : 'idle'
    return 'idle'
  }

  return (
    <div className="space-y-4">
      {/* Stage flow */}
      <div className="flex items-center gap-0 overflow-x-auto pb-2">
        {PIPELINE_STAGES.map((stage, i) => {
          const status = stageStatus(stage.id)
          return (
            <React.Fragment key={stage.id}>
              <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-lg border-2 transition-all ${
                  status === 'done'
                    ? 'shadow-md'
                    : 'border-slate-200 bg-slate-50 opacity-40'
                }`}
                  style={status === 'done' ? { borderColor: stage.color, background: `${stage.color}15` } : {}}>
                  {stage.icon}
                </div>
                <span className={`text-[9px] font-bold uppercase tracking-widest ${
                  status === 'done' ? 'text-slate-700' : 'text-slate-300'
                }`}>{stage.label}</span>
                {status === 'done' && <span className="text-[8px] text-green-600 font-bold">✓</span>}
              </div>
              {i < PIPELINE_STAGES.length - 1 && (
                <svg width="44" height="16" className="flex-shrink-0 -mt-6">
                  <line x1="0" y1="8" x2="44" y2="8"
                    stroke={stageStatus(PIPELINE_STAGES[i+1].id) === 'done' ? '#8b5cf6' : '#e2e8f0'}
                    strokeWidth="2"
                    className={stageStatus(PIPELINE_STAGES[i+1].id) === 'done' ? 'pipe-active' : 'pipe-idle'}
                  />
                  {stageStatus(PIPELINE_STAGES[i+1].id) === 'done' && (
                    <polygon points="40,4 44,8 40,12" fill="#8b5cf6" />
                  )}
                </svg>
              )}
            </React.Fragment>
          )
        })}
      </div>

      {/* Tool nodes */}
      {toolsUsed.length > 0 && (
        <div>
          <div className="text-[8px] text-slate-400 uppercase tracking-widest font-bold mb-2">
            Tools Invoked ({toolsUsed.length} of {allTools.length})
          </div>
          <div className="flex flex-wrap gap-2">
            {/* Used tools */}
            {toolsUsed.map(tool => {
              const failed = lead.tools_failed?.includes(tool.id)
              return (
                <button key={tool.id}
                  onMouseEnter={() => setHoveredTool(tool.id)}
                  onMouseLeave={() => setHoveredTool(null)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-bold transition-all hover:scale-105 ${
                    failed
                      ? 'border-red-300 bg-red-50 text-red-700'
                      : 'border-green-300 bg-green-50 text-green-700'
                  } ${hoveredTool === tool.id ? 'scale-105 shadow-md' : ''}`}
                >
                  <span>{tool.icon}</span>
                  <span>{tool.label}</span>
                  <span>{failed ? '✗' : '✓'}</span>
                </button>
              )
            })}
            {/* Not tried */}
            {allTools.filter(t => !lead.tools_tried?.includes(t.id)).slice(0, 5).map(tool => (
              <div key={tool.id}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-[10px] text-slate-400 opacity-50"
              >
                <span>{tool.icon}</span>
                <span>{tool.label}</span>
                <span className="text-slate-300">–</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Result banner */}
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-[10px] font-semibold ${
        isComplete ? 'bg-green-50 border-green-200 text-green-800' :
        isFailed   ? 'bg-red-50   border-red-200   text-red-700'   :
        'bg-purple-50 border-purple-200 text-purple-800'
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

// ─── LOG ENTRY ─────────────────────────────────────────────────────────────

function LogEntry({ index, log }: { index: number; log: string }) {
  const isError   = log.toLowerCase().includes('fail') || log.toLowerCase().includes('error') || log.toLowerCase().includes('429')
  const isSuccess = log.toLowerCase().includes('found') || log.toLowerCase().includes('email') || log.toLowerCase().includes('✓')
  const isGemini  = log.toLowerCase().includes('gemini')

  return (
    <div className={`log-entry flex gap-2 px-2 py-0.5 rounded text-[10px] font-mono leading-relaxed cursor-default transition-colors ${
      isError ? 'text-red-600' : isSuccess ? 'text-green-700' : isGemini ? 'text-purple-700' : 'text-slate-500'
    }`}>
      <span className="text-slate-300 select-none flex-shrink-0 w-5 text-right">{index + 1}</span>
      <span className="break-all">{log}</span>
    </div>
  )
}
