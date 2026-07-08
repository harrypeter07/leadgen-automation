// dashboard/src/app/scraper/page.tsx
'use client'

import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'

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
  const [includeEmails, setIncludeEmails] = useState(false)
  const [searchScope, setSearchScope] = useState<'city' | 'country' | 'global'>('city')
  const [country, setCountry] = useState('')
  const [minFollowers, setMinFollowers] = useState(0)
  const [maxFollowers, setMaxFollowers] = useState(500)
  const [reachAmount, setReachAmount] = useState(0)
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
  const [isPaused, setIsPaused] = useState(false)

  // API Routing Configurations
  const [primaryBackend, setPrimaryBackend] = useState('')
  const [secondaryBackend, setSecondaryBackend] = useState('')
  const [backendMode, setBackendMode] = useState<'primary' | 'secondary' | 'both'>('primary')

  // Helper fetch wrapper to attach routing headers from localStorage/state
  async function fetchWithRouting(url: string, options: RequestInit = {}) {
    const savedPrimary = typeof window !== 'undefined' ? localStorage.getItem('scraper_primary_backend') : null
    const primaryUrl = savedPrimary !== null && savedPrimary.trim() !== '' ? savedPrimary.trim() : 'https://scraper-auto.up.railway.app'
    
    const headers = {
      ...(options.headers || {}),
      'x-backend-primary': primaryUrl,
      'x-backend-secondary': typeof window !== 'undefined' ? (localStorage.getItem('scraper_secondary_backend') || '') : '',
      'x-backend-mode': typeof window !== 'undefined' ? (localStorage.getItem('scraper_backend_mode') || 'primary') : 'primary'
    }
    return fetch(url, { ...options, headers })
  }

  // Load routing configuration from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedPrimary = localStorage.getItem('scraper_primary_backend')
      setPrimaryBackend(savedPrimary !== null && savedPrimary.trim() !== '' ? savedPrimary.trim() : 'https://scraper-auto.up.railway.app')
      setSecondaryBackend(localStorage.getItem('scraper_secondary_backend') || '')
      setBackendMode((localStorage.getItem('scraper_backend_mode') as 'primary' | 'secondary' | 'both') || 'primary')
    }
  }, [])

  // Fetch all jobs
  async function fetchJobs() {
    try {
      const res = await fetchWithRouting('/api/scraper/jobs')
      const data = await res.json()
      if (res.ok && data.jobs) {
        setJobs(data.jobs)
        setIsPaused(!!data.isPaused)
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

  useEffect(() => {
    fetchJobs()
    const interval = setInterval(fetchJobs, 5000)
    return () => clearInterval(interval)
  }, [selectedJob])

  // Queue a new job
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
    if (searchScope === 'country' && !country.trim()) {
      toast.error('Country is required')
      return
    }

    setQueuing(true)
    const toastId = toast.loading('Queueing scrape job...')
    try {
      // Append :email or query options to provider
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
      if (!res.ok) {
        const errMsg = typeof data.error === 'object' && data.error ? data.error.message : data.error;
        throw new Error(errMsg || 'Failed to queue job')
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
      const res = await fetchWithRouting('/api/scraper/pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId })
      })
      if (res.ok) {
        toast.success('Job paused')
        fetchJobs()
      }
    } catch {
      toast.error('Failed to pause job')
    }
  }

  // Resume a job
  async function handleResumeJob(jobId: string) {
    try {
      const res = await fetchWithRouting('/api/scraper/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId })
      })
      if (res.ok) {
        toast.success('Job resumed')
        fetchJobs()
      }
    } catch {
      toast.error('Failed to resume job')
    }
  }

  // Stop a job
  async function handleStopJob(jobId: string) {
    try {
      const res = await fetchWithRouting('/api/scraper/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId })
      })
      if (res.ok) {
        toast.success('Job stopped')
        fetchJobs()
      }
    } catch {
      toast.error('Failed to stop job')
    }
  }

  // Retry / Clone a job
  async function handleRetryJob(jobId: string) {
    try {
      const res = await fetchWithRouting('/api/scraper/retry', {
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
      fetchJobs() // refresh job list after manual lead add
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to submit lead'
      toast.error(message, { id: toastId })
    } finally {
      setAddingLead(false)
    }
  }

  function handleSaveBackendSettings(e: React.FormEvent) {
    e.preventDefault()
    if (typeof window !== 'undefined') {
      localStorage.setItem('scraper_primary_backend', primaryBackend.trim())
      localStorage.setItem('scraper_secondary_backend', secondaryBackend.trim())
      localStorage.setItem('scraper_backend_mode', backendMode)
      toast.success('API Routing configurations successfully updated and saved!')
      fetchJobs() // reload job lists using the new configured target URLs
    }
  }

  const activeJob = jobs.find(j => j.status === 'running')

  return (
    <div className="space-y-8 text-[#2D2D2D] select-none">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-[#1C1C1E] tracking-tight">Cloud Scraper Console</h1>
        <p className="mt-1 text-sm text-gray-500 font-medium">Deploy, manage, and monitor background Maps scraping jobs directly in the cloud.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column: Forms */}
        <div className="lg:col-span-1 space-y-6">
          {/* Create Job Form */}
          <div className="rounded-2xl border border-[#E4E3DD] bg-white p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)]">
            <h3 className="font-bold text-[#1C1C1E] text-md mb-4 uppercase tracking-wider text-[11px] text-gray-500">🚀 Queue Scrape Job</h3>
            <form onSubmit={handleQueueJob} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-wider">Provider</label>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  className="w-full rounded-xl bg-[#F4F3EF] border border-[#E4E3DD] px-3.5 py-2.5 text-xs text-[#2D2D2D] font-bold focus:outline-none focus:border-gray-500"
                >
                  <option value="google_maps">🗺️ Google Maps Scraper</option>
                  <option value="google_search">🔍 Google Search Scraper</option>
                  <option value="instagram">📸 Instagram Scraper</option>
                  <option value="tinyfish">🐠 TinyFish AI Web Scraper</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-wider">Keyword</label>
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="e.g. dentist, cafe, hotel"
                  required
                  className="w-full rounded-xl bg-[#F4F3EF] border border-[#E4E3DD] px-3.5 py-2.5 text-xs text-[#2D2D2D] font-semibold focus:outline-none focus:border-gray-500 placeholder-gray-400"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-wider">Search Scope</label>
                <select
                  value={searchScope}
                  onChange={(e) => setSearchScope(e.target.value as 'city' | 'country' | 'global')}
                  className="w-full rounded-xl bg-[#F4F3EF] border border-[#E4E3DD] px-3.5 py-2.5 text-xs text-[#2D2D2D] font-bold focus:outline-none focus:border-gray-500"
                >
                  <option value="city">🏙️ City Search</option>
                  <option value="country">🌍 Country Search</option>
                  <option value="global">🌐 Global Search</option>
                </select>
              </div>

              {searchScope !== 'global' && (
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-wider">Area (Optional)</label>
                  <input
                    type="text"
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    placeholder="e.g. Andheri, Bandra, Juhu"
                    className="w-full rounded-xl bg-[#F4F3EF] border border-[#E4E3DD] px-3.5 py-2.5 text-xs text-[#2D2D2D] font-semibold focus:outline-none focus:border-gray-500 placeholder-gray-400"
                  />
                </div>
              )}

              {searchScope === 'city' && (
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-wider">City</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. Mumbai, Nagpur, Pune"
                    required
                    className="w-full rounded-xl bg-[#F4F3EF] border border-[#E4E3DD] px-3.5 py-2.5 text-xs text-[#2D2D2D] font-semibold focus:outline-none focus:border-gray-500 placeholder-gray-400"
                  />
                </div>
              )}

              {searchScope === 'country' && (
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-wider">Country</label>
                  <input
                    type="text"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    placeholder="e.g. Sweden, India, Germany"
                    required
                    className="w-full rounded-xl bg-[#F4F3EF] border border-[#E4E3DD] px-3.5 py-2.5 text-xs text-[#2D2D2D] font-semibold focus:outline-none focus:border-gray-500 placeholder-gray-400"
                  />
                </div>
              )}

              {provider === 'instagram' && (
                <div className="space-y-4 border-l-2 border-pink-400 pl-3.5 py-1">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-pink-600 mb-1 uppercase tracking-wider">Min Followers</label>
                      <input
                        type="number"
                        value={minFollowers}
                        onChange={(e) => setMinFollowers(parseInt(e.target.value, 10) || 0)}
                        min="0"
                        className="w-full rounded-xl bg-[#F4F3EF] border border-[#E4E3DD] px-3.5 py-2.5 text-xs text-[#2D2D2D] font-semibold focus:outline-none focus:border-gray-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-pink-600 mb-1 uppercase tracking-wider">Max Followers</label>
                      <input
                        type="number"
                        value={maxFollowers}
                        onChange={(e) => setMaxFollowers(parseInt(e.target.value, 10) || 0)}
                        min="0"
                        className="w-full rounded-xl bg-[#F4F3EF] border border-[#E4E3DD] px-3.5 py-2.5 text-xs text-[#2D2D2D] font-semibold focus:outline-none focus:border-gray-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-pink-600 mb-1 uppercase tracking-wider">Reach Target (Est.)</label>
                    <input
                      type="number"
                      value={reachAmount}
                      onChange={(e) => setReachAmount(parseInt(e.target.value, 10) || 0)}
                      min="0"
                      placeholder="e.g. 500 estimated impressions"
                      className="w-full rounded-xl bg-[#F4F3EF] border border-[#E4E3DD] px-3.5 py-2.5 text-xs text-[#2D2D2D] font-semibold focus:outline-none focus:border-gray-500 placeholder-gray-400"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-wider">Max Leads</label>
                  <input
                    type="number"
                    value={maxLeads}
                    onChange={(e) => setMaxLeads(parseInt(e.target.value, 10) || 10)}
                    min="1"
                    className="w-full rounded-xl bg-[#F4F3EF] border border-[#E4E3DD] px-3.5 py-2.5 text-xs text-[#2D2D2D] font-semibold focus:outline-none focus:border-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-wider">Worker Tabs</label>
                  <select
                    value={workerCount}
                    onChange={(e) => setWorkerCount(parseInt(e.target.value, 10) || 1)}
                    className="w-full rounded-xl bg-[#F4F3EF] border border-[#E4E3DD] px-3.5 py-2.5 text-xs text-[#2D2D2D] font-bold focus:outline-none focus:border-gray-500"
                  >
                    <option value={1}>1 Tab</option>
                    <option value={2}>2 Tabs</option>
                    <option value={4}>4 Tabs</option>
                  </select>
                </div>
              </div>

              {/* Email Enrichment Toggle */}
              <div className="pt-2">
                <label className="flex items-center gap-3 cursor-pointer group select-none">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={includeEmails}
                      onChange={(e) => setIncludeEmails(e.target.checked)}
                      className="sr-only"
                    />
                    <div className={`w-10 h-6 rounded-full transition-colors ${includeEmails ? 'bg-[#1C1C1E]' : 'bg-[#ECEAE4]'}`} />
                    <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${includeEmails ? 'translate-x-4' : 'translate-x-0'}`} />
                  </div>
                  <span className="text-xs font-bold text-gray-600 group-hover:text-[#1C1C1E] transition-colors">
                    Enrich with Email addresses
                  </span>
                </label>
                <p className="text-[9px] text-gray-400 ml-13 mt-1 leading-relaxed">
                  Automatically extracts emails by parsing business websites in a separate tab during extraction.
                </p>
              </div>

              <button
                type="submit"
                disabled={queuing}
                className="w-full rounded-xl bg-[#1C1C1E] hover:bg-[#252528] disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold uppercase tracking-wider text-white py-3.5 mt-2 transition-all shadow-sm"
              >
                {queuing ? 'Queueing...' : 'Queue Scrape Job'}
              </button>
            </form>
          </div>

          {/* Manual Entry Form */}
          <div className="rounded-2xl border border-[#E4E3DD] bg-white p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)]">
            <h3 className="font-bold text-[#1C1C1E] text-md mb-1 uppercase tracking-wider text-[11px] text-gray-500">✏️ Manual Lead Entry</h3>
            <p className="text-[10px] text-gray-400 mb-4">Direct database bypass intake pipeline</p>
            <form onSubmit={handleQuickAdd} className="space-y-3.5">
              <div>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Business Name *"
                  required
                  className="w-full rounded-xl bg-[#F4F3EF] border border-[#E4E3DD] px-3.5 py-2.5 text-xs text-[#2D2D2D] font-semibold placeholder-gray-400 focus:outline-none focus:border-gray-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Phone (e.g. +91...)"
                  className="w-full rounded-xl bg-[#F4F3EF] border border-[#E4E3DD] px-3.5 py-2.5 text-xs text-[#2D2D2D] font-semibold placeholder-gray-400 focus:outline-none focus:border-gray-500"
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  className="w-full rounded-xl bg-[#F4F3EF] border border-[#E4E3DD] px-3.5 py-2.5 text-xs text-[#2D2D2D] font-semibold placeholder-gray-400 focus:outline-none focus:border-gray-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  value={leadCity}
                  onChange={(e) => setLeadCity(e.target.value)}
                  placeholder="City"
                  className="w-full rounded-xl bg-[#F4F3EF] border border-[#E4E3DD] px-3.5 py-2.5 text-xs text-[#2D2D2D] font-semibold placeholder-gray-400 focus:outline-none focus:border-gray-500"
                />
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Category"
                  className="w-full rounded-xl bg-[#F4F3EF] border border-[#E4E3DD] px-3.5 py-2.5 text-xs text-[#2D2D2D] font-semibold placeholder-gray-400 focus:outline-none focus:border-gray-500"
                />
              </div>
              <input
                type="text"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="Website URL"
                className="w-full rounded-xl bg-[#F4F3EF] border border-[#E4E3DD] px-3.5 py-2.5 text-xs text-[#2D2D2D] font-semibold placeholder-gray-400 focus:outline-none focus:border-gray-500"
              />
              <button
                type="submit"
                disabled={addingLead}
                className="flex items-center justify-center gap-2 w-full rounded-xl bg-gray-100 hover:bg-[#202022] hover:text-white disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold uppercase tracking-wider text-gray-700 py-3.5 transition-all"
              >
                Add Lead
              </button>
            </form>
          </div>

          {/* API Backend Config Card */}
          <div className="rounded-2xl border border-[#E4E3DD] bg-white p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)]">
            <h3 className="font-bold text-[#1C1C1E] text-md mb-1 uppercase tracking-wider text-[11px] text-gray-500">🔌 API Backend Routing</h3>
            <p className="text-[10px] text-gray-400 mb-4 font-medium">Configure primary and secondary API targets</p>
            <form onSubmit={handleSaveBackendSettings} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-wider">Primary Backend URL</label>
                <input
                  type="url"
                  value={primaryBackend}
                  onChange={(e) => setPrimaryBackend(e.target.value)}
                  placeholder="e.g. http://localhost:3001"
                  className="w-full rounded-xl bg-[#F4F3EF] border border-[#E4E3DD] px-3.5 py-2.5 text-xs text-[#2D2D2D] font-semibold placeholder-gray-400 focus:outline-none focus:border-gray-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-wider">Secondary Backend URL</label>
                <input
                  type="url"
                  value={secondaryBackend}
                  onChange={(e) => setSecondaryBackend(e.target.value)}
                  placeholder="e.g. http://localhost:3002"
                  className="w-full rounded-xl bg-[#F4F3EF] border border-[#E4E3DD] px-3.5 py-2.5 text-xs text-[#2D2D2D] font-semibold placeholder-gray-400 focus:outline-none focus:border-gray-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-wider">Active Target Routing Mode</label>
                <select
                  value={backendMode}
                  onChange={(e) => setBackendMode(e.target.value as 'primary' | 'secondary' | 'both')}
                  className="w-full rounded-xl bg-[#F4F3EF] border border-[#E4E3DD] px-3.5 py-2.5 text-xs text-[#2D2D2D] font-bold focus:outline-none focus:border-gray-500"
                >
                  <option value="primary">🎯 Primary Server Only</option>
                  <option value="secondary">🥈 Secondary Server Only</option>
                  <option value="both">⚡ Dual Broadcast (Both Servers)</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full rounded-xl bg-[#1C1C1E] hover:bg-[#252528] text-xs font-bold uppercase tracking-wider text-white py-3.5 mt-2 transition-all shadow-sm"
              >
                Save Settings
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Live Status & History */}
        <div className="lg:col-span-2 space-y-6">
          {/* Active Job status */}
          <div className="rounded-2xl border border-[#E4E3DD] bg-white p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)]">
            <h3 className="font-bold text-[#1C1C1E] text-md mb-4 flex items-center justify-between uppercase tracking-wider text-[11px] text-gray-500">
              <span>⚡ Live Scraping Progress</span>
              {activeJob && (
                <span className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                  isPaused 
                    ? 'text-yellow-600 bg-yellow-50 border-yellow-200' 
                    : 'text-green-600 bg-green-50 border-green-200 animate-pulse'
                }`}>
                  {isPaused ? 'Paused' : 'Active'}
                </span>
              )}
            </h3>

            {activeJob ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="rounded-xl bg-[#F4F3EF] p-4 border border-[#E4E3DD]">
                    <span className="text-gray-400 uppercase font-bold text-[9px]">Keyword</span>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="font-bold text-gray-800 text-sm">{parseKeywordAndArea(activeJob.keyword).keyword}</p>
                      {parseKeywordAndArea(activeJob.keyword).area && (
                        <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 font-bold text-[8px] uppercase">
                          📍 {parseKeywordAndArea(activeJob.keyword).area}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="rounded-xl bg-[#F4F3EF] p-4 border border-[#E4E3DD]">
                    <span className="text-gray-400 uppercase font-bold text-[9px]">City</span>
                    <p className="font-bold text-gray-800 text-sm mt-1">{activeJob.city}</p>
                  </div>
                </div>

                {/* Progress bar */}
                <div>
                  <div className="flex justify-between text-xs font-bold text-gray-500 mb-1.5">
                    <span>Collecting details...</span>
                    <span>{activeJob.progress} / {activeJob.max_leads} Leads ({Math.round((activeJob.progress / activeJob.max_leads) * 100)}%)</span>
                  </div>
                  <div className="w-full bg-[#F4F3EF] rounded-full h-4 overflow-hidden p-0.5">
                    <div
                      className="bg-[#1C1C1E] h-3 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, (activeJob.progress / activeJob.max_leads) * 100)}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-lg bg-gray-50 p-2.5 border border-[#E4E3DD]">
                    <span className="text-gray-400 uppercase font-bold text-[8px] block">ETA</span>
                    <span className="font-mono font-bold text-gray-700">
                      {activeJob.estimated_remaining_seconds 
                        ? `${Math.round(activeJob.estimated_remaining_seconds)}s` 
                        : 'Calculating...'}
                    </span>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-2.5 border border-[#E4E3DD]">
                    <span className="text-gray-400 uppercase font-bold text-[8px] block">Workers</span>
                    <span className="font-bold text-gray-700">{activeJob.worker_count} Tab(s)</span>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-2.5 border border-[#E4E3DD]">
                    <span className="text-gray-400 uppercase font-bold text-[8px] block">Errors</span>
                    <span className="font-bold text-red-500">{activeJob.error_count}</span>
                  </div>
                </div>

                <div className="rounded-xl bg-[#F4F3EF] border border-[#E4E3DD] p-3 text-xs flex items-center justify-between">
                  <span className="text-gray-500 font-semibold">Current Listing:</span>
                  <span className="font-bold text-gray-800 max-w-[200px] truncate">{activeJob.current_business || 'Starting...'}</span>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => isPaused ? handleResumeJob(activeJob.id) : handlePauseJob(activeJob.id)}
                    className={`flex-1 rounded-xl text-xs font-bold uppercase tracking-wider text-white py-3 transition-colors ${
                      isPaused 
                        ? 'bg-green-600 hover:bg-green-700' 
                        : 'bg-yellow-500 hover:bg-yellow-600'
                    }`}
                  >
                    {isPaused ? '▶️ Resume' : '⏸️ Pause'}
                  </button>
                  <button
                    onClick={() => handleStopJob(activeJob.id)}
                    className="flex-1 rounded-xl bg-red-500 hover:bg-red-600 text-xs font-bold uppercase tracking-wider text-white py-3 transition-colors"
                  >
                    ⏹️ Stop
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-400 text-xs font-medium">
                <p className="font-bold text-sm text-gray-500 mb-1">No active scraping job running</p>
                <p>Configure and queue a new job on the left panel to begin.</p>
              </div>
            )}
          </div>

          {/* Live Leads Preview */}
          {activeJob && (activeJob.scraped_leads?.length ?? 0) > 0 && (
            <div className="rounded-2xl border border-purple-200 bg-purple-50/30 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-purple-950 text-xs uppercase tracking-wider flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-pulse" />
                  Live Preview — {activeJob.scraped_leads!.length} Leads Extracted
                </h3>
                <span className="text-[10px] text-green-600 uppercase tracking-wider font-bold bg-green-50 border border-green-200 px-2 py-0.5 rounded">✓ Auto-saved to DB</span>
              </div>
              <div className="overflow-x-auto max-h-[220px] overflow-y-auto">
                <table className="w-full text-left text-[11px] border-collapse min-w-[700px]">
                  <thead className="sticky top-0 bg-white">
                    {activeJob.current_provider.includes('instagram') ? (
                      <tr className="border-b border-purple-200 text-purple-950 font-bold uppercase tracking-wider text-[9px]">
                        <th className="pb-2.5 pr-4">User</th>
                        <th className="pb-2.5 pr-4">Followers</th>
                        <th className="pb-2.5 pr-4">Following</th>
                        <th className="pb-2.5 pr-4">Est. Reach</th>
                        <th className="pb-2.5 pr-4">Verified</th>
                        <th className="pb-2.5 pr-4">Email</th>
                        <th className="pb-2.5 pr-4">Phone</th>
                        <th className="pb-2.5 pr-4">Bio</th>
                        <th className="pb-2.5">Website</th>
                      </tr>
                    ) : (
                      <tr className="border-b border-purple-200 text-purple-950 font-bold uppercase tracking-wider text-[9px]">
                        <th className="pb-2.5 pr-4">Name</th>
                        <th className="pb-2.5 pr-4">Phone</th>
                        <th className="pb-2.5 pr-4">Email</th>
                        <th className="pb-2.5 pr-4">Address</th>
                        <th className="pb-2.5 pr-4">Category</th>
                        <th className="pb-2.5 pr-4">Rating</th>
                        <th className="pb-2.5">Website</th>
                      </tr>
                    )}
                  </thead>
                  <tbody className="divide-y divide-purple-100 text-gray-700">
                    {activeJob.scraped_leads!.slice(-15).map((lead, i) => {
                      const isInsta = activeJob.current_provider.includes('instagram');
                      return isInsta ? (
                        <tr key={i} className="hover:bg-purple-50/50">
                          <td className="py-2.5 pr-4 font-bold text-purple-950 max-w-[130px] truncate">{lead.name}</td>
                          <td className="py-2.5 pr-4 font-bold text-gray-700">{(lead as any).instagram_followers ?? '—'}</td>
                          <td className="py-2.5 pr-4 font-medium text-gray-500">{(lead as any).instagram_following ?? '—'}</td>
                          <td className="py-2.5 pr-4 font-bold text-pink-600">{(lead as any).instagram_reach ? `⚡ ${(lead as any).instagram_reach}` : '—'}</td>
                          <td className="py-2.5 pr-4 font-semibold text-gray-500">{(lead as any).instagram_verified ? '✅ Yes' : 'No'}</td>
                          <td className="py-2.5 pr-4 text-purple-700 max-w-[120px] truncate">{lead.email || '—'}</td>
                          <td className="py-2.5 pr-4 font-mono text-gray-500 text-[10px] whitespace-nowrap">{lead.phone || '—'}</td>
                          <td className="py-2.5 pr-4 text-gray-500 max-w-[150px] truncate" title={(lead as any).instagram_bio || lead.notes || ''}>{(lead as any).instagram_bio || lead.notes || '—'}</td>
                          <td className="py-2.5 text-blue-600 max-w-[120px] truncate font-semibold">
                            {lead.website
                              ? <a href={lead.website} target="_blank" rel="noreferrer" className="underline hover:text-blue-500">{lead.website.replace(/^https?:\/\//, '')}</a>
                              : '—'}
                          </td>
                        </tr>
                      ) : (
                        <tr key={i} className="hover:bg-purple-50/50">
                          <td className="py-2.5 pr-4 font-bold text-purple-950 max-w-[130px] truncate">{lead.name}</td>
                          <td className="py-2.5 pr-4 font-mono text-gray-500 text-[10px] whitespace-nowrap">{lead.phone || '—'}</td>
                          <td className="py-2.5 pr-4 text-purple-700 max-w-[120px] truncate">{lead.email || '—'}</td>
                          <td className="py-2.5 pr-4 text-gray-500 max-w-[140px] truncate" title={lead.address || undefined}>{lead.address || '—'}</td>
                          <td className="py-2.5 pr-4 text-gray-500 max-w-[90px] truncate">{lead.category || '—'}</td>
                          <td className="py-2.5 pr-4 text-yellow-600 font-bold whitespace-nowrap">{lead.rating ? `⭐ ${lead.rating}` : '—'}</td>
                          <td className="py-2.5 text-blue-600 max-w-[120px] truncate font-semibold">
                            {lead.website
                              ? <a href={lead.website} target="_blank" rel="noreferrer" className="underline hover:text-blue-500">{lead.website.replace(/^https?:\/\//, '')}</a>
                              : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Job History list */}
          <div className="rounded-2xl border border-[#E4E3DD] bg-white p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)]">
            <h3 className="font-bold text-[#1C1C1E] text-md mb-4 uppercase tracking-wider text-[11px] text-gray-500">📜 Scrape Job History</h3>
            
            {loadingJobs ? (
              <div className="text-center py-6 text-xs text-gray-400">Loading history...</div>
            ) : jobs.length === 0 ? (
              <div className="text-center py-6 text-xs text-gray-400">No jobs registered yet</div>
            ) : (
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
                {jobs.map((job) => (
                  <div key={job.id} className="rounded-xl border border-[#E4E3DD] bg-gray-50/50 p-4 space-y-3.5">
                    <div className="flex justify-between items-start text-xs">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-gray-800">
                            {parseKeywordAndArea(job.keyword).keyword} in {job.city}
                          </span>
                          {parseKeywordAndArea(job.keyword).area && (
                            <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 font-bold text-[8px] uppercase">
                              📍 {parseKeywordAndArea(job.keyword).area}
                            </span>
                          )}
                          <span className="text-[10px] text-gray-400">({job.current_provider})</span>
                        </div>
                        <span className="text-[10px] text-gray-400 mt-1 block font-medium">{new Date(job.created_at).toLocaleString()}</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {/* Status Badge */}
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border
                          ${job.status === 'completed' ? 'bg-green-50 text-green-700 border-green-200' : ''}
                          ${job.status === 'running' ? 'bg-blue-50 text-blue-700 border-blue-200' : ''}
                          ${job.status === 'paused' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : ''}
                          ${job.status === 'queued' ? 'bg-gray-100 text-gray-500 border-gray-200' : ''}
                          ${job.status === 'stopped' ? 'bg-orange-50 text-orange-700 border-orange-200' : ''}
                          ${job.status === 'failed' ? 'bg-red-50 text-red-700 border-red-200' : ''}
                        `}>
                          {job.status}
                        </span>

                        {/* Toggle expand */}
                        <button
                          onClick={() => setSelectedJob(selectedJob?.id === job.id ? null : job)}
                          className="px-2 py-1 text-[9px] font-bold uppercase bg-white border border-[#E4E3DD] text-gray-600 rounded-lg hover:bg-gray-100"
                        >
                          {selectedJob?.id === job.id ? 'Hide' : 'Leads'}
                        </button>
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-xs text-gray-500 font-medium">
                      <span>Leads: {job.progress} / {job.max_leads}</span>
                      <span>Duration: {job.duration_seconds ? `${job.duration_seconds}s` : 'N/A'}</span>
                    </div>

                    {/* Action controls for specific job */}
                    <div className="flex gap-2 justify-end">
                      {job.status === 'paused' && (
                        <button
                          onClick={() => handleResumeJob(job.id)}
                          className="px-2.5 py-1 text-[9px] font-bold uppercase bg-green-600 hover:bg-green-700 rounded-lg text-white"
                        >
                          ▶️ Resume
                        </button>
                      )}
                      {['completed', 'stopped', 'failed'].includes(job.status) && (
                        <button
                          onClick={() => handleRetryJob(job.id)}
                          className="px-2.5 py-1 text-[9px] font-bold uppercase bg-[#1C1C1E] hover:bg-[#252528] rounded-lg text-white"
                        >
                          🔄 Retry/Clone
                        </button>
                      )}
                    </div>

                    {/* Scraped Leads + Save Panel */}
                    {selectedJob?.id === job.id && (
                      <div className="mt-3 space-y-3">
                        <div className="rounded-xl bg-white border border-[#E4E3DD] p-4">
                          {(() => {
                            const leads = job.scraped_leads || []
                            return (
                              <>
                                <div className="flex items-center justify-between mb-3 border-b border-[#E4E3DD] pb-2">
                                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                                    📋 Scraped Leads ({leads.length})
                                  </span>
                                  {leads.length > 0 && (
                                    <a
                                      href="/leads"
                                      className="px-3 py-1.5 text-[9px] font-bold uppercase rounded-lg bg-[#1C1C1E] hover:bg-[#252528] text-white transition-colors"
                                    >
                                      📂 View on Leads Page
                                    </a>
                                  )}
                                </div>

                                {leads.length === 0 ? (
                                  <p className="text-[10px] text-gray-400 py-3 font-semibold text-center">
                                    {job.status === 'running'
                                      ? 'Leads stream in here as scraping progresses...'
                                      : 'No leads extracted yet.'}
                                  </p>
                                ) : (
                                  <div>
                                    <div className="overflow-x-auto max-h-[220px] overflow-y-auto">
                                      <table className="w-full text-left text-[10px] border-collapse min-w-[600px]">
                                        <thead className="sticky top-0 bg-white">
                                          {job.current_provider.includes('instagram') ? (
                                            <tr className="text-gray-400 font-bold uppercase tracking-wider border-b border-[#E4E3DD] text-[8px]">
                                              <th className="pb-1.5 pr-2">User</th>
                                              <th className="pb-1.5 pr-2">Followers</th>
                                              <th className="pb-1.5 pr-2">Following</th>
                                              <th className="pb-1.5 pr-2">Est. Reach</th>
                                              <th className="pb-1.5 pr-2">Verified</th>
                                              <th className="pb-1.5 pr-2">Email</th>
                                              <th className="pb-1.5 pr-2">Phone</th>
                                              <th className="pb-1.5 pr-2">Bio</th>
                                              <th className="pb-1.5">Website</th>
                                            </tr>
                                          ) : (
                                            <tr className="text-gray-400 font-bold uppercase tracking-wider border-b border-[#E4E3DD] text-[8px]">
                                              <th className="pb-1.5 pr-2">Name</th>
                                              <th className="pb-1.5 pr-2">Phone</th>
                                              <th className="pb-1.5 pr-2">Email</th>
                                              <th className="pb-1.5 pr-2">Address</th>
                                              <th className="pb-1.5 pr-2">Category</th>
                                              <th className="pb-1.5 pr-2">Rating</th>
                                              <th className="pb-1.5">Website</th>
                                            </tr>
                                          )}
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 text-gray-700">
                                          {leads.slice(0, 10).map((lead, idx) => {
                                            const isInsta = job.current_provider.includes('instagram');
                                            return isInsta ? (
                                              <tr key={idx} className="hover:bg-gray-50">
                                                <td className="py-2 pr-2 font-bold text-gray-800 max-w-[120px] truncate">{lead.name}</td>
                                                <td className="py-2 pr-2 font-bold text-gray-600">{(lead as any).instagram_followers ?? '—'}</td>
                                                <td className="py-2 pr-2 text-gray-500">{(lead as any).instagram_following ?? '—'}</td>
                                                <td className="py-2 pr-2 font-bold text-pink-600">{(lead as any).instagram_reach ? `⚡ ${(lead as any).instagram_reach}` : '—'}</td>
                                                <td className="py-2 pr-2 text-gray-500">{(lead as any).instagram_verified ? 'Yes' : 'No'}</td>
                                                <td className="py-2 pr-2 text-purple-700 max-w-[120px] truncate">{lead.email || '—'}</td>
                                                <td className="py-2 pr-2 font-mono text-gray-500 text-[9px]">{lead.phone || '—'}</td>
                                                <td className="py-2 pr-2 text-gray-400 max-w-[140px] truncate" title={(lead as any).instagram_bio || lead.notes || ''}>{(lead as any).instagram_bio || lead.notes || '—'}</td>
                                                <td className="py-2 text-blue-600 max-w-[100px] truncate font-semibold">
                                                  {lead.website
                                                    ? <a href={lead.website} target="_blank" rel="noreferrer" className="underline">{lead.website.replace(/^https?:\/\//, '')}</a>
                                                    : '—'}
                                                </td>
                                              </tr>
                                            ) : (
                                              <tr key={idx} className="hover:bg-gray-50">
                                                <td className="py-2 pr-2 font-bold text-gray-800 max-w-[120px] truncate">{lead.name}</td>
                                                <td className="py-2 pr-2 font-mono text-gray-500 text-[9px]">{lead.phone || '—'}</td>
                                                <td className="py-2 pr-2 text-purple-700 max-w-[120px] truncate">{lead.email || '—'}</td>
                                                <td className="py-2 pr-2 text-gray-500 max-w-[120px] truncate" title={lead.address || undefined}>{lead.address || '—'}</td>
                                                <td className="py-2 pr-2 text-gray-500 max-w-[80px] truncate">{lead.category || '—'}</td>
                                                <td className="py-2 pr-2 text-yellow-600 font-bold">{lead.rating ? `⭐ ${lead.rating}` : '—'}</td>
                                                <td className="py-2 text-blue-600 max-w-[100px] truncate font-semibold">
                                                  {lead.website
                                                    ? <a href={lead.website} target="_blank" rel="noreferrer" className="underline">{lead.website.replace(/^https?:\/\//, '')}</a>
                                                    : '—'}
                                                </td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                    {leads.length > 10 && (
                                      <p className="text-[10px] text-gray-400 mt-3 italic text-center font-medium">
                                        Showing first 10 of {leads.length} leads. View all of them on the <a href="/leads" className="text-purple-600 hover:underline font-bold">Leads page</a>.
                                      </p>
                                    )}
                                  </div>
                                )}
                              </>
                            )
                          })()}
                        </div>

                        {/* Logs Stream */}
                        <div className="rounded-xl bg-[#F4F3EF] border border-[#E4E3DD] p-4">
                          <span className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">📟 Logs Stream</span>
                          <div className="text-[10px] text-gray-600 font-mono space-y-1 max-h-[120px] overflow-y-auto">
                            {job.logs && job.logs.length > 0 ? (
                              [...job.logs].reverse().map((log, index) => (
                                <p key={index} className="whitespace-pre-wrap">{log}</p>
                              ))
                            ) : (
                              <p className="text-gray-400">No logs yet.</p>
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
