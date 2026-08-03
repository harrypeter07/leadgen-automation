'use client'

import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { supabaseBrowser } from '@/lib/supabase'
import { 
  Button, 
  Badge, 
  Card, 
  StatCard, 
  HeroCard 
} from '@/components'
import { Brain, Send, Link as LinkIcon } from 'lucide-react'

export default function WorkflowsPage() {
  const [totalLeads, setTotalLeads] = useState<number | null>(null)
  const [pendingAi, setPendingAi] = useState<number | null>(null)
  const [readyOutreach, setReadyOutreach] = useState<number | null>(null)

  const [triggeringAi, setTriggeringAi] = useState(false)
  const [triggeringOutreach, setTriggeringOutreach] = useState(false)

  const [lastAiTrigger, setLastAiTrigger] = useState<string | null>(null)
  const [lastOutreachTrigger, setLastOutreachTrigger] = useState<string | null>(null)

  const webhookUrl = `${process.env.NEXT_PUBLIC_N8N_WEBHOOK_BASE_URL || 'https://n8n-production-b85da.up.railway.app'}/webhook/leads`

  async function fetchCounts() {
    try {
      const totalRes = await supabaseBrowser
        .from('leads')
        .select('*', { count: 'exact', head: true })
      setTotalLeads(totalRes.count ?? 0)

      const pendingRes = await supabaseBrowser
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'new')
        .is('ai_message_whatsapp', null)
      setPendingAi(pendingRes.count ?? 0)

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
    <div className="space-y-10 max-w-7xl mx-auto">
      {/* Hero Header */}
      <HeroCard
        eyebrow="AUTOMATION WORKFLOWS"
        title="Orchestrate Campaign Pipelines"
        description="Trigger AI personalization, execute multi-channel outreach, and verify n8n webhook nodes."
        variant="sage"
      />

      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <StatCard
          label="Total Database Leads"
          value={totalLeads === null ? '...' : totalLeads.toLocaleString()}
          variant="lavender"
        />
        <StatCard
          label="Pending AI Copy Generation"
          value={pendingAi === null ? '...' : pendingAi.toLocaleString()}
          variant="cream"
        />
        <StatCard
          label="Ready for Outreach"
          value={readyOutreach === null ? '...' : readyOutreach.toLocaleString()}
          variant="sage"
        />
      </div>

      {/* Workflow Trigger Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card variant="page-alt" className="p-8 space-y-6 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-ink" />
                <h3 className="font-bold text-xl text-ink font-display">Gemini AI Personalisation</h3>
              </div>
              <Badge variant="lime" className="font-mono">READY</Badge>
            </div>
            <p className="text-xs text-text-body leading-relaxed font-medium">
              Analyzes scraped profile metadata, runs persona templates, and generates highly targeted WhatsApp messages and email copies.
            </p>
          </div>

          <div className="space-y-4 pt-4 border-t border-border-subtle">
            {lastAiTrigger && (
              <span className="text-[11px] font-semibold text-text-muted block">
                Last Triggered: {lastAiTrigger}
              </span>
            )}
            <Button
              onClick={handleTriggerAi}
              loading={triggeringAi}
              disabled={pendingAi === 0}
              variant="primary"
              className="w-full"
              iconType="arrow-right"
            >
              Trigger AI Copywriting
            </Button>
          </div>
        </Card>

        <Card variant="page-alt" className="p-8 space-y-6 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div className="flex items-center gap-2">
                <Send className="w-5 h-5 text-ink" />
                <h3 className="font-bold text-xl text-ink font-display">Outreach Campaign Dispatch</h3>
              </div>
              <Badge variant="dark">PIPELINE</Badge>
            </div>
            <p className="text-xs text-text-body leading-relaxed font-medium">
              Triggers outreach for ready leads. Automatically schedules messages, launches WhatsApp client sockets, and dispatches email copy structures.
            </p>
          </div>

          <div className="space-y-4 pt-4 border-t border-border-subtle">
            {lastOutreachTrigger && (
              <span className="text-[11px] font-semibold text-text-muted block">
                Last Triggered: {lastOutreachTrigger}
              </span>
            )}
            <Button
              onClick={handleTriggerOutreach}
              loading={triggeringOutreach}
              disabled={readyOutreach === 0}
              variant="secondary"
              className="w-full"
              iconType="arrow-right"
            >
              Trigger Outreach Campaign
            </Button>
          </div>
        </Card>
      </div>

      {/* Webhook Integrations Card */}
      <Card variant="ink" className="p-8 space-y-4">
        <div className="flex items-center justify-between border-b border-border-subtle/20 pb-3">
          <div className="flex items-center gap-2">
            <LinkIcon className="w-5 h-5 text-lime" />
            <h3 className="font-bold text-lg text-page font-display">n8n Webhook Node Endpoint</h3>
          </div>
          <Badge variant="lime">ACTIVE</Badge>
        </div>
        <p className="text-xs text-text-onDarkMuted leading-relaxed font-medium">
          Use the endpoint URL below to configure external ingestion nodes and send leads to n8n pipelines in real-time.
        </p>
        <div className="flex items-center justify-between gap-4 bg-ink-soft p-4 rounded-lg font-mono text-xs text-text-onDark border border-border-subtle/20">
          <span className="truncate">{webhookUrl}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopyWebhook}
            className="text-lime hover:text-lime"
          >
            Copy Endpoint
          </Button>
        </div>
      </Card>
    </div>
  )
}
