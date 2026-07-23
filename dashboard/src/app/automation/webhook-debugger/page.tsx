'use client'

import React, { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Activity, RefreshCw, Trash2, Send, Copy, Check, Terminal, ShieldCheck } from 'lucide-react'

interface WebhookLog {
  timestamp: string
  object: string
  senderId: string
  snippet: string
  payload: any
}

export default function WebhookDebuggerPage() {
  const [logs, setLogs] = useState<WebhookLog[]>([])
  const [loading, setLoading] = useState(true)
  const [clearing, setClearing] = useState(false)
  const [simulating, setSimulating] = useState(false)
  const [selectedLog, setSelectedLog] = useState<WebhookLog | null>(null)
  
  const [verifyToken, setVerifyToken] = useState('FLOWFYP_VERIFY_TOKEN')
  const [callbackUrl, setCallbackUrl] = useState('')
  const [copiedUrl, setCopiedUrl] = useState(false)
  const [copiedToken, setCopiedToken] = useState(false)

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/meta/webhook-logs')
      const data = await res.json()
      if (res.ok && data.logs) {
        setLogs(data.logs)
      }
    } catch (err) {
      console.error('Failed to load webhook logs:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/meta/settings')
      if (res.ok) {
        const data = await res.json()
        if (data.settings) {
          setVerifyToken(data.settings.META_VERIFY_TOKEN || 'FLOWFYP_VERIFY_TOKEN')
        }
      }
    } catch {}
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCallbackUrl(`${window.location.origin}/api/meta/webhook`)
    }
    fetchLogs()
    fetchSettings()
    const timer = setInterval(fetchLogs, 4000)
    return () => clearInterval(timer)
  }, [fetchLogs, fetchSettings])

  const handleClearLogs = async () => {
    if (!confirm('Are you sure you want to clear all webhook event logs?')) return
    setClearing(true)
    const toastId = toast.loading('Clearing webhook log history...')
    try {
      const res = await fetch('/api/meta/webhook-logs', { method: 'DELETE' })
      if (res.ok) {
        toast.success('Logs cleared!', { id: toastId })
        fetchLogs()
        setSelectedLog(null)
      } else {
        throw new Error()
      }
    } catch {
      toast.error('Failed to clear logs', { id: toastId })
    } finally {
      setClearing(false)
    }
  }

  const handleSimulateWebhook = async () => {
    setSimulating(true)
    const toastId = toast.loading('Sending test webhook event...')
    try {
      const activeAccountRes = await fetch('/api/meta/active-account').then(r => r.json()).catch(() => ({}))
      const targetIgId = activeAccountRes.instagramBusinessId || '17841411718913026'

      const mockPayload = {
        object: 'instagram',
        entry: [
          {
            id: targetIgId,
            time: Math.floor(Date.now() / 1000),
            messaging: [
              {
                sender: { id: 'simulate_test_user_777' },
                recipient: { id: targetIgId },
                timestamp: Date.now(),
                message: {
                  mid: `mid.test.${Date.now()}`,
                  text: 'Hello! I am testing the webhook debugger.'
                }
              }
            ]
          }
        ]
      }

      const res = await fetch('/api/meta/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockPayload)
      })

      if (res.ok) {
        toast.success('Test webhook event simulated successfully!', { id: toastId })
        setTimeout(fetchLogs, 500)
      } else {
        throw new Error('Simulation failed')
      }
    } catch (err: any) {
      toast.error(err.message || 'Simulation error', { id: toastId })
    } finally {
      setSimulating(false)
    }
  }

  const copyToClipboard = (text: string, type: 'url' | 'token') => {
    navigator.clipboard.writeText(text)
    if (type === 'url') {
      setCopiedUrl(true)
      setTimeout(() => setCopiedUrl(false), 2000)
    } else {
      setCopiedToken(true)
      setTimeout(() => setCopiedToken(false), 2000)
    }
    toast.success('Copied to clipboard!')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl border border-border bg-card">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
            <Terminal className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">Meta Webhook Live Monitor</h1>
            <p className="text-xs text-muted-foreground">Inspect real-time inbound Meta webhook payloads, test triggers, and verify challenges.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleSimulateWebhook} disabled={simulating} className="gap-1.5">
            <Send className="w-3.5 h-3.5 text-primary" />
            <span>Simulate Inbound Event</span>
          </Button>
          <Button variant="outline" size="sm" onClick={handleClearLogs} disabled={clearing} className="gap-1.5 text-rose-400">
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Logs</span>
          </Button>
        </div>
      </div>

      {/* Webhook Registration Credentials Card */}
      <Card>
        <CardHeader className="p-4 border-b border-border">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Meta Webhook Subscription Details
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Callback URL</label>
            <div className="flex gap-2">
              <Input value={callbackUrl} readOnly className="font-mono text-xs" />
              <Button size="sm" variant="outline" onClick={() => copyToClipboard(callbackUrl, 'url')}>
                {copiedUrl ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Verify Token</label>
            <div className="flex gap-2">
              <Input value={verifyToken} readOnly className="font-mono text-xs" />
              <Button size="sm" variant="outline" onClick={() => copyToClipboard(verifyToken, 'token')}>
                {copiedToken ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Log Feed Grid (4 cols list + 8 cols JSON detail) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 h-[500px]">
        <Card className="md:col-span-5 flex flex-col h-full overflow-hidden">
          <CardHeader className="p-3 border-b border-border flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-semibold">Live Events ({logs.length})</CardTitle>
            <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400">Live Polling</Badge>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-4 space-y-2">
                {[1,2,3,4].map(i => <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />)}
              </div>
            ) : logs.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">No webhook events logged yet.</div>
            ) : (
              logs.map((log, idx) => (
                <div
                  key={idx}
                  onClick={() => setSelectedLog(log)}
                  className={`p-3 border-b border-border cursor-pointer transition-colors hover:bg-accent/50 ${
                    selectedLog === log ? 'bg-accent border-l-2 border-l-primary' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <Badge variant="outline" className="text-[9px] uppercase">{log.object}</Badge>
                    <span className="text-[10px] text-muted-foreground">{new Date(log.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <p className="text-xs font-mono text-foreground truncate">{log.snippet || 'Webhook payload received'}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Payload Detail JSON view */}
        <Card className="md:col-span-7 flex flex-col h-full overflow-hidden">
          <CardHeader className="p-3 border-b border-border">
            <CardTitle className="text-xs font-semibold">Event Payload Inspector</CardTitle>
          </CardHeader>
          <CardContent className="p-4 flex-1 overflow-y-auto font-mono text-xs bg-muted/20">
            {selectedLog ? (
              <pre className="text-[11px] leading-relaxed whitespace-pre-wrap text-foreground">{JSON.stringify(selectedLog.payload, null, 2)}</pre>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-xs font-sans">
                Select an event log on the left to inspect raw payload JSON.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
