'use client'

import React, { useState } from 'react'
import toast from 'react-hot-toast'

export default function CRMPipelinePage() {
  const [pipelineLeads, setPipelineLeads] = useState([
    { id: '1', name: 'Singapore Cafe Coffee', company: 'Singapore Cafe SG', value: 2500, score: 85, stage: 'nurtured', source: 'whatsapp' },
    { id: '2', name: 'Zarss Tester Page', company: 'Zarss Dev Staging', value: 1200, score: 40, stage: 'qualified', source: 'messenger' },
    { id: '3', name: '@restaurant_sg', company: 'SG Bistro Group', value: 4500, score: 90, stage: 'proposal_sent', source: 'instagram' },
    { id: '4', name: 'Organic Bakery Ltd', company: 'Organic Bakers', value: 3000, score: 75, stage: 'demo_scheduled', source: 'whatsapp' },
    { id: '5', name: 'Downtown Gym Center', company: 'Downtown Fitness', value: 5000, score: 95, stage: 'closed_won', source: 'inbound' },
  ])

  const stages = [
    { id: 'qualified', name: 'Lead Qualified' },
    { id: 'nurtured', name: 'Nurtured' },
    { id: 'proposal_sent', name: 'Proposal Sent' },
    { id: 'demo_scheduled', name: 'Demo Scheduled' },
    { id: 'closed_won', name: 'Closed Won' }
  ]

  const handleMoveStage = (leadId: string, direction: 'forward' | 'backward') => {
    setPipelineLeads(prev => prev.map(lead => {
      if (lead.id === leadId) {
        const currentIdx = stages.findIndex(s => s.id === lead.stage)
        let nextIdx = currentIdx + (direction === 'forward' ? 1 : -1)
        if (nextIdx >= 0 && nextIdx < stages.length) {
          toast.success(`Moved ${lead.name} to ${stages[nextIdx].name}`)
          return { ...lead, stage: stages[nextIdx].id }
        }
      }
      return lead
    }))
  }

  const handleAddNewLead = () => {
    toast.success('New opportunity CRM record created! (Mock Target)')
  }

  return (
    <div className="space-y-8 select-none">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">Lead Pipeline Management</h1>
          <p className="mt-1 text-sm text-gray-500 font-medium">Orchestrate sales pipelines, prioritize high-value client opportunities, and track CRM conversions.</p>
        </div>
        <button
          onClick={handleAddNewLead}
          className="rounded-xl bg-[#E3B859] hover:bg-[#d4ac50] text-[#141416] text-xs font-bold uppercase tracking-wider px-6 py-3 transition-colors shadow-md"
        >
          + Add Opportunity
        </button>
      </div>

      {/* Kanban Board Layout */}
      <div className="grid gap-4 md:grid-cols-5 overflow-x-auto pb-4">
        {stages.map((stage) => {
          const leadsInStage = pipelineLeads.filter(l => l.stage === stage.id)
          const columnTotalValue = leadsInStage.reduce((acc, curr) => acc + curr.value, 0)
          
          return (
            <div key={stage.id} className="rounded-2xl border border-[#2D2D30] bg-[#18181A] p-4 flex flex-col justify-between min-h-[500px] w-64 md:w-auto flex-shrink-0">
              <div className="space-y-4">
                {/* Column header */}
                <div className="flex justify-between items-center border-b border-[#2D2D30] pb-2 text-xs">
                  <span className="font-bold text-white uppercase tracking-wider">{stage.name}</span>
                  <span className="font-mono text-gray-500 text-[10px] font-bold">{leadsInStage.length}</span>
                </div>

                {/* Leads list cards */}
                <div className="space-y-3">
                  {leadsInStage.map((lead) => (
                    <div key={lead.id} className="p-4 bg-[#141416] border border-[#2D2D30]/60 rounded-xl text-xs space-y-3.5 shadow-sm hover:border-gray-500 transition-colors">
                      <div>
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-white block truncate">{lead.name}</span>
                          <span className="font-mono text-[9px] text-[#E3B859] font-bold">★ {lead.score}</span>
                        </div>
                        <span className="text-[10px] text-gray-500 font-semibold mt-0.5 block truncate">{lead.company}</span>
                      </div>

                      <div className="flex justify-between items-center pt-2 border-t border-[#2D2D30]/40">
                        <span className="font-bold text-white font-mono">${lead.value.toLocaleString()}</span>
                        <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Source: {lead.source}</span>
                      </div>

                      <div className="flex gap-1 pt-1 justify-end">
                        <button
                          onClick={() => handleMoveStage(lead.id, 'backward')}
                          className="px-2 py-1 bg-gray-800 text-gray-400 hover:text-white rounded border border-[#2D2D30] text-[9px] font-bold uppercase"
                        >
                          ◀
                        </button>
                        <button
                          onClick={() => handleMoveStage(lead.id, 'forward')}
                          className="px-2 py-1 bg-gray-800 text-gray-400 hover:text-white rounded border border-[#2D2D30] text-[9px] font-bold uppercase"
                        >
                          ▶
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Column Footer */}
              <div className="pt-4 border-t border-[#2D2D30]/50 text-right text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                Total: <span className="text-white font-mono">${columnTotalValue.toLocaleString()}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
