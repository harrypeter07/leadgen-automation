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

export default function TinyFishPage() {
  const [activeTab, setActiveTab] = useState<'search' | 'fetch'>('search')

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

  // Import State tracking
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

  // Import lead proxy helper
  async function handleImportLead(name: string, url: string, source: 'tinyfish_search' | 'tinyfish_fetch') {
    setImportingUrls((prev) => ({ ...prev, [url]: true }))
    const toastId = toast.loading(`Importing "${name}" as a lead...`)
    try {
      const cleanUrl = url.split('?')[0].replace(/\/$/, '')
      const res = await fetch('/api/leads/quick-add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim() || 'Imported TinyFish Lead',
          website: cleanUrl,
          category: source === 'tinyfish_search' ? 'TinyFish Search Result' : 'TinyFish Fetch Result',
          source: source,
          city: 'Web Search',
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to import lead')
      
      if (data.warning) {
        toast(data.warning, { id: toastId, icon: '⚠️', duration: 6000 })
      } else {
        toast.success('Successfully imported as lead!', { id: toastId })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Import failed'
      toast.error(msg, { id: toastId })
    } finally {
      setImportingUrls((prev) => ({ ...prev, [url]: false }))
    }
  }

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
        <div className="flex bg-[#F4F3EF] border border-[#E4E3DD] p-1 rounded-xl gap-1">
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
                  <option value="US">🇺🇸 United States</option>
                  <option value="IN">🇮🇳 India</option>
                  <option value="GB">🇬🇧 United Kingdom</option>
                  <option value="CA">🇨🇦 Canada</option>
                  <option value="AU">🇦🇺 Australia</option>
                  <option value="SG">🇸🇬 Singapore</option>
                  <option value="DE">🇩🇪 Germany</option>
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
                            className="hover:underline hover:text-blue-600 break-words"
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
                        onClick={() => handleImportLead(result.title || result.site_name, result.url, 'tinyfish_search')}
                        disabled={importingUrls[result.url]}
                        className="rounded-lg border border-[#E4E3DD] hover:border-gray-500 bg-white hover:bg-gray-50 text-[#1C1C1E] px-3.5 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors disabled:opacity-50 whitespace-nowrap"
                      >
                        {importingUrls[result.url] ? 'Importing...' : '📥 Import as Lead'}
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
            <div className="rounded-2xl border border-[#E4E3DD] bg-white p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)]">
              <h3 className="font-bold text-[#1C1C1E] text-sm mb-4 uppercase tracking-wider text-[11px] text-gray-500">
                URL Input (Renders JS/SPAs)
              </h3>
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
                    rows={8}
                    className="w-full rounded-xl bg-[#F4F3EF] border border-[#E4E3DD] px-3.5 py-2.5 text-xs text-[#2D2D2D] font-semibold focus:outline-none focus:border-gray-500 placeholder-gray-400 resize-none leading-relaxed"
                  />
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

          {/* Right panel: content reader */}
          <div className="lg:col-span-2 space-y-6">
            {selectedFetchResult ? (
              <div className="rounded-2xl border border-[#E4E3DD] bg-white p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] flex flex-col h-[580px]">
                {/* Header info */}
                <div className="border-b border-[#E4E3DD] pb-4 mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-gray-900 text-md truncate tracking-tight">
                      {selectedFetchResult.title || 'Untitled Page'}
                    </h3>
                    <p className="text-[10px] font-mono text-gray-400 mt-1 break-all truncate font-semibold">
                      {selectedFetchResult.final_url || selectedFetchResult.url}
                    </p>
                  </div>

                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => handleImportLead(selectedFetchResult.title, selectedFetchResult.url, 'tinyfish_fetch')}
                      disabled={importingUrls[selectedFetchResult.url]}
                      className="rounded-lg border border-[#E4E3DD] hover:border-gray-500 bg-white text-[#1C1C1E] px-3.5 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
                    >
                      {importingUrls[selectedFetchResult.url] ? 'Importing...' : '📥 Import as Lead'}
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

                {/* Metadata details */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 rounded-xl bg-[#F4F3EF] border border-[#E4E3DD] text-[10px] text-gray-600 font-semibold mb-4 leading-relaxed shrink-0">
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

                {/* Extracted Markdown Content */}
                <div className="flex-1 overflow-y-auto p-5 rounded-xl bg-[#F4F3EF] border border-[#E4E3DD] font-mono text-xs text-gray-700 leading-relaxed whitespace-pre-wrap select-text selection:bg-amber-100">
                  {selectedFetchResult.text || (
                    <span className="italic text-gray-400">This URL yielded no readable text content.</span>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-[#E4E3DD] bg-gray-50/20 p-12 text-center flex flex-col items-center justify-center h-[580px]">
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
    </div>
  )
}
