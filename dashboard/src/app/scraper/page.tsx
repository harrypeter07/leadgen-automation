'use client'

import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'

import { supabaseBrowser } from '@/lib/supabase'

interface ScrapedLead {
  name: string
  phone: string | null
  email: string | null
  address: string | null
  city: string | null
  category: string | null
  website: string | null
  rating: number | null
  review_count: number | null
  source: string
  status: string
}

interface ScrapeJob {
  id: string
  created_at: string
  keyword: string
  city: string
  max_leads: number
  status: 'queued' | 'running' | 'paused' | 'stopped' | 'completed' | 'failed'
  progress: number
  current_business: string | null
  current_provider: string
  error_count: number
  started_at: string | null
  completed_at: string | null
  duration_seconds: number | null
  estimated_remaining_seconds: number | null
  logs: string[]
  created_by: string
  worker_count: number
  scraped_leads: ScrapedLead[] | null
}

export default function ScraperPage() {
  // Create Job States
  const [provider, setProvider] = useState('google_maps')
  const [keyword, setKeyword] = useState('dentist')
  const [area, setArea] = useState('')
  const [city, setCity] = useState('Mumbai')
  const [maxLeads, setMaxLeads] = useState(25)
  const [workerCount, setWorkerCount] = useState(1)
  const [queuing, setQueuing] = useState(false)

  // Helper to parse keyword brackets notation
  const parseKeywordAndArea = (rawKeyword: string) => {
    if (!rawKeyword) return { keyword: '', area: null }
    const match = rawKeyword.match(/^(.*?)\s*\[Area:\s*(.*?)\]$/)
    if (match) {
      return { keyword: match[1], area: match[2] }
    }
    return { keyword: rawKeyword, area: null }
  }

  // Manual entry states (Preserved Feature)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [leadCity, setLeadCity] = useState('')
  const [category, setCategory] = useState('')
  const [website, setWebsite] = useState('')
  const [addingLead, setAddingLead] = useState(false)

  // Job List and Polling
  const [jobs, setJobs] = useState<ScrapeJob[]>([])
  const [loadingJobs, setLoadingJobs] = useState(true)
  const [selectedJob, setSelectedJob] = useState<ScrapeJob | null>(null)
  // Per-job selected lead indices for checkboxes (jobId -> Set of indices)
  const [selectedLeadIndices, setSelectedLeadIndices] = useState<Record<string, Set<number>>>({})
  const [savingLeads, setSavingLeads] = useState<Record<string, boolean>>({})

  // Fetch all jobs — scraped_leads come embedded in the job record (JSONB)
  async function fetchJobs() {
    try {
      const res = await fetch('/api/scraper/jobs')
      const data = await res.json()
      if (res.ok && data.jobs) {
        setJobs(data.jobs)
        // Keep selected job in sync with poll
        if (selectedJob) {
          const updated = data.jobs.find((j: ScrapeJob) => j.id === selectedJob.id)
          if (updated) setSelectedJob(updated)
        }
      }
    } catch (err) {
      console.error('Failed to fetch jobs:', err)
    } finally {
      setLoadingJobs(false)
    }
  }

  // Toggle a lead index selection for a job
  function toggleLeadSelection(jobId: string, index: number) {
    setSelectedLeadIndices(prev => {
      const current = new Set(prev[jobId] || [])
      if (current.has(index)) current.delete(index)
      else current.add(index)
      return { ...prev, [jobId]: current }
    })
  }

  function toggleSelectAll(jobId: string, total: number) {
    setSelectedLeadIndices(prev => {
      const current = prev[jobId] || new Set()
      const allSelected = current.size === total
      return { ...prev, [jobId]: allSelected ? new Set() : new Set(Array.from({ length: total }, (_, i) => i)) }
    })
  }

  // Save selected (or all) scraped_leads from the job record to the leads table
  async function handleSaveLeads(jobId: string, totalLeads: number) {
    setSavingLeads(prev => ({ ...prev, [jobId]: true }))
    const toastId = toast.loading('Saving leads to database...')
    try {
      const sel = selectedLeadIndices[jobId]
      const body = sel && sel.size > 0 && sel.size < totalLeads
        ? { indices: Array.from(sel) }
        : {}

      const res = await fetch(`/api/scraper/${jobId}/save-leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')

      toast.success(`✅ ${data.message}`, { id: toastId, duration: 5000 })
      if (data.warnings?.length > 0) {
        data.warnings.forEach((w: string) => toast(`⚠️ ${w}`, { duration: 4000 }))
      }
      // Clear selection and refresh jobs (scraped_leads will be empty now)
      setSelectedLeadIndices(prev => ({ ...prev, [jobId]: new Set() }))
      fetchJobs()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save'
      toast.error(msg, { id: toastId })
    } finally {
      setSavingLeads(prev => ({ ...prev, [jobId]: false }))
    }
  }

  // Poll jobs every 5 seconds — scraped_leads come embedded in job records
  useEffect(() => {
    fetchJobs()
    const interval = setInterval(fetchJobs, 5000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Queue a new job
  async function handleQueueJob(e: React.FormEvent) {
    e.preventDefault()
    if (!keyword.trim() || !city.trim()) {
      toast.error('Keyword and City are required')
      return
    }

    setQueuing(true)
    const toastId = toast.loading('Queueing scrape job...')
    try {
      const res = await fetch('/api/scraper/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: keyword.trim(),
          city: city.trim(),
          area: area.trim() || undefined,
          maxLeads,
          workerCount,
          provider
        })
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to queue job')
      }

      toast.success('Scrape job successfully queued!', { id: toastId })
      setArea('') // clear area state
      fetchJobs()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error starting job'
      toast.error(msg, { id: toastId })
    } finally {
      setQueuing(false)
    }
  }

  // Pause a job
  async function handlePauseJob(jobId: string) {
    try {
      const res = await fetch('/api/scraper/pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId })
      })
      const data = await res.json()
      if (res.ok) {
        toast.success('Job paused')
        fetchJobs()
      } else {
        toast.error(data.error || 'Failed to pause')
      }
    } catch {
      toast.error('Error sending request')
    }
  }

  // Resume a job
  async function handleResumeJob(jobId: string) {
    try {
      const res = await fetch('/api/scraper/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId })
      })
      const data = await res.json()
      if (res.ok) {
        toast.success('Job resumed')
        fetchJobs()
      } else {
        toast.error(data.error || 'Failed to resume')
      }
    } catch {
      toast.error('Error sending request')
    }
  }

  // Stop a job
  async function handleStopJob(jobId: string) {
    try {
      const res = await fetch('/api/scraper/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId })
      })
      const data = await res.json()
      if (res.ok) {
        toast.success('Job stopped')
        fetchJobs()
      } else {
        toast.error(data.error || 'Failed to stop')
      }
    } catch {
      toast.error('Error sending request')
    }
  }

  // Retry / Clone a job
  async function handleRetryJob(jobId: string) {
    try {
      const res = await fetch('/api/scraper/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId })
      })
      const data = await res.json()
      if (res.ok) {
        toast.success('New retry job queued')
        fetchJobs()
      } else {
        toast.error(data.error || 'Failed to retry')
      }
    } catch {
      toast.error('Error sending request')
    }
  }

  // Manual Quick Add Lead
  async function handleQuickAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Name is a required field')
      return
    }

    setAddingLead(true)
    const toastId = toast.loading('Adding lead to database...')
    try {
      const res = await fetch('/api/leads/quick-add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim() || null,
          email: email.trim() || null,
          city: leadCity.trim() || null,
          category: category.trim() || null,
          website: website.trim() || null,
          source: 'manual_entry',
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit lead')
      }

      if (data.warning) {
        toast.success('Lead saved (duplicate warning)', { id: toastId })
        toast(data.warning, { icon: '⚠️', duration: 6000 })
      } else {
        toast.success('Lead added successfully directly to database!', { id: toastId })
      }

      setName('')
      setPhone('')
      setEmail('')
      setLeadCity('')
      setCategory('')
      setWebsite('')
      fetchRecentLeads() // reload list to show new manual lead
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to submit lead'
      toast.error(message, { id: toastId })
    } finally {
      setAddingLead(false)
    }
  }

  const activeJob = jobs.find(j => j.status === 'running')

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Cloud Scraper Console</h1>
        <p className="mt-1 text-sm text-gray-400">Deploy, manage, and monitor background Maps scraping jobs directly in the cloud.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column: Forms */}
        <div className="lg:col-span-1 space-y-6">
          {/* Create Job Form */}
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
            <h3 className="font-bold text-gray-200 text-lg mb-4">🚀 Start Scrape Job</h3>
            <form onSubmit={handleQueueJob} className="space-y-4">
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 mb-1 uppercase tracking-wider">Provider</label>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  className="w-full rounded-lg bg-gray-950 border border-gray-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="google_maps">🗺️ Google Maps Scraper</option>
                  <option value="google_search">🔍 Google Search Scraper</option>
                  <option value="instagram">📸 Instagram Scraper</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-gray-400 mb-1 uppercase tracking-wider">Keyword</label>
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="e.g. dentist, cafe, hotel"
                  required
                  className="w-full rounded-lg bg-gray-950 border border-gray-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-gray-400 mb-1 uppercase tracking-wider">Area (Optional)</label>
                <input
                  type="text"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  placeholder="e.g. Andheri, Bandra, Juhu"
                  className="w-full rounded-lg bg-gray-950 border border-gray-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-gray-400 mb-1 uppercase tracking-wider">City</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Mumbai, Nagpur, Pune"
                  required
                  className="w-full rounded-lg bg-gray-950 border border-gray-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 mb-1 uppercase tracking-wider">Max Leads</label>
                  <input
                    type="number"
                    value={maxLeads}
                    onChange={(e) => setMaxLeads(parseInt(e.target.value, 10) || 10)}
                    min="1"
                    className="w-full rounded-lg bg-gray-950 border border-gray-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 mb-1 uppercase tracking-wider">Worker Tabs</label>
                  <select
                    value={workerCount}
                    onChange={(e) => setWorkerCount(parseInt(e.target.value, 10) || 1)}
                    className="w-full rounded-lg bg-gray-950 border border-gray-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value={1}>1 Worker (Sequential)</option>
                    <option value={2}>2 Workers (Tabs)</option>
                    <option value={4}>4 Workers (Tabs)</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={queuing}
                className="w-full rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold text-white py-2.5 mt-2 transition-colors"
              >
                {queuing ? 'Queueing...' : 'Queue Scrape Job'}
              </button>
            </form>
          </div>

          {/* Manual Entry Form */}
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
            <h3 className="font-bold text-gray-200 text-lg mb-2">✏️ Manual Lead Entry</h3>
            <p className="text-[10px] text-gray-400 mb-4">Direct database bypass intake pipeline</p>
            <form onSubmit={handleQuickAdd} className="space-y-3">
              <div>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Business Name *"
                  required
                  className="w-full rounded-lg bg-gray-950 border border-gray-800 px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-purple-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Phone (e.g. +91...)"
                  className="w-full rounded-lg bg-gray-950 border border-gray-800 px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-purple-500"
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  className="w-full rounded-lg bg-gray-950 border border-gray-800 px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-purple-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  value={leadCity}
                  onChange={(e) => setLeadCity(e.target.value)}
                  placeholder="City"
                  className="w-full rounded-lg bg-gray-950 border border-gray-800 px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-purple-500"
                />
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Category"
                  className="w-full rounded-lg bg-gray-950 border border-gray-800 px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-purple-500"
                />
              </div>
              <input
                type="text"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="Website URL"
                className="w-full rounded-lg bg-gray-950 border border-gray-800 px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-purple-500"
              />
              <button
                type="submit"
                disabled={addingLead}
                className="flex items-center justify-center gap-2 w-full rounded-lg bg-gray-850 hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold text-white py-2.5 transition-colors"
              >
                Add Lead
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Live Status & History */}
        <div className="lg:col-span-2 space-y-6">
          {/* Active Job status */}
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
            <h3 className="font-bold text-gray-200 text-lg mb-4 flex items-center justify-between">
              <span>⚡ Live Scraping Progress</span>
              {activeJob && (
                <span className="flex items-center gap-1.5 text-xs text-green-400 font-semibold uppercase tracking-wider animate-pulse">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                  Active
                </span>
              )}
            </h3>

            {activeJob ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="rounded-lg bg-gray-950/80 p-3 border border-gray-850">
                    <span className="text-gray-500 uppercase font-semibold text-[10px]">Keyword</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="font-bold text-gray-200 text-sm">{parseKeywordAndArea(activeJob.keyword).keyword}</p>
                      {parseKeywordAndArea(activeJob.keyword).area && (
                        <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 font-semibold text-[9px] uppercase">
                          📍 {parseKeywordAndArea(activeJob.keyword).area}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="rounded-lg bg-gray-950/80 p-3 border border-gray-850">
                    <span className="text-gray-500 uppercase font-semibold text-[10px]">City</span>
                    <p className="font-bold text-gray-200 text-sm">{activeJob.city}</p>
                  </div>
                </div>

                {/* Progress bar */}
                <div>
                  <div className="flex justify-between text-xs font-medium text-gray-400 mb-1.5">
                    <span>Collecting details...</span>
                    <span>{activeJob.progress} / {activeJob.max_leads} Leads ({Math.round((activeJob.progress / activeJob.max_leads) * 100)}%)</span>
                  </div>
                  <div className="w-full bg-gray-950 rounded-full h-3.5 overflow-hidden border border-gray-850 p-0.5">
                    <div
                      className="bg-purple-600 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, (activeJob.progress / activeJob.max_leads) * 100)}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-md bg-gray-950/40 p-2.5 border border-gray-850">
                    <span className="text-gray-500 uppercase font-semibold text-[9px] block">ETA</span>
                    <span className="font-bold text-gray-300">
                      {activeJob.estimated_remaining_seconds 
                        ? `${Math.round(activeJob.estimated_remaining_seconds)}s` 
                        : 'Calculating...'}
                    </span>
                  </div>
                  <div className="rounded-md bg-gray-950/40 p-2.5 border border-gray-850">
                    <span className="text-gray-500 uppercase font-semibold text-[9px] block">Workers</span>
                    <span className="font-bold text-gray-300">{activeJob.worker_count} Tab(s)</span>
                  </div>
                  <div className="rounded-md bg-gray-950/40 p-2.5 border border-gray-850">
                    <span className="text-gray-500 uppercase font-semibold text-[9px] block">Errors</span>
                    <span className="font-bold text-red-400">{activeJob.error_count}</span>
                  </div>
                </div>

                <div className="rounded-lg bg-purple-950/20 border border-purple-900/30 p-3 text-xs flex items-center justify-between">
                  <span className="text-purple-300">Current Listing:</span>
                  <span className="font-bold text-white max-w-[200px] truncate">{activeJob.current_business || 'Starting...'}</span>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handlePauseJob(activeJob.id)}
                    className="flex-1 rounded-lg bg-yellow-600 hover:bg-yellow-500 text-xs font-semibold text-white py-2"
                  >
                    ⏸️ Pause
                  </button>
                  <button
                    onClick={() => handleStopJob(activeJob.id)}
                    className="flex-1 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-semibold text-white py-2"
                  >
                    ⏹️ Stop
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500 text-xs">
                <p className="font-medium text-sm text-gray-400 mb-1">No active scraping job running</p>
                <p>Configure and queue a new job on the left panel to begin.</p>
              </div>
            )}
          </div>

          {/* Live Leads Preview - reads from active job's scraped_leads JSONB (no extra API call) */}
          {activeJob && (activeJob.scraped_leads?.length ?? 0) > 0 && (
            <div className="rounded-xl border border-purple-900/40 bg-purple-950/10 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-purple-300 text-sm flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                  Live Preview — {activeJob.scraped_leads!.length} leads extracted so far
                </h3>
                <span className="text-[9px] text-gray-500 uppercase tracking-wider">Not saved yet</span>
              </div>
              <div className="overflow-x-auto max-h-[140px] overflow-y-auto">
                <table className="w-full text-left text-[10px] border-collapse">
                  <thead>
                    <tr className="border-b border-purple-900/30 text-gray-500 font-semibold uppercase tracking-wider text-[9px]">
                      <th className="pb-2 pr-2">Name</th>
                      <th className="pb-2 pr-2">Phone</th>
                      <th className="pb-2 pr-2">Category</th>
                      <th className="pb-2">Rating</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-purple-900/20 text-gray-300">
                    {activeJob.scraped_leads!.slice(-8).map((lead, i) => (
                      <tr key={i} className="hover:bg-purple-950/20">
                        <td className="py-1.5 pr-2 font-medium text-white max-w-[130px] truncate">{lead.name}</td>
                        <td className="py-1.5 pr-2 font-mono text-gray-400 text-[9px]">{lead.phone || '—'}</td>
                        <td className="py-1.5 pr-2 text-gray-400 max-w-[90px] truncate">{lead.category || '—'}</td>
                        <td className="py-1.5 text-yellow-400">{lead.rating ? `⭐ ${lead.rating}` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Job History list */}
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
            <h3 className="font-bold text-gray-200 text-lg mb-4">📜 Scrape Job History</h3>
            
            {loadingJobs ? (
              <div className="text-center py-6 text-xs text-gray-500">Loading history...</div>
            ) : jobs.length === 0 ? (
              <div className="text-center py-6 text-xs text-gray-500">No jobs registered yet</div>
            ) : (
              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                {jobs.map((job) => (
                  <div key={job.id} className="rounded-lg border border-gray-850 bg-gray-950/30 p-4 space-y-3">
                    <div className="flex justify-between items-start text-xs">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-gray-200">
                            {parseKeywordAndArea(job.keyword).keyword} in {job.city}
                          </span>
                          {parseKeywordAndArea(job.keyword).area && (
                            <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 font-semibold text-[8px] uppercase">
                              📍 {parseKeywordAndArea(job.keyword).area}
                            </span>
                          )}
                          <span className="text-[10px] text-gray-500">({job.current_provider})</span>
                        </div>
                        <span className="text-[10px] text-gray-500">{new Date(job.created_at).toLocaleString()}</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {/* Status Badge */}
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider
                          ${job.status === 'completed' ? 'bg-green-950 text-green-400 border border-green-900' : ''}
                          ${job.status === 'running' ? 'bg-blue-950 text-blue-400 border border-blue-900' : ''}
                          ${job.status === 'paused' ? 'bg-yellow-950 text-yellow-400 border border-yellow-900' : ''}
                          ${job.status === 'queued' ? 'bg-gray-800 text-gray-400' : ''}
                          ${job.status === 'stopped' ? 'bg-orange-950 text-orange-400 border border-orange-900' : ''}
                          ${job.status === 'failed' ? 'bg-red-950 text-red-400 border border-red-900' : ''}
                        `}>
                          {job.status}
                        </span>

                        {/* Toggle expand */}
                        <button
                          onClick={() => setSelectedJob(selectedJob?.id === job.id ? null : job)}
                          className="px-2 py-1 text-[10px] bg-gray-800 text-gray-300 rounded hover:bg-gray-700"
                        >
                          {selectedJob?.id === job.id ? 'Hide' : 'View Leads & Logs'}
                        </button>
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-xs text-gray-400">
                      <span>Leads: {job.progress} / {job.max_leads}</span>
                      <span>Duration: {job.duration_seconds ? `${job.duration_seconds}s` : 'N/A'}</span>
                    </div>

                    {/* Action controls for specific job */}
                    <div className="flex gap-2 justify-end">
                      {job.status === 'paused' && (
                        <button
                          onClick={() => handleResumeJob(job.id)}
                          className="px-2 py-1 text-[10px] bg-green-600 hover:bg-green-500 rounded text-white"
                        >
                          ▶️ Resume
                        </button>
                      )}
                      {['completed', 'stopped', 'failed'].includes(job.status) && (
                        <button
                          onClick={() => handleRetryJob(job.id)}
                          className="px-2 py-1 text-[10px] bg-purple-600 hover:bg-purple-500 rounded text-white"
                        >
                          🔄 Retry/Clone
                        </button>
                      )}
                    </div>

                    {/* Scraped Leads + Save Panel (JSONB from job record — no extra API call) */}
                    {selectedJob?.id === job.id && (
                      <div className="mt-3 space-y-3">
                        {/* Leads table with checkboxes */}
                        <div className="rounded-lg bg-gray-950 border border-gray-800 p-3">
                          {(() => {
                            const leads = job.scraped_leads || []
                            const sel = selectedLeadIndices[job.id] || new Set<number>()
                            const allSelected = leads.length > 0 && sel.size === leads.length
                            return (
                              <>
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-[10px] font-semibold text-green-400 uppercase tracking-wider">
                                    📋 Scraped Leads ({leads.length})
                                    {leads.length > 0 && (
                                      <span className="ml-2 text-gray-500 normal-case font-normal">
                                        {sel.size > 0 ? `${sel.size} selected` : 'none selected'}
                                      </span>
                                    )}
                                  </span>
                                  {leads.length > 0 && (
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={() => toggleSelectAll(job.id, leads.length)}
                                        className="text-[9px] text-purple-400 hover:text-purple-300 underline"
                                      >
                                        {allSelected ? 'Deselect All' : 'Select All'}
                                      </button>
                                      <button
                                        onClick={() => handleSaveLeads(job.id, leads.length)}
                                        disabled={savingLeads[job.id]}
                                        className="px-3 py-1 text-[10px] font-semibold rounded bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white transition-colors"
                                      >
                                        {savingLeads[job.id]
                                          ? 'Saving...'
                                          : sel.size > 0 && sel.size < leads.length
                                            ? `💾 Save ${sel.size} Selected`
                                            : '💾 Save All to Leads'}
                                      </button>
                                    </div>
                                  )}
                                </div>

                                {leads.length === 0 ? (
                                  <p className="text-[10px] text-gray-600 py-3">
                                    {job.status === 'running'
                                      ? 'Leads stream in here as scraping progresses...'
                                      : job.status === 'completed'
                                        ? 'All leads were saved and cleared. Run a new job to scrape more.'
                                        : 'No leads extracted yet.'}
                                  </p>
                                ) : (
                                  <div className="overflow-x-auto max-h-[220px] overflow-y-auto">
                                    <table className="w-full text-left text-[10px] border-collapse">
                                      <thead className="sticky top-0 bg-gray-950">
                                        <tr className="text-gray-500 font-semibold uppercase tracking-wider border-b border-gray-800 text-[9px]">
                                          <th className="pb-1.5 pr-2 w-6">
                                            <input
                                              type="checkbox"
                                              checked={allSelected}
                                              onChange={() => toggleSelectAll(job.id, leads.length)}
                                              className="accent-purple-500"
                                            />
                                          </th>
                                          <th className="pb-1.5 pr-2">Name</th>
                                          <th className="pb-1.5 pr-2">Phone</th>
                                          <th className="pb-1.5 pr-2">Category</th>
                                          <th className="pb-1.5 pr-2">Rating</th>
                                          <th className="pb-1.5">Website</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-gray-900">
                                        {leads.map((lead, idx) => (
                                          <tr
                                            key={idx}
                                            onClick={() => toggleLeadSelection(job.id, idx)}
                                            className={`cursor-pointer hover:bg-gray-900/60 transition-colors ${
                                              sel.has(idx) ? 'bg-purple-950/20' : ''
                                            }`}
                                          >
                                            <td className="py-1.5 pr-2">
                                              <input
                                                type="checkbox"
                                                checked={sel.has(idx)}
                                                onChange={() => toggleLeadSelection(job.id, idx)}
                                                onClick={e => e.stopPropagation()}
                                                className="accent-purple-500"
                                              />
                                            </td>
                                            <td className="py-1.5 pr-2 font-medium text-white max-w-[120px] truncate">{lead.name}</td>
                                            <td className="py-1.5 pr-2 font-mono text-gray-400 text-[9px]">{lead.phone || '—'}</td>
                                            <td className="py-1.5 pr-2 text-gray-400 max-w-[80px] truncate">{lead.category || '—'}</td>
                                            <td className="py-1.5 pr-2 text-yellow-400">{lead.rating ? `⭐ ${lead.rating}` : '—'}</td>
                                            <td className="py-1.5 text-blue-400 max-w-[100px] truncate">
                                              {lead.website
                                                ? <a href={lead.website} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="underline">{lead.website.replace(/^https?:\/\//, '')}</a>
                                                : '—'}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </>
                            )
                          })()}
                        </div>

                        {/* Logs Stream */}
                        <div className="rounded bg-black border border-purple-950/40 p-3">
                          <span className="block text-[10px] font-semibold text-purple-400 uppercase mb-2">📟 Logs Stream</span>
                          <div className="text-[10px] text-gray-400 font-mono space-y-1 max-h-[100px] overflow-y-auto">
                            {job.logs && job.logs.length > 0 ? (
                              [...job.logs].reverse().map((log, index) => (
                                <p key={index} className="whitespace-pre-wrap">{log}</p>
                              ))
                            ) : (
                              <p className="text-gray-600">No logs yet.</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
