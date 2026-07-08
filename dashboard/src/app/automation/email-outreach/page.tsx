'use client'

import React, { useState, useEffect, useCallback } from 'react'
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

export default function EmailOutreachPage() {
  const [jobs, setJobs] = useState<ScraperJob[]>([])
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [loadingLeads, setLoadingLeads] = useState(false)
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSending, setIsSending] = useState(false)

  // Editing Lead Details Modal State
  const [editingLead, setEditingLead] = useState<Lead | null>(null)
  const [editSubject, setEditSubject] = useState('')
  const [editBody, setEditBody] = useState('')
  const [isSavingDraft, setIsSavingDraft] = useState(false)

  // Fetch completed scraper jobs
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

  // Fetch leads matching selected jobs (with email only)
  const fetchLeads = useCallback(async () => {
    if (selectedJobIds.length === 0) {
      setLeads([])
      return
    }

    setLoadingLeads(true)
    try {
      const jobIdsParam = selectedJobIds.join(',')
      const res = await fetch(`/api/leads?job_ids=${jobIdsParam}&has_email=true&limit=200`)
      const data = await res.json()
      if (res.ok && data.leads) {
        setLeads(data.leads)
      }
    } catch (err) {
      console.error('Error fetching leads:', err)
      toast.error('Failed to load leads')
    } finally {
      setLoadingLeads(false)
    }
  }, [selectedJobIds])

  // Configuration Settings State
  const [smtpUser, setSmtpUser] = useState('')
  const [smtpPass, setSmtpPass] = useState('')
  const [smtpFromName, setSmtpFromName] = useState('')
  const [isSavingSettings, setIsSavingSettings] = useState(false)
  const [showConfig, setShowConfig] = useState(false)

  // Load SMTP config on mount
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

  useEffect(() => {
    fetchJobs()
    fetchSmtpSettings()
  }, [])

  useEffect(() => {
    fetchLeads()
  }, [fetchLeads])

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

  const filteredLeads = leads.filter(l => 
    l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (l.category && l.category.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  // 1. Generate AI Outreach Drafts (calls Next.js proxy route to Express backend)
  const handleGenerateOutreach = async () => {
    if (selectedLeadIds.length === 0) {
      toast.error('Please select at least one lead.')
      return
    }

    setIsGenerating(true)
    const toastId = toast.loading(`Drafting AI emails for ${selectedLeadIds.length} leads...`)

    try {
      const res = await fetch('/api/automation/outreach/email/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadIds: selectedLeadIds })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success('🎉 AI email drafts successfully generated!', { id: toastId })
        fetchLeads() // refresh leads list to load drafts
      } else {
        throw new Error(data.error || 'Failed to generate drafts')
      }
    } catch (err: any) {
      toast.error(`Generation failed: ${err.message}`, { id: toastId })
    } finally {
      setIsGenerating(false)
    }
  }

  // 2. Send Emails (calls Next.js proxy route to Express backend)
  const handleSendEmails = async () => {
    const leadsToSend = filteredLeads.filter(l => selectedLeadIds.includes(l.id))
    const missingDrafts = leadsToSend.filter(l => !l.ai_message_email_subject || !l.ai_message_email_body)

    if (selectedLeadIds.length === 0) {
      toast.error('Please select at least one lead.')
      return
    }

    if (missingDrafts.length > 0) {
      toast.error(`Cannot send: ${missingDrafts.length} selected lead(s) have no AI draft generated yet.`)
      return
    }

    setIsSending(true)
    const toastId = toast.loading(`Dispatching emails to ${selectedLeadIds.length} recipients...`)

    try {
      const res = await fetch('/api/automation/outreach/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadIds: selectedLeadIds })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success('✉️ Outreach emails successfully dispatched!', { id: toastId })
        setSelectedLeadIds([])
        fetchLeads() // refresh to show sent state
      } else {
        throw new Error(data.error || 'Failed to send emails')
      }
    } catch (err: any) {
      toast.error(`Sending failed: ${err.message}`, { id: toastId })
    } finally {
      setIsSending(false)
    }
  }

  // Open Preview & Edit Modal
  const openEditModal = (lead: Lead) => {
    setEditingLead(lead)
    setEditSubject(lead.ai_message_email_subject || '')
    setEditBody(lead.ai_message_email_body || '')
  }

  // Save manual draft changes directly
  const handleSaveDraft = async () => {
    if (!editingLead) return
    setIsSavingDraft(true)
    try {
      const res = await fetch(`/api/leads`, {
        method: 'POST', // leadsRepository uses upsert on matching ID/phone check
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingLead.id,
          name: editingLead.name,
          ai_message_email_subject: editSubject,
          ai_message_email_body: editBody
        })
      })
      if (res.ok) {
        toast.success('Draft updated successfully!')
        setEditingLead(null)
        fetchLeads()
      } else {
        toast.error('Failed to save draft details')
      }
    } catch (err) {
      console.error(err)
      toast.error('Failed to update draft')
    } finally {
      setIsSavingDraft(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header Banner */}
      <div className="relative rounded-2xl overflow-hidden border border-[#2D2D30] bg-gradient-to-r from-[#1E1E22] to-[#141416] p-8 shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(227,184,89,0.08),transparent)] pointer-events-none" />
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-2">
            <h1 className="text-2xl font-black uppercase tracking-wider text-white flex items-center gap-3">
              <span>📧</span> AI Email Outreach Portal
            </h1>
            <p className="text-xs text-gray-400 max-w-xl">
              Select leads generated from your scraper runs, perform automatic AI website analysis and enrichment, draft professional, non-spammy cold outreach messages, and send them seamlessly.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleGenerateOutreach}
              disabled={isGenerating || isSending || selectedLeadIds.length === 0}
              className="bg-gradient-to-r from-[#E3B859] to-[#C9A045] hover:from-[#F0C973] hover:to-[#D9B255] disabled:opacity-40 disabled:cursor-not-allowed text-[#141416] px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 shadow-md flex items-center gap-2"
            >
              {isGenerating ? 'Drafting...' : '⚡ Generate AI Drafts'}
            </button>
            <button
              onClick={handleSendEmails}
              disabled={isGenerating || isSending || selectedLeadIds.length === 0}
              className="bg-[#2D2D30] hover:bg-[#3D3D40] disabled:opacity-40 disabled:cursor-not-allowed border border-[#4D4D50] text-white px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 shadow-md flex items-center gap-2"
            >
              {isSending ? 'Sending...' : '✉️ Send Emails'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-6">
          {/* SMTP Configuration Module */}
          <div className="rounded-2xl border border-[#2D2D30] bg-[#18181A]/60 backdrop-blur-md p-5 shadow-lg space-y-4">
            <button 
              type="button"
              onClick={() => setShowConfig(!showConfig)}
              className="w-full flex justify-between items-center border-b border-[#2D2D30] pb-3 text-left select-none group"
            >
              <div>
                <h2 className="text-xs font-black uppercase tracking-widest text-[#E3B859] flex items-center gap-2">
                  <span>⚙️</span> SMTP Configuration
                </h2>
                <p className="text-[9px] text-gray-500 mt-1">Configure sender accounts for email outreach.</p>
              </div>
              <span className="text-gray-400 group-hover:text-white transition-colors text-xs">
                {showConfig ? '▲' : '▼'}
              </span>
            </button>
            
            {showConfig && (
              <form onSubmit={handleSaveSmtpSettings} className="space-y-3.5 pt-1">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-gray-400">Sender Email</label>
                  <input
                    type="email"
                    value={smtpUser}
                    onChange={(e) => setSmtpUser(e.target.value)}
                    required
                    placeholder="stratnent@gmail.com"
                    className="w-full bg-[#101012] border border-[#2D2D30] rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#E3B859] transition-colors"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-gray-400">Gmail App Password</label>
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
                  <label className="text-[10px] font-black uppercase tracking-wider text-gray-400">Display Name</label>
                  <input
                    type="text"
                    value={smtpFromName}
                    onChange={(e) => setSmtpFromName(e.target.value)}
                    placeholder="OUTREACH"
                    className="w-full bg-[#101012] border border-[#2D2D30] rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#E3B859] transition-colors"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSavingSettings}
                  className="w-full bg-[#E3B859] hover:bg-[#F0C973] disabled:opacity-40 disabled:cursor-not-allowed text-[#141416] py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all duration-300 shadow-md"
                >
                  {isSavingSettings ? 'Saving...' : 'Save SMTP Settings'}
                </button>
              </form>
            )}
          </div>

          {/* Scraper Jobs List Selection */}
          <div className="rounded-2xl border border-[#2D2D30] bg-[#18181A]/60 backdrop-blur-md p-5 shadow-lg space-y-4 flex flex-col">
            <div className="border-b border-[#2D2D30] pb-3">
              <h2 className="text-xs font-black uppercase tracking-widest text-[#E3B859] flex items-center gap-2">
                <span>🔍</span> Scraper Batches
              </h2>
              <p className="text-[10px] text-gray-500 mt-1">Select one or multiple jobs to retrieve scraped leads.</p>
            </div>
            
            <div className="space-y-2.5 overflow-y-auto max-h-[450px] flex-1 pr-1">
              {jobs.length === 0 ? (
                <div className="text-center py-6 text-xs text-gray-500 font-bold uppercase tracking-wider">
                  No Scraper Jobs Found
                </div>
              ) : (
                jobs.map(job => {
                  const isSelected = selectedJobIds.includes(job.id)
                  return (
                    <div
                      key={job.id}
                      onClick={() => toggleJobSelection(job.id)}
                      className={`p-3.5 rounded-xl border transition-all duration-300 cursor-pointer flex items-start gap-3 select-none ${
                        isSelected 
                          ? 'bg-[#222225] border-[#E3B859] text-white' 
                          : 'bg-[#141416]/50 border-[#2D2D30] text-gray-400 hover:border-gray-500'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        readOnly
                        className="mt-1 accent-[#E3B859] rounded cursor-pointer"
                      />
                      <div className="space-y-1">
                        <div className="text-[11px] font-black uppercase tracking-wider leading-tight text-white line-clamp-1">
                          {job.keyword}
                        </div>
                        <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-none">
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

        {/* Selected Leads Table */}
        <div className="lg:col-span-3 rounded-2xl border border-[#2D2D30] bg-[#18181A]/60 backdrop-blur-md p-5 shadow-lg flex flex-col space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 border-b border-[#2D2D30] pb-4">
            <div>
              <h2 className="text-xs font-black uppercase tracking-widest text-[#E3B859] flex items-center gap-2">
                <span>👥</span> Scraped Leads ({filteredLeads.length})
              </h2>
              <p className="text-[10px] text-gray-500 mt-1">Leads with verified emails are shown. Select items to perform outreach.</p>
            </div>
            
            <div className="relative max-w-xs w-full">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search leads by name or category..."
                className="w-full bg-[#141416] border border-[#2D2D30] rounded-xl px-4 py-2.5 text-xs text-[#E4E3DD] focus:outline-none focus:border-[#E3B859] pl-9"
              />
              <span className="absolute left-3.5 top-3 text-[11px] text-gray-500">🔍</span>
            </div>
          </div>

          <div className="overflow-x-auto flex-1 min-h-[400px]">
            {loadingLeads ? (
              <div className="flex flex-col items-center justify-center h-64 space-y-3">
                <div className="w-8 h-8 rounded-full border-2 border-t-[#E3B859] border-r-transparent border-b-[#E3B859] border-l-transparent animate-spin" />
                <span className="text-xs text-gray-500 uppercase tracking-widest font-black">Loading leads...</span>
              </div>
            ) : selectedJobIds.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center space-y-2">
                <span className="text-3xl">👈</span>
                <div className="text-xs text-gray-500 font-black uppercase tracking-widest">Select Scraper Jobs to Load Leads</div>
              </div>
            ) : filteredLeads.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <span className="text-xs text-gray-500 font-black uppercase tracking-widest">No leads with emails found for selected jobs</span>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#2D2D30] text-gray-500 font-bold uppercase tracking-wider">
                    <th className="py-3 px-4 w-10">
                      <input
                        type="checkbox"
                        checked={selectedLeadIds.length === filteredLeads.length && filteredLeads.length > 0}
                        onChange={toggleSelectAllLeads}
                        className="accent-[#E3B859] rounded cursor-pointer"
                      />
                    </th>
                    <th className="py-3 px-4">Lead Name</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Contact Detail</th>
                    <th className="py-3 px-4">Enrichment</th>
                    <th className="py-3 px-4">Outreach Draft</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#202023]/60">
                  {filteredLeads.map(lead => {
                    const isSelected = selectedLeadIds.includes(lead.id)
                    const hasDraft = lead.ai_message_email_subject && lead.ai_message_email_body
                    const hasEnrichment = lead.enrichment_status === 'completed'
                    
                    return (
                      <tr 
                        key={lead.id} 
                        className={`hover:bg-[#202022]/40 transition-colors ${
                          isSelected ? 'bg-[#222225]/20' : ''
                        }`}
                      >
                        <td className="py-3.5 px-4">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleLeadSelection(lead.id)}
                            className="accent-[#E3B859] rounded cursor-pointer"
                          />
                        </td>
                        <td className="py-3.5 px-4 font-black text-white">
                          <div className="space-y-0.5">
                            <div>{lead.name}</div>
                            {lead.website && (
                              <a 
                                href={lead.website} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="text-[10px] text-gray-500 hover:text-[#E3B859] flex items-center gap-1 mt-0.5 font-normal"
                              >
                                🔗 {lead.website.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}
                              </a>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-gray-400 font-bold uppercase tracking-widest text-[10px]">
                          {lead.category || 'Local Business'}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="space-y-1">
                            {lead.email && (
                              <div className="font-mono text-gray-300 font-bold">{lead.email}</div>
                            )}
                            {lead.phone && (
                              <div className="text-[10px] text-gray-500 font-mono">{lead.phone}</div>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          {hasEnrichment ? (
                            <span 
                              className="bg-green-950/40 border border-green-800/30 text-green-300 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider cursor-pointer"
                              title={lead.enrichment_fields?.business_description}
                            >
                              ✅ Enriched
                            </span>
                          ) : (
                            <span className="bg-[#2D2D30]/60 border border-[#4D4D50]/30 text-gray-400 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider">
                              Not Started
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          {hasDraft ? (
                            <button
                              onClick={() => openEditModal(lead)}
                              className="text-[#E3B859] hover:underline flex items-center gap-1 font-bold text-[11px]"
                            >
                              📝 Preview Draft
                            </button>
                          ) : (
                            <span className="text-gray-600 italic">No draft yet</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          {lead.status === 'email_sent' ? (
                            <span className="bg-green-900/40 border border-green-800/30 text-green-300 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider">
                              Sent
                            </span>
                          ) : hasDraft ? (
                            <span className="bg-amber-900/40 border border-amber-800/30 text-amber-300 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider">
                              Draft Ready
                            </span>
                          ) : (
                            <span className="bg-gray-800/40 border border-gray-700/30 text-gray-400 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider">
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

      {/* Editing / Previewing Draft Modal */}
      {editingLead && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1C1C1E] border border-[#2D2D30] rounded-2xl w-full max-w-2xl p-6 shadow-2xl space-y-5">
            <div className="flex justify-between items-center border-b border-[#2D2D30] pb-3">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-white">
                  Outreach Draft Preview
                </h3>
                <p className="text-[10px] text-gray-500 mt-1">Review or adjust the personalized message copy for {editingLead.name}.</p>
              </div>
              <button 
                onClick={() => setEditingLead(null)} 
                className="text-gray-400 hover:text-white text-xs uppercase tracking-widest font-black"
              >
                Close
              </button>
            </div>

            {/* AI Context Summary if enriched */}
            {editingLead.enrichment_fields?.business_description && (
              <div className="bg-[#141416]/60 border border-[#2D2D30] rounded-xl p-3.5 space-y-2">
                <div className="text-[9px] font-black uppercase tracking-widest text-[#E3B859]">
                  🧠 Enrichment Intelligence Summary
                </div>
                <p className="text-[11px] text-gray-400 italic">
                  &ldquo;{editingLead.enrichment_fields.business_description}&rdquo;
                </p>
                {editingLead.enrichment_fields.key_offerings && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {editingLead.enrichment_fields.key_offerings.map(off => (
                      <span key={off} className="bg-[#222225] border border-[#3A3A3D]/40 px-2 py-0.5 rounded text-[9px] text-gray-300">
                        {off}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase tracking-widest text-gray-500">Subject</label>
                <input
                  type="text"
                  value={editSubject}
                  onChange={e => setEditSubject(e.target.value)}
                  className="w-full bg-[#141416] border border-[#2D2D30] focus:border-[#E3B859] rounded-xl px-4 py-2.5 text-xs text-[#E4E3DD] focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase tracking-widest text-gray-500">Email Body</label>
                <textarea
                  value={editBody}
                  onChange={e => setEditBody(e.target.value)}
                  rows={8}
                  className="w-full bg-[#141416] border border-[#2D2D30] focus:border-[#E3B859] rounded-xl px-4 py-3 text-xs text-[#E4E3DD] focus:outline-none font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-[#2D2D30] pt-4">
              <button
                onClick={() => setEditingLead(null)}
                className="bg-[#222225] hover:bg-[#2D2D30] text-gray-300 hover:text-white px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveDraft}
                disabled={isSavingDraft}
                className="bg-gradient-to-r from-[#E3B859] to-[#C9A045] hover:from-[#F0C973] hover:to-[#D9B255] text-[#141416] px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md"
              >
                {isSavingDraft ? 'Saving...' : 'Save Draft'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
