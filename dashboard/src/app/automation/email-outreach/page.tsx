'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import toast from 'react-hot-toast'
import { GeminiKeyModal } from '@/components/gemini-key-modal'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
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
  Send,
  RefreshCw,
  Eye,
  Edit,
  Key
} from 'lucide-react'

interface ScraperJob {
  id: string
  keyword: string
  city: string
  created_at: string
  status: string
  subJobs?: ScraperJob[]
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
  const [geminiModalOpen, setGeminiModalOpen] = useState(false)

  // Scraper Job lead counts
  const [jobLeadsCounts, setJobLeadsCounts] = useState<Record<string, number>>({})

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

  const fetchJobs = async () => {
    try {
      const res = await fetch('/api/scraper/jobs')
      const data = await res.json()
      if (res.ok && data.jobs) {
        setJobs(data.jobs.filter((j: ScraperJob) => ['completed', 'stopped', 'failed'].includes(j.status)))
      }
    } catch (err) {
      console.error('Error fetching jobs:', err)
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

  const fetchLeads = useCallback(async (silent = false) => {
    if (selectedJobIds.length === 0) {
      setLeads([])
      return
    }
    if (!silent) setLoadingLeads(true)
    try {
      const resolvedJobIds: string[] = []
      selectedJobIds.forEach(id => {
        const job = jobs.find(j => j.id === id)
        if (job && job.subJobs && job.subJobs.length > 0) {
          job.subJobs.forEach((sj: ScraperJob) => resolvedJobIds.push(sj.id))
        } else {
          resolvedJobIds.push(id)
        }
      })
      const jobIdsParam = resolvedJobIds.join(',')
      const res = await fetch(`/api/leads?job_ids=${jobIdsParam}&has_email=true&limit=500`)
      const data = await res.json()
      if (res.ok && data.leads) {
        setLeads(data.leads)
      }
    } catch (err) {
      console.error('Error fetching leads:', err)
    } finally {
      if (!silent) setLoadingLeads(false)
    }
  }, [selectedJobIds, jobs])

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
  }, [])

  useEffect(() => {
    fetchLeads()
  }, [fetchLeads])

  const filteredLeads = useMemo(() => {
    const q = searchQuery.toLowerCase()
    return leads.filter(l =>
      l.name.toLowerCase().includes(q) ||
      (l.category && l.category.toLowerCase().includes(q))
    )
  }, [leads, searchQuery])

  const stats = useMemo(() => {
    const total     = leads.length
    const withDraft = leads.filter(l => l.ai_message_email_subject && l.ai_message_email_body).length
    const sent      = leads.filter(l => l.status === 'contacted' || l.status === 'email_sent').length
    const enriched  = leads.filter(l => l.enrichment_status === 'completed').length
    return { total, withDraft, sent, enriched }
  }, [leads])

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

  const handleSaveSmtpSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSavingSettings(true)
    const toastId = toast.loading('Saving SMTP configuration...')
    try {
      const res = await fetch('/api/meta/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: {
            SMTP_USER: smtpUser,
            SMTP_PASS: smtpPass,
            SMTP_FROM_NAME: smtpFromName
          }
        })
      })
      if (res.ok) {
        toast.success('SMTP configuration saved!', { id: toastId })
        setShowConfig(false)
      } else {
        throw new Error('Failed to save settings')
      }
    } catch (err: any) {
      toast.error(err.message, { id: toastId })
    } finally {
      setIsSavingSettings(false)
    }
  }

  // Generate AI Email Drafts via Gemini
  const handleGenerateDrafts = async () => {
    const targetIds = selectedLeadIds.length > 0 ? selectedLeadIds : filteredLeads.map(l => l.id)
    if (targetIds.length === 0) {
      toast.error('No leads selected for AI draft generation')
      return
    }

    setIsGenerating(true)
    setGenerateProgress({ done: 0, total: targetIds.length, label: 'Generating email drafts with Gemini...' })
    const toastId = toast.loading(`Generating AI drafts for ${targetIds.length} leads...`)

    let completed = 0
    for (const leadId of targetIds) {
      try {
        await fetch('/api/leads/generate-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leadId })
        })
        completed++
        setGenerateProgress({ done: completed, total: targetIds.length, label: `Generated ${completed}/${targetIds.length}` })
      } catch (err) {
        console.error(`Draft gen failed for ${leadId}:`, err)
      }
    }

    toast.success(`Generated ${completed} AI drafts with Gemini!`, { id: toastId })
    setIsGenerating(false)
    setGenerateProgress(null)
    fetchLeads(true)
  }

  // Send Emails
  const handleSendEmails = async () => {
    const targetIds = selectedLeadIds.length > 0 ? selectedLeadIds : filteredLeads.filter(l => l.ai_message_email_subject).map(l => l.id)
    if (targetIds.length === 0) {
      toast.error('No lead drafts ready to send')
      return
    }

    setIsSending(true)
    const toastId = toast.loading(`Sending ${targetIds.length} emails...`)
    let sentCount = 0
    let failedCount = 0

    for (const leadId of targetIds) {
      try {
        const res = await fetch('/api/leads/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leadId })
        })
        if (res.ok) sentCount++
        else failedCount++
      } catch {
        failedCount++
      }
    }

    toast.success(`Outreach complete! Sent: ${sentCount}, Failed: ${failedCount}`, { id: toastId })
    setIsSending(false)
    fetchLeads(true)
  }

  return (
    <div className="space-y-6">
      {/* Reusable Gemini API Key Modal */}
      <GeminiKeyModal open={geminiModalOpen} onOpenChange={setGeminiModalOpen} />

      {/* Header & Control Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-xl border border-border bg-card">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
            <Mail className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">Email Outreach Engine</h1>
            <p className="text-xs text-muted-foreground">Scrape leads, generate tailored Gemini AI drafts, and execute cold email campaigns.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Inline Gemini API Key button as requested */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setGeminiModalOpen(true)}
            className="gap-1.5 border-blue-500/30 text-blue-400 bg-blue-500/10 hover:bg-blue-500/20"
          >
            <Sparkles className="w-4 h-4" />
            <span>Set Gemini Key</span>
          </Button>

          <Button variant="outline" size="sm" onClick={() => setShowConfig(!showConfig)} className="gap-1.5">
            <Settings className="w-4 h-4" />
            <span>SMTP Settings</span>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={isGenerating}
            onClick={handleGenerateDrafts}
            className="gap-1.5 text-purple-400 bg-purple-500/10 border border-purple-500/30 hover:bg-purple-500/20"
          >
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            <span>Generate Gemini AI Drafts</span>
          </Button>
          <Button
            size="sm"
            disabled={isSending}
            onClick={handleSendEmails}
            className="gap-1.5"
          >
            {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            <span>Send Email Outreach</span>
          </Button>
        </div>
      </div>

      {/* SMTP Config Drawer/Card */}
      {showConfig && (
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Settings className="w-4 h-4 text-primary" />
              SMTP Credentials & Sender Configuration
            </CardTitle>
            <CardDescription>Configure your custom SMTP provider details for outbound outreach.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveSmtpSettings} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">Sender Display Name</label>
                <Input value={smtpFromName} onChange={e => setSmtpFromName(e.target.value)} placeholder="e.g. Stratnent Growth" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">SMTP Email Username</label>
                <Input value={smtpUser} onChange={e => setSmtpUser(e.target.value)} placeholder="outreach@company.com" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">SMTP App Password</label>
                <Input type="password" value={smtpPass} onChange={e => setSmtpPass(e.target.value)} placeholder="••••••••••••" />
              </div>
              <div className="sm:col-span-3 flex justify-end gap-2">
                <Button variant="outline" size="sm" type="button" onClick={() => setShowConfig(false)}>Cancel</Button>
                <Button size="sm" type="submit" disabled={isSavingSettings}>Save Configuration</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Leads</p>
              <p className="text-xl font-bold text-foreground mt-0.5">{stats.total}</p>
            </div>
            <div className="p-2 rounded-lg bg-secondary text-foreground"><Users className="w-4 h-4" /></div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Enriched</p>
              <p className="text-xl font-bold text-foreground mt-0.5">{stats.enriched}</p>
            </div>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400"><CheckCircle className="w-4 h-4" /></div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">AI Drafts Ready</p>
              <p className="text-xl font-bold text-foreground mt-0.5">{stats.withDraft}</p>
            </div>
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400"><Sparkles className="w-4 h-4" /></div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Outreach Sent</p>
              <p className="text-xl font-bold text-foreground mt-0.5">{stats.sent}</p>
            </div>
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400"><Mail className="w-4 h-4" /></div>
          </CardContent>
        </Card>
      </div>

      {/* Main Grid: Job Selector (4 cols) + Leads Table (8 cols) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Scraper Job Selector Card */}
        <Card className="md:col-span-4 flex flex-col h-[520px]">
          <CardHeader className="p-4 border-b border-border">
            <CardTitle className="text-xs font-semibold">Select Scraper Target Jobs</CardTitle>
            <CardDescription>Filter leads by past google scraper execution runs.</CardDescription>
          </CardHeader>
          <CardContent className="p-2 flex-1 overflow-y-auto space-y-1">
            {jobs.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">No scraper jobs found.</div>
            ) : (
              jobs.map(job => {
                const isSelected = selectedJobIds.includes(job.id)
                const count = jobLeadsCounts[job.id] || 0
                return (
                  <div
                    key={job.id}
                    onClick={() => toggleJobSelection(job.id)}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors flex items-center justify-between text-xs ${
                      isSelected 
                        ? 'border-primary bg-primary/10 text-foreground font-medium' 
                        : 'border-border bg-card text-muted-foreground hover:bg-accent'
                    }`}
                  >
                    <div>
                      <p className="font-semibold text-foreground">{job.keyword} <span className="text-muted-foreground font-normal">({job.city})</span></p>
                      <p className="text-[10px] text-muted-foreground">{new Date(job.created_at).toLocaleDateString()}</p>
                    </div>
                    <Badge variant={isSelected ? "default" : "secondary"}>{count} leads</Badge>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>

        {/* Lead Records Table Card */}
        <Card className="md:col-span-8 flex flex-col h-[520px]">
          <CardHeader className="p-4 border-b border-border flex flex-row items-center justify-between">
            <div className="flex items-center gap-2 flex-1 max-w-sm">
              <Search className="w-4 h-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search leads by name or category..."
                className="h-8"
              />
            </div>
            <div className="text-xs text-muted-foreground">
              Showing <span className="font-semibold text-foreground">{filteredLeads.length}</span> leads
            </div>
          </CardHeader>

          <CardContent className="p-0 flex-1 overflow-y-auto">
            {loadingLeads ? (
              <div className="p-4 space-y-2">
                {[1,2,3,4,5].map(i => <div key={i} className="h-10 rounded-md bg-muted animate-pulse" />)}
              </div>
            ) : filteredLeads.length === 0 ? (
              <div className="p-12 text-center text-xs text-muted-foreground space-y-1">
                <Users className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
                <p className="font-medium text-foreground">No leads available</p>
                <p>Select target jobs on the left sidebar to view leads.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredLeads.map(lead => {
                  const isSelected = selectedLeadIds.includes(lead.id)
                  const hasDraft = !!(lead.ai_message_email_subject && lead.ai_message_email_body)
                  const isSent = lead.status === 'contacted' || lead.status === 'email_sent'
                  return (
                    <div
                      key={lead.id}
                      className={`p-3.5 flex items-center justify-between hover:bg-accent/40 transition-colors text-xs ${
                        isSelected ? 'bg-accent/60' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleLeadSelection(lead.id)}
                          className="rounded border-input text-primary focus:ring-ring"
                        />
                        <div>
                          <p className="font-semibold text-foreground">{lead.name}</p>
                          <p className="text-[11px] text-muted-foreground">{lead.email || 'No email'} · {lead.category || 'Local Business'}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {isSent ? (
                          <Badge variant="success">Email Sent</Badge>
                        ) : hasDraft ? (
                          <Badge variant="secondary" className="text-purple-400 border-purple-500/20 bg-purple-500/10">Draft Ready</Badge>
                        ) : (
                          <Badge variant="outline">Pending</Badge>
                        )}
                        {hasDraft && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setViewingLead(lead)}
                            className="h-7 px-2 text-[11px]"
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" /> View Draft
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Viewing / Editing Draft Modal */}
      {viewingLead && (
        <Dialog open={!!viewingLead} onOpenChange={() => setViewingLead(null)}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              Gemini AI Email Draft — {viewingLead.name}
            </DialogTitle>
            <DialogDescription>Review or customize the AI generated subject and body prior to sending.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">Email Subject</label>
              <Input
                value={editSubject || viewingLead.ai_message_email_subject || ''}
                onChange={e => setEditSubject(e.target.value)}
                className="font-medium"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">Email Body Content</label>
              <textarea
                rows={6}
                value={editBody || viewingLead.ai_message_email_body || ''}
                onChange={e => setEditBody(e.target.value)}
                className="w-full rounded-md border border-input bg-background p-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring font-sans"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingLead(null)}>Close</Button>
          </DialogFooter>
        </Dialog>
      )}
    </div>
  )
}
