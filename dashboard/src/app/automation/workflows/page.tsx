'use client'

import React, { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'

interface Workflow {
  id: string
  name: string
  description: string
  status: 'active' | 'inactive' | 'error'
  workflow_type: string
  trigger_url?: string
  last_run?: string
  run_count?: number
}

interface Execution {
  id: string
  workflow_name: string
  event: string
  status: 'completed' | 'failed' | 'running'
  started_at: string
  duration_ms?: number
  error?: string
}

const STATUS_BADGE: Record<string, string> = {
  active:    'bg-green-900/40 border-green-800/30 text-green-300',
  inactive:  'bg-gray-800/40 border-gray-700/30 text-gray-400',
  error:     'bg-red-900/40 border-red-800/30 text-red-300',
  completed: 'bg-green-900/40 border-green-800/30 text-green-300',
  failed:    'bg-red-900/40 border-red-800/30 text-red-300',
  running:   'bg-amber-900/40 border-amber-800/30 text-amber-300',
}

// Default workflows matching our 4 n8n workflows
const DEFAULT_WORKFLOWS: Workflow[] = [
  {
    id: 'comm-hub',
    name: 'Communication Hub',
    description: 'Handles inbound Messenger and Instagram DM events. Routes messages through AI classification and dispatches auto-replies.',
    status: 'active',
    workflow_type: 'n8n Webhook',
    trigger_url: process.env.NEXT_PUBLIC_N8N_COMM_URL || '',
  },
  {
    id: 'pub-hub',
    name: 'Publishing Hub',
    description: 'Publishes approved posts to Facebook and Instagram. Handles scheduling, media upload, and caption generation.',
    status: 'active',
    workflow_type: 'n8n HTTP POST',
  },
  {
    id: 'sync-hub',
    name: 'Sync & Monitoring Hub',
    description: 'Polls page insights, comment feeds, and token expiry every hour. Writes metrics to Supabase.',
    status: 'active',
    workflow_type: 'Schedule Cron',
  },
  {
    id: 'sys-dispatch',
    name: 'System Dispatcher',
    description: 'Master orchestrator. Routes events to Communication or Publishing Hub based on payload type.',
    status: 'active',
    workflow_type: 'n8n Webhook',
  },
]

function relTime(ts: string) {
  try {
    const diff = (Date.now() - new Date(ts).getTime()) / 1000
    if (diff < 60)    return `${Math.round(diff)}s ago`
    if (diff < 3600)  return `${Math.round(diff / 60)}m ago`
    if (diff < 86400) return `${Math.round(diff / 3600)}h ago`
    return new Date(ts).toLocaleDateString()
  } catch { return ts }
}

export default function WorkflowsBuilderPage() {
  const [workflows, setWorkflows]     = useState<Workflow[]>(DEFAULT_WORKFLOWS)
  const [executions, setExecutions]   = useState<Execution[]>([])
  const [loadingEx, setLoadingEx]     = useState(true)
  const [runningId, setRunningId]     = useState<string | null>(null)
  const [n8nConnected, setN8nConnected] = useState<boolean | null>(null)

  // Load executions from logs table (API_RESPONSE events with source info)
  const fetchExecutions = useCallback(async () => {
    setLoadingEx(true)
    try {
      const res  = await fetch('/api/automation/logs?limit=30')
      const data = await res.json()
      const logs = data.logs || []

      // Map log entries to execution display
      const execs: Execution[] = logs
        .filter((l: { event?: string }) => l.event === 'API_RESPONSE' || l.event === 'API_REQUEST')
        .slice(0, 20)
        .map((l: {
          request_id?: string
          id?: string
          workflow_source?: string
          source?: string
          event?: string
          timestamp?: string
          duration_ms?: number
          error?: string
          level?: string
          status_code?: number
        }) => ({
          id:            l.request_id || l.id || String(Math.random()),
          workflow_name: l.workflow_source || l.source || 'Meta API',
          event:         l.event || 'unknown',
          status:        l.error ? 'failed' : 'completed',
          started_at:    l.timestamp || new Date().toISOString(),
          duration_ms:   l.duration_ms,
          error:         l.error,
        }))
      setExecutions(execs)
    } catch {
      setExecutions([])
    }
    setLoadingEx(false)
  }, [])

  // Check n8n connectivity
  useEffect(() => {
    fetch('/api/health/n8n')
      .then(r => r.json())
      .then(d => setN8nConnected(d.connected))
      .catch(() => setN8nConnected(false))

    fetchExecutions()
  }, [fetchExecutions])

  // Load workflow status from DB
  useEffect(() => {
    fetch('/api/automation/workflows')
      .then(r => r.json())
      .then(data => {
        if (data.workflows && Array.isArray(data.workflows) && data.workflows.length > 0) {
          setWorkflows(data.workflows)
        }
      })
      .catch(() => {/* keep defaults */})
  }, [])

  async function handleTrigger(wf: Workflow) {
    if (!n8nConnected) {
      toast.error('n8n is not connected. Check N8N_WEBHOOK_BASE_URL in env.')
      return
    }
    setRunningId(wf.id)
    const toastId = toast.loading(`Triggering: ${wf.name}…`)
    try {
      const n8nBase = process.env.NEXT_PUBLIC_N8N_WEBHOOK_BASE_URL
      if (!n8nBase) throw new Error('N8N_WEBHOOK_BASE_URL not configured')

      const res  = await fetch(`${n8nBase}/webhook/meta-${wf.id}`, { method: 'POST', body: JSON.stringify({ manual: true }), headers: { 'Content-Type': 'application/json' } })
      if (res.ok) toast.success(`${wf.name} triggered!`, { id: toastId })
      else toast.error(`Trigger failed (HTTP ${res.status})`, { id: toastId })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Trigger failed', { id: toastId })
    }
    setRunningId(null)
    fetchExecutions()
  }

  return (
    <div className="space-y-8 text-white select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight">⚙️ n8n Workflow Manager</h1>
          <p className="mt-1 text-sm text-gray-500 font-medium">Manage the 4 automation workflows: Communication Hub, Publishing Hub, Sync Monitor, and System Dispatcher.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold ${n8nConnected === true ? 'bg-green-900/30 border-green-800/30 text-green-300' : n8nConnected === false ? 'bg-red-900/30 border-red-800/30 text-red-300' : 'bg-gray-800/30 border-gray-700/30 text-gray-400'}`}>
            <span className={`w-2 h-2 rounded-full ${n8nConnected === true ? 'bg-green-400 animate-pulse' : n8nConnected === false ? 'bg-red-400' : 'bg-gray-400'}`}></span>
            {n8nConnected === true ? 'n8n Connected' : n8nConnected === false ? 'n8n Offline' : 'Checking n8n…'}
          </div>
          <button onClick={fetchExecutions} className="px-3 py-1.5 rounded-xl bg-[#222225] border border-[#2D2D30] text-xs font-bold text-gray-300 hover:text-white transition-colors">🔄 Refresh</button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Configured workflows */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">🔧 Configured Pipelines</h3>
          {workflows.map(wf => (
            <div key={wf.id} className="p-5 bg-[#141416] border border-[#2D2D30] rounded-2xl space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-white text-sm">{wf.name}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${STATUS_BADGE[wf.status] || STATUS_BADGE.inactive}`}>{wf.status}</span>
                    <span className="text-[10px] font-mono text-gray-500 bg-[#222225] px-2 py-0.5 rounded">{wf.workflow_type}</span>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">{wf.description}</p>
                </div>
                <button
                  onClick={() => handleTrigger(wf)}
                  disabled={runningId === wf.id}
                  className="flex-shrink-0 px-3 py-1.5 rounded-xl bg-[#E3B859]/10 border border-[#E3B859]/20 text-[#E3B859] text-xs font-bold hover:bg-[#E3B859]/20 transition-colors disabled:opacity-40"
                >{runningId === wf.id ? '⏳' : '▶ Run'}</button>
              </div>
              {wf.last_run && (
                <div className="text-[10px] text-gray-500 font-mono">Last run: {relTime(wf.last_run)}</div>
              )}
            </div>
          ))}
        </div>

        {/* Execution log */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">📋 Recent Executions</h3>
          <div className="rounded-2xl border border-[#2D2D30] bg-[#18181A] overflow-hidden">
            {loadingEx ? (
              <div className="p-6 flex flex-col gap-2">
                {[1,2,3].map(i => <div key={i} className="h-10 rounded-xl bg-[#222225] animate-pulse" />)}
              </div>
            ) : executions.length === 0 ? (
              <div className="p-6 text-center text-gray-600 text-xs">
                No executions yet — trigger a workflow or run an API test.
              </div>
            ) : (
              <div className="divide-y divide-[#2D2D30] max-h-[500px] overflow-y-auto">
                {executions.map(ex => (
                  <div key={ex.id} className="p-3 text-xs space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[10px] text-gray-500">{ex.id.slice(0, 8)}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${STATUS_BADGE[ex.status]}`}>{ex.status}</span>
                    </div>
                    <div className="font-bold text-white text-[11px]">{ex.workflow_name}</div>
                    <div className="flex items-center justify-between text-[10px] text-gray-500">
                      <span>{relTime(ex.started_at)}</span>
                      {ex.duration_ms && <span>{ex.duration_ms}ms</span>}
                    </div>
                    {ex.error && <div className="text-red-400 font-mono text-[10px] truncate">{ex.error}</div>}
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
