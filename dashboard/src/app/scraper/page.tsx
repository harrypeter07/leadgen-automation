'use client'

import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { 
  Button, 
  Badge, 
  Card, 
  HeroCard, 
  Tabs, 
  Input, 
  SearchInput,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell
} from '@/components'
import { Search, Play, Pause, Square, RotateCw, CheckCircle, Sparkles, Terminal } from 'lucide-react'

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
  const [provider, setProvider] = useState('google_maps')
  const [keyword, setKeyword] = useState('dentist')
  const [area, setArea] = useState('')
  const [city, setCity] = useState('Mumbai')
  const [maxLeads, setMaxLeads] = useState(25)
  const [workerCount, setWorkerCount] = useState(1)
  const [includeEmails, setIncludeEmails] = useState(false)
  const [searchScope, setSearchScope] = useState<'city' | 'country' | 'global'>('city')
  const [country, setCountry] = useState('')
  const [minFollowers, setMinFollowers] = useState(0)
  const [maxFollowers, setMaxFollowers] = useState(500)
  const [reachAmount, setReachAmount] = useState(0)
  const [queuing, setQueuing] = useState(false)

  // Manual entry states
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
  const [isPaused, setIsPaused] = useState(false)

  // API Routing Configurations
  const [primaryBackend, setPrimaryBackend] = useState('')
  const [secondaryBackend, setSecondaryBackend] = useState('')
  const [backendMode, setBackendMode] = useState<'primary' | 'secondary' | 'both'>('primary')

  const parseKeywordAndArea = (rawKeyword: string) => {
    if (!rawKeyword) return { keyword: '', area: null }
    const match = rawKeyword.match(/^(.*?)\s*\[Area:\s*(.*?)\]$/)
    if (match) {
      return { keyword: match[1], area: match[2] }
    }
    return { keyword: rawKeyword, area: null }
  }

  async function fetchWithRouting(url: string, options: RequestInit = {}) {
    const savedPrimary = typeof window !== 'undefined' ? localStorage.getItem('scraper_primary_backend') : null
    const primaryUrl = savedPrimary !== null && savedPrimary.trim() !== '' ? savedPrimary.trim() : 'https://scraper-auto.up.railway.app'
    
    const savedSecondary = typeof window !== 'undefined' ? localStorage.getItem('scraper_secondary_backend') : null
    const secondaryUrl = savedSecondary !== null && savedSecondary.trim() !== '' ? savedSecondary.trim() : 'https://leadgen-automation-production-12c6.up.railway.app'

    const headers = {
      ...(options.headers || {}),
      'x-backend-primary': primaryUrl,
      'x-backend-secondary': secondaryUrl,
      'x-backend-mode': typeof window !== 'undefined' ? (localStorage.getItem('scraper_backend_mode') || 'primary') : 'primary'
    }
    return fetch(url, { ...options, headers })
  }

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedPrimary = localStorage.getItem('scraper_primary_backend')
      setPrimaryBackend(savedPrimary !== null && savedPrimary.trim() !== '' ? savedPrimary.trim() : 'https://scraper-auto.up.railway.app')
      
      const savedSecondary = localStorage.getItem('scraper_secondary_backend')
      setSecondaryBackend(savedSecondary !== null && savedSecondary.trim() !== '' ? savedSecondary.trim() : 'https://leadgen-automation-production-12c6.up.railway.app')
      
      setBackendMode((localStorage.getItem('scraper_backend_mode') as 'primary' | 'secondary' | 'both') || 'primary')
    }
  }, [])

  async function fetchJobs() {
    try {
      const res = await fetchWithRouting('/api/scraper/jobs')
      const data = await res.json()
      if (res.ok && data.jobs) {
        setJobs(data.jobs)
        setIsPaused(!!data.isPaused)
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

  useEffect(() => {
    fetchJobs()
    const interval = setInterval(fetchJobs, 5000)
    return () => clearInterval(interval)
  }, [selectedJob])

  async function handleQueueJob(e: React.FormEvent) {
    e.preventDefault()
    if (!keyword.trim()) {
      toast.error('Keyword is required')
      return
    }
    if (searchScope === 'city' && !city.trim()) {
      toast.error('City is required')
      return
    }

    setQueuing(true)
    const toastId = toast.loading('Queueing scrape job...')
    try {
      const finalProvider = provider === 'instagram'
        ? `instagram?minFollowers=${minFollowers}&maxFollowers=${maxFollowers}&reachAmount=${reachAmount}`
        : includeEmails ? `${provider}:email` : provider;

      let finalCity = city.trim()
      if (searchScope === 'global') {
        finalCity = 'Global'
      } else if (searchScope === 'country') {
        finalCity = `Country: ${country.trim()}`
      }

      const res = await fetchWithRouting('/api/scraper/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: keyword.trim(),
          city: finalCity,
          area: searchScope === 'global' ? undefined : (area.trim() || undefined),
          maxLeads,
          workerCount,
          provider: finalProvider
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to queue job')

      toast.success('Scrape job successfully queued!', { id: toastId })
      setArea('')
      fetchJobs()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error starting job'
      toast.error(msg, { id: toastId })
    } finally {
      setQueuing(false)
    }
  }

  async function handleQuickAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Name is required')
      return
    }

    setAddingLead(true)
    const toastId = toast.loading('Adding lead...')
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
      if (!res.ok) throw new Error(data.error || 'Failed to submit lead')

      toast.success('Lead added successfully!', { id: toastId })
      setName('')
      setPhone('')
      setEmail('')
      setLeadCity('')
      setCategory('')
      setWebsite('')
      fetchJobs()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to submit lead'
      toast.error(message, { id: toastId })
    } finally {
      setAddingLead(false)
    }
  }

  const activeJob = jobs.find(j => j.status === 'running')

  return (
    <div className="space-y-10 max-w-7xl mx-auto">
      {/* Hero Block */}
      <HeroCard
        eyebrow="SCRAPER"
        title="Google Maps & Cloud Lead Extraction"
        description="Extract verified business leads, phones, websites, and emails in real-time."
        variant="sage"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Form Inputs */}
        <div className="lg:col-span-1 space-y-6">
          <Card variant="page-alt" className="p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <h3 className="font-bold text-base text-ink font-display">Queue Scrape Job</h3>
              <Badge variant="dark">CONFIG</Badge>
            </div>

            <form onSubmit={handleQueueJob} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-eyebrow text-text-muted mb-1">
                  Provider
                </label>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  className="w-full h-11 rounded-pill bg-page px-4 text-xs font-bold text-ink border-none focus:ring-2 focus:ring-lime"
                >
                  <option value="google_maps">🗺️ Google Maps Scraper</option>
                  <option value="google_search">🔍 Google Search Scraper</option>
                  <option value="instagram">📸 Instagram Scraper</option>
                  <option value="tinyfish">🐠 TinyFish AI Web Scraper</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-eyebrow text-text-muted mb-1">
                  Keyword
                </label>
                <Input
                  type="text"
                  value={keyword}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setKeyword(e.target.value)}
                  placeholder="e.g. dentist, cafe, hotel"
                  required
                  className="w-full h-11 rounded-pill bg-page px-4 text-xs font-medium border-none focus:ring-2 focus:ring-lime"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-eyebrow text-text-muted mb-1">
                    Scope
                  </label>
                  <select
                    value={searchScope}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSearchScope(e.target.value as 'city' | 'country' | 'global')}
                    className="w-full h-11 rounded-pill bg-page px-3 text-xs font-bold text-ink border-none focus:ring-2 focus:ring-lime"
                  >
                    <option value="city">City</option>
                    <option value="country">Country</option>
                    <option value="global">Global</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-eyebrow text-text-muted mb-1">
                    City / Target
                  </label>
                  <Input
                    type="text"
                    value={city}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCity(e.target.value)}
                    placeholder="e.g. Mumbai"
                    required={searchScope === 'city'}
                    className="w-full h-11 rounded-pill bg-page px-3 text-xs font-medium border-none focus:ring-2 focus:ring-lime"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-eyebrow text-text-muted mb-1">
                    Max Leads
                  </label>
                  <Input
                    type="number"
                    value={maxLeads}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMaxLeads(parseInt(e.target.value, 10) || 10)}
                    min="1"
                    className="w-full h-11 rounded-pill bg-page px-4 text-xs font-medium border-none focus:ring-2 focus:ring-lime"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-eyebrow text-text-muted mb-1">
                    Worker Tabs
                  </label>
                  <select
                    value={workerCount}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setWorkerCount(parseInt(e.target.value, 10) || 1)}
                    className="w-full h-11 rounded-pill bg-page px-3 text-xs font-bold text-ink border-none focus:ring-2 focus:ring-lime"
                  >
                    <option value={1}>1 Tab</option>
                    <option value={2}>2 Tabs</option>
                    <option value={4}>4 Tabs</option>
                  </select>
                </div>
              </div>

              <Button
                type="submit"
                loading={queuing}
                variant="primary"
                className="w-full mt-2"
                iconType="arrow-right"
              >
                Start Scrape Job
              </Button>
            </form>
          </Card>

          {/* Quick Add Manual Form */}
          <Card variant="page-alt" className="p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <h3 className="font-bold text-base text-ink font-display">Manual Lead Entry</h3>
              <Badge variant="lime">DIRECT</Badge>
            </div>
            <form onSubmit={handleQuickAdd} className="space-y-3">
              <Input
                type="text"
                value={name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                placeholder="Business Name *"
                required
                className="w-full h-10 rounded-pill bg-page px-4 text-xs font-medium border-none"
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="text"
                  value={phone}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPhone(e.target.value)}
                  placeholder="Phone"
                  className="w-full h-10 rounded-pill bg-page px-3 text-xs font-medium border-none"
                />
                <Input
                  type="email"
                  value={email}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                  placeholder="Email"
                  className="w-full h-10 rounded-pill bg-page px-3 text-xs font-medium border-none"
                />
              </div>
              <Button
                type="submit"
                loading={addingLead}
                variant="secondary"
                size="sm"
                className="w-full mt-2"
              >
                Add Manual Lead
              </Button>
            </form>
          </Card>
        </div>

        {/* Right Column: Live Status & Log Console */}
        <div className="lg:col-span-2 space-y-6">
          {/* Dark Ink Live Log Console Card */}
          <Card variant="ink" className="p-8 rounded-xl space-y-6">
            <div className="flex items-center justify-between border-b border-border-subtle/20 pb-4">
              <div className="flex items-center gap-2">
                <Terminal className="w-5 h-5 text-lime" />
                <h3 className="font-bold text-xl text-page font-display">Live Job Execution Console</h3>
              </div>
              {activeJob && (
                <Badge variant="lime">
                  {isPaused ? 'PAUSED' : 'RUNNING'}
                </Badge>
              )}
            </div>

            {activeJob ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                  <div className="bg-ink-soft p-4 rounded-lg border border-border-subtle/20">
                    <span className="text-[10px] font-bold uppercase tracking-eyebrow text-text-onDarkMuted block">Target</span>
                    <span className="text-sm font-bold text-page mt-1 block truncate">{activeJob.keyword}</span>
                  </div>
                  <div className="bg-ink-soft p-4 rounded-lg border border-border-subtle/20">
                    <span className="text-[10px] font-bold uppercase tracking-eyebrow text-text-onDarkMuted block">Progress</span>
                    <span className="text-sm font-bold text-lime mt-1 block">{activeJob.progress} / {activeJob.max_leads}</span>
                  </div>
                  <div className="bg-ink-soft p-4 rounded-lg border border-border-subtle/20">
                    <span className="text-[10px] font-bold uppercase tracking-eyebrow text-text-onDarkMuted block">ETA</span>
                    <span className="text-sm font-bold text-page mt-1 block font-mono">{activeJob.estimated_remaining_seconds ? `${Math.round(activeJob.estimated_remaining_seconds)}s` : '—'}</span>
                  </div>
                  <div className="bg-ink-soft p-4 rounded-lg border border-border-subtle/20">
                    <span className="text-[10px] font-bold uppercase tracking-eyebrow text-text-onDarkMuted block">Workers</span>
                    <span className="text-sm font-bold text-page mt-1 block">{activeJob.worker_count} Tab(s)</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div>
                  <div className="w-full bg-ink-soft rounded-pill h-3 overflow-hidden p-0.5">
                    <div
                      className="bg-lime h-2 rounded-pill transition-all duration-300"
                      style={{ width: `${Math.min(100, (activeJob.progress / activeJob.max_leads) * 100)}%` }}
                    />
                  </div>
                </div>

                {/* Log stream output */}
                <div className="bg-ink-soft p-4 rounded-lg font-mono text-xs text-text-onDarkMuted space-y-1.5 max-h-48 overflow-y-auto border border-border-subtle/20">
                  {activeJob.logs && activeJob.logs.length > 0 ? (
                    [...activeJob.logs].reverse().slice(0, 10).map((log, i) => (
                      <p key={i} className="leading-relaxed truncate">{log}</p>
                    ))
                  ) : (
                    <p className="text-text-onDarkMuted/60">Initializing background scraping logs...</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-text-onDarkMuted font-medium">
                No active scrape job currently running. Queue a job on the left panel.
              </div>
            )}
          </Card>

          {/* Job History Table Card */}
          <Card variant="page-alt" className="p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <h3 className="font-bold text-lg text-ink font-display">Job Execution History</h3>
              <Badge variant="dark">HISTORY</Badge>
            </div>

            {loadingJobs ? (
              <p className="text-center text-text-muted py-8 font-medium">Loading history...</p>
            ) : jobs.length === 0 ? (
              <p className="text-center text-text-muted py-8 font-medium">No scrape jobs recorded yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Target Keyword</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Progress</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.slice(0, 8).map((job) => (
                    <TableRow key={job.id}>
                      <TableCell className="font-bold text-ink">{parseKeywordAndArea(job.keyword).keyword}</TableCell>
                      <TableCell>{job.city}</TableCell>
                      <TableCell>
                        <Badge variant={job.status === 'completed' ? 'lime' : job.status === 'running' ? 'dark' : 'muted'}>
                          {job.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold">{job.progress} / {job.max_leads}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
