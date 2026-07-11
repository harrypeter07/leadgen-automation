'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import toast from 'react-hot-toast'
import {
  Settings,
  Search,
  Users,
  FileText,
  CheckCircle,
  Sparkles,
  Mail,
  Inbox,
  MapPin,
  Globe,
  Loader2,
  Check,
  X,
  ChevronUp,
  ChevronDown,
  Info,
  Phone,
  ArrowRightLeft
} from 'lucide-react'

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

  // Scraper Job lead counts
  const [jobLeadsCounts, setJobLeadsCounts] = useState<Record<string, number>>({})

  // Draft Preview / Edit Modal
  const [viewingLead, setViewingLead] = useState<Lead | null>(null)
  const [draftViewMode, setDraftViewMode] = useState<DraftViewMode>('preview')
  const [editSubject, setEditSubject] = useState('')
  const [editBody, setEditBody] = useState('')
  const [isSavingDraft, setIsSavingDraft] = useState(false)

  // Custom Template Modal State
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [templateSubject, setTemplateSubject] = useState('')
  const [templateBody, setTemplateBody] = useState('')
  const [isApplyingTemplate, setIsApplyingTemplate] = useState(false)
  const [lastFocusedField, setLastFocusedField] = useState<'subject' | 'body'>('body')

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
        setJobs(data.jobs.filter((j: ScraperJob) => ['completed', 'stopped', 'failed'].includes(j.status)))
      }
    } catch (err) {
      console.error('Error fetching jobs:', err)
      toast.error('Failed to load scraper jobs')
    }
  }

  const fetchJobCounts = async () => {
    try {
      const res = await fetch('/api/leads/job-counts')
      const data = await res.json()
      if (res.ok && data.counts) {
        setJobLeadsCounts(data.counts)
      }
    } catch (err) {
      console.error('Error fetching job counts:', err)
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
    fetchJobCounts()
    // Load custom template from localStorage
    const savedSubject = localStorage.getItem('outreach_template_subject')
    const savedBody = localStorage.getItem('outreach_template_body')
    if (savedSubject) setTemplateSubject(savedSubject)
    if (savedBody) setTemplateBody(savedBody)
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
    let lastErrorMessage = ''

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
          if (data.results) {
            const fails = data.results.filter((r: any) => !r.success)
            if (fails.length > 0) {
              lastErrorMessage = fails[0].error || 'Generation failed for some leads'
            }
          }
        } else {
          failedCount += batch.length
          lastErrorMessage = data.error || 'Server error during generation'
        }
        setGenerateProgress({
          done: generatedCount + failedCount,
          total: selectedLeadIds.length,
          label: `${generatedCount} drafted ✓, ${failedCount} failed`
        })
      }
      
      if (failedCount > 0) {
        toast.error(`Drafting finished with issues: Generated ${generatedCount}, Failed ${failedCount}.\nReason: ${lastErrorMessage}`, { id: toastId, duration: 6000 })
      } else {
        toast.success(`🎉 Done! Generated ${generatedCount} drafts`, { id: toastId })
      }
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

  // ─── Custom Template Logic ────────────────────────────────────────────────
  const templatePreview = useMemo(() => {
    const previewLead = leads.find(l => selectedLeadIds.includes(l.id)) || {
      name: 'Acme Corp',
      email: 'contact@acme.com',
      website: 'https://acme.com',
      category: 'Software Solutions',
      city: 'New York',
      rating: 4.8,
      review_count: 142,
      enrichment_fields: {
        contact_person: 'John Doe',
        contact_position: 'Marketing Director'
      }
    }

    const enrichment = previewLead.enrichment_fields || {}
    const replacements: Record<string, string> = {
      '{name}': previewLead.name || '',
      '{email}': previewLead.email || '',
      '{website}': previewLead.website || '',
      '{category}': previewLead.category || '',
      '{city}': previewLead.city || '',
      '{rating}': previewLead.rating ? String(previewLead.rating) : '',
      '{review_count}': previewLead.review_count ? String(previewLead.review_count) : '',
      '{contact_person}': (enrichment as any).contact_person || '',
      '{contact_position}': (enrichment as any).contact_position || '',
    }

    let subject = templateSubject || '(Empty Subject)'
    let body = templateBody || '(Empty Body)'

    Object.entries(replacements).forEach(([placeholder, value]) => {
      const regex = new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
      subject = subject.replace(regex, value)
      body = body.replace(regex, value)
    })

    return { subject, body, leadName: previewLead.name }
  }, [templateSubject, templateBody, leads, selectedLeadIds])

  const insertPlaceholder = (tag: string) => {
    if (lastFocusedField === 'subject') {
      const input = document.getElementById('templateSubjectInput') as HTMLInputElement
      if (input) {
        const start = input.selectionStart || 0
        const end = input.selectionEnd || 0
        const val = templateSubject
        const newVal = val.substring(0, start) + tag + val.substring(end)
        setTemplateSubject(newVal)
        setTimeout(() => {
          input.focus()
          input.setSelectionRange(start + tag.length, start + tag.length)
        }, 10)
      } else {
        setTemplateSubject(prev => prev + tag)
      }
    } else {
      const textarea = document.getElementById('templateBodyInput') as HTMLTextAreaElement
      if (textarea) {
        const start = textarea.selectionStart || 0
        const end = textarea.selectionEnd || 0
        const val = templateBody
        const newVal = val.substring(0, start) + tag + val.substring(end)
        setTemplateBody(newVal)
        setTimeout(() => {
          textarea.focus()
          textarea.setSelectionRange(start + tag.length, start + tag.length)
        }, 10)
      } else {
        setTemplateBody(prev => prev + tag)
      }
    }
  }

  const handleApplyTemplate = async () => {
    if (selectedLeadIds.length === 0) {
      toast.error('Please select at least one lead first.')
      return
    }
    if (!templateSubject.trim() || !templateBody.trim()) {
      toast.error('Please enter both template subject and template body.')
      return
    }

    setIsApplyingTemplate(true)
    const toastId = toast.loading(`Applying template to ${selectedLeadIds.length} selected lead(s)...`)

    // Save template persistently to localStorage
    localStorage.setItem('outreach_template_subject', templateSubject)
    localStorage.setItem('outreach_template_body', templateBody)

    try {
      const selectedLeads = leads.filter(l => selectedLeadIds.includes(l.id))
      
      const payload = selectedLeads.map(lead => {
        const enrichment = lead.enrichment_fields || {}
        const replacements: Record<string, string> = {
          '{name}': lead.name || '',
          '{email}': lead.email || '',
          '{website}': lead.website || '',
          '{category}': lead.category || '',
          '{city}': lead.city || '',
          '{rating}': lead.rating ? String(lead.rating) : '',
          '{review_count}': lead.review_count ? String(lead.review_count) : '',
          '{contact_person}': (enrichment as any).contact_person || '',
          '{contact_position}': (enrichment as any).contact_position || '',
        }

        let subject = templateSubject
        let body = templateBody

        Object.entries(replacements).forEach(([placeholder, value]) => {
          const regex = new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
          subject = subject.replace(regex, value)
          body = body.replace(regex, value)
        })

        return {
          id: lead.id,
          name: lead.name,
          ai_message_email_subject: subject,
          ai_message_email_body: body
        }
      })

      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(`Template applied successfully to ${selectedLeads.length} leads!`, { id: toastId })
        setShowTemplateModal(false)
        await fetchLeads()
      } else {
        throw new Error(data.error || 'Failed to apply template')
      }
    } catch (err: any) {
      toast.error(`Error: ${err.message}`, { id: toastId })
    } finally {
      setIsApplyingTemplate(false)
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="p-4 lg:p-6 space-y-5 min-h-screen text-slate-800 dark:text-white" style={{ background: 'transparent' }}>

      {/* Progress Banner */}
      {generateProgress && (
        <div className="rounded-2xl border border-gray-300 dark:border-[#2D2D30] bg-white dark:bg-[#141416] p-5 space-y-3 shadow-lg">
          <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider text-[#E3B859]">
            <span className="flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#E3B859]" />
              {generateProgress.label}
            </span>
            <span className="font-mono text-slate-800 dark:text-white">
              {generateProgress.done} / {generateProgress.total} &nbsp;
              ({Math.round((generateProgress.done / generateProgress.total) * 100)}%)
            </span>
          </div>
          <div className="w-full bg-gray-100 dark:bg-[#18181A] h-2.5 rounded-full overflow-hidden border border-gray-200 dark:border-[#2D2D30]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-yellow-500 to-[#E3B859] transition-all duration-500"
              style={{ width: `${(generateProgress.done / generateProgress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Send Results Banner */}
      {sendResults && !generateProgress && (
        <div className="rounded-2xl border border-green-200 dark:border-green-800/40 bg-green-50 dark:bg-green-950/20 p-4 flex items-center justify-between shadow-sm">
          <div className="text-xs text-green-800 dark:text-green-300 font-bold flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
            Last send: <span className="text-green-950 dark:text-white">{sendResults.sent} dispatched</span>
            {sendResults.failed > 0 && <span className="text-red-600 dark:text-red-400 ml-2">· {sendResults.failed} failed</span>}
          </div>
          <button onClick={() => setSendResults(null)} className="text-slate-400 hover:text-slate-800 dark:text-gray-500 dark:hover:text-white text-xs">✕</button>
        </div>
      )}

      {/* Header Banner */}
      <div className="relative rounded-2xl overflow-hidden border border-gray-300 dark:border-[#2D2D30] bg-white dark:bg-[#18181A] p-6 shadow-sm">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(227,184,89,0.05),transparent)] pointer-events-none" />
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-5">
          <div className="space-y-1.5">
            <h1 className="text-xl font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2.5">
              <Mail className="w-5 h-5 text-purple-600 dark:text-purple-400" /> AI Email Outreach Portal
            </h1>
            <p className="text-[11px] text-slate-500 dark:text-gray-400 max-w-lg leading-relaxed">
              Select leads from scraper batches, generate personalized AI cold email drafts, preview and edit them, then send seamlessly.
            </p>
          </div>
          <div className="flex gap-2.5">
            <button
              onClick={() => setShowTemplateModal(true)}
              disabled={isGenerating || isSending}
              className="bg-purple-650 hover:bg-purple-700 dark:bg-purple-900/50 dark:hover:bg-purple-900 border border-purple-300 dark:border-purple-800/40 text-white px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all duration-300 shadow-md flex items-center gap-2"
            >
              <FileText className="w-3.5 h-3.5" /> Custom Template
            </button>
            <button
              onClick={handleGenerateOutreach}
              disabled={isGenerating || isSending || selectedLeadIds.length === 0}
              className="bg-[#E3B859] hover:bg-[#d4ac50] disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all duration-300 shadow-md flex items-center gap-2"
            >
              {isGenerating ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" />Drafting…</>
              ) : (
                <><Sparkles className="w-3.5 h-3.5" /> Generate AI Drafts</>
              )}
            </button>
            <button
              onClick={handleSendEmails}
              disabled={isGenerating || isSending || selectedLeadIds.length === 0}
              className="bg-white dark:bg-[#252528] hover:bg-slate-50 dark:hover:bg-[#303035] disabled:opacity-40 disabled:cursor-not-allowed border border-gray-300 dark:border-[#3A3A3D] text-slate-800 dark:text-white px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all duration-300 shadow-md flex items-center gap-2"
            >
              {isSending ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" />Sending…</>
              ) : (
                <><Mail className="w-3.5 h-3.5" /> Send Emails</>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">

        {/* LEFT SIDEBAR */}
        <div className="lg:col-span-1 space-y-4">

          {/* SMTP Config */}
          <div className="rounded-2xl border border-gray-300 dark:border-[#2D2D30] bg-white dark:bg-[#18181A] p-4 shadow-sm space-y-3">
            <button
              type="button"
              onClick={() => setShowConfig(!showConfig)}
              className="w-full flex justify-between items-center select-none group"
            >
              <h2 className="text-[10px] font-black uppercase tracking-widest text-[#E3B859] flex items-center gap-2">
                <Settings className="w-3.5 h-3.5 text-[#E3B859]" /> SMTP Configuration
              </h2>
              <span className="text-slate-400 dark:text-gray-500 group-hover:text-slate-800 dark:group-hover:text-white transition-colors text-[10px]">
                {showConfig ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </span>
            </button>

            {showConfig && (
              <form onSubmit={handleSaveSmtpSettings} className="space-y-3 pt-2.5 border-t border-gray-200 dark:border-[#2D2D30] ">
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-wider text-slate-500 dark:text-gray-500">Sender Email</label>
                  <input
                    type="email"
                    value={smtpUser}
                    onChange={(e) => setSmtpUser(e.target.value)}
                    required
                    placeholder="you@gmail.com"
                    className="w-full bg-slate-50 dark:bg-[#101012] border border-gray-200 dark:border-[#2D2D30] rounded-lg px-3 py-2 text-xs text-slate-850 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-[#E3B859] transition-colors"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-wider text-slate-500 dark:text-gray-500">Gmail App Password</label>
                  <input
                    type="password"
                    value={smtpPass}
                    onChange={(e) => setSmtpPass(e.target.value)}
                    required
                    placeholder="••••••••••••••••"
                    className="w-full bg-slate-50 dark:bg-[#101012] border border-gray-200 dark:border-[#2D2D30] rounded-lg px-3 py-2 text-xs text-slate-850 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-[#E3B859] transition-colors"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-wider text-slate-500 dark:text-gray-500">Display Name</label>
                  <input
                    type="text"
                    value={smtpFromName}
                    onChange={(e) => setSmtpFromName(e.target.value)}
                    placeholder="Your Name"
                    className="w-full bg-slate-50 dark:bg-[#101012] border border-gray-200 dark:border-[#2D2D30] rounded-lg px-3 py-2 text-xs text-slate-850 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-[#E3B859] transition-colors"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSavingSettings}
                  className="w-full bg-[#E3B859] hover:bg-[#d4ac50] disabled:opacity-40 text-slate-950 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
                >
                  {isSavingSettings ? 'Saving…' : 'Save Settings'}
                </button>
              </form>
            )}
          </div>

          {/* Scraper Batches */}
          <div className="rounded-2xl border border-gray-300 dark:border-[#2D2D30] bg-white dark:bg-[#18181A] p-4 shadow-sm space-y-3 flex flex-col">
            <div className="border-b border-gray-200 dark:border-[#2D2D30] pb-3">
              <h2 className="text-[10px] font-black uppercase tracking-widest text-[#E3B859] flex items-center gap-2">
                <Search className="w-3.5 h-3.5 text-[#E3B859]" /> Scraper Batches
              </h2>
              <p className="text-[9px] text-slate-500 dark:text-gray-500 mt-1">Select one or more jobs to load leads.</p>
            </div>

            <div className="space-y-2 overflow-y-auto max-h-[480px] flex-1 pr-0.5">
              {jobs.length === 0 ? (
                <div className="text-center py-8 text-[10px] text-slate-400 dark:text-gray-650 font-bold uppercase tracking-wider">
                  No Completed Jobs Found
                </div>
              ) : (
                jobs.map(job => {
                  const isSelected = selectedJobIds.includes(job.id)
                  const leadCount  = jobLeadsCounts[job.id] || 0
                  return (
                    <div
                      key={job.id}
                      onClick={() => toggleJobSelection(job.id)}
                      className={`p-3 rounded-xl border transition-all duration-200 cursor-pointer flex items-start gap-2.5 select-none ${
                        isSelected
                          ? 'bg-purple-50 dark:bg-[#222225] border-purple-300 dark:border-[#E3B859]/70 shadow-sm'
                          : 'bg-slate-50 dark:bg-[#141416]/50 border-gray-200 dark:border-[#2D2D30] hover:border-gray-400 dark:hover:border-[#4D4D50]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        readOnly
                        className="mt-0.5 accent-[#E3B859] cursor-pointer"
                      />
                      <div className="space-y-0.5 min-w-0 font-sans w-full">
                        <div className="text-[11px] font-black uppercase tracking-wide text-slate-800 dark:text-white truncate">
                          {job.keyword}
                        </div>
                        <div className="text-[9px] text-slate-500 dark:text-gray-500 font-bold uppercase tracking-widest flex items-center gap-1">
                          <MapPin className="w-2.5 h-2.5 text-[#E3B859]" /> {job.city}
                        </div>
                        <div className="text-[9px] text-slate-400 dark:text-gray-600 font-mono flex justify-between items-center w-full">
                          <span>{new Date(job.created_at).toLocaleDateString()}</span>
                          <span className="bg-purple-100 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/30 text-purple-800 dark:text-purple-300 px-1.5 py-0.5 rounded text-[8px] font-black">
                            {leadCount} leads
                          </span>
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
        <div className="lg:col-span-3 rounded-2xl border border-gray-300 dark:border-[#2D2D30] bg-white dark:bg-[#18181A] shadow-sm flex flex-col overflow-hidden">

          {/* Panel Header */}
          <div className="p-4 border-b border-gray-200 dark:border-[#2D2D30] space-y-3">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h2 className="text-[10px] font-black uppercase tracking-widest text-[#E3B859] flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-[#E3B859]" /> Scraped Leads
                  {leads.length > 0 && <span className="text-slate-800 dark:text-white">({filteredLeads.length})</span>}
                </h2>
                <p className="text-[9px] text-slate-500 dark:text-gray-500 mt-0.5">Only leads with verified emails shown. Draft-ready leads appear first.</p>
              </div>

              <div className="relative w-full sm:max-w-[240px]">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search by name or category…"
                  className="w-full bg-slate-50 dark:bg-[#141416] border border-gray-200 dark:border-[#2D2D30] rounded-xl px-4 py-2 text-xs text-slate-800 dark:text-[#E4E3DD] placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-[#E3B859] pl-8 transition-colors"
                />
                <span className="absolute left-3 top-2.5"><Search className="w-3.5 h-3.5 text-slate-400" /></span>
              </div>
            </div>

            {/* Stats Bar */}
            {leads.length > 0 && (
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: 'Total',   value: stats.total,     color: 'text-slate-800 dark:text-gray-300',  icon: <Users className="w-3 h-3 text-slate-500" /> },
                  { label: 'Drafted', value: stats.withDraft, color: 'text-amber-600 dark:text-amber-300', icon: <FileText className="w-3 h-3 text-amber-500" /> },
                  { label: 'Sent',    value: stats.sent,      color: 'text-green-600 dark:text-green-300', icon: <CheckCircle className="w-3 h-3 text-green-500" /> },
                  { label: 'Enriched',value: stats.enriched,  color: 'text-blue-600 dark:text-blue-300',  icon: <Sparkles className="w-3 h-3 text-blue-500" /> },
                ].map(s => (
                  <div key={s.label} className="bg-slate-50 dark:bg-[#141416] border border-gray-200 dark:border-[#2D2D30] rounded-xl p-2.5 text-center">
                    <div className={`text-base font-black ${s.color}`}>{s.value}</div>
                    <div className="text-[8px] text-slate-500 dark:text-gray-500 font-bold uppercase tracking-widest mt-0.5 flex items-center justify-center gap-1">{s.icon} {s.label}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Selection Controls */}
            {filteredLeads.length > 0 && (
              <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-gray-500">
                <label className="flex items-center gap-2 cursor-pointer select-none hover:text-slate-800 dark:hover:text-white transition-colors">
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
                    className="text-slate-450 dark:text-gray-500 hover:text-slate-800 dark:hover:text-white font-bold uppercase tracking-widest transition-colors"
                  >
                    Clear Selection
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Leads List */}
          <div className="flex-1 overflow-y-auto" style={{ maxHeight: '60vh' }}>
            {loadingLeads ? (
              <div className="flex flex-col items-center justify-center h-56 gap-3">
                <Loader2 className="w-7 h-7 text-[#E3B859] animate-spin" />
                <span className="text-[10px] text-slate-450 dark:text-gray-500 uppercase tracking-widest font-black animate-pulse">Loading leads…</span>
              </div>
            ) : selectedJobIds.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-56 text-center gap-2 text-slate-400 dark:text-gray-500">
                <Inbox className="w-8 h-8 opacity-45" />
                <div className="text-[10px] font-black uppercase tracking-widest">Select a scraper batch from the sidebar</div>
              </div>
            ) : filteredLeads.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-56 text-center gap-2.5 text-slate-400 dark:text-gray-500">
                <Inbox className="w-8 h-8 opacity-35" />
                <div className="text-[10px] font-black uppercase tracking-widest">No leads with emails found</div>
                <p className="text-[9px] text-slate-500 dark:text-gray-600 max-w-xs leading-relaxed">
                  Leads without an email address are filtered. Run the enrichment scraper to find emails.
                </p>
              </div>
            ) : (
              <table className="w-full text-left text-[11px] border-collapse">
                <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-[#141416]">
                  <tr className="border-b border-gray-200 dark:border-[#2D2D30] text-slate-500 dark:text-gray-500 font-bold uppercase tracking-wider text-[9px]">
                    <th className="py-3 px-4 w-8" />
                    <th className="py-3 px-4">Lead</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4">Outreach Draft</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-[#1E1E20]">
                  {filteredLeads.map(lead => {
                    const isSelected  = selectedLeadIds.includes(lead.id)
                    const hasDraft    = !!(lead.ai_message_email_subject && lead.ai_message_email_body)
                    const hasEnrichment = lead.enrichment_status === 'completed'
                    const isSent      = lead.status === 'contacted' || lead.status === 'email_sent'

                    return (
                      <tr
                        key={lead.id}
                        className={`transition-colors ${
                          isSelected 
                            ? 'bg-purple-50/30 dark:bg-[#1E1E22]' 
                            : 'hover:bg-slate-50/70 dark:hover:bg-[#1A1A1D]/60'
                        } ${hasDraft ? 'border-l-2 border-l-amber-500/80' : ''}`}
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
                          <div className="font-black text-slate-900 dark:text-white leading-tight">
                            {hasDraft && <span className="text-amber-500 mr-1.5 text-[9px]">●</span>}
                            {lead.name}
                          </div>
                          {lead.website && (
                            <a
                              href={lead.website}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[9px] text-slate-500 hover:text-[#E3B859] dark:text-gray-500 dark:hover:text-[#E3B859] flex items-center gap-1 mt-1 font-normal"
                            >
                              <Globe className="w-2.5 h-2.5 text-slate-400" />
                              {lead.website.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}
                            </a>
                          )}
                        </td>

                        {/* Category */}
                        <td className="py-3 px-4 text-slate-500 dark:text-gray-500 font-bold uppercase tracking-widest text-[9px]">
                          {lead.category || '—'}
                        </td>

                        {/* Email */}
                        <td className="py-3 px-4">
                          <div className="font-mono text-slate-800 dark:text-gray-300 text-[10px] leading-tight">{lead.email}</div>
                          {lead.phone && (
                            <div className="text-[9px] text-slate-500 dark:text-gray-650 font-mono mt-1 flex items-center gap-1">
                              <Phone className="w-2.5 h-2.5 text-slate-400" /> {lead.phone}
                            </div>
                          )}
                        </td>

                        {/* Draft Column */}
                        <td className="py-3 px-4">
                          {hasDraft ? (
                            <button
                              onClick={() => openDraftModal(lead)}
                              className="group flex items-center gap-1 text-amber-600 hover:text-amber-500 dark:text-amber-400 dark:hover:text-amber-300 font-bold text-[10px] transition-colors"
                            >
                              <FileText className="w-3.5 h-3.5 text-amber-500 group-hover:scale-105 transition-transform" />
                              <span className="underline underline-offset-2">View Draft</span>
                            </button>
                          ) : (
                            <span className="text-slate-400 dark:text-gray-600 italic text-[10px]">No draft yet</span>
                          )}
                          {hasEnrichment && !hasDraft && (
                            <div className="text-[8px] text-blue-600 dark:text-blue-400 font-bold uppercase tracking-wider mt-1 flex items-center gap-0.5">
                              <Sparkles className="w-2 h-2 text-blue-500 animate-pulse" /> Enriched
                            </div>
                          )}
                        </td>

                        {/* Status Badge */}
                        <td className="py-3 px-4">
                          {isSent ? (
                            <span className="bg-green-100 dark:bg-green-950/50 border border-green-200 dark:border-green-800/40 text-green-850 dark:text-green-300 px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-wider">
                              ✓ Sent
                            </span>
                          ) : hasDraft ? (
                            <span className="bg-amber-100 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-700/40 text-amber-850 dark:text-amber-300 px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-wider">
                              Draft Ready
                            </span>
                          ) : hasEnrichment ? (
                            <span className="bg-blue-100 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800/40 text-blue-850 dark:text-blue-300 px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-wider">
                              Enriched
                            </span>
                          ) : (
                            <span className="bg-slate-100 dark:bg-[#222225]/60 border border-gray-200 dark:border-[#3A3A3D]/40 text-slate-600 dark:text-gray-450 px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-wider">
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
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={closeDraftModal}>
          <div
            className="bg-white dark:bg-[#1A1A1E] border border-gray-300 dark:border-[#2D2D30] rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 dark:border-[#2D2D30] bg-slate-50 dark:bg-[#141416]">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                  <Mail className="w-4 h-4 text-purple-600 dark:text-purple-400" /> Outreach Draft
                </h3>
                <p className="text-[9px] text-slate-500 dark:text-gray-500 mt-0.5">
                  {viewingLead.name} · <span className="text-[#E3B859] font-bold">{viewingLead.email}</span>
                </p>
              </div>
              <div className="flex items-center gap-2.5">
                {/* Mode toggle */}
                <div className="flex bg-slate-100 dark:bg-[#222225] border border-gray-200 dark:border-[#3A3A3D] rounded-lg overflow-hidden text-[9px] font-black uppercase tracking-widest">
                  <button
                    onClick={() => setDraftViewMode('preview')}
                    className={`px-3 py-1.5 transition-colors ${draftViewMode === 'preview' ? 'bg-[#E3B859] text-slate-950' : 'text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white'}`}
                  >
                    Preview
                  </button>
                  <button
                    onClick={() => setDraftViewMode('edit')}
                    className={`px-3 py-1.5 transition-colors ${draftViewMode === 'edit' ? 'bg-[#E3B859] text-slate-950' : 'text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white'}`}
                  >
                    Edit
                  </button>
                </div>
                <button
                  onClick={closeDraftModal}
                  className="text-slate-450 hover:text-slate-900 dark:text-gray-550 dark:hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Enrichment Context */}
            {viewingLead.enrichment_fields?.business_description && (
              <div className="mx-6 mt-4 bg-purple-50/30 dark:bg-[#141416]/60 border border-purple-100 dark:border-[#2D2D30] rounded-xl p-3 space-y-1.5">
                <div className="text-[8px] font-black uppercase tracking-widest text-[#E3B859] flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5 text-[#E3B859]" /> Business Intelligence
                </div>
                <p className="text-[10px] text-slate-600 dark:text-gray-400 italic leading-relaxed">
                  &ldquo;{viewingLead.enrichment_fields.business_description}&rdquo;
                </p>
                {viewingLead.enrichment_fields.key_offerings && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {viewingLead.enrichment_fields.key_offerings.map(off => (
                      <span key={off} className="bg-slate-100 dark:bg-[#222225] border border-gray-200 dark:border-[#3A3A3D]/50 px-2 py-0.5 rounded text-[8px] text-slate-600 dark:text-gray-300">
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
                  <div className="bg-slate-50 dark:bg-[#141416] border border-gray-200 dark:border-[#2D2D30] rounded-xl p-4">
                    <div className="text-[8px] font-black uppercase tracking-widest text-slate-550 dark:text-gray-500 mb-1.5">Subject</div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white leading-relaxed">{editSubject || '—'}</div>
                  </div>
                  <div className="bg-slate-50 dark:bg-[#141416] border border-gray-200 dark:border-[#2D2D30] rounded-xl p-4">
                    <div className="text-[8px] font-black uppercase tracking-widest text-slate-550 dark:text-gray-500 mb-2">Email Body</div>
                    <div className="text-[11px] text-slate-800 dark:text-gray-300 leading-relaxed whitespace-pre-wrap font-sans">
                      {editBody || '—'}
                    </div>
                  </div>
                </div>
              ) : (
                /* Edit Mode */
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[8px] font-black uppercase tracking-widest text-slate-550 dark:text-gray-500">Subject</label>
                    <input
                      type="text"
                      value={editSubject}
                      onChange={e => setEditSubject(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-[#141416] border border-gray-200 dark:border-[#2D2D30] focus:border-[#E3B859] rounded-xl px-4 py-2.5 text-xs text-slate-850 dark:text-[#E4E3DD] focus:outline-none transition-colors"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-black uppercase tracking-widest text-slate-550 dark:text-gray-500">Email Body</label>
                    <textarea
                      value={editBody}
                      onChange={e => setEditBody(e.target.value)}
                      rows={9}
                      className="w-full bg-slate-50 dark:bg-[#141416] border border-gray-200 dark:border-[#2D2D30] focus:border-[#E3B859] rounded-xl px-4 py-3 text-[11px] text-slate-850 dark:text-[#E4E3DD] focus:outline-none font-mono leading-relaxed transition-colors resize-none"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-2.5 px-6 pb-5">
              <button
                onClick={closeDraftModal}
                className="bg-slate-100 dark:bg-[#222225] hover:bg-slate-200 dark:hover:bg-[#2D2D30] text-slate-650 dark:text-gray-300 hover:text-slate-900 dark:hover:text-white px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors"
              >
                Close
              </button>
              {draftViewMode === 'edit' && (
                <button
                  onClick={handleSaveDraft}
                  disabled={isSavingDraft}
                  className="bg-[#E3B859] hover:bg-[#d4ac50] disabled:opacity-40 text-slate-950 px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-md"
                >
                  {isSavingDraft ? 'Saving…' : 'Save Draft'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Custom Template Modal ─────────────────────────────────────────── */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowTemplateModal(false)}>
          <div
            className="bg-white dark:bg-[#1A1A1E] border border-gray-300 dark:border-[#2D2D30] rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col md:grid md:grid-cols-2 max-h-[90vh]"
            onClick={e => e.stopPropagation()}
          >
            {/* Template Designer Form (Left Side) */}
            <div className="p-6 space-y-4 overflow-y-auto max-h-[85vh] md:max-h-[90vh] flex flex-col justify-between border-b md:border-b-0 md:border-r border-gray-250 dark:border-[#2D2D30]">
              <div className="space-y-4">
                <div className="flex justify-between items-start border-b border-gray-200 dark:border-[#2D2D30] pb-3">
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                      <FileText className="w-4 h-4 text-purple-650 dark:text-purple-400" /> Outreach Template Designer
                    </h3>
                    <p className="text-[9px] text-slate-500 dark:text-gray-500 mt-0.5">
                      Create a dynamic template with placeholders to customize messages for each lead.
                    </p>
                  </div>
                </div>

                {/* Placeholder Selector */}
                <div className="space-y-2 bg-slate-50/50 dark:bg-[#141416]/50 p-3 border border-gray-200 dark:border-[#2D2D30] rounded-xl">
                  <span className="text-[9px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider block">Placeholders (Click to insert)</span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { tag: '{name}', label: 'Lead Name' },
                      { tag: '{email}', label: 'Email' },
                      { tag: '{website}', label: 'Website' },
                      { tag: '{category}', label: 'Category' },
                      { tag: '{city}', label: 'City' },
                      { tag: '{rating}', label: 'Rating' },
                      { tag: '{review_count}', label: 'Reviews' },
                      { tag: '{contact_person}', label: 'Contact Name' },
                      { tag: '{contact_position}', label: 'Position' }
                    ].map(p => (
                      <button
                        key={p.tag}
                        type="button"
                        onClick={() => insertPlaceholder(p.tag)}
                        className="px-2 py-1 text-[8px] font-mono font-bold bg-purple-50 dark:bg-purple-950/40 text-purple-705 dark:text-purple-350 border border-purple-200 dark:border-purple-800/40 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
                      >
                        {p.tag} <span className="text-[7px] opacity-60 font-sans font-normal font-mono">({p.label})</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Form Inputs */}
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[8px] font-black uppercase tracking-widest text-slate-550 dark:text-gray-500">Template Subject</label>
                    <input
                      id="templateSubjectInput"
                      type="text"
                      value={templateSubject}
                      onChange={e => setTemplateSubject(e.target.value)}
                      onFocus={() => setLastFocusedField('subject')}
                      placeholder="e.g. Partnership opportunity for {name} in {city}"
                      className="w-full bg-slate-50 dark:bg-[#141416] border border-gray-200 dark:border-[#2D2D30] focus:border-[#E3B859] rounded-xl px-4 py-2.5 text-xs text-slate-850 dark:text-[#E4E3DD] focus:outline-none transition-colors"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-black uppercase tracking-widest text-slate-550 dark:text-gray-500">Template Body</label>
                    <textarea
                      id="templateBodyInput"
                      value={templateBody}
                      onChange={e => setTemplateBody(e.target.value)}
                      onFocus={() => setLastFocusedField('body')}
                      rows={10}
                      placeholder={`e.g. Hi {contact_person},\n\nI noticed {name} is offering amazing services in {city}...`}
                      className="w-full bg-slate-50 dark:bg-[#141416] border border-gray-200 dark:border-[#2D2D30] focus:border-[#E3B859] rounded-xl px-4 py-3 text-[11px] text-slate-850 dark:text-[#E4E3DD] focus:outline-none font-mono leading-relaxed transition-colors resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2.5 pt-4 border-t border-gray-200 dark:border-[#2D2D30]">
                <button
                  type="button"
                  onClick={() => setShowTemplateModal(false)}
                  className="bg-slate-100 dark:bg-[#222225] hover:bg-slate-200 dark:hover:bg-[#2D2D30] text-slate-650 dark:text-gray-300 hover:text-slate-900 dark:hover:text-white px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApplyTemplate}
                  disabled={isApplyingTemplate || selectedLeadIds.length === 0}
                  className="bg-purple-650 hover:bg-purple-700 disabled:opacity-40 text-white px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-md"
                >
                  {isApplyingTemplate ? 'Applying…' : `Apply to Selected Leads (${selectedLeadIds.length})`}
                </button>
              </div>
            </div>

            {/* Live Preview Panel (Right Side) */}
            <div className="bg-slate-550/5 dark:bg-[#141416]/50 p-6 flex flex-col space-y-4 font-sans h-full max-h-[85vh] md:max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center border-b border-gray-200 dark:border-[#2D2D30] pb-3">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-[#E3B859] flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#E3B859] animate-pulse" /> Live Dynamic Preview
                  </h3>
                  <p className="text-[9px] text-slate-500 dark:text-gray-500 mt-0.5">
                    Showing dynamic preview for: <span className="text-slate-850 dark:text-white font-bold">{templatePreview.leadName}</span>
                  </p>
                </div>
              </div>

              {selectedLeadIds.length === 0 && (
                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-xl p-3 flex items-center gap-2.5 text-[10px] text-amber-800 dark:text-amber-300 leading-relaxed font-sans">
                  <Info className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <span>
                    No leads are currently selected on the main page. Showing a mock preview. Select leads to apply this template to them.
                  </span>
                </div>
              )}

              <div className="border border-gray-200 dark:border-[#2D2D30] rounded-xl bg-white dark:bg-[#0E0E10] overflow-hidden flex flex-col flex-1 shadow-sm min-h-[300px]">
                {/* Subject Preview */}
                <div className="px-4 py-3 border-b border-gray-150 dark:border-[#2D2D30] bg-slate-50/50 dark:bg-[#121214] text-[10px]">
                  <span className="text-slate-400 font-bold mr-1.5 uppercase tracking-wide">Subject:</span>
                  <span className="text-slate-900 dark:text-white font-bold">{templatePreview.subject}</span>
                </div>
                {/* Body Preview */}
                <div className="p-4 text-[11px] text-slate-850 dark:text-gray-300 whitespace-pre-wrap leading-relaxed font-sans flex-1 overflow-y-auto max-h-[350px]">
                  {templatePreview.body}
                </div>
              </div>

              <div className="text-[9px] text-slate-400 dark:text-gray-600 leading-relaxed italic border-t border-gray-200 dark:border-[#2D2D30] pt-3">
                💡 Placeholders are case-insensitive. If any value (like Website or Contact) is missing for a lead, it will render as empty.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
