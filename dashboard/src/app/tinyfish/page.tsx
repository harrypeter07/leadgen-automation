// dashboard/src/app/tinyfish/page.tsx
'use client'

import React, { useState } from 'react'
import toast from 'react-hot-toast'

interface SearchResult {
  position: number
  site_name: string
  title: string
  snippet: string
  url: string
}

interface FetchResult {
  url: string
  final_url: string
  title: string
  description: string
  language: string
  author: string
  format: string
  text: string
}

// Resilient Regex extraction utility for contact info
function extractContacts(text: string) {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
  // Matches international phone numbers: +xx xxxx-xxxx, +x xxxxxxxxx, local patterns
  const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\+?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{4,12}/g
  const socialsRegex = /(https?:\/\/(?:www\.)?(?:instagram|linkedin|facebook|twitter|x|youtube|github)\.com\/[a-zA-Z0-9_.-]+)/gi

  const emails = Array.from(new Set(text.match(emailRegex) || [])).filter(e => {
    const clean = e.toLowerCase()
    return !clean.endsWith('.png') && !clean.endsWith('.jpg') && !clean.endsWith('.gif') && !clean.endsWith('.svg') && !clean.endsWith('.webp') && !clean.endsWith('.css')
  })

  const rawPhones = text.match(phoneRegex) || []
  const phones = Array.from(new Set(rawPhones.map(p => p.trim()).filter(p => {
    const digits = p.replace(/\D/g, '')
    // Standard phone number digit ranges (7-15 digits)
    return digits.length >= 7 && digits.length <= 15
  })))

  const socials = Array.from(new Set(text.match(socialsRegex) || []))

  return { emails, phones, socials }
}

export default function TinyFishPage() {
  const [activeTab, setActiveTab] = useState<'search' | 'fetch' | 'scraper'>('search')

  // TinyFish Scraper States
  const [scraperKeyword, setScraperKeyword] = useState('dentist')
  const [scraperArea, setScraperArea] = useState('')
  const [scraperCity, setScraperCity] = useState('Mumbai')
  const [scraperCountry, setScraperCountry] = useState('')
  const [scraperSearchScope, setScraperSearchScope] = useState<'city' | 'country' | 'global'>('city')
  const [scraperMaxLeads, setScraperMaxLeads] = useState(10)
  const [scraperIncludeEmails, setScraperIncludeEmails] = useState(true)
  const [scraperJobs, setScraperJobs] = useState<any[]>([])
  const [scraperQueuing, setScraperQueuing] = useState(false)
  const [selectedScraperJob, setSelectedScraperJob] = useState<any | null>(null)

  // Search API States
  const [searchQuery, setSearchQuery] = useState('')
  const [searchLocation, setSearchLocation] = useState('US')
  const [searchLanguage, setSearchLanguage] = useState('en')
  const searchPage = 0
  const [loadingSearch, setLoadingSearch] = useState(false)
  const [searchResults, setSearchResults] = useState<{ query: string; total_results: number; results: SearchResult[] } | null>(null)

  // Fetch API States
  const [urlsInput, setUrlsInput] = useState('')
  const [loadingFetch, setLoadingFetch] = useState(false)
  const [fetchResults, setFetchResults] = useState<{ results: FetchResult[]; errors: unknown[] } | null>(null)
  const [selectedFetchResult, setSelectedFetchResult] = useState<FetchResult | null>(null)

  // Extraction Checkboxes
  const [extractEmails, setExtractEmails] = useState(true)
  const [extractPhones, setExtractPhones] = useState(true)
  const [extractSocials, setExtractSocials] = useState(true)

  // Import Dialog Customizer States
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [importName, setImportName] = useState('')
  const [importWebsite, setImportWebsite] = useState('')
  const [importEmail, setImportEmail] = useState('')
  const [importPhone, setImportPhone] = useState('')
  const [importNotes, setImportNotes] = useState('')
  const [importCategory, setImportCategory] = useState('')
  const [importSource, setImportSource] = useState<'tinyfish_search' | 'tinyfish_fetch'>('tinyfish_search')
  const [extractedEmailsList, setExtractedEmailsList] = useState<string[]>([])
  const [extractedPhonesList, setExtractedPhonesList] = useState<string[]>([])

  // Loading states for individual URL buttons
  const [importingUrls, setImportingUrls] = useState<Record<string, boolean>>({})

  // Trigger search
  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!searchQuery.trim()) {
      toast.error('Search query is required')
      return
    }

    setLoadingSearch(true)
    const toastId = toast.loading('Searching the web via TinyFish...')
    try {
      const params = new URLSearchParams({
        query: searchQuery.trim(),
        location: searchLocation,
        language: searchLanguage,
        page: searchPage.toString(),
      })
      const res = await fetch(`/api/tinyfish/search?${params.toString()}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to search')
      setSearchResults(data)
      toast.success(`Search completed! Found ${data.results?.length || 0} results.`, { id: toastId })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Search error'
      toast.error(msg, { id: toastId })
    } finally {
      setLoadingSearch(false)
    }
  }

  // Trigger fetch URLs
  async function handleFetch(e: React.FormEvent) {
    e.preventDefault()
    const urls = urlsInput
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('http://') || line.startsWith('https://'))

    if (urls.length === 0) {
      toast.error('Please input at least one valid URL starting with http:// or https://')
      return
    }
    if (urls.length > 10) {
      toast.error('You can fetch a maximum of 10 URLs at once.')
      return
    }

    setLoadingFetch(true)
    const toastId = toast.loading(`Fetching ${urls.length} page(s) via TinyFish...`)
    try {
      const res = await fetch('/api/tinyfish/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to fetch content')
      setFetchResults(data)
      if (data.results && data.results.length > 0) {
        setSelectedFetchResult(data.results[0])
      }
      const successCount = data.results?.length || 0
      const errorCount = data.errors?.length || 0
      toast.success(`Fetch finished! Success: ${successCount}, Errors: ${errorCount}`, { id: toastId })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Fetch error'
      toast.error(msg, { id: toastId })
    } finally {
      setLoadingFetch(false)
    }
  }

  // Triggered when clicking 'Import as Lead' (runs background fetch if from search tab)
  async function handleImportClick(title: string, url: string, source: 'tinyfish_search' | 'tinyfish_fetch', textContent?: string) {
    setImportWebsite(url.split('?')[0].replace(/\/$/, ''))
    setImportName(title)
    setImportCategory(source === 'tinyfish_search' ? 'TinyFish Search Result' : 'TinyFish Fetch Result')
    setImportSource(source)

    let text = textContent || ''

    // If search result and filters are selected, pull full page in background to scrape contacts!
    if (source === 'tinyfish_search' && (extractEmails || extractPhones || extractSocials)) {
      setImportingUrls((prev) => ({ ...prev, [url]: true }))
      const toastId = toast.loading('Crawling site in background to scrape emails & contact details...')
      try {
        const res = await fetch('/api/tinyfish/fetch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ urls: [url] }),
        })
        const data = await res.json()
        if (res.ok && data.results && data.results.length > 0) {
          text = data.results[0].text || ''
          toast.success('Site crawled successfully! Contact details extracted.', { id: toastId })
        } else {
          toast.error('Background crawl failed. Pre-filling URL only.', { id: toastId })
        }
      } catch {
        toast.error('Background crawl errored. Pre-filling URL only.', { id: toastId })
      } finally {
        setImportingUrls((prev) => ({ ...prev, [url]: false }))
      }
    }

    // Process contact data extraction
    if (text) {
      const contacts = extractContacts(text)
      const parsedEmails = extractEmails ? contacts.emails : []
      const parsedPhones = extractPhones ? contacts.phones : []
      const parsedSocials = extractSocials ? contacts.socials : []

      setExtractedEmailsList(parsedEmails)
      setExtractedPhonesList(parsedPhones)

      setImportEmail(parsedEmails[0] || '')
      setImportPhone(parsedPhones[0] || '')

      let notes = ''
      if (parsedSocials.length > 0) {
        notes += `Extracted Socials:\n${parsedSocials.join('\n')}\n\n`
      }
      if (parsedEmails.length > 1) {
        notes += `All parsed emails: ${parsedEmails.join(', ')}\n`
      }
      if (parsedPhones.length > 1) {
        notes += `All parsed phones: ${parsedPhones.join(', ')}\n`
      }
      setImportNotes(notes)
    } else {
      setExtractedEmailsList([])
      setExtractedPhonesList([])
      setImportEmail('')
      setImportPhone('')
      setImportNotes('')
    }

    setShowImportDialog(true)
  }

  // Submit the customized lead to backend database
  async function submitImportLead(e: React.FormEvent) {
    e.preventDefault()
    const toastId = toast.loading(`Saving lead "${importName}"...`)
    try {
      const res = await fetch('/api/leads/quick-add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: importName.trim() || 'Imported TinyFish Lead',
          phone: importPhone.trim() || null,
          email: importEmail.trim() || null,
          website: importWebsite.trim() || null,
          category: importCategory,
          source: importSource,
          city: 'Web Search',
          notes: importNotes.trim() || null,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save lead')

      if (data.warning) {
        toast(data.warning, { id: toastId, icon: '⚠️', duration: 6000 })
      } else {
        toast.success('Successfully imported as lead!', { id: toastId })
      }
      setShowImportDialog(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Import failed'
      toast.error(msg, { id: toastId })
    }
  }

  // Get active contacts for currently selected fetch result
  const activeContacts = selectedFetchResult ? extractContacts(selectedFetchResult.text) : null

  async function fetchScraperJobs() {
    try {
      const res = await fetch('/api/scraper/jobs')
      const data = await res.json()
      if (res.ok && data.jobs) {
        const tfJobs = data.jobs.filter((j: any) => j.current_provider?.includes('tinyfish'))
        setScraperJobs(tfJobs)
        if (selectedScraperJob) {
          const updated = tfJobs.find((j: any) => j.id === selectedScraperJob.id)
          if (updated) setSelectedScraperJob(updated)
        }
      }
    } catch (err) {
      console.error('Failed to fetch scraper jobs:', err)
    }
  }

  async function handleQueueScraperJob(e: React.FormEvent) {
    e.preventDefault()
    if (!scraperKeyword.trim()) {
      toast.error('Keyword is required')
      return
    }
    if (scraperSearchScope === 'city' && !scraperCity.trim()) {
      toast.error('City is required')
      return
    }
    if (scraperSearchScope === 'country' && !scraperCountry.trim()) {
      toast.error('Country is required')
      return
    }

    setScraperQueuing(true)
    const toastId = toast.loading('Queueing TinyFish scraper job...')
    try {
      const finalProvider = scraperIncludeEmails ? 'tinyfish:email' : 'tinyfish'
      
      let finalCity = scraperCity.trim()
      if (scraperSearchScope === 'global') {
        finalCity = 'Global'
      } else if (scraperSearchScope === 'country') {
        finalCity = `Country: ${scraperCountry.trim()}`
      }

      const res = await fetch('/api/scraper/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: scraperKeyword.trim(),
          city: finalCity,
          area: scraperSearchScope === 'global' ? undefined : (scraperArea.trim() || undefined),
          maxLeads: scraperMaxLeads,
          workerCount: 1,
          provider: finalProvider
        })
      })

      const data = await res.json()
      if (!res.ok) {
        const errMsg = typeof data.error === 'object' && data.error ? data.error.message : data.error;
        throw new Error(errMsg || 'Failed to queue job')
      }

      toast.success('TinyFish scraper job successfully queued!', { id: toastId })
      setScraperArea('')
      fetchScraperJobs()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error starting job'
      toast.error(msg, { id: toastId })
    } finally {
      setScraperQueuing(false)
    }
  }

  useEffect(() => {
    fetchScraperJobs()
    const interval = setInterval(fetchScraperJobs, 5000)
    return () => clearInterval(interval)
  }, [selectedScraperJob])

  return (
    <div className="space-y-8 text-[#2D2D2D] select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-[#1C1C1E] tracking-tight flex items-center gap-2">
            <span>🐟 TinyFish AI Engine</span>
            <span className="text-[10px] uppercase bg-green-50 text-green-700 px-1.5 py-0.5 rounded font-mono font-bold tracking-wider">
              Free Tier APIs
            </span>
          </h1>
          <p className="mt-1 text-sm text-gray-500 font-medium">
            Search the web without credit quotas, and fetch raw clean markdown content from live JS-rendered websites.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex bg-[#F4F3EF] border border-[#E4E3DD] p-1 rounded-xl gap-1 shrink-0">
          <button
            onClick={() => setActiveTab('search')}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
              activeTab === 'search'
                ? 'bg-[#1C1C1E] text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            🔍 Web Search
          </button>
          <button
            onClick={() => setActiveTab('fetch')}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
              activeTab === 'fetch'
                ? 'bg-[#1C1C1E] text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            📄 URL Fetcher
          </button>
          <button
            onClick={() => setActiveTab('scraper')}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
              activeTab === 'scraper'
                ? 'bg-[#1C1C1E] text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            🐠 Leads Scraper
          </button>
        </div>
      </div>

      {activeTab === 'search' ? (
        <div className="space-y-6">
          {/* Search Inputs Card */}
          <div className="rounded-2xl border border-[#E4E3DD] bg-white p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)]">
            <h3 className="font-bold text-[#1C1C1E] text-sm mb-4 uppercase tracking-wider text-[11px] text-gray-500">
              Web Discovery Engine
            </h3>
            <form onSubmit={handleSearch} className="grid gap-4 md:grid-cols-12 items-end">
              <div className="md:col-span-6">
                <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-wider">
                  Search Query (e.g. operators like site: supported)
                </label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="e.g. best real estate agents in New York site:linkedin.com"
                  required
                  className="w-full rounded-xl bg-[#F4F3EF] border border-[#E4E3DD] px-3.5 py-2.5 text-xs text-[#2D2D2D] font-semibold focus:outline-none focus:border-gray-500 placeholder-gray-400"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-wider">
                  Location (Geotag)
                </label>
                <select
                  value={searchLocation}
                  onChange={(e) => setSearchLocation(e.target.value)}
                  className="w-full rounded-xl bg-[#F4F3EF] border border-[#E4E3DD] px-3 py-2.5 text-xs text-[#2D2D2D] font-semibold focus:outline-none focus:border-gray-500 cursor-pointer"
                >
                  <option value="global">🌎 Global (All)</option>
                  <option value="US">🇺🇸 United States</option>
                  <option value="IN">🇮🇳 India</option>
                  <option value="GB">🇬🇧 United Kingdom</option>
                  <option value="CA">🇨🇦 Canada</option>
                  <option value="AU">🇦🇺 Australia</option>
                  <option value="SG">🇸🇬 Singapore</option>
                  <option value="DE">🇩🇪 Germany</option>
                  <option value="FR">🇫🇷 France</option>
                  <option value="AE">🇦🇪 UAE</option>
                  <option value="SA">🇸🇦 Saudi Arabia</option>
                  <option value="JP">🇯🇵 Japan</option>
                  <option value="NZ">🇳🇿 New Zealand</option>
                  <option value="ZA">🇿🇦 South Africa</option>
                  <option value="BR">🇧🇷 Brazil</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-wider">
                  Language
                </label>
                <select
                  value={searchLanguage}
                  onChange={(e) => setSearchLanguage(e.target.value)}
                  className="w-full rounded-xl bg-[#F4F3EF] border border-[#E4E3DD] px-3 py-2.5 text-xs text-[#2D2D2D] font-semibold focus:outline-none focus:border-gray-500 cursor-pointer"
                >
                  <option value="en">English (en)</option>
                  <option value="es">Spanish (es)</option>
                  <option value="fr">French (fr)</option>
                  <option value="de">German (de)</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <button
                  type="submit"
                  disabled={loadingSearch}
                  className="w-full rounded-xl bg-[#1C1C1E] hover:bg-[#252528] disabled:opacity-40 text-xs font-bold uppercase tracking-wider text-white py-3 transition-colors shadow-sm"
                >
                  {loadingSearch ? 'Searching...' : 'Search Web'}
                </button>
              </div>
            </form>

            {/* Extraction Options checkboxes (also runs on background fetch of search results) */}
            <div className="mt-4 pt-4 border-t border-[#E4E3DD] flex flex-wrap items-center gap-6">
              <span className="text-[10px] font-bold text-gray-450 uppercase tracking-wider">
                ⚙️ Autopilot Scraping (On Import):
              </span>
              <label className="flex items-center gap-2 text-xs font-semibold text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={extractEmails}
                  onChange={(e) => setExtractEmails(e.target.checked)}
                  className="rounded border-[#E4E3DD] text-[#1C1C1E] focus:ring-0"
                />
                Extract Emails
              </label>
              <label className="flex items-center gap-2 text-xs font-semibold text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={extractPhones}
                  onChange={(e) => setExtractPhones(e.target.checked)}
                  className="rounded border-[#E4E3DD] text-[#1C1C1E] focus:ring-0"
                />
                Extract Phones
              </label>
              <label className="flex items-center gap-2 text-xs font-semibold text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={extractSocials}
                  onChange={(e) => setExtractSocials(e.target.checked)}
                  className="rounded border-[#E4E3DD] text-[#1C1C1E] focus:ring-0"
                />
                Extract Socials
              </label>
            </div>
          </div>

          {/* Search Results Display */}
          {searchResults && (
            <div className="rounded-2xl border border-[#E4E3DD] bg-white p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] space-y-4">
              <div className="flex items-center justify-between border-b border-[#E4E3DD] pb-3 mb-2">
                <h3 className="font-bold text-[#1C1C1E] text-md uppercase tracking-wider text-[11px] text-gray-500">
                  Search Results for &ldquo;{searchResults.query}&rdquo;
                </h3>
                <span className="text-[10px] font-bold text-gray-400 uppercase bg-[#F4F3EF] px-2 py-0.5 rounded border border-[#E4E3DD]">
                  Total: {searchResults.results?.length || 0} hits
                </span>
              </div>

              {searchResults.results && searchResults.results.length > 0 ? (
                <div className="space-y-4">
                  {searchResults.results.map((result, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl border border-[#E4E3DD] hover:border-gray-400 bg-[#F4F3EF]/10 hover:bg-[#F4F3EF]/30 transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
                    >
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-black text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded border">
                            #{result.position}
                          </span>
                          <span className="text-[10px] uppercase font-bold tracking-wider text-[#E3B859]">
                            {result.site_name}
                          </span>
                        </div>
                        <h4 className="text-sm font-black text-gray-900 tracking-tight leading-snug">
                          <a
                            href={result.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline hover:text-blue-600 break-words font-black"
                          >
                            {result.title}
                          </a>
                        </h4>
                        <p className="text-xs text-gray-500 leading-relaxed font-semibold">
                          {result.snippet}
                        </p>
                        <span className="text-[10px] font-mono text-gray-400 block break-all font-semibold">
                          {result.url}
                        </span>
                      </div>

                      <button
                        onClick={() => handleImportClick(result.title || result.site_name, result.url, 'tinyfish_search')}
                        disabled={importingUrls[result.url]}
                        className="rounded-lg border border-[#E4E3DD] hover:border-gray-500 bg-white hover:bg-gray-50 text-[#1C1C1E] px-3.5 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors disabled:opacity-50 whitespace-nowrap"
                      >
                        {importingUrls[result.url] ? 'Crawling...' : '📥 Import as Lead'}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 text-xs italic text-center py-6">No results found for this query.</p>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left panel: URL input */}
          <div className="lg:col-span-1 space-y-6">
            <div className="rounded-2xl border border-[#E4E3DD] bg-white p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] space-y-4">
              <div>
                <h3 className="font-bold text-[#1C1C1E] text-sm mb-1 uppercase tracking-wider text-[11px] text-gray-500">
                  URL Input (Renders JS/SPAs)
                </h3>
                <p className="text-[10px] text-gray-400 font-medium">Crawl pages and scrape target contact details.</p>
              </div>
              
              <form onSubmit={handleFetch} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-wider">
                    URLs to crawl (One per line, Max 10)
                  </label>
                  <textarea
                    value={urlsInput}
                    onChange={(e) => setUrlsInput(e.target.value)}
                    placeholder="https://example.com/blog/article-1&#10;https://another-site.org/pricing"
                    required
                    rows={6}
                    className="w-full rounded-xl bg-[#F4F3EF] border border-[#E4E3DD] px-3.5 py-2.5 text-xs text-[#2D2D2D] font-semibold focus:outline-none focus:border-gray-500 placeholder-gray-400 resize-none leading-relaxed"
                  />
                </div>

                {/* Extraction Options Checkboxes */}
                <div className="pt-2 border-t border-[#E4E3DD] space-y-2">
                  <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                    Extract Options
                  </span>
                  <label className="flex items-center gap-2 text-xs font-semibold text-gray-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={extractEmails}
                      onChange={(e) => setExtractEmails(e.target.checked)}
                      className="rounded border-[#E4E3DD] text-[#1C1C1E] focus:ring-0"
                    />
                    Emails & Info Contacts
                  </label>
                  <label className="flex items-center gap-2 text-xs font-semibold text-gray-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={extractPhones}
                      onChange={(e) => setExtractPhones(e.target.checked)}
                      className="rounded border-[#E4E3DD] text-[#1C1C1E] focus:ring-0"
                    />
                    Phone numbers
                  </label>
                  <label className="flex items-center gap-2 text-xs font-semibold text-gray-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={extractSocials}
                      onChange={(e) => setExtractSocials(e.target.checked)}
                      className="rounded border-[#E4E3DD] text-[#1C1C1E] focus:ring-0"
                    />
                    Social Links (Insta, LI, Facebook)
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={loadingFetch}
                  className="w-full rounded-xl bg-[#1C1C1E] hover:bg-[#252528] disabled:opacity-40 text-xs font-bold uppercase tracking-wider text-white py-3.5 shadow-sm transition-colors"
                >
                  {loadingFetch ? 'Crawling Pages...' : '⚡ Fetch Page Contents'}
                </button>
              </form>
            </div>

            {/* List of successfully fetched pages */}
            {fetchResults && fetchResults.results && fetchResults.results.length > 0 && (
              <div className="rounded-2xl border border-[#E4E3DD] bg-white p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] space-y-3">
                <h4 className="font-bold text-gray-500 uppercase text-[10px] tracking-wider">
                  Fetched Pages ({fetchResults.results.length})
                </h4>
                <div className="space-y-2">
                  {fetchResults.results.map((page, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedFetchResult(page)}
                      className={`w-full text-left p-3 rounded-xl border transition-all text-xs font-semibold block ${
                        selectedFetchResult?.url === page.url
                          ? 'border-[#E3B859] bg-[#E3B859]/10 text-gray-900 font-bold'
                          : 'border-[#E4E3DD] hover:border-gray-400 hover:bg-[#F4F3EF]/30 text-gray-600'
                      }`}
                    >
                      <div className="truncate font-bold text-gray-900">{page.title || 'Untitled Page'}</div>
                      <div className="truncate text-[10px] text-gray-450 font-mono mt-0.5">{page.url}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right panel: content reader & contact analyzer */}
          <div className="lg:col-span-2 space-y-6">
            {selectedFetchResult ? (
              <div className="rounded-2xl border border-[#E4E3DD] bg-white p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] flex flex-col h-[650px] space-y-4">
                {/* Header info */}
                <div className="border-b border-[#E4E3DD] pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shrink-0">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-black text-gray-900 text-md truncate tracking-tight">
                      {selectedFetchResult.title || 'Untitled Page'}
                    </h3>
                    <p className="text-[10px] font-mono text-gray-400 mt-1 break-all truncate font-semibold">
                      {selectedFetchResult.final_url || selectedFetchResult.url}
                    </p>
                  </div>

                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => handleImportClick(selectedFetchResult.title, selectedFetchResult.url, 'tinyfish_fetch', selectedFetchResult.text)}
                      className="rounded-lg border border-[#E4E3DD] hover:border-gray-500 bg-white text-[#1C1C1E] px-3.5 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors"
                    >
                      📥 Import as Lead
                    </button>
                    <a
                      href={selectedFetchResult.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg border border-[#E4E3DD] hover:border-gray-500 bg-[#1C1C1E] hover:bg-[#252528] text-white px-3.5 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors inline-block"
                    >
                      🌐 Visit Site
                    </a>
                  </div>
                </div>

                {/* Metadata & Extracted Contacts Row */}
                <div className="grid gap-4 md:grid-cols-2 shrink-0">
                  {/* Metadata */}
                  <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-[#F4F3EF] border border-[#E4E3DD] text-[10px] text-gray-600 font-semibold leading-relaxed">
                    <div>
                      <span className="text-gray-400 uppercase block font-bold text-[8px]">Author</span>
                      <span className="truncate block">{selectedFetchResult.author || '—'}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 uppercase block font-bold text-[8px]">Language</span>
                      <span className="truncate block">{selectedFetchResult.language?.toUpperCase() || '—'}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 uppercase block font-bold text-[8px]">Format</span>
                      <span className="truncate block font-mono">{selectedFetchResult.format || 'markdown'}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 uppercase block font-bold text-[8px]">Description</span>
                      <span className="truncate block" title={selectedFetchResult.description}>
                        {selectedFetchResult.description || '—'}
                      </span>
                    </div>
                  </div>

                  {/* Extracted Contacts Badge Panel */}
                  <div className="p-4 rounded-xl border border-[#E4E3DD] bg-white text-xs font-semibold leading-relaxed space-y-2">
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider block border-b border-gray-100 pb-1">
                      🔍 Scraped Contacts & links
                    </span>
                    
                    {activeContacts && (
                      <div className="space-y-1.5 overflow-y-auto max-h-[85px] text-[11px] font-semibold text-gray-700">
                        {extractEmails && (
                          <div>
                            <span className="text-gray-450 block font-bold text-[8px] uppercase">Emails ({activeContacts.emails.length})</span>
                            {activeContacts.emails.length > 0 ? (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {activeContacts.emails.map((e, idx) => (
                                  <span key={idx} className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200 text-[10px]">
                                    ✉️ {e}
                                  </span>
                                ))}
                              </div>
                            ) : <span className="text-gray-400 italic text-[10px]">None detected</span>}
                          </div>
                        )}

                        {extractPhones && (
                          <div className="mt-1">
                            <span className="text-gray-450 block font-bold text-[8px] uppercase">Phones ({activeContacts.phones.length})</span>
                            {activeContacts.phones.length > 0 ? (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {activeContacts.phones.map((p, idx) => (
                                  <span key={idx} className="bg-green-50 text-green-700 px-2 py-0.5 rounded border border-green-200 text-[10px]">
                                    📞 {p}
                                  </span>
                                ))}
                              </div>
                            ) : <span className="text-gray-400 italic text-[10px]">None detected</span>}
                          </div>
                        )}

                        {extractSocials && (
                          <div className="mt-1">
                            <span className="text-gray-450 block font-bold text-[8px] uppercase">Social Links ({activeContacts.socials.length})</span>
                            {activeContacts.socials.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5 mt-1 font-mono text-[9px] text-gray-500">
                                {activeContacts.socials.map((s, idx) => {
                                  const name = s.replace(/https?:\/\/(?:www\.)?/, '').split('/')[0]
                                  return (
                                    <a key={idx} href={s} target="_blank" rel="noopener noreferrer" className="bg-purple-50 hover:bg-purple-100 text-purple-700 px-2 py-0.5 rounded border border-purple-200 text-[10px]">
                                      👤 {name}
                                    </a>
                                  )
                                })}
                              </div>
                            ) : <span className="text-gray-400 italic text-[10px]">None detected</span>}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Extracted Markdown Content */}
                <div className="flex-1 overflow-y-auto p-5 rounded-xl bg-[#F4F3EF] border border-[#E4E3DD] font-mono text-xs text-gray-700 leading-relaxed whitespace-pre-wrap select-text selection:bg-amber-100">
                  {selectedFetchResult.text || (
                    <span className="italic text-gray-400">This URL yielded no readable text content.</span>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-[#E4E3DD] bg-gray-50/20 p-12 text-center flex flex-col items-center justify-center h-[650px]">
                <span className="text-4xl mb-4">🐟</span>
                <h4 className="text-md font-bold text-gray-700">No URL Content Loaded</h4>
                <p className="text-xs text-gray-400 font-medium max-w-sm mt-1">
                  Enter some URLs in the left panel and click &ldquo;Fetch Page Contents&rdquo; to view the JS-rendered clean markdown output here.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'scraper' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Queue Scraper Job Form */}
          <div className="lg:col-span-1 rounded-2xl border border-[#E4E3DD] bg-white p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] space-y-4 h-fit">
            <h3 className="font-bold text-[#1C1C1E] text-sm mb-2 uppercase tracking-wider text-[11px] text-gray-500">
              🚀 Start TinyFish AI Scraper
            </h3>
            <form onSubmit={handleQueueScraperJob} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-wider">Keyword</label>
                <input
                  type="text"
                  value={scraperKeyword}
                  onChange={(e) => setScraperKeyword(e.target.value)}
                  placeholder="e.g. dentist, software architect, ceo"
                  required
                  className="w-full rounded-xl bg-[#F4F3EF] border border-[#E4E3DD] px-3.5 py-2.5 text-xs text-[#2D2D2D] font-semibold focus:outline-none focus:border-gray-500 placeholder-gray-400"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-wider">Search Scope</label>
                <select
                  value={scraperSearchScope}
                  onChange={(e) => setScraperSearchScope(e.target.value as 'city' | 'country' | 'global')}
                  className="w-full rounded-xl bg-[#F4F3EF] border border-[#E4E3DD] px-3.5 py-2.5 text-xs text-[#2D2D2D] font-bold focus:outline-none focus:border-gray-500"
                >
                  <option value="city">🏙️ City Search</option>
                  <option value="country">🌍 Country Search</option>
                  <option value="global">🌐 Global Search</option>
                </select>
              </div>

              {scraperSearchScope !== 'global' && (
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-wider">Area (Optional)</label>
                  <input
                    type="text"
                    value={scraperArea}
                    onChange={(e) => setScraperArea(e.target.value)}
                    placeholder="e.g. Andheri, Södermalm"
                    className="w-full rounded-xl bg-[#F4F3EF] border border-[#E4E3DD] px-3.5 py-2.5 text-xs text-[#2D2D2D] font-semibold focus:outline-none focus:border-gray-500 placeholder-gray-400"
                  />
                </div>
              )}

              {scraperSearchScope === 'city' && (
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-wider">City</label>
                  <input
                    type="text"
                    value={scraperCity}
                    onChange={(e) => setScraperCity(e.target.value)}
                    placeholder="e.g. Mumbai, Stockholm"
                    required
                    className="w-full rounded-xl bg-[#F4F3EF] border border-[#E4E3DD] px-3.5 py-2.5 text-xs text-[#2D2D2D] font-semibold focus:outline-none focus:border-gray-500 placeholder-gray-400"
                  />
                </div>
              )}

              {scraperSearchScope === 'country' && (
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-wider">Country</label>
                  <input
                    type="text"
                    value={scraperCountry}
                    onChange={(e) => setScraperCountry(e.target.value)}
                    placeholder="e.g. Sweden, India, Germany"
                    required
                    className="w-full rounded-xl bg-[#F4F3EF] border border-[#E4E3DD] px-3.5 py-2.5 text-xs text-[#2D2D2D] font-semibold focus:outline-none focus:border-gray-500 placeholder-gray-400"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-wider">Max Leads</label>
                  <input
                    type="number"
                    value={scraperMaxLeads}
                    onChange={(e) => setScraperMaxLeads(parseInt(e.target.value, 10) || 5)}
                    min="1"
                    max="50"
                    className="w-full rounded-xl bg-[#F4F3EF] border border-[#E4E3DD] px-3.5 py-2.5 text-xs text-[#2D2D2D] font-semibold focus:outline-none focus:border-gray-500"
                  />
                </div>
                <div className="flex flex-col justify-end pb-1.5">
                  <label className="flex items-center gap-2 text-xs font-semibold text-gray-600 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={scraperIncludeEmails}
                      onChange={(e) => setScraperIncludeEmails(e.target.checked)}
                      className="rounded border-[#E4E3DD] text-[#1C1C1E] focus:ring-0"
                    />
                    Find Emails
                  </label>
                </div>
              </div>

              <button
                type="submit"
                disabled={scraperQueuing}
                className="w-full rounded-xl bg-[#1C1C1E] hover:bg-[#252528] disabled:opacity-40 text-xs font-bold uppercase tracking-wider text-white py-3.5 shadow-sm transition-colors"
              >
                {scraperQueuing ? 'Starting Scraper...' : '⚡ Launch TinyFish Scraper'}
              </button>
            </form>
          </div>

          {/* Right: Job List & Detail Views */}
          <div className="lg:col-span-2 space-y-6">
            {/* Scraper Job runs list */}
            <div className="rounded-2xl border border-[#E4E3DD] bg-white p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] space-y-3">
              <h3 className="font-bold text-[#1C1C1E] text-sm uppercase tracking-wider text-[11px] text-gray-500">
                🐠 TinyFish Scraper Job History
              </h3>
              {scraperJobs.length === 0 ? (
                <div className="text-center py-8 text-xs text-gray-400 font-semibold">
                  No TinyFish scraper runs found. Queue one using the left panel!
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-1">
                  {scraperJobs.map((job) => {
                    const isActive = selectedScraperJob?.id === job.id;
                    const dateStr = new Date(job.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date(job.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
                    return (
                      <button
                        key={job.id}
                        onClick={() => setSelectedScraperJob(job)}
                        className={`text-left p-4 rounded-xl border transition-all ${
                          isActive
                            ? 'border-[#E3B859] bg-[#E3B859]/10 text-gray-900 font-bold'
                            : 'border-[#E4E3DD] hover:border-gray-400 hover:bg-[#F4F3EF]/30 text-gray-600'
                        }`}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <span className="font-bold truncate text-xs text-gray-800">{job.keyword}</span>
                          <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full shrink-0 ${
                            job.status === 'completed' ? 'bg-green-100 text-green-700' :
                            job.status === 'failed' ? 'bg-red-100 text-red-700' :
                            'bg-yellow-100 text-yellow-800 animate-pulse'
                          }`}>
                            {job.status}
                          </span>
                        </div>
                        <div className="text-[10px] text-gray-400 font-semibold mt-1">
                          📍 {job.city} · {dateStr}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Selected scraper job details (logs & live progress) */}
            {selectedScraperJob && (
              <div className="rounded-2xl border border-[#E4E3DD] bg-white p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] space-y-4">
                <div className="flex justify-between items-center border-b border-[#E4E3DD] pb-3">
                  <div>
                    <h4 className="font-black text-gray-800 text-sm">
                      Job Details: {selectedScraperJob.keyword}
                    </h4>
                    <p className="text-[10px] text-gray-400 font-semibold">
                      ID: {selectedScraperJob.id}
                    </p>
                  </div>
                  <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full ${
                    selectedScraperJob.status === 'completed' ? 'bg-green-100 text-green-700' :
                    selectedScraperJob.status === 'failed' ? 'bg-red-100 text-red-700' :
                    'bg-yellow-100 text-yellow-750 animate-pulse'
                  }`}>
                    {selectedScraperJob.status}
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-bold text-gray-400">
                    <span>PROGRESS</span>
                    <span>{selectedScraperJob.progress || 0} / {selectedScraperJob.max_leads} Leads</span>
                  </div>
                  <div className="w-full bg-[#F4F3EF] rounded-full h-2">
                    <div
                      className="bg-[#E3B859] h-2 rounded-full transition-all duration-500"
                      style={{ width: `${Math.round(((selectedScraperJob.progress || 0) / selectedScraperJob.max_leads) * 100)}%` }}
                    />
                  </div>
                </div>

                {/* Scraper Terminal Logs */}
                <div className="space-y-1">
                  <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                    Execution Logs (Live Console)
                  </span>
                  <div className="bg-gray-900 text-green-400 rounded-xl p-3 h-48 overflow-y-auto font-mono text-[10px] space-y-1 select-text">
                    {(!selectedScraperJob.logs || selectedScraperJob.logs.length === 0) ? (
                      <div className="text-gray-500">Initializing environment...</div>
                    ) : (
                      selectedScraperJob.logs.slice(-20).map((log: string, idx: number) => (
                        <div key={idx} className="leading-relaxed">{log}</div>
                      ))
                    )}
                  </div>
                </div>

                {/* Scraped leads list */}
                {selectedScraperJob.scraped_leads && selectedScraperJob.scraped_leads.length > 0 && (
                  <div className="space-y-2">
                    <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                      Scraped Profiles ({selectedScraperJob.scraped_leads.length})
                    </span>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {selectedScraperJob.scraped_leads.map((lead: any, idx: number) => (
                        <div key={idx} className="p-3 border border-[#E4E3DD] rounded-xl flex justify-between items-center bg-gray-50/20">
                          <div>
                            <div className="text-xs font-bold text-gray-800">{lead.name}</div>
                            <div className="text-[10px] text-gray-400 mt-0.5">
                              📞 {lead.phone || 'No phone'} · 📧 {lead.email || 'No email'}
                            </div>
                            {lead.notes && (
                              <div className="text-[9px] text-gray-500 mt-1 italic line-clamp-1">{lead.notes}</div>
                            )}
                          </div>
                          {lead.website && (
                            <a
                              href={lead.website}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-lg border border-[#E4E3DD] hover:border-gray-500 bg-white px-2 py-1 text-[9px] font-bold uppercase tracking-wider transition-colors shrink-0"
                            >
                              Visit Site
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Customizer Modal Dialog */}
      {showImportDialog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none">
          <div className="bg-white border border-[#E4E3DD] rounded-2xl p-6 shadow-2xl max-w-md w-full space-y-4">
            <div className="flex justify-between items-start border-b border-[#E4E3DD] pb-3">
              <h3 className="font-black text-lg text-gray-900 tracking-tight flex items-center gap-2">
                <span>📥 Import Lead Customizer</span>
              </h3>
              <button 
                onClick={() => setShowImportDialog(false)} 
                className="text-gray-400 hover:text-gray-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={submitImportLead} className="space-y-3">
              <div>
                <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Company / Page Name</label>
                <input
                  type="text"
                  value={importName}
                  onChange={(e) => setImportName(e.target.value)}
                  required
                  className="w-full rounded-xl bg-[#F4F3EF] border border-[#E4E3DD] px-3 py-2 text-xs font-semibold focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Website URL</label>
                <input
                  type="text"
                  value={importWebsite}
                  onChange={(e) => setImportWebsite(e.target.value)}
                  required
                  className="w-full rounded-xl bg-[#F4F3EF] border border-[#E4E3DD] px-3 py-2 text-xs font-semibold focus:outline-none text-gray-500"
                />
              </div>

              <div>
                <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Email Address</label>
                {extractedEmailsList.length > 0 && (
                  <select
                    onChange={(e) => setImportEmail(e.target.value)}
                    value={importEmail}
                    className="w-full rounded-xl bg-[#F4F3EF] border border-[#E4E3DD] px-3 py-1.5 text-[10px] font-semibold focus:outline-none mb-1 cursor-pointer"
                  >
                    <option value="">-- Select Extracted Email --</option>
                    {extractedEmailsList.map((e, idx) => (
                      <option key={idx} value={e}>{e}</option>
                    ))}
                  </select>
                )}
                <input
                  type="email"
                  value={importEmail}
                  onChange={(e) => setImportEmail(e.target.value)}
                  placeholder="e.g. contact@domain.com"
                  className="w-full rounded-xl bg-[#F4F3EF] border border-[#E4E3DD] px-3 py-2 text-xs font-semibold focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Phone Number</label>
                {extractedPhonesList.length > 0 && (
                  <select
                    onChange={(e) => setImportPhone(e.target.value)}
                    value={importPhone}
                    className="w-full rounded-xl bg-[#F4F3EF] border border-[#E4E3DD] px-3 py-1.5 text-[10px] font-semibold focus:outline-none mb-1 cursor-pointer"
                  >
                    <option value="">-- Select Extracted Phone --</option>
                    {extractedPhonesList.map((p, idx) => (
                      <option key={idx} value={p}>{p}</option>
                    ))}
                  </select>
                )}
                <input
                  type="text"
                  value={importPhone}
                  onChange={(e) => setImportPhone(e.target.value)}
                  placeholder="e.g. +1 555-0199"
                  className="w-full rounded-xl bg-[#F4F3EF] border border-[#E4E3DD] px-3 py-2 text-xs font-semibold focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Outreach Notes / Socials</label>
                <textarea
                  value={importNotes}
                  onChange={(e) => setImportNotes(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl bg-[#F4F3EF] border border-[#E4E3DD] px-3 py-2 text-xs font-semibold focus:outline-none resize-none"
                />
              </div>

              <div className="flex gap-2 pt-2 border-t border-[#E4E3DD]">
                <button
                  type="button"
                  onClick={() => setShowImportDialog(false)}
                  className="flex-1 rounded-xl border border-[#E4E3DD] hover:bg-gray-50 text-xs font-bold uppercase tracking-wider py-3"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-[#1C1C1E] hover:bg-[#252528] text-white text-xs font-bold uppercase tracking-wider py-3"
                >
                  Save Lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
