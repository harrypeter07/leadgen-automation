'use client'

import React, { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'

interface Lead {
  id: string
  name: string
  category?: string
  city?: string
  status?: string
  rating?: number
  review_count?: number
  email?: string
  phone?: string
}

export default function CRMPipelinePage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)

  const stages = [
    { id: 'qualified', name: 'Qualified', dbStatus: 'qualified' },
    { id: 'nurtured', name: 'Nurtured', dbStatus: 'nurtured' },
    { id: 'proposal_sent', name: 'Proposal Sent', dbStatus: 'proposal' },
    { id: 'demo_scheduled', name: 'Demo Scheduled', dbStatus: 'demo' },
    { id: 'closed_won', name: 'Closed Won', dbStatus: 'closed_won' }
  ]

  const fetchLeads = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/leads?perPage=100')
      const data = await res.json()
      if (res.ok && data.leads) {
        setLeads(data.leads)
      }
    } catch (err: any) {
      toast.error('Failed to load CRM pipeline leads')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLeads()
  }, [fetchLeads])

  // Maps lead status string to one of our Kanban stage IDs
  const getStageId = (status?: string): string => {
    if (!status) return 'qualified'
    const s = status.toLowerCase()
    if (s === 'new' || s === 'qualified') return 'qualified'
    if (s === 'contacted' || s === 'nurtured') return 'nurtured'
    if (s === 'proposal' || s === 'proposal_sent') return 'proposal_sent'
    if (s === 'demo' || s === 'demo_scheduled') return 'demo_scheduled'
    if (s === 'closed_won' || s === 'won') return 'closed_won'
    return 'qualified'
  }

  const handleMoveStage = async (lead: Lead, direction: 'forward' | 'backward') => {
    const currentStageId = getStageId(lead.status)
    const currentIdx = stages.findIndex(s => s.id === currentStageId)
    const nextIdx = currentIdx + (direction === 'forward' ? 1 : -1)

    if (nextIdx < 0 || nextIdx >= stages.length) return

    const targetStage = stages[nextIdx]
    const toastId = toast.loading(`Moving ${lead.name} to ${targetStage.name}…`)

    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: lead.id,
          status: targetStage.dbStatus,
        }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(`Moved ${lead.name} to ${targetStage.name}`, { id: toastId })
        fetchLeads()
      } else {
        throw new Error(data.error || 'Failed to update stage')
      }
    } catch (err: any) {
      toast.error(err.message, { id: toastId })
    }
  }

  return (
    <div className="space-y-8 select-none text-white">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black tracking-tight">💼 CRM Lead Pipeline</h1>
          <p className="mt-1 text-sm text-gray-500 font-medium">Orchestrate sales pipelines, prioritize high-value client opportunities, and track CRM conversions.</p>
        </div>
        <button
          onClick={fetchLeads}
          className="rounded-xl bg-[#E3B859] hover:bg-[#d4ac50] text-[#141416] text-xs font-bold uppercase tracking-wider px-5 py-3 transition-colors shadow-md"
        >
          🔄 Refresh Board
        </button>
      </div>

      {loading ? (
        <div className="py-20 text-center text-gray-500 animate-pulse text-sm">Loading opportunity stages…</div>
      ) : (
        /* Kanban Board Layout */
        <div className="grid gap-4 md:grid-cols-5 overflow-x-auto pb-4">
          {stages.map((stage) => {
            const leadsInStage = leads.filter(l => getStageId(l.status) === stage.id)
            
            return (
              <div key={stage.id} className="rounded-2xl border border-[#2D2D30] bg-[#18181A] p-4 flex flex-col justify-between min-h-[550px] w-64 md:w-auto flex-shrink-0">
                <div className="space-y-4">
                  {/* Column header */}
                  <div className="flex justify-between items-center border-b border-[#2D2D30]/60 pb-2 text-xs">
                    <span className="font-bold text-gray-300 uppercase tracking-wider">{stage.name}</span>
                    <span className="font-mono text-gray-500 text-[10px] font-bold">{leadsInStage.length}</span>
                  </div>

                  {/* Leads list cards */}
                  <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                    {leadsInStage.length === 0 ? (
                      <div className="py-8 text-center text-gray-600 text-[10px] uppercase border border-dashed border-[#2D2D30]/40 rounded-xl">
                        Empty Stage
                      </div>
                    ) : (
                      leadsInStage.map((lead) => (
                        <div key={lead.id} className="p-4 bg-[#141416] border border-[#2D2D30]/60 rounded-xl text-xs space-y-3 shadow-sm hover:border-gray-500 transition-all duration-300">
                          <div>
                            <div className="flex justify-between items-start gap-1">
                              <span className="font-bold text-white block truncate w-40">{lead.name}</span>
                              {lead.rating && (
                                <span className="font-mono text-[9px] text-[#E3B859] font-bold">★{lead.rating}</span>
                              )}
                            </div>
                            <span className="text-[10px] text-gray-500 font-semibold mt-0.5 block truncate">
                              📍 {lead.city || 'Singapore'}
                            </span>
                          </div>

                          <div className="flex justify-between items-center pt-2 border-t border-[#2D2D30]/40 text-[9px] text-gray-500">
                            <span className="truncate w-24 font-mono">{lead.email || lead.phone || 'No Contact'}</span>
                            <span className="font-bold uppercase tracking-wider truncate max-w-[80px]">
                              {lead.category || 'Local'}
                            </span>
                          </div>

                          <div className="flex gap-1 pt-1 justify-end">
                            <button
                              type="button"
                              onClick={() => handleMoveStage(lead, 'backward')}
                              className="px-2.5 py-1 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded border border-[#2D2D30] text-[9px] font-bold uppercase transition-colors"
                            >
                              ◀
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveStage(lead, 'forward')}
                              className="px-2.5 py-1 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded border border-[#2D2D30] text-[9px] font-bold uppercase transition-colors"
                            >
                              ▶
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
