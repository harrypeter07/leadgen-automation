'use client'

import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { formatDistanceToNow } from 'date-fns'
import type { Lead, LeadStatus } from '@/types/lead'
import StatusBadge from './components/StatusBadge'

const PER_PAGE = 25

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

  useEffect(() => {
    fetchCategories()
  }, [])

  useEffect(() => {
    fetchLeads()
    setSelectedIds([]) // clear selection when filters/page changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, status, city, category, page])

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
    setPage(1)
  }

  const totalPages = Math.max(1, Math.ceil(totalLeads / PER_PAGE))
  const startIdx = totalLeads === 0 ? 0 : (page - 1) * PER_PAGE + 1
  const endIdx = Math.min(page * PER_PAGE, totalLeads)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Leads Pipeline</h1>
          <p className="mt-1 text-sm text-gray-400">Total Leads Found: {totalLeads}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            disabled={totalLeads === 0}
            className="flex items-center gap-2 rounded-lg bg-gray-900 border border-gray-800 px-4 py-2 text-sm font-semibold text-gray-200 hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed hover:border-gray-700 transition-all duration-150"
          >
            📥 Export CSV
          </button>
        </div>
      </div>

      {/* Filter Bar (Sticky Top) */}
      <div className="sticky top-0 z-25 bg-gray-950/80 backdrop-blur-md py-2 border-b border-gray-800/40">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 bg-gray-900 border border-gray-800 p-4 rounded-xl shadow-xl">
          {/* Search Input */}
          <div className="col-span-2 md:col-span-1">
            <label htmlFor="search" className="block text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wider">Search</label>
            <input
              id="search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name or phone..."
              className="w-full rounded-lg bg-gray-950 border border-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
            />
          </div>

          {/* Status Dropdown */}
          <div>
            <label htmlFor="status" className="block text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wider">Status</label>
            <select
              id="status"
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1); }}
              className="w-full rounded-lg bg-gray-950 border border-gray-800 px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500 transition-colors"
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
            <label htmlFor="city" className="block text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wider">City</label>
            <input
              id="city"
              type="text"
              value={city}
              onChange={(e) => { setCity(e.target.value); setPage(1); }}
              placeholder="e.g. Mumbai"
              className="w-full rounded-lg bg-gray-950 border border-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
            />
          </div>

          {/* Category Dropdown */}
          <div>
            <label htmlFor="category" className="block text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wider">Category</label>
            <select
              id="category"
              value={category}
              onChange={(e) => { setCategory(e.target.value); setPage(1); }}
              className="w-full rounded-lg bg-gray-950 border border-gray-800 px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500 transition-colors"
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
              className="w-full rounded-lg border border-gray-800 bg-gray-950 hover:bg-gray-900 hover:border-gray-700 py-2.5 text-sm font-semibold text-gray-300 transition-all duration-150"
            >
              🧹 Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-purple-950/20 border border-purple-900/60 p-4 rounded-xl animate-fade-in">
          <span className="text-sm font-medium text-purple-300">
            Selected <strong className="text-white">{selectedIds.length}</strong> leads
          </span>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleBulkSendWhatsapp}
              className="rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs px-3.5 py-2 transition-colors duration-150"
            >
              💬 Send WhatsApp (AI)
            </button>
            <button
              onClick={handleBulkMarkReplied}
              className="rounded-lg border border-purple-900 bg-gray-950 hover:bg-gray-900 text-purple-300 font-semibold text-xs px-3.5 py-2 transition-colors duration-150"
            >
              ✓ Mark Replied
            </button>
            <button
              onClick={handleBulkDelete}
              className="rounded-lg bg-red-950/60 border border-red-900 text-red-300 hover:bg-red-900/40 font-semibold text-xs px-3.5 py-2 transition-colors duration-150"
            >
              🗑️ Delete Selected
            </button>
          </div>
        </div>
      )}

      {/* Table Section */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/40 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-800 text-sm">
            <thead className="bg-gray-900/60">
              <tr className="text-left text-gray-400">
                <th className="px-5 py-3.5 text-left w-12">
                  <input
                    type="checkbox"
                    checked={leads.length > 0 && selectedIds.length === leads.length}
                    onChange={handleSelectAll}
                    className="rounded border-gray-800 bg-gray-950 text-purple-600 focus:ring-purple-500/20 w-4 h-4 cursor-pointer"
                    aria-label="Select all leads"
                  />
                </th>
                <th className="px-5 py-3.5 font-bold">Name</th>
                <th className="px-5 py-3.5 font-bold">Phone</th>
                <th className="px-5 py-3.5 font-bold">City</th>
                <th className="px-5 py-3.5 font-bold">Category</th>
                <th className="px-5 py-3.5 font-bold">Status</th>
                <th className="px-5 py-3.5 font-bold text-center">AI Ready</th>
                <th className="px-5 py-3.5 font-bold">Created</th>
                <th className="px-5 py-3.5 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/40">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <span className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
                      Loading pipeline leads...
                    </div>
                  </td>
                </tr>
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center text-gray-500 font-medium">
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
                    <tr key={lead.id} className={`hover:bg-gray-800/10 transition-colors duration-150 ${isChecked ? 'bg-purple-950/5' : ''}`}>
                      <td className="px-5 py-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => handleSelectRow(lead.id, e.target.checked)}
                          className="rounded border-gray-800 bg-gray-950 text-purple-600 focus:ring-purple-500/20 w-4 h-4 cursor-pointer"
                          aria-label={`Select ${lead.name}`}
                        />
                      </td>
                      <td className="px-5 py-3 text-white font-bold max-w-[200px] truncate" title={lead.name}>{lead.name}</td>
                      <td className="px-5 py-3 text-gray-300 font-medium">{lead.phone || '—'}</td>
                      <td className="px-5 py-3 text-gray-400">{lead.city || '—'}</td>
                      <td className="px-5 py-3 text-gray-400">{lead.category || '—'}</td>
                      <td className="px-5 py-3">
                        <StatusBadge status={lead.status} />
                      </td>
                      <td className="px-5 py-3 text-center">
                        {isAiReady ? (
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-green-500/10 text-green-400 border border-green-500/20 font-bold" title="AI Outreach Copy Generated">✓</span>
                        ) : (
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-gray-800 text-gray-500 border border-gray-700 font-bold" title="AI Outreach Copy Missing">✗</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-gray-500 whitespace-nowrap">
                        {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true })}
                      </td>
                      <td className="px-5 py-3 text-right relative">
                        {isRowActionLoading ? (
                          <span className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin inline-block align-middle mr-2" />
                        ) : (
                          <div className="inline-block text-left">
                            <button
                              onClick={() => setActiveMenuId(isDropdownActive ? null : lead.id)}
                              type="button"
                              className="p-1 rounded bg-gray-900 border border-gray-800 text-gray-400 hover:text-white hover:border-gray-700 focus:outline-none transition-colors"
                              aria-label="Lead Actions"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                              </svg>
                            </button>

                            {/* Dropdown Menu */}
                            {isDropdownActive && (
                              <>
                                <div className="fixed inset-0 z-30" onClick={() => setActiveMenuId(null)} />
                                <div className="absolute right-0 mt-2 w-48 rounded-lg bg-gray-900 border border-gray-800 shadow-2xl z-40 py-1 overflow-hidden animate-fade-in">
                                  {isAiReady && (
                                    <button
                                      onClick={() => {
                                        setSelectedLeadForModal(lead)
                                        setModalTab('whatsapp')
                                        setActiveMenuId(null)
                                      }}
                                      className="flex items-center gap-2 w-full text-left px-4 py-2 text-xs text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
                                    >
                                      👁️ View AI Messages
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleSendWhatsapp(lead)}
                                    disabled={!lead.phone || !isAiReady}
                                    className="flex items-center gap-2 w-full text-left px-4 py-2 text-xs text-gray-300 hover:bg-gray-800 hover:text-white disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-gray-300 transition-colors"
                                  >
                                    💬 Send WhatsApp (AI)
                                  </button>
                                  <button
                                    onClick={() => handleSendEmail(lead)}
                                    disabled={!lead.email || !lead.ai_message_email_subject}
                                    className="flex items-center gap-2 w-full text-left px-4 py-2 text-xs text-gray-300 hover:bg-gray-800 hover:text-white disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-gray-300 transition-colors"
                                  >
                                    📧 Send Email (AI)
                                  </button>
                                  <hr className="border-gray-800" />
                                  <button
                                    onClick={() => handleUpdateStatus(lead.id, 'replied')}
                                    className="flex items-center gap-2 w-full text-left px-4 py-2 text-xs text-amber-400 hover:bg-gray-800 transition-colors"
                                  >
                                    ✓ Mark Replied
                                  </button>
                                  <button
                                    onClick={() => handleUpdateStatus(lead.id, 'converted')}
                                    className="flex items-center gap-2 w-full text-left px-4 py-2 text-xs text-green-400 hover:bg-gray-800 transition-colors"
                                  >
                                    ✓ Mark Converted
                                  </button>
                                  <button
                                    onClick={() => handleUpdateStatus(lead.id, 'skip')}
                                    className="flex items-center gap-2 w-full text-left px-4 py-2 text-xs text-gray-400 hover:bg-gray-800 transition-colors"
                                  >
                                    ⊘ Skip Lead
                                  </button>
                                  <hr className="border-gray-800" />
                                  <button
                                    onClick={() => handleDeleteLead(lead.id)}
                                    className="flex items-center gap-2 w-full text-left px-4 py-2 text-xs text-red-400 hover:bg-gray-800 transition-colors"
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
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>
            Showing <strong className="text-white">{startIdx}-{endIdx}</strong> of <strong className="text-white">{totalLeads}</strong> leads
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(prev => Math.max(1, prev - 1))}
              disabled={page === 1}
              className="rounded-lg border border-gray-800 bg-gray-900 px-3.5 py-1.5 hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <span className="font-semibold text-white">Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
              disabled={page === totalPages}
              className="rounded-lg border border-gray-800 bg-gray-900 px-3.5 py-1.5 hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* AI Message Viewer Modal */}
      {selectedLeadForModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setSelectedLeadForModal(null)} />
          
          <div className="relative w-full max-w-lg rounded-xl border border-gray-800 bg-gray-900 shadow-2xl overflow-hidden animate-fade-in">
            {/* Modal Header */}
            <div className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">AI Messages: {selectedLeadForModal.name}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{selectedLeadForModal.category || 'No Category'} | {selectedLeadForModal.city || 'No City'}</p>
              </div>
              <button
                onClick={() => setSelectedLeadForModal(null)}
                className="text-gray-400 hover:text-white transition-colors"
                aria-label="Close modal"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-gray-800 text-sm font-semibold">
              <button
                onClick={() => setModalTab('whatsapp')}
                className={`flex-1 text-center py-3 border-b-2 transition-all ${
                  modalTab === 'whatsapp'
                    ? 'border-purple-500 text-purple-400 bg-purple-500/5'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                💬 WhatsApp Message
              </button>
              <button
                onClick={() => setModalTab('email')}
                className={`flex-1 text-center py-3 border-b-2 transition-all ${
                  modalTab === 'email'
                    ? 'border-purple-500 text-purple-400 bg-purple-500/5'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
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
                  <div className="rounded-xl bg-[#0b141a] p-4 border border-gray-800/80">
                    <div className="max-w-[85%] rounded-lg bg-[#202c33] p-3 text-sm text-gray-100 relative shadow border border-gray-700/30">
                      <span className="block whitespace-pre-wrap">{selectedLeadForModal.ai_message_whatsapp || 'No WhatsApp Copy Generated'}</span>
                      <span className="block text-[10px] text-gray-500 text-right mt-1.5">just now</span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      handleSendWhatsapp(selectedLeadForModal)
                      setSelectedLeadForModal(null)
                    }}
                    disabled={!selectedLeadForModal.phone || !selectedLeadForModal.ai_message_whatsapp}
                    className="w-full rounded-lg bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white font-semibold py-2.5 text-sm transition-colors duration-150"
                  >
                    🚀 Send WhatsApp Now
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-3 rounded-lg bg-gray-950 border border-gray-800 p-4 text-sm text-gray-200">
                    <div>
                      <span className="text-xs text-gray-500 block font-semibold uppercase tracking-wider">Subject</span>
                      <p className="text-white font-bold mt-1 text-sm">{selectedLeadForModal.ai_message_email_subject || 'No Subject Generated'}</p>
                    </div>
                    <hr className="border-gray-800" />
                    <div>
                      <span className="text-xs text-gray-500 block font-semibold uppercase tracking-wider">Body</span>
                      <p className="whitespace-pre-wrap text-gray-300 mt-1 text-xs leading-relaxed">{selectedLeadForModal.ai_message_email_body || 'No Email Body Generated'}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      handleSendEmail(selectedLeadForModal)
                      setSelectedLeadForModal(null)
                    }}
                    disabled={!selectedLeadForModal.email || !selectedLeadForModal.ai_message_email_subject}
                    className="w-full rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-semibold py-2.5 text-sm transition-colors duration-150"
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
