// dashboard/src/app/workflows/page.tsx
'use client'

import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { supabaseBrowser } from '@/lib/supabase'

export default function WorkflowsPage() {
  const [totalLeads, setTotalLeads] = useState<number | null>(null)
  const [pendingAi, setPendingAi] = useState<number | null>(null)
  const [readyOutreach, setReadyOutreach] = useState<number | null>(null)

  const [triggeringAi, setTriggeringAi] = useState(false)
  const [triggeringOutreach, setTriggeringOutreach] = useState(false)

  const [lastAiTrigger, setLastAiTrigger] = useState<string | null>(null)
  const [lastOutreachTrigger, setLastOutreachTrigger] = useState<string | null>(null)

  const webhookUrl = `${process.env.NEXT_PUBLIC_N8N_WEBHOOK_BASE_URL || 'https://n8n-production-b85da.up.railway.app'}/webhook/leads`

  // Fetch counts from Supabase
  async function fetchCounts() {
    try {
      // 1. Total leads
      const totalRes = await supabaseBrowser
        .from('leads')
        .select('*', { count: 'exact', head: true })
      setTotalLeads(totalRes.count ?? 0)

      // 2. Pending AI (where ai_message_whatsapp is null and status is new)
      const pendingRes = await supabaseBrowser
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'new')
        .is('ai_message_whatsapp', null)
      setPendingAi(pendingRes.count ?? 0)

      // 3. Ready outreach (where status is new and ai_message_whatsapp is not null)
      const readyRes = await supabaseBrowser
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'new')
        .not('ai_message_whatsapp', 'is', null)
      setReadyOutreach(readyRes.count ?? 0)
    } catch (err) {
      console.error('Error fetching workflow stats:', err)
    }
  }

  useEffect(() => {
    fetchCounts()
    setLastAiTrigger(localStorage.getItem('leadgen_last_ai_trigger'))
    setLastOutreachTrigger(localStorage.getItem('leadgen_last_outreach_trigger'))

    // Optimized polling (poll stats every 35s to reduce DB load)
    const interval = setInterval(fetchCounts, 35000)
    return () => clearInterval(interval)
  }, [])

  // Trigger AI Personalise
  async function handleTriggerAi() {
    setTriggeringAi(true)
    const toastId = toast.loading('Triggering Gemini AI Personalisation...')
    try {
      const res = await fetch('/api/workflows/trigger-ai', { method: 'POST' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to trigger AI workflow')
      }
      toast.success('AI Personalisation workflow triggered!', { id: toastId })
      const nowStr = new Date().toLocaleString()
      localStorage.setItem('leadgen_last_ai_trigger', nowStr)
      setLastAiTrigger(nowStr)
      fetchCounts()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to trigger AI workflow'
      toast.error(message, { id: toastId })
    } finally {
      setTriggeringAi(false)
    }
  }

  // Trigger Outreach
  async function handleTriggerOutreach() {
    setTriggeringOutreach(true)
    const toastId = toast.loading('Triggering outreach workflow...')
    try {
      const res = await fetch('/api/workflows/trigger-outreach', { method: 'POST' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to trigger outreach workflow')
      }
      toast.success('Outreach workflow triggered successfully!', { id: toastId })
      const nowStr = new Date().toLocaleString()
      localStorage.setItem('leadgen_last_outreach_trigger', nowStr)
      setLastOutreachTrigger(nowStr)
      fetchCounts()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to trigger outreach workflow'
      toast.error(message, { id: toastId })
    } finally {
      setTriggeringOutreach(false)
    }
  }

  function handleCopyWebhook() {
    navigator.clipboard.writeText(webhookUrl)
    toast.success('n8n Webhook URL copied!')
  }

  return (
    <div className="space-y-8 text-[#2D2D2D] select-none">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-[#1C1C1E] tracking-tight">Automated Workflows</h1>
        <p className="mt-1 text-sm text-gray-500 font-medium">Orchestrate automated campaign pipelines, trigger AI copywriting, and verify n8n webhook nodes.</p>
      </div>

      {/* Grid count cards */}
      <div className="grid gap-6 sm:grid-cols-3">
        <div className="rounded-2xl bg-[#D4E0CD] p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.02)] border border-[#B8C8B0] flex flex-col justify-between min-h-[120px]">
          <span className="text-[10px] font-bold text-[#3B4D3C] uppercase tracking-wider">Total Leads in DB</span>
          <h3 className="text-3xl font-black text-[#2E3A2F] mt-3">
            {totalLeads === null ? '...' : totalLeads.toLocaleString()}
          </h3>
        </div>

        <div className="rounded-2xl bg-[#F9D99A] p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.02)] border border-[#E8C584] flex flex-col justify-between min-h-[120px]">
          <span className="text-[10px] font-bold text-[#5C451F] uppercase tracking-wider">Pending AI copy generation</span>
          <h3 className="text-3xl font-black text-[#4A391D] mt-3">
            {pendingAi === null ? '...' : pendingAi.toLocaleString()}
          </h3>
        </div>

        <div className="rounded-2xl bg-white border border-[#E4E3DD] p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] flex flex-col justify-between min-h-[120px]">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Ready for outreach campaigns</span>
          <h3 className="text-3xl font-black text-gray-800 mt-3">
            {readyOutreach === null ? '...' : readyOutreach.toLocaleString()}
          </h3>
        </div>
      </div>

      {/* Workflow trigger cards */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Gemini AI Trigger Card */}
        <div className="rounded-2xl border border-[#E4E3DD] bg-white p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] space-y-4 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="text-xl">🤖</span>
              <h3 className="text-lg font-bold text-[#1C1C1E] tracking-tight">Gemini AI Copywriting</h3>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed font-semibold">
              Scrapes detailed profile metadata for new leads, runs personalization templates, and generates highly targeted WhatsApp messages and email copies.
            </p>
          </div>

          <div className="space-y-4 pt-4 border-t border-[#E4E3DD]/60">
            {lastAiTrigger && (
              <div className="text-[10px] text-gray-450 font-bold uppercase tracking-wider">
                Last Triggered: <span className="text-gray-700">{lastAiTrigger}</span>
              </div>
            )}

            <button
              onClick={handleTriggerAi}
              disabled={triggeringAi || pendingAi === 0}
              className="w-full rounded-xl bg-[#1C1C1E] hover:bg-[#252528] disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold uppercase tracking-wider text-white py-3.5 shadow-sm transition-colors flex items-center justify-center gap-2"
            >
              {triggeringAi ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : null}
              Trigger AI Copywriting
            </button>
          </div>
        </div>

        {/* Automated outreach campaign card */}
        <div className="rounded-2xl border border-[#E4E3DD] bg-white p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] space-y-4 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="text-xl">📤</span>
              <h3 className="text-lg font-bold text-[#1C1C1E] tracking-tight">Automated Outreach Campaign</h3>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed font-semibold">
              Triggers the outreach pipeline for ready leads. Automatically schedules messages, launches WhatsApp client sockets, and dispatches email copy structures.
            </p>
          </div>

          <div className="space-y-4 pt-4 border-t border-[#E4E3DD]/60">
            {lastOutreachTrigger && (
              <div className="text-[10px] text-gray-450 font-bold uppercase tracking-wider">
                Last Triggered: <span className="text-gray-700">{lastOutreachTrigger}</span>
              </div>
            )}

            <button
              onClick={handleTriggerOutreach}
              disabled={triggeringOutreach || readyOutreach === 0}
              className="w-full rounded-xl bg-[#1C1C1E] hover:bg-[#252528] disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold uppercase tracking-wider text-white py-3.5 shadow-sm transition-colors flex items-center justify-center gap-2"
            >
              {triggeringOutreach ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : null}
              Trigger Outreach Campaign
            </button>
          </div>
        </div>
      </div>

      {/* Webhook Integrations info card */}
      <div className="rounded-2xl border border-[#E4E3DD] bg-white p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] space-y-4">
        <h3 className="font-bold text-[#1C1C1E] text-md uppercase tracking-wider text-[11px] text-gray-500">🔗 Webhook Integrations (n8n Node Link)</h3>
        <p className="text-xs text-gray-500 leading-relaxed font-semibold">
          Configure external ingestion nodes to send leads directly to n8n pipelines in real-time. Use the following webhook link inside your scrape workflows.
        </p>

        <div className="flex gap-3 bg-[#F4F3EF] border border-[#E4E3DD] p-3 rounded-xl items-center text-xs">
          <span className="font-mono text-gray-650 flex-1 truncate select-all">{webhookUrl}</span>
          <button
            onClick={handleCopyWebhook}
            className="px-3.5 py-1.5 rounded-lg bg-white border border-[#E4E3DD] text-[10px] font-bold uppercase tracking-wider text-gray-750 hover:bg-gray-50 transition-colors shadow-sm"
          >
            Copy
          </button>
        </div>
      </div>
    </div>
  )
}
