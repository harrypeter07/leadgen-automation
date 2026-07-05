// dashboard/src/app/leads/page.tsx
'use client'

import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { formatDistanceToNow } from 'date-fns'
import type { Lead, LeadStatus } from '@/types/lead'
import StatusBadge from './components/StatusBadge'

const PER_PAGE = 25

interface JobOption {
  id: string
  keyword: string
  city: string
  current_provider: string
  created_at: string
  status: string
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [totalLeads, setTotalLeads] = useState(0)
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  // Filters State
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [status, setStatus] = useState('')
  const [city, setCity] = useState('')
  const [category, setCategory] = useState('')
  const [jobs, setJobs] = useState<JobOption[]>([])
  const [selectedJobId, setSelectedJobId] = useState('')
  const [jobSearch, setJobSearch] = useState('')
  const [showJobDropdown, setShowJobDropdown] = useState(false)

  // Pagination State
  const [page, setPage] = useState(1)

  // Bulk Selection State
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  // Modal State
  const [selectedLeadForModal, setSelectedLeadForModal] = useState<Lead | null>(null)
  const [modalTab, setModalTab] = useState<'whatsapp' | 'email'>('whatsapp')

  // Row Action Menu State
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null)

  // Loader state for row actions
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  // ─── Background WA Scan State ──────────────────────────────────────────────
  type ScanStatus = {
    running: boolean
    aborted: boolean
    startedAt: string | null
    total: number
    checked: number
    waCount: number
    noWaCount: number
    errCount: number
    currentName: string | null
    currentPhone: string | null
    logs: string[]
  }
  const [scanStatus, setScanStatus]         = useState<ScanStatus | null>(null)
  const [scanPolling, setScanPolling]       = useState<ReturnType<typeof setInterval> | null>(null)
  const [scanPanelOpen, setScanPanelOpen]   = useState(false)

  // Poll backend scan status every 3 seconds while scan is running
  async function pollScanStatus() {
    try {
      const res = await fetch('/api/scraper/whatsapp-scan/status')
      if (!res.ok) return
      const data: ScanStatus = await res.json()
      setScanStatus(data)

      if (!data.running) {
        // Scan finished — stop polling and refresh leads to show new badges
        setScanPolling(prev => { if (prev) clearInterval(prev); return null })
        if (data.checked > 0) {
          toast.success(`✅ WA Scan done! ${data.waCount} on WhatsApp, ${data.noWaCount} not on WA.`)
          fetchLeads() // refresh badges
        }
      }
    } catch {
      // ignore transient errors
    }
  }

  // Start polling
  function startPolling() {
    const iv = setInterval(pollScanStatus, 3000)
    setScanPolling(iv)
    return iv
  }

  // Stop polling on unmount
  useEffect(() => {
    return () => { if (scanPolling) clearInterval(scanPolling) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanPolling])

  // On mount: check if a scan is already running (e.g. started in prev tab)
  useEffect(() => {
    pollScanStatus().then(() => {
      setScanStatus(prev => {
        if (prev?.running) { setScanPanelOpen(true); startPolling() }
        return prev
      })
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleStartWAScan() {
    if (scanStatus?.running) {
      setScanPanelOpen(true)
      return
    }
    setScanPanelOpen(true)

    const res = await fetch('/api/scraper/whatsapp-scan/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        job_id:     selectedJobId || undefined,
        city:       city.trim()  || undefined,
        intervalMs: 5000,
      }),
    })
    const data = await res.json()

    if (!res.ok) {
      if (res.status === 409) {
        toast('A scan is already running!', { icon: '⚠️' })
        setScanStatus(data.status)
        startPolling()
        return
      }
      toast.error(data.error || 'Failed to start scan')
      return
    }

    toast.success('🔍 WhatsApp scan started in background!')
    await pollScanStatus()
    startPolling()
  }

  async function handleStopWAScan() {
    const res = await fetch('/api/scraper/whatsapp-scan/stop', { method: 'POST' })
    if (res.ok) {
      toast('⏹ Stop signal sent — finishing current lead…', { icon: '⏸' })
      await pollScanStatus()
    }
  }


  function copyToClipboard(text: string, type: string) {
    navigator.clipboard.writeText(text)
    toast.success(`${type} copied to clipboard!`)
  }

  // Debouncing search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1) // reset to first page on search
    }, 300)
    return () => clearTimeout(handler)
  }, [search])

  // Fetch unique categories via server-side API (bypasses RLS)
  async function fetchCategories() {
    try {
      const res = await fetch('/api/leads?perPage=1000&page=1')
      if (!res.ok) return
      const data = await res.json()
      const cats = Array.from(
        new Set((data.leads ?? []).map((l: Lead) => l.category).filter(Boolean))
      ) as string[]
      setCategories(cats.sort())
    } catch (err) {
      console.error('Error fetching categories:', err)
    }
  }

  // Fetch leads via server-side API route (service role key — bypasses RLS)
  async function fetchLeads() {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page:    String(page),
        perPage: String(PER_PAGE),
      })
      if (status)              params.set('status',   status)
      if (city.trim())         params.set('city',     city.trim())
      if (category)            params.set('category', category)
      if (selectedJobId)       params.set('job_id',   selectedJobId)
      if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim())

      const res = await fetch(`/api/leads?${params.toString()}`)
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Failed to load leads')

      setLeads((data.leads ?? []) as Lead[])
      setTotalLeads(data.total ?? 0)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load leads'
      console.error('[Leads Page] fetchLeads error:', message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  async function fetchJobs() {
    try {
      const res = await fetch('/api/scraper/jobs')
      const data = await res.json()
      if (res.ok && data.jobs) {
        setJobs(data.jobs)
      }
    } catch (err) {
      console.error('Failed to fetch jobs:', err)
    }
  }

  // Close job dropdown when clicking outside
  useEffect(() => {
    if (!showJobDropdown) return
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.relative')) {
        setShowJobDropdown(false)
      }
    }
    document.addEventListener('click', handleOutsideClick)
    return () => document.removeEventListener('click', handleOutsideClick)
  }, [showJobDropdown])

  useEffect(() => {
    fetchCategories()
    fetchJobs()
  }, [])

  useEffect(() => {
    fetchLeads()
    setSelectedIds([]) // clear selection when filters/page changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, status, city, category, page, selectedJobId])

  // --- Row Actions ---
  async function handleUpdateStatus(id: string, newStatus: LeadStatus) {
    setActionLoadingId(id)
    const toastId = toast.loading(`Updating status to ${newStatus}...`)
    try {
      const res = await fetch(`/api/leads/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to update status')
      }
      toast.success('Status updated!', { id: toastId })
      fetchLeads()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update status'
      toast.error(message, { id: toastId })
    } finally {
      setActionLoadingId(null)
      setActiveMenuId(null)
    }
  }

  async function handleDeleteLead(id: string) {
    if (!confirm('Are you sure you want to delete this lead?')) return
    setActionLoadingId(id)
    const toastId = toast.loading('Deleting lead...')
    try {
      const res = await fetch(`/api/leads/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to delete lead')
      }
      toast.success('Lead deleted!', { id: toastId })
      fetchLeads()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete lead'
      toast.error(message, { id: toastId })
    } finally {
      setActionLoadingId(null)
      setActiveMenuId(null)
    }
  }

  async function handleSendWhatsapp(lead: Lead) {
    if (!lead.phone) {
      toast.error('Lead does not have a phone number')
      return
    }
    if (!lead.ai_message_whatsapp) {
      toast.error('WhatsApp AI message has not been generated')
      return
    }

    setActionLoadingId(lead.id)
    const toastId = toast.loading('Sending WhatsApp outreach...')
    try {
      const res = await fetch(`/api/leads/${lead.id}/send-whatsapp`, { method: 'POST' })
      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to send WhatsApp message')
      }
      toast.success('WhatsApp outreach sent successfully!', { id: toastId })
      fetchLeads()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to send WhatsApp'
      toast.error(message, { id: toastId })
    } finally {
      setActionLoadingId(null)
      setActiveMenuId(null)
    }
  }

  async function handleSendEmail(lead: Lead) {
    if (!lead.email) {
      toast.error('Lead does not have an email address')
      return
    }
    if (!lead.ai_message_email_subject || !lead.ai_message_email_body) {
      toast.error('Email AI message copy has not been generated')
      return
    }

    setActionLoadingId(lead.id)
    const toastId = toast.loading('Sending Email outreach...')
    try {
      const res = await fetch(`/api/leads/${lead.id}/send-email`, { method: 'POST' })
      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to send email')
      }
      toast.success('Outreach email sent successfully!', { id: toastId })
      fetchLeads()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to send email'
      toast.error(message, { id: toastId })
    } finally {
      setActionLoadingId(null)
      setActiveMenuId(null)
    }
  }

  // --- Bulk Actions ---
  function handleSelectAll(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.checked) {
      setSelectedIds(leads.map(lead => lead.id))
    } else {
      setSelectedIds([])
    }
  }

  function handleSelectRow(id: string, checked: boolean) {
    if (checked) {
      setSelectedIds(prev => [...prev, id])
    } else {
      setSelectedIds(prev => prev.filter(item => item !== id))
    }
  }

  async function handleBulkSendWhatsapp() {
    const selectedLeads = leads.filter(l => selectedIds.includes(l.id))
    const readyLeads = selectedLeads.filter(l => l.phone && l.ai_message_whatsapp)

    if (readyLeads.length === 0) {
      toast.error('None of the selected leads are ready for WhatsApp (need phone & AI message)')
      return
    }

    if (!confirm(`Send WhatsApp messages to ${readyLeads.length} leads?`)) return

    const toastId = toast.loading(`Sending bulk WhatsApp outreach (${readyLeads.length} messages)...`)
    let successCount = 0
    let failCount = 0

    for (const lead of readyLeads) {
      try {
        const res = await fetch(`/api/leads/${lead.id}/send-whatsapp`, { method: 'POST' })
        if (res.ok) successCount++
        else failCount++
      } catch {
        failCount++
      }
    }

    toast.success(`Outreach done: ${successCount} sent, ${failCount} failed.`, { id: toastId })
    setSelectedIds([])
    fetchLeads()
  }

  async function handleBulkMarkReplied() {
    if (!confirm(`Mark ${selectedIds.length} selected leads as Replied?`)) return
    const toastId = toast.loading(`Updating ${selectedIds.length} leads...`)
    let successCount = 0

    for (const id of selectedIds) {
      try {
        const res = await fetch(`/api/leads/${id}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'replied' }),
        })
        if (res.ok) successCount++
      } catch {}
    }

    toast.success(`Successfully marked ${successCount} leads as Replied.`, { id: toastId })
    setSelectedIds([])
    fetchLeads()
  }

  async function handleBulkDelete() {
    if (!confirm(`Delete ${selectedIds.length} leads permanently?`)) return
    const toastId = toast.loading(`Deleting ${selectedIds.length} leads...`)
    let successCount = 0

    for (const id of selectedIds) {
      try {
        const res = await fetch(`/api/leads/${id}`, { method: 'DELETE' })
        if (res.ok) successCount++
      } catch {}
    }

    toast.success(`Successfully deleted ${successCount} leads.`, { id: toastId })
    setSelectedIds([])
    fetchLeads()
  }

  // Export CSV
  function handleExportCsv() {
    const params = new URLSearchParams()
    if (status) params.set('status', status)
    if (city.trim()) params.set('city', city.trim())
    if (category) params.set('category', category)
    
    // Redirect browser to trigger CSV download API
    window.location.href = `/api/leads/export?${params.toString()}`
    toast.success('Initiating CSV export download')
  }

  // Clear filters helper
  function clearAllFilters() {
    setStatus('')
    setCity('')
    setCategory('')
    setSearch('')
    setSelectedJobId('')
    setPage(1)
  }

  const totalPages = Math.max(1, Math.ceil(totalLeads / PER_PAGE))
  const startIdx = totalLeads === 0 ? 0 : (page - 1) * PER_PAGE + 1
  const endIdx = Math.min(page * PER_PAGE, totalLeads)

  return (
    <div className="space-y-6 text-[#2D2D2D] select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-[#1C1C1E] tracking-tight">Leads Pipeline</h1>
          <p className="mt-1 text-sm text-gray-500 font-medium">Total Active Leads: {totalLeads}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* WA Scan Button */}
          <button
            onClick={handleStartWAScan}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold uppercase tracking-wider shadow-sm transition-all ${
              scanStatus?.running
                ? 'bg-yellow-500 hover:bg-yellow-600 text-white animate-pulse'
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            {scanStatus?.running ? `🔍 Scanning ${scanStatus.checked}/${scanStatus.total}…` : '🔍 Identify WhatsApp'}
          </button>

          {/* Stop button shown only while running */}
          {scanStatus?.running && (
            <button
              onClick={handleStopWAScan}
              className="flex items-center gap-2 rounded-xl bg-red-500 hover:bg-red-600 text-white px-3 py-2.5 text-xs font-bold uppercase tracking-wider shadow-sm transition-all"
            >
              ⏹ Stop
            </button>
          )}

          {/* Scan log panel toggle */}
          {scanStatus && (
            <button
              onClick={() => setScanPanelOpen(v => !v)}
              className="flex items-center gap-1 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-gray-600 px-3 py-2.5 text-xs font-bold uppercase tracking-wider shadow-sm transition-all"
            >
              📋 Logs
            </button>
          )}

          <button
            onClick={handleExportCsv}
            disabled={totalLeads === 0}
            className="flex items-center gap-2 rounded-xl bg-white border border-[#E4E3DD] px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm transition-all"
          >
            📥 Export CSV
          </button>
        </div>
      </div>

      {/* ── WA Scan Live Progress Panel ─────────────────────────────────────── */}
      {scanStatus && scanPanelOpen && (
        <div className="bg-gray-900 text-green-300 rounded-2xl p-4 shadow-lg border border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              🔍 WhatsApp Scan
              {scanStatus.running ? (
                <span className="bg-yellow-500 text-yellow-900 text-[10px] px-2 py-0.5 rounded-full font-black animate-pulse">LIVE</span>
              ) : (
                <span className="bg-gray-600 text-gray-200 text-[10px] px-2 py-0.5 rounded-full font-black">DONE</span>
              )}
            </h3>
            <button onClick={() => setScanPanelOpen(false)} className="text-gray-400 hover:text-white text-lg">✕</button>
          </div>
          {/* Progress Bar */}
          <div className="mb-3">
            <div className="flex justify-between text-[11px] text-gray-400 mb-1">
              <span>{scanStatus.checked}/{scanStatus.total} checked</span>
              <span>✅ {scanStatus.waCount} WA · ❌ {scanStatus.noWaCount} No-WA · ⚠️ {scanStatus.errCount} err</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all duration-700"
                style={{ width: scanStatus.total > 0 ? `${Math.round((scanStatus.checked / scanStatus.total) * 100)}%` : '0%' }}
              />
            </div>
          </div>
          {scanStatus.currentName && (
            <p className="text-[11px] text-yellow-300 mb-2">⏳ Currently: {scanStatus.currentName} ({scanStatus.currentPhone})</p>
          )}
          {/* Logs */}
          <div className="max-h-40 overflow-y-auto font-mono text-[10px] space-y-0.5">
            {(scanStatus.logs ?? []).slice(0, 20).map((line, i) => (
              <div key={i} className="text-gray-300 leading-relaxed">{line}</div>
            ))}
          </div>
        </div>
      )}

      {/* Filter Bar (Sticky Top) */}
      <div className="sticky top-0 z-20 bg-[#F4F3EF]/90 backdrop-blur-md py-2 border-b border-[#E4E3DD]/40">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 bg-white border border-[#E4E3DD] p-4 rounded-2xl shadow-sm">
          {/* Search Input */}
          <div className="col-span-2 md:col-span-1">
            <label htmlFor="search" className="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-wider">Search</label>
            <input
              id="search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name or phone..."
              className="w-full rounded-xl bg-[#F4F3EF] border border-[#E4E3DD] px-3.5 py-2.5 text-xs text-[#2D2D2D] font-semibold placeholder-gray-400 focus:outline-none focus:border-gray-500 transition-colors"
            />
          </div>

          {/* Scrape Job Filter */}
          <div className="relative col-span-2 md:col-span-1">
            <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-wider">Filter Scrape Run</label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowJobDropdown(!showJobDropdown)}
                className="w-full flex justify-between items-center rounded-xl bg-[#F4F3EF] border border-[#E4E3DD] px-3.5 py-2.5 text-xs text-[#2D2D2D] font-bold text-left focus:outline-none focus:border-gray-500 transition-colors"
              >
                <span className="truncate">
                  {selectedJobId 
                    ? (() => {
                        const job = jobs.find(j => j.id === selectedJobId)
                        if (!job) return 'All Jobs'
                        const providerLabel = job.current_provider?.replace('google_maps', 'G-Maps').replace('google_search', 'Search')
                        const cleanKeyword = job.keyword.replace(/\s*\[Area:.*?\]$/, '')
                        return `📌 [${providerLabel}] ${cleanKeyword} in ${job.city}`
                      })()
                    : 'All Jobs'}
                </span>
                <span className="ml-2 text-[10px] text-gray-400">▼</span>
              </button>

              {showJobDropdown && (
                <div className="absolute left-0 right-0 mt-2 bg-white border border-[#E4E3DD] rounded-2xl p-3 shadow-xl z-30 max-h-[300px] flex flex-col gap-2 w-[280px] md:w-[320px]">
                  <input
                    type="text"
                    value={jobSearch}
                    onChange={(e) => setJobSearch(e.target.value)}
                    placeholder="Search job keyword/city..."
                    className="w-full rounded-lg bg-[#F4F3EF] border border-[#E4E3DD] px-3 py-2 text-xs font-semibold placeholder-gray-400 focus:outline-none focus:border-gray-500"
                  />
                  <div className="overflow-y-auto flex-1 flex flex-col divide-y divide-[#F4F3EF] max-h-[200px]">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedJobId('')
                        setShowJobDropdown(false)
                        setJobSearch('')
                        setPage(1)
                      }}
                      className={`w-full text-left py-2 px-2 text-xs font-semibold hover:bg-[#F4F3EF] rounded-lg transition-colors ${!selectedJobId ? 'text-black bg-[#F4F3EF]' : 'text-gray-600'}`}
                    >
                      🌍 Show All Jobs
                    </button>
                    {jobs.filter(job => {
                      const q = jobSearch.toLowerCase()
                      return (
                        (job.keyword || '').toLowerCase().includes(q) ||
                        (job.city || '').toLowerCase().includes(q) ||
                        (job.current_provider || '').toLowerCase().includes(q)
                      )
                    }).map((job) => {
                      const providerLabel = job.current_provider?.replace('google_maps', 'G-Maps').replace('google_search', 'Search')
                      const dateLabel = new Date(job.created_at).toLocaleDateString()
                      const timeLabel = new Date(job.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      
                      let displayKeyword = job.keyword
                      let areaTag = ''
                      const areaMatch = job.keyword.match(/^(.*?)\s*\[Area:\s*(.*?)\]$/)
                      if (areaMatch) {
                        displayKeyword = areaMatch[1]
                        areaTag = ` (${areaMatch[2]})`
                      }

                      return (
                        <button
                          key={job.id}
                          type="button"
                          onClick={() => {
                            setSelectedJobId(job.id)
                            setShowJobDropdown(false)
                            setJobSearch('')
                            setPage(1)
                          }}
                          className={`w-full text-left py-2.5 px-2 text-xs hover:bg-[#F4F3EF] rounded-lg transition-colors flex flex-col gap-0.5 ${selectedJobId === job.id ? 'bg-[#F4F3EF] text-black font-bold' : 'text-gray-600'}`}
                        >
                          <span className="font-bold truncate text-[#1C1C1E] text-left">
                            📌 [{providerLabel}] {displayKeyword}{areaTag} in {job.city}
                          </span>
                          <span className="text-[10px] text-gray-400 text-left">
                            📅 Run on {dateLabel} at {timeLabel}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Status Dropdown */}
          <div>
            <label htmlFor="status" className="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-wider">Status</label>
            <select
              id="status"
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1); }}
              className="w-full rounded-xl bg-[#F4F3EF] border border-[#E4E3DD] px-3.5 py-2.5 text-xs text-[#2D2D2D] font-bold focus:outline-none focus:border-gray-500 transition-colors"
            >
              <option value="">All Statuses</option>
              <option value="new">New</option>
              <option value="whatsapp_sent">WhatsApp Sent</option>
              <option value="email_sent">Email Sent</option>
              <option value="replied">Replied</option>
              <option value="converted">Converted</option>
              <option value="skip">Skipped</option>
            </select>
          </div>

          {/* City Input */}
          <div>
            <label htmlFor="city" className="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-wider">City</label>
            <input
              id="city"
              type="text"
              value={city}
              onChange={(e) => { setCity(e.target.value); setPage(1); }}
              placeholder="e.g. Mumbai"
              className="w-full rounded-xl bg-[#F4F3EF] border border-[#E4E3DD] px-3.5 py-2.5 text-xs text-[#2D2D2D] font-semibold placeholder-gray-400 focus:outline-none focus:border-gray-500 transition-colors"
            />
          </div>

          {/* Category Dropdown */}
          <div>
            <label htmlFor="category" className="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-wider">Category</label>
            <select
              id="category"
              value={category}
              onChange={(e) => { setCategory(e.target.value); setPage(1); }}
              className="w-full rounded-xl bg-[#F4F3EF] border border-[#E4E3DD] px-3.5 py-2.5 text-xs text-[#2D2D2D] font-bold focus:outline-none focus:border-gray-500 transition-colors"
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Clear Filters Button */}
          <div className="flex items-end col-span-2 md:col-span-1">
            <button
              onClick={clearAllFilters}
              type="button"
              className="w-full rounded-xl border border-[#E4E3DD] bg-gray-50 hover:bg-gray-100 py-3 text-xs font-bold uppercase tracking-wider text-gray-700 transition-all"
            >
              🧹 Clear
            </button>
          </div>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-purple-50/50 border border-purple-200 p-4 rounded-2xl animate-fade-in">
          <span className="text-xs font-bold text-purple-950 uppercase tracking-wider">
            Selected <strong className="text-purple-700">{selectedIds.length}</strong> leads
          </span>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleBulkSendWhatsapp}
              className="rounded-xl bg-[#1C1C1E] hover:bg-[#252528] text-white font-bold uppercase tracking-wider text-[10px] px-4 py-2.5 transition-colors shadow-sm"
            >
              💬 Send WhatsApp (AI)
            </button>
            <button
              onClick={handleBulkMarkReplied}
              className="rounded-xl border border-purple-200 bg-white hover:bg-gray-50 text-purple-700 font-bold uppercase tracking-wider text-[10px] px-4 py-2.5 transition-colors"
            >
              ✓ Mark Replied
            </button>
            <button
              onClick={handleBulkDelete}
              className="rounded-xl bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 font-bold uppercase tracking-wider text-[10px] px-4 py-2.5 transition-colors"
            >
              🗑️ Delete
            </button>
          </div>
        </div>
      )}

      {/* Table Section */}
      <div className="rounded-2xl border border-[#E4E3DD] bg-white overflow-hidden shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)]">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[#E4E3DD]/60 text-xs">
            <thead className="bg-gray-50/50">
              <tr className="text-left text-gray-400 uppercase tracking-wider text-[9px] font-bold">
                <th className="px-5 py-4 text-left w-12">
                  <input
                    type="checkbox"
                    checked={leads.length > 0 && selectedIds.length === leads.length}
                    onChange={handleSelectAll}
                    className="rounded border-[#E4E3DD] bg-gray-50 text-gray-900 focus:ring-gray-400 w-4 h-4 cursor-pointer"
                    aria-label="Select all leads"
                  />
                </th>
                <th className="px-5 py-4 font-bold">Name</th>
                <th className="px-5 py-4 font-bold">Phone</th>
                <th className="px-5 py-4 font-bold">Email</th>
                <th className="px-5 py-4 font-bold">Website</th>
                <th className="px-5 py-4 font-bold">City</th>
                <th className="px-5 py-4 font-bold">Category</th>
                <th className="px-5 py-4 font-bold">Status</th>
                <th className="px-5 py-4 font-bold text-center">AI Message</th>
                <th className="px-5 py-4 font-bold">Created</th>
                <th className="px-5 py-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E3DD]/50 text-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={11} className="px-5 py-16 text-center text-gray-400">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <span className="w-8 h-8 border-4 border-gray-700 border-t-transparent rounded-full animate-spin" />
                      Loading pipeline leads...
                    </div>
                  </td>
                </tr>
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-5 py-12 text-center text-gray-400 font-semibold">
                    No leads match the filter criteria.
                  </td>
                </tr>
              ) : (
                leads.map((lead) => {
                  const isChecked = selectedIds.includes(lead.id)
                  const isAiReady = !!lead.ai_message_whatsapp
                  const isRowActionLoading = actionLoadingId === lead.id
                  const isDropdownActive = activeMenuId === lead.id

                  return (
                    <tr key={lead.id} className={`hover:bg-[#F4F3EF]/30 transition-colors duration-150 ${isChecked ? 'bg-purple-50/20' : ''}`}>
                      <td className="px-5 py-3.5">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => handleSelectRow(lead.id, e.target.checked)}
                          className="rounded border-[#E4E3DD] bg-gray-50 text-gray-900 focus:ring-gray-400 w-4 h-4 cursor-pointer"
                          aria-label={`Select ${lead.name}`}
                        />
                      </td>
                      <td className="px-5 py-3.5 font-bold text-gray-900 max-w-[150px] truncate" title={lead.name}>
                        {lead.name}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-[10px] text-gray-500">
                        {lead.phone ? (() => {
                          const isWhatsApp = lead.notes?.includes('[WhatsApp: Yes]');
                          const isNotWhatsApp = lead.notes?.includes('[WhatsApp: No]');
                          const cleanedPhone = lead.phone.replace(/\D/g, '');

                          if (isWhatsApp) {
                            return (
                              <a
                                href={`https://wa.me/${cleanedPhone}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:underline text-green-700 font-bold flex items-center gap-1.5"
                                title="Open in WhatsApp"
                              >
                                <span>{lead.phone}</span>
                                <span className="text-[9px] bg-green-50 text-green-700 px-1 py-0.5 rounded border border-green-200">WA</span>
                              </a>
                            )
                          }

                          if (isNotWhatsApp) {
                            return (
                              <button
                                onClick={() => copyToClipboard(lead.phone!, 'Phone')}
                                className="hover:underline text-gray-400 flex items-center gap-1.5"
                                title="Click to copy (Not on WhatsApp)"
                              >
                                <span>{lead.phone}</span>
                                <span className="text-[9px] bg-gray-100 text-gray-400 px-1 py-0.5 rounded border border-gray-200">No-WA</span>
                              </button>
                            )
                          }

                          return (
                            <button
                              onClick={() => copyToClipboard(lead.phone!, 'Phone')}
                              className="hover:underline hover:text-[#1C1C1E]"
                              title="Click to copy"
                            >
                              {lead.phone}
                            </button>
                          )
                        })() : '—'}
                      </td>
                      <td className="px-5 py-3.5 max-w-[130px] truncate text-gray-500">
                        {lead.email ? (
                          <a
                            href={`https://mail.google.com/mail/?view=cm&fs=1&to=${lead.email}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline text-purple-700 font-semibold"
                            title="Compose in Gmail"
                          >
                            {lead.email}
                          </a>
                        ) : '—'}
                      </td>
                      <td className="px-5 py-3.5 max-w-[120px] truncate font-semibold text-blue-600">
                        {lead.website ? (
                          <a
                            href={lead.website}
                            target="_blank"
                            rel="noreferrer"
                            className="hover:underline"
                            title={lead.website}
                          >
                            {lead.website.replace(/^https?:\/\//i, '')}
                          </a>
                        ) : '—'}
                      </td>
                      <td className="px-5 py-3.5 text-gray-500 font-medium">{lead.city || '—'}</td>
                      <td className="px-5 py-3.5 text-gray-400 font-bold uppercase tracking-wider text-[9px] max-w-[100px] truncate" title={lead.category || undefined}>
                        {lead.category || '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusBadge status={lead.status} />
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        {isAiReady ? (
                          <button
                            onClick={() => {
                              setSelectedLeadForModal(lead)
                              setModalTab('whatsapp')
                            }}
                            className="px-2.5 py-1 rounded bg-green-50 text-green-700 border border-green-200 text-[9px] font-bold uppercase tracking-wider hover:bg-green-100 transition-colors"
                            title="View AI Copy details"
                          >
                            ✓ Ready
                          </button>
                        ) : (
                          <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Empty</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-gray-400 font-medium whitespace-nowrap text-[10px]">
                        {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true })}
                      </td>
                      <td className="px-5 py-3.5 text-right relative">
                        {isRowActionLoading ? (
                          <span className="inline-block w-4 h-4 border-2 border-gray-700 border-t-transparent rounded-full animate-spin mr-2" />
                        ) : (
                          <div className="inline-block text-left">
                            <button
                              onClick={() => setActiveMenuId(isDropdownActive ? null : lead.id)}
                              className="px-2 py-1 text-gray-500 hover:text-[#1C1C1E] font-bold text-sm bg-gray-50 rounded-lg hover:bg-gray-100 border border-[#E4E3DD] transition-all"
                              aria-label="Lead action options"
                            >
                              •••
                            </button>

                            {/* Dropdown Options */}
                            {isDropdownActive && (
                              <>
                                <div className="fixed inset-0 z-10" onClick={() => setActiveMenuId(null)} />
                                <div className="absolute right-0 mt-1 w-44 rounded-xl border border-[#E4E3DD] bg-white shadow-xl z-20 overflow-hidden text-left py-1 text-xs">
                                  {isAiReady && (
                                    <button
                                      onClick={() => handleSendWhatsapp(lead)}
                                      className="flex items-center w-full px-4 py-2 hover:bg-gray-50 font-bold text-gray-700 text-left"
                                    >
                                      💬 Send WhatsApp
                                    </button>
                                  )}
                                  {lead.email && lead.ai_message_email_subject && (
                                    <button
                                      onClick={() => handleSendEmail(lead)}
                                      className="flex items-center w-full px-4 py-2 hover:bg-gray-50 font-bold text-gray-700 text-left"
                                    >
                                      📧 Send Email Outreach
                                    </button>
                                  )}
                                  <div className="border-t border-[#E4E3DD]/60 my-1" />
                                  <button
                                    onClick={() => handleUpdateStatus(lead.id, 'converted')}
                                    className="flex items-center w-full px-4 py-2 hover:bg-green-50 text-green-700 font-bold text-left"
                                  >
                                    ✓ Mark Converted
                                  </button>
                                  <button
                                    onClick={() => handleUpdateStatus(lead.id, 'replied')}
                                    className="flex items-center w-full px-4 py-2 hover:bg-amber-50 text-amber-700 font-bold text-left"
                                  >
                                    ★ Mark Replied
                                  </button>
                                  <button
                                    onClick={() => handleUpdateStatus(lead.id, 'skip')}
                                    className="flex items-center w-full px-4 py-2 hover:bg-gray-50 text-gray-400 font-bold text-left"
                                  >
                                    ⏹ Mark Skipped
                                  </button>
                                  <div className="border-t border-[#E4E3DD]/60 my-1" />
                                  <button
                                    onClick={() => handleDeleteLead(lead.id)}
                                    className="flex items-center w-full px-4 py-2 hover:bg-red-50 text-red-700 font-bold text-left"
                                  >
                                    🗑️ Delete Lead
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Bar */}
      {!loading && totalLeads > 0 && (
        <div className="flex items-center justify-between text-xs text-gray-500 font-semibold bg-white border border-[#E4E3DD] px-6 py-3 rounded-2xl shadow-sm">
          <span>
            Showing <strong className="text-gray-800">{startIdx}-{endIdx}</strong> of <strong className="text-gray-800">{totalLeads}</strong> leads
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(prev => Math.max(1, prev - 1))}
              disabled={page === 1}
              className="rounded-lg border border-[#E4E3DD] bg-white px-3.5 py-1.5 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <span className="font-bold text-gray-800 px-1">Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
              disabled={page === totalPages}
              className="rounded-lg border border-[#E4E3DD] bg-white px-3.5 py-1.5 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* AI Message Viewer Modal */}
      {selectedLeadForModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedLeadForModal(null)} />
          
          <div className="relative w-full max-w-lg rounded-2xl border border-[#E4E3DD] bg-white shadow-2xl overflow-hidden animate-fade-in text-[#2D2D2D]">
            {/* Modal Header */}
            <div className="border-b border-[#E4E3DD] px-6 py-4 flex items-center justify-between bg-gray-50/50">
              <div>
                <h3 className="text-lg font-black text-gray-900">AI Outreach Editor</h3>
                <p className="text-xs text-gray-400 mt-0.5 font-bold uppercase tracking-wider">{selectedLeadForModal.name}</p>
              </div>
              <button
                onClick={() => setSelectedLeadForModal(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Close modal"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-[#E4E3DD] text-xs font-bold uppercase tracking-wider">
              <button
                onClick={() => setModalTab('whatsapp')}
                className={`flex-1 text-center py-3.5 border-b-2 transition-all ${
                  modalTab === 'whatsapp'
                    ? 'border-[#1C1C1E] text-gray-900 bg-gray-50/30'
                    : 'border-transparent text-gray-450 hover:text-gray-700'
                }`}
              >
                💬 WhatsApp Message
              </button>
              <button
                onClick={() => setModalTab('email')}
                className={`flex-1 text-center py-3.5 border-b-2 transition-all ${
                  modalTab === 'email'
                    ? 'border-[#1C1C1E] text-gray-900 bg-gray-50/30'
                    : 'border-transparent text-gray-450 hover:text-gray-700'
                }`}
              >
                📧 Email Copy
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 max-h-[350px] overflow-y-auto">
              {modalTab === 'whatsapp' ? (
                <div className="space-y-4">
                  {/* WhatsApp style preview bubble */}
                  <div className="rounded-xl bg-[#E5DDD5] p-4 border border-[#D8CFC7] shadow-inner">
                    <div className="max-w-[85%] rounded-xl bg-white p-3 text-xs text-gray-800 relative shadow-sm border border-white">
                      <span className="block whitespace-pre-wrap leading-relaxed">{selectedLeadForModal.ai_message_whatsapp || 'No WhatsApp Copy Generated'}</span>
                      <span className="block text-[9px] text-gray-400 text-right mt-1.5 font-bold">just now</span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      handleSendWhatsapp(selectedLeadForModal)
                      setSelectedLeadForModal(null)
                    }}
                    disabled={!selectedLeadForModal.phone || !selectedLeadForModal.ai_message_whatsapp}
                    className="w-full rounded-xl bg-[#1C1C1E] hover:bg-[#252528] disabled:opacity-40 text-white font-bold uppercase tracking-wider py-3 text-xs transition-colors shadow-sm"
                  >
                    🚀 Send WhatsApp Now
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-3 rounded-xl bg-[#F4F3EF] border border-[#E4E3DD] p-4 text-xs">
                    <div>
                      <span className="text-[9px] text-gray-400 block font-bold uppercase tracking-wider">Subject</span>
                      <p className="text-gray-900 font-bold mt-1 text-sm">{selectedLeadForModal.ai_message_email_subject || 'No Subject Generated'}</p>
                    </div>
                    <hr className="border-[#E4E3DD]/60" />
                    <div>
                      <span className="text-[9px] text-gray-400 block font-bold uppercase tracking-wider">Body</span>
                      <p className="whitespace-pre-wrap text-gray-700 mt-1 text-xs leading-relaxed">{selectedLeadForModal.ai_message_email_body || 'No Email Body Generated'}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      handleSendEmail(selectedLeadForModal)
                      setSelectedLeadForModal(null)
                    }}
                    disabled={!selectedLeadForModal.email || !selectedLeadForModal.ai_message_email_subject}
                    className="w-full rounded-xl bg-[#1C1C1E] hover:bg-[#252528] disabled:opacity-40 text-white font-bold uppercase tracking-wider py-3 text-xs transition-colors shadow-sm"
                  >
                    🚀 Send Email Now
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
