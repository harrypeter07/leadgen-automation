'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import toast from 'react-hot-toast'

interface ScraperJob {
  id: string
  keyword: string
  city: string
  created_at: string
  status: string
}

interface Lead {
  id: string
  name: string
  email: string | null
  phone: string | null
  website: string | null
  category: string | null
  city: string | null
  rating: number | null
  review_count: number | null
  status: string
  notes: string | null
  ai_message_email_subject: string | null
  ai_message_email_body: string | null
  enrichment_fields?: {
    business_description?: string
    key_offerings?: string[]
    contact_person?: string
    contact_position?: string
  }
  enrichment_status: 'not_started' | 'completed' | 'failed'
}

type DraftViewMode = 'preview' | 'edit'

export default function EmailOutreachPage() {
  const [jobs, setJobs] = useState<ScraperJob[]>([])
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [loadingLeads, setLoadingLeads] = useState(false)
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [generateProgress, setGenerateProgress] = useState<{ done: number; total: number; label: string } | null>(null)
  const [sendResults, setSendResults] = useState<{ sent: number; failed: number } | null>(null)

  // Draft Preview / Edit Modal
  const [viewingLead, setViewingLead] = useState<Lead | null>(null)
  const [draftViewMode, setDraftViewMode] = useState<DraftViewMode>('preview')
  const [editSubject, setEditSubject] = useState('')
  const [editBody, setEditBody] = useState('')
  const [isSavingDraft, setIsSavingDraft] = useState(false)

  // SMTP Config State
  const [smtpUser, setSmtpUser] = useState('')
  const [smtpPass, setSmtpPass] = useState('')
  const [smtpFromName, setSmtpFromName] = useState('')
  const [isSavingSettings, setIsSavingSettings] = useState(false)
  const [showConfig, setShowConfig] = useState(false)

  // ─── Data Fetching ────────────────────────────────────────────────────────

  const fetchJobs = async () => {
    try {
      const res = await fetch('/api/scraper/jobs')
      const data = await res.json()
      if (res.ok && data.jobs) {
        setJobs(data.jobs.filter((j: ScraperJob) => j.status === 'completed'))
      }
    } catch (err) {
      console.error('Error fetching jobs:', err)
      toast.error('Failed to load scraper jobs')
    }
  }

  const fetchLeads = useCallback(async () => {
    if (selectedJobIds.length === 0) {
      setLeads([])
      return
    }
    setLoadingLeads(true)
    try {
      const jobIdsParam = selectedJobIds.join(',')
      const res = await fetch(`/api/leads?job_ids=${jobIdsParam}&has_email=true&limit=500`)
      const data = await res.json()
      if (res.ok && data.leads) {
        setLeads(data.leads)
      } else {
        console.error('[fetchLeads] error:', data.error)
        toast.error(data.error || 'Failed to load leads')
      }
    } catch (err) {
      console.error('Error fetching leads:', err)
      toast.error('Failed to load leads')
    } finally {
      setLoadingLeads(false)
    }
  }, [selectedJobIds])

  const fetchSmtpSettings = async () => {
    try {
      const res = await fetch('/api/meta/settings')
      const data = await res.json()
      if (res.ok && data.settings) {
        setSmtpUser(data.settings.SMTP_USER || '')
        setSmtpPass(data.settings.SMTP_PASS || '')
        setSmtpFromName(data.settings.SMTP_FROM_NAME || '')
      }
    } catch (err) {
      console.error('Failed to load SMTP settings:', err)
    }
  }

  useEffect(() => {
    fetchJobs()
    fetchSmtpSettings()
  }, [])

  useEffect(() => {
    fetchLeads()
  }, [fetchLeads])

  // ─── Derived / Sorted Data ────────────────────────────────────────────────

  const filteredLeads = useMemo(() => {
    const q = searchQuery.toLowerCase()
    const filtered = leads.filter(l =>
      l.name.toLowerCase().includes(q) ||
      (l.category && l.category.toLowerCase().includes(q))
    )

    // Sort: draft-ready first → email_sent → enriched → rest
    return filtered.sort((a, b) => {
      const aHasDraft = !!(a.ai_message_email_subject && a.ai_message_email_body)
      const bHasDraft = !!(b.ai_message_email_subject && b.ai_message_email_body)
      const aIsSent   = a.status === 'contacted' || a.status === 'email_sent'
      const bIsSent   = b.status === 'contacted' || b.status === 'email_sent'

      if (aHasDraft && !bHasDraft) return -1
      if (!aHasDraft && bHasDraft) return 1
      if (aIsSent && !bIsSent) return -1
      if (!aIsSent && bIsSent) return 1
      return a.name.localeCompare(b.name)
    })
  }, [leads, searchQuery])

  // Stats derived from all leads (not filtered)
  const stats = useMemo(() => {
    const total      = leads.length
    const withDraft  = leads.filter(l => l.ai_message_email_subject && l.ai_message_email_body).length
    const sent       = leads.filter(l => l.status === 'contacted' || l.status === 'email_sent').length
    const enriched   = leads.filter(l => l.enrichment_status === 'completed').length
    return { total, withDraft, sent, enriched }
  }, [leads])

  // ─── Selection Logic ──────────────────────────────────────────────────────

  const toggleJobSelection = (jobId: string) => {
    setSelectedJobIds(prev =>
      prev.includes(jobId) ? prev.filter(id => id !== jobId) : [...prev, jobId]
    )
  }

  const toggleLeadSelection = (leadId: string) => {
    setSelectedLeadIds(prev =>
      prev.includes(leadId) ? prev.filter(id => id !== leadId) : [...prev, leadId]
    )
  }

  const toggleSelectAllLeads = () => {
    if (selectedLeadIds.length === filteredLeads.length) {
      setSelectedLeadIds([])
    } else {
      setSelectedLeadIds(filteredLeads.map(l => l.id))
    }
  }

  // ─── SMTP Save ────────────────────────────────────────────────────────────

  const handleSaveSmtpSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSavingSettings(true)
    const toastId = toast.loading('Saving email settings...')
    try {
      const res = await fetch('/api/meta/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: {
            SMTP_USER: smtpUser.trim(),
            SMTP_PASS: smtpPass.trim(),
            SMTP_FROM_NAME: smtpFromName.trim()
          }
        })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success('SMTP configuration saved!', { id: toastId })
        fetchSmtpSettings()
      } else {
        throw new Error(data.error || 'Failed to save configuration')
      }
    } catch (err: any) {
      toast.error(`Error: ${err.message}`, { id: toastId })
    } finally {
      setIsSavingSettings(false)
    }
  }

  // ─── Generate AI Drafts ───────────────────────────────────────────────────

  const handleGenerateOutreach = async () => {
    if (selectedLeadIds.length === 0) {
      toast.error('Please select at least one lead.')
      return
    }

    setIsGenerating(true)
    setGenerateProgress({ done: 0, total: selectedLeadIds.length, label: 'Starting AI drafting…' })
    const toastId = toast.loading(`Starting batch AI email drafting for ${selectedLeadIds.length} leads…`)

    const batchSize = 3
    let generatedCount = 0
    let failedCount = 0

    try {
      for (let i = 0; i < selectedLeadIds.length; i += batchSize) {
        const batch = selectedLeadIds.slice(i, i + batchSize)
        const batchNum = Math.floor(i / batchSize) + 1
        const label = `Batch ${batchNum} — ${generatedCount} drafted, ${failedCount} failed…`
        toast.loading(label, { id: toastId })
        setGenerateProgress({ done: generatedCount + failedCount, total: selectedLeadIds.length, label })

        const res = await fetch('/api/automation/outreach/email/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leadIds: batch })
        })
        const data = await res.json()
        if (res.ok && data.success !== false) {
          generatedCount += data.generated || batch.length
          failedCount    += data.failed   || 0
        } else {
          failedCount += batch.length
        }
        setGenerateProgress({
          done: generatedCount + failedCount,
          total: selectedLeadIds.length,
          label: `${generatedCount} drafted ✓, ${failedCount} failed`
        })
      }
      toast.success(`🎉 Done! Generated ${generatedCount} drafts${failedCount > 0 ? `, ${failedCount} failed` : ''}`, { id: toastId })
      // Refresh leads to show new drafts
      await fetchLeads()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Generation failed'
      toast.error(`Generation error: ${msg}`, { id: toastId })
    } finally {
      setIsGenerating(false)
      setGenerateProgress(null)
    }
  }

  // ─── Send Emails ──────────────────────────────────────────────────────────

  const handleSendEmails = async () => {
    const leadsToSend  = filteredLeads.filter(l => selectedLeadIds.includes(l.id))
    const missingDrafts = leadsToSend.filter(l => !l.ai_message_email_subject || !l.ai_message_email_body)

    if (selectedLeadIds.length === 0) {
      toast.error('Please select at least one lead.')
      return
    }
    if (missingDrafts.length > 0) {
      toast.error(`Cannot send: ${missingDrafts.length} lead(s) have no AI draft. Generate drafts first.`)
      return
    }

    setIsSending(true)
    setSendResults(null)
    setGenerateProgress({ done: 0, total: selectedLeadIds.length, label: 'Sending emails…' })
    const toastId = toast.loading(`Dispatching to ${selectedLeadIds.length} recipients…`)

    const batchSize = 3
    let sentCount   = 0
    let failedCount = 0

    try {
      for (let i = 0; i < selectedLeadIds.length; i += batchSize) {
        const batch = selectedLeadIds.slice(i, i + batchSize)
        const label = `Sending batch ${Math.floor(i / batchSize) + 1} — ${sentCount} sent…`
        toast.loading(label, { id: toastId })
        setGenerateProgress({ done: sentCount + failedCount, total: selectedLeadIds.length, label })

        const res = await fetch('/api/automation/outreach/email/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leadIds: batch })
        })
        const data = await res.json()
        if (res.ok) {
          sentCount   += data.sent   || 0
          failedCount += data.failed || 0
        } else {
          failedCount += batch.length
        }
        setGenerateProgress({
          done: sentCount + failedCount,
          total: selectedLeadIds.length,
          label: `${sentCount} sent ✓, ${failedCount} failed`
        })
      }
      setSendResults({ sent: sentCount, failed: failedCount })
      toast.success(`✉️ Dispatched! Sent: ${sentCount}, Failed: ${failedCount}`, { id: toastId })
      setSelectedLeadIds([])
      await fetchLeads()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Send failed'
      toast.error(`Sending failed: ${msg}`, { id: toastId })
    } finally {
      setIsSending(false)
      setGenerateProgress(null)
    }
  }

  // ─── Draft Modal ──────────────────────────────────────────────────────────

  const openDraftModal = (lead: Lead) => {
    setViewingLead(lead)
    setEditSubject(lead.ai_message_email_subject || '')
    setEditBody(lead.ai_message_email_body || '')
    setDraftViewMode('preview')
  }

  const closeDraftModal = () => {
    setViewingLead(null)
    setDraftViewMode('preview')
  }

  const handleSaveDraft = async () => {
    if (!viewingLead) return
    setIsSavingDraft(true)
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: viewingLead.id,
          name: viewingLead.name,
          ai_message_email_subject: editSubject,
          ai_message_email_body: editBody
        })
      })
      if (res.ok) {
        toast.success('Draft updated successfully!')
        closeDraftModal()
        await fetchLeads()
      } else {
        toast.error('Failed to save draft')
      }
    } catch (err) {
      console.error(err)
      toast.error('Failed to update draft')
    } finally {
      setIsSavingDraft(false)
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="p-4 lg:p-6 space-y-5 min-h-screen" style={{ background: 'transparent' }}>

      {/* Progress Banner */}
      {generateProgress && (
        <div className="rounded-2xl border border-[#2D2D30] bg-[#141416] p-5 space-y-3 shadow-lg">
          <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider text-[#E3B859]">
            <span>⏳ {generateProgress.label}</span>
            <span className="font-mono text-white">
              {generateProgress.done} / {generateProgress.total} &nbsp;
              ({Math.round((generateProgress.done / generateProgress.total) * 100)}%)
            </span>
          </div>
          <div className="w-full bg-[#18181A] h-2.5 rounded-full overflow-hidden border border-[#2D2D30]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-yellow-500 to-[#E3B859] transition-all duration-500"
              style={{ width: `${(generateProgress.done / generateProgress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Send Results Banner */}
      {sendResults && !generateProgress && (
        <div className="rounded-2xl border border-green-800/40 bg-green-950/20 p-4 flex items-center justify-between">
          <div className="text-xs text-green-300 font-bold">
            ✉️ Last send: <span className="text-white">{sendResults.sent} dispatched</span>
            {sendResults.failed > 0 && <span className="text-red-400 ml-2">· {sendResults.failed} failed</span>}
          </div>
          <button onClick={() => setSendResults(null)} className="text-gray-500 hover:text-white text-xs">✕</button>
        </div>
      )}

      {/* Header Banner */}
      <div className="relative rounded-2xl overflow-hidden border border-[#2D2D30] bg-gradient-to-r from-[#1A1A1E] to-[#141416] p-6 shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(227,184,89,0.07),transparent)] pointer-events-none" />
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-5">
          <div className="space-y-1.5">
            <h1 className="text-xl font-black uppercase tracking-wider text-white flex items-center gap-2.5">
              <span className="text-2xl">📧</span> AI Email Outreach Portal
            </h1>
            <p className="text-[11px] text-gray-400 max-w-lg leading-relaxed">
              Select leads from scraper batches, generate personalized AI cold email drafts, preview and edit them, then send seamlessly.
            </p>
          </div>
          <div className="flex gap-2.5">
            <button
              onClick={handleGenerateOutreach}
              disabled={isGenerating || isSending || selectedLeadIds.length === 0}
              className="bg-gradient-to-r from-[#E3B859] to-[#C9A045] hover:from-[#F0C973] hover:to-[#D9B255] disabled:opacity-40 disabled:cursor-not-allowed text-[#141416] px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all duration-300 shadow-lg flex items-center gap-2"
            >
              {isGenerating
                ? <><span className="w-3 h-3 border-2 border-[#141416]/40 border-t-[#141416] rounded-full animate-spin" />Drafting…</>
                : '⚡ Generate AI Drafts'}
            </button>
            <button
              onClick={handleSendEmails}
              disabled={isGenerating || isSending || selectedLeadIds.length === 0}
              className="bg-[#252528] hover:bg-[#303035] disabled:opacity-40 disabled:cursor-not-allowed border border-[#3A3A3D] text-white px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all duration-300 shadow-md flex items-center gap-2"
            >
              {isSending
                ? <><span className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" />Sending…</>
                : '✉️ Send Emails'}
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">

        {/* LEFT SIDEBAR */}
        <div className="lg:col-span-1 space-y-4">

          {/* SMTP Config */}
          <div className="rounded-2xl border border-[#2D2D30] bg-[#18181A]/70 backdrop-blur-md p-4 shadow-lg space-y-3">
            <button
              type="button"
              onClick={() => setShowConfig(!showConfig)}
              className="w-full flex justify-between items-center select-none group"
            >
              <h2 className="text-[10px] font-black uppercase tracking-widest text-[#E3B859] flex items-center gap-2">
                <span>⚙️</span> SMTP Configuration
              </h2>
              <span className="text-gray-500 group-hover:text-white transition-colors text-[10px]">
                {showConfig ? '▲' : '▼'}
              </span>
            </button>

            {showConfig && (
              <form onSubmit={handleSaveSmtpSettings} className="space-y-3 pt-1 border-t border-[#2D2D30]">
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-wider text-gray-500">Sender Email</label>
                  <input
                    type="email"
                    value={smtpUser}
                    onChange={(e) => setSmtpUser(e.target.value)}
                    required
                    placeholder="you@gmail.com"
                    className="w-full bg-[#101012] border border-[#2D2D30] rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#E3B859] transition-colors"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-wider text-gray-500">Gmail App Password</label>
                  <input
                    type="password"
                    value={smtpPass}
                    onChange={(e) => setSmtpPass(e.target.value)}
                    required
                    placeholder="••••••••••••••••"
                    className="w-full bg-[#101012] border border-[#2D2D30] rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#E3B859] transition-colors"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-wider text-gray-500">Display Name</label>
                  <input
                    type="text"
                    value={smtpFromName}
                    onChange={(e) => setSmtpFromName(e.target.value)}
                    placeholder="Your Name"
                    className="w-full bg-[#101012] border border-[#2D2D30] rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#E3B859] transition-colors"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSavingSettings}
                  className="w-full bg-[#E3B859] hover:bg-[#F0C973] disabled:opacity-40 text-[#141416] py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
                >
                  {isSavingSettings ? 'Saving…' : 'Save Settings'}
                </button>
              </form>
            )}
          </div>

          {/* Scraper Batches */}
          <div className="rounded-2xl border border-[#2D2D30] bg-[#18181A]/70 backdrop-blur-md p-4 shadow-lg space-y-3 flex flex-col">
            <div className="border-b border-[#2D2D30] pb-3">
              <h2 className="text-[10px] font-black uppercase tracking-widest text-[#E3B859] flex items-center gap-2">
                <span>🔍</span> Scraper Batches
              </h2>
              <p className="text-[9px] text-gray-500 mt-1">Select one or more jobs to load leads.</p>
            </div>

            <div className="space-y-2 overflow-y-auto max-h-[480px] flex-1 pr-0.5">
              {jobs.length === 0 ? (
                <div className="text-center py-8 text-[10px] text-gray-600 font-bold uppercase tracking-wider">
                  No Completed Jobs Found
                </div>
              ) : (
                jobs.map(job => {
                  const isSelected = selectedJobIds.includes(job.id)
                  return (
                    <div
                      key={job.id}
                      onClick={() => toggleJobSelection(job.id)}
                      className={`p-3 rounded-xl border transition-all duration-200 cursor-pointer flex items-start gap-2.5 select-none ${
                        isSelected
                          ? 'bg-[#222225] border-[#E3B859]/70 shadow-[0_0_10px_rgba(227,184,89,0.08)]'
                          : 'bg-[#141416]/50 border-[#2D2D30] hover:border-[#4D4D50]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        readOnly
                        className="mt-0.5 accent-[#E3B859] cursor-pointer"
                      />
                      <div className="space-y-0.5 min-w-0">
                        <div className="text-[11px] font-black uppercase tracking-wide text-white truncate">
                          {job.keyword}
                        </div>
                        <div className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">
                          📍 {job.city}
                        </div>
                        <div className="text-[9px] text-gray-600 font-mono">
                          {new Date(job.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>

        {/* RIGHT — Leads Panel */}
        <div className="lg:col-span-3 rounded-2xl border border-[#2D2D30] bg-[#18181A]/70 backdrop-blur-md shadow-lg flex flex-col overflow-hidden">

          {/* Panel Header */}
          <div className="p-4 border-b border-[#2D2D30] space-y-3">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h2 className="text-[10px] font-black uppercase tracking-widest text-[#E3B859] flex items-center gap-2">
                  <span>👥</span> Scraped Leads
                  {leads.length > 0 && <span className="text-white">({filteredLeads.length})</span>}
                </h2>
                <p className="text-[9px] text-gray-500 mt-0.5">Only leads with verified emails shown. Draft-ready leads appear first.</p>
              </div>

              <div className="relative w-full sm:max-w-[240px]">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search by name or category…"
                  className="w-full bg-[#141416] border border-[#2D2D30] rounded-xl px-4 py-2 text-xs text-[#E4E3DD] placeholder-gray-600 focus:outline-none focus:border-[#E3B859] pl-8 transition-colors"
                />
                <span className="absolute left-3 top-2.5 text-[10px] text-gray-500">🔍</span>
              </div>
            </div>

            {/* Stats Bar */}
            {leads.length > 0 && (
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: 'Total',   value: stats.total,     color: 'text-gray-300',  icon: '👥' },
                  { label: 'Drafted', value: stats.withDraft, color: 'text-amber-300', icon: '📝' },
                  { label: 'Sent',    value: stats.sent,      color: 'text-green-300', icon: '✅' },
                  { label: 'Enriched',value: stats.enriched,  color: 'text-blue-300',  icon: '🧠' },
                ].map(s => (
                  <div key={s.label} className="bg-[#141416] border border-[#2D2D30] rounded-xl p-2.5 text-center">
                    <div className={`text-base font-black ${s.color}`}>{s.value}</div>
                    <div className="text-[8px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">{s.icon} {s.label}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Selection Controls */}
            {filteredLeads.length > 0 && (
              <div className="flex items-center justify-between text-[10px] text-gray-500">
                <label className="flex items-center gap-2 cursor-pointer select-none hover:text-white transition-colors">
                  <input
                    type="checkbox"
                    checked={selectedLeadIds.length === filteredLeads.length && filteredLeads.length > 0}
                    onChange={toggleSelectAllLeads}
                    className="accent-[#E3B859] rounded cursor-pointer"
                  />
                  <span className="font-bold uppercase tracking-widest">
                    {selectedLeadIds.length > 0
                      ? `${selectedLeadIds.length} selected`
                      : 'Select All'}
                  </span>
                </label>
                {selectedLeadIds.length > 0 && (
                  <button
                    onClick={() => setSelectedLeadIds([])}
                    className="text-gray-500 hover:text-white font-bold uppercase tracking-widest transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Leads List */}
          <div className="flex-1 overflow-y-auto" style={{ maxHeight: '60vh' }}>
            {loadingLeads ? (
              <div className="flex flex-col items-center justify-center h-56 gap-3">
                <div className="w-7 h-7 rounded-full border-2 border-t-[#E3B859] border-r-transparent border-b-[#E3B859] border-l-transparent animate-spin" />
                <span className="text-[10px] text-gray-500 uppercase tracking-widest font-black">Loading leads…</span>
              </div>
            ) : selectedJobIds.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-56 text-center gap-3">
                <span className="text-4xl opacity-40">👈</span>
                <div className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Select a scraper batch to load leads</div>
              </div>
            ) : filteredLeads.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-56 text-center gap-3">
                <span className="text-3xl opacity-30">📭</span>
                <div className="text-[10px] text-gray-500 font-black uppercase tracking-widest">No leads with emails found</div>
                <p className="text-[9px] text-gray-600 max-w-xs">
                  Leads without an email address are excluded. Run the enrichment scraper to find emails.
                </p>
              </div>
            ) : (
              <table className="w-full text-left text-[11px] border-collapse">
                <thead className="sticky top-0 z-10 bg-[#141416]">
                  <tr className="border-b border-[#2D2D30] text-gray-500 font-bold uppercase tracking-wider text-[9px]">
                    <th className="py-3 px-4 w-8" />
                    <th className="py-3 px-4">Lead</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4">Outreach Draft</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E1E20]">
                  {filteredLeads.map(lead => {
                    const isSelected  = selectedLeadIds.includes(lead.id)
                    const hasDraft    = !!(lead.ai_message_email_subject && lead.ai_message_email_body)
                    const hasEnrichment = lead.enrichment_status === 'completed'
                    const isSent      = lead.status === 'contacted' || lead.status === 'email_sent'

                    return (
                      <tr
                        key={lead.id}
                        className={`transition-colors ${
                          isSelected ? 'bg-[#1E1E22]' : 'hover:bg-[#1A1A1D]/60'
                        } ${hasDraft ? 'border-l-2 border-l-amber-600/40' : ''}`}
                      >
                        {/* Checkbox */}
                        <td className="py-3 px-4">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleLeadSelection(lead.id)}
                            className="accent-[#E3B859] rounded cursor-pointer"
                          />
                        </td>

                        {/* Lead Name + Website */}
                        <td className="py-3 px-4">
                          <div className="font-black text-white leading-tight">
                            {hasDraft && <span className="text-amber-400 mr-1 text-[9px]">●</span>}
                            {lead.name}
                          </div>
                          {lead.website && (
                            <a
                              href={lead.website}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[9px] text-gray-500 hover:text-[#E3B859] flex items-center gap-0.5 mt-0.5 font-normal"
                            >
                              🔗 {lead.website.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}
                            </a>
                          )}
                        </td>

                        {/* Category */}
                        <td className="py-3 px-4 text-gray-400 font-bold uppercase tracking-widest text-[9px]">
                          {lead.category || '—'}
                        </td>

                        {/* Email */}
                        <td className="py-3 px-4">
                          <div className="font-mono text-gray-300 text-[10px] leading-tight">{lead.email}</div>
                          {lead.phone && (
                            <div className="text-[9px] text-gray-600 font-mono mt-0.5">{lead.phone}</div>
                          )}
                        </td>

                        {/* Draft Column */}
                        <td className="py-3 px-4">
                          {hasDraft ? (
                            <button
                              onClick={() => openDraftModal(lead)}
                              className="group flex items-center gap-1.5 text-amber-400 hover:text-amber-300 font-bold text-[10px] transition-colors"
                            >
                              <span className="text-[13px] group-hover:scale-110 transition-transform">📝</span>
                              <span className="underline underline-offset-2">View Draft</span>
                            </button>
                          ) : (
                            <span className="text-gray-600 italic text-[10px]">No draft yet</span>
                          )}
                          {hasEnrichment && !hasDraft && (
                            <div className="text-[8px] text-blue-400 font-bold uppercase tracking-wider mt-1">🧠 Enriched</div>
                          )}
                        </td>

                        {/* Status Badge */}
                        <td className="py-3 px-4">
                          {isSent ? (
                            <span className="bg-green-950/50 border border-green-800/40 text-green-300 px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-wider">
                              ✓ Sent
                            </span>
                          ) : hasDraft ? (
                            <span className="bg-amber-950/50 border border-amber-700/40 text-amber-300 px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-wider">
                              Draft Ready
                            </span>
                          ) : hasEnrichment ? (
                            <span className="bg-blue-950/50 border border-blue-800/40 text-blue-300 px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-wider">
                              Enriched
                            </span>
                          ) : (
                            <span className="bg-[#222225]/60 border border-[#3A3A3D]/40 text-gray-400 px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-wider">
                              Qualified
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* ─── Draft Preview / Edit Modal ───────────────────────────────────── */}
      {viewingLead && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={closeDraftModal}>
          <div
            className="bg-[#1A1A1E] border border-[#2D2D30] rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-[#2D2D30] bg-[#141416]">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                  📧 Outreach Draft
                </h3>
                <p className="text-[9px] text-gray-500 mt-0.5">
                  {viewingLead.name} · <span className="text-[#E3B859]">{viewingLead.email}</span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                {/* Mode toggle */}
                <div className="flex bg-[#222225] border border-[#3A3A3D] rounded-lg overflow-hidden text-[9px] font-black uppercase tracking-widest">
                  <button
                    onClick={() => setDraftViewMode('preview')}
                    className={`px-3 py-1.5 transition-colors ${draftViewMode === 'preview' ? 'bg-[#E3B859] text-[#141416]' : 'text-gray-400 hover:text-white'}`}
                  >
                    Preview
                  </button>
                  <button
                    onClick={() => setDraftViewMode('edit')}
                    className={`px-3 py-1.5 transition-colors ${draftViewMode === 'edit' ? 'bg-[#E3B859] text-[#141416]' : 'text-gray-400 hover:text-white'}`}
                  >
                    Edit
                  </button>
                </div>
                <button
                  onClick={closeDraftModal}
                  className="text-gray-500 hover:text-white transition-colors text-lg leading-none"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Enrichment Context */}
            {viewingLead.enrichment_fields?.business_description && (
              <div className="mx-6 mt-4 bg-[#141416]/60 border border-[#2D2D30] rounded-xl p-3 space-y-1.5">
                <div className="text-[8px] font-black uppercase tracking-widest text-[#E3B859]">🧠 Business Intelligence</div>
                <p className="text-[10px] text-gray-400 italic leading-relaxed">
                  &ldquo;{viewingLead.enrichment_fields.business_description}&rdquo;
                </p>
                {viewingLead.enrichment_fields.key_offerings && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {viewingLead.enrichment_fields.key_offerings.map(off => (
                      <span key={off} className="bg-[#222225] border border-[#3A3A3D]/50 px-2 py-0.5 rounded text-[8px] text-gray-300">
                        {off}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Content Area */}
            <div className="px-6 py-4 space-y-4">
              {draftViewMode === 'preview' ? (
                /* Preview Mode */
                <div className="space-y-3">
                  <div className="bg-[#141416] border border-[#2D2D30] rounded-xl p-4">
                    <div className="text-[8px] font-black uppercase tracking-widest text-gray-500 mb-1.5">Subject</div>
                    <div className="text-sm font-bold text-white">{editSubject || '—'}</div>
                  </div>
                  <div className="bg-[#141416] border border-[#2D2D30] rounded-xl p-4">
                    <div className="text-[8px] font-black uppercase tracking-widest text-gray-500 mb-2">Email Body</div>
                    <div className="text-[12px] text-gray-300 leading-relaxed whitespace-pre-wrap font-sans">
                      {editBody || '—'}
                    </div>
                  </div>
                </div>
              ) : (
                /* Edit Mode */
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[8px] font-black uppercase tracking-widest text-gray-500">Subject</label>
                    <input
                      type="text"
                      value={editSubject}
                      onChange={e => setEditSubject(e.target.value)}
                      className="w-full bg-[#141416] border border-[#2D2D30] focus:border-[#E3B859] rounded-xl px-4 py-2.5 text-xs text-[#E4E3DD] focus:outline-none transition-colors"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-black uppercase tracking-widest text-gray-500">Email Body</label>
                    <textarea
                      value={editBody}
                      onChange={e => setEditBody(e.target.value)}
                      rows={9}
                      className="w-full bg-[#141416] border border-[#2D2D30] focus:border-[#E3B859] rounded-xl px-4 py-3 text-[11px] text-[#E4E3DD] focus:outline-none font-mono leading-relaxed transition-colors resize-none"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-2.5 px-6 pb-5">
              <button
                onClick={closeDraftModal}
                className="bg-[#222225] hover:bg-[#2D2D30] text-gray-300 hover:text-white px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors"
              >
                Close
              </button>
              {draftViewMode === 'edit' && (
                <button
                  onClick={handleSaveDraft}
                  disabled={isSavingDraft}
                  className="bg-gradient-to-r from-[#E3B859] to-[#C9A045] hover:from-[#F0C973] hover:to-[#D9B255] disabled:opacity-40 text-[#141416] px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-md"
                >
                  {isSavingDraft ? 'Saving…' : 'Save Draft'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
