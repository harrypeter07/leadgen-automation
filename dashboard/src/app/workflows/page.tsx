// dashboard/src/app/workflows/page.tsx
'use client'

import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { supabaseBrowser } from '@/lib/supabase'
import { RefreshCw, Brain, Send, Copy, Database, Sparkles, Zap, Link as LinkIcon } from 'lucide-react'

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
    <div className="p-4 sm:p-8 space-y-8 select-none text-foreground max-w-7xl mx-auto">
      {/* Header */}
      <div className="border-b border-blue-500/15 pb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
          <RefreshCw className="w-7 h-7 text-blue-400" /> Automated Workflows
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-zinc-400 font-medium">Orchestrate automated campaign pipelines, trigger AI copywriting, and verify n8n webhook nodes.</p>
      </div>

      {/* Grid count cards */}
      <div className="grid gap-6 sm:grid-cols-3">
        <div className="rounded-2xl glass glow-border p-6 shadow-xl flex flex-col justify-between min-h-[130px]">
          <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-blue-400" /> Total Leads in DB
          </span>
          <h3 className="text-3xl font-black text-white mt-3 font-mono">
            {totalLeads === null ? '...' : totalLeads.toLocaleString()}
          </h3>
        </div>

        <div className="rounded-2xl glass glow-border p-6 shadow-xl flex flex-col justify-between min-h-[130px]">
          <span className="text-[10px] font-mono font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Pending AI Copy Generation
          </span>
          <h3 className="text-3xl font-black text-amber-300 mt-3 font-mono">
            {pendingAi === null ? '...' : pendingAi.toLocaleString()}
          </h3>
        </div>

        <div className="rounded-2xl glass glow-border p-6 shadow-xl flex flex-col justify-between min-h-[130px]">
          <span className="text-[10px] font-mono font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-emerald-400" /> Ready for Outreach
          </span>
          <h3 className="text-3xl font-black text-emerald-400 mt-3 font-mono">
            {readyOutreach === null ? '...' : readyOutreach.toLocaleString()}
          </h3>
        </div>
      </div>

      {/* Workflow trigger cards */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Gemini AI Trigger Card */}
        <div className="rounded-2xl glass glow-border p-6 shadow-xl space-y-4 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-300">
                <Brain className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white tracking-tight">Gemini AI Copywriting</h3>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed font-medium">
              Scrapes detailed profile metadata for new leads, runs personalization templates, and generates highly targeted WhatsApp messages and email copies.
            </p>
          </div>

          <div className="space-y-4 pt-4 border-t border-blue-500/15">
            {lastAiTrigger && (
              <div className="text-[10px] text-zinc-400 font-mono font-bold uppercase tracking-wider">
                Last Triggered: <span className="text-blue-300">{lastAiTrigger}</span>
              </div>
            )}

            <button
              onClick={handleTriggerAi}
              disabled={triggeringAi || pendingAi === 0}
              className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold uppercase font-mono tracking-wider text-white py-3.5 shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
            >
              {triggeringAi ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Brain className="w-4 h-4" />
              )}
              Trigger AI Copywriting
            </button>
          </div>
        </div>

        {/* Automated outreach campaign card */}
        <div className="rounded-2xl glass glow-border p-6 shadow-xl space-y-4 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-300">
                <Send className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white tracking-tight">Automated Outreach Campaign</h3>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed font-medium">
              Triggers the outreach pipeline for ready leads. Automatically schedules messages, launches WhatsApp client sockets, and dispatches email copy structures.
            </p>
          </div>

          <div className="space-y-4 pt-4 border-t border-blue-500/15">
            {lastOutreachTrigger && (
              <div className="text-[10px] text-zinc-400 font-mono font-bold uppercase tracking-wider">
                Last Triggered: <span className="text-blue-300">{lastOutreachTrigger}</span>
              </div>
            )}

            <button
              onClick={handleTriggerOutreach}
              disabled={triggeringOutreach || readyOutreach === 0}
              className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold uppercase font-mono tracking-wider text-white py-3.5 shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
            >
              {triggeringOutreach ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Trigger Outreach Campaign
            </button>
          </div>
        </div>
      </div>

      {/* Webhook Integrations info card */}
      <div className="rounded-2xl glass glow-border p-6 shadow-xl space-y-4">
        <h3 className="font-bold text-white text-md uppercase tracking-wider text-[11px] text-zinc-400 font-mono flex items-center gap-1.5">
          <LinkIcon className="w-3.5 h-3.5 text-blue-400" /> Webhook Integrations (n8n Node Link)
        </h3>
        <p className="text-xs text-zinc-400 leading-relaxed font-medium">
          Configure external ingestion nodes to send leads directly to n8n pipelines in real-time. Use the following webhook link inside your scrape workflows.
        </p>

        <div className="flex gap-3 bg-black/50 border border-white/10 p-3 rounded-xl items-center text-xs">
          <span className="font-mono text-zinc-300 flex-1 truncate select-all">{webhookUrl}</span>
          <button
            onClick={handleCopyWebhook}
            className="px-3.5 py-1.5 rounded-lg bg-blue-600/20 border border-blue-500/30 text-blue-300 text-[10px] font-mono font-bold uppercase tracking-wider hover:bg-blue-600/30 transition-all shadow-sm flex items-center gap-1"
          >
            <Copy className="w-3 h-3" /> Copy
          </button>
        </div>
      </div>
    </div>
  )
}
