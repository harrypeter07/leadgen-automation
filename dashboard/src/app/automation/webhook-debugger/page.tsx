'use client'

import React, { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'

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
  
  // Settings info for copy-pasting
  const [verifyToken, setVerifyToken] = useState('FLOWFYP_VERIFY_TOKEN')
  const [callbackUrl, setCallbackUrl] = useState('')

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
    
    // Poll every 3 seconds for real-time debugging updates!
    const timer = setInterval(fetchLogs, 3000)
    return () => clearInterval(timer)
  }, [fetchLogs, fetchSettings])

  const handleClearLogs = async () => {
    if (!confirm('Are you sure you want to clear the webhook event logs?')) return
    setClearing(true)
    const toastId = toast.loading('Clearing webhook log history...')
    try {
      const res = await fetch('/api/meta/webhook-logs', { method: 'DELETE' })
      if (res.ok) {
        toast.success('Webhook log history cleared!', { id: toastId })
        fetchLogs()
        setSelectedLog(null)
      } else {
        throw new Error()
      }
    } catch {
      toast.error('Failed to clear webhook logs', { id: toastId })
    } finally {
      setClearing(false)
    }
  }

  const handleSimulateWebhook = async () => {
    setSimulating(true)
    const toastId = toast.loading('Simulating inbound Meta message event...')
    try {
      const mockPayload = {
        object: 'instagram',
        entry: [
          {
            id: '17841411718913026',
            time: Math.floor(Date.now() / 1000),
            messaging: [
              {
                sender: { id: 'simulate_sender_999' },
                recipient: { id: '17841411718913026' },
                timestamp: Date.now(),
                message: {
                  mid: `m_simulated_${Math.random().toString(36).substring(2, 9)}`,
                  text: 'Hello, this is a simulated debug message! 🚀'
                }
              }
            ]
          }
        ]
      }

      const res = await fetch('/api/meta/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Bypass app secret signature check locally
        },
        body: JSON.stringify(mockPayload)
      })

      if (res.ok) {
        toast.success('Simulation event sent successfully!', { id: toastId })
        setTimeout(fetchLogs, 500)
      } else {
        const err = await res.text()
        throw new Error(err || 'Server rejected simulation')
      }
    } catch (err: any) {
      toast.error(`Simulation failed: ${err.message}`, { id: toastId })
    } finally {
      setSimulating(false)
    }
  }

  return (
    <div className="space-y-8 select-none text-white animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight">📡 Webhook Debugger & Event Logs</h1>
          <p className="mt-1 text-sm text-gray-500 font-medium">Verify verification handshakes, inspect real-time payloads, and diagnose Meta messaging events.</p>
        </div>
        
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSimulateWebhook}
            disabled={simulating}
            className="px-4 py-3 rounded-xl bg-purple-950/40 hover:bg-purple-900/30 text-purple-300 border border-purple-900/40 text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-40"
          >
            {simulating ? '⏳ Sending...' : '🧪 Simulate Event'}
          </button>
          
          <button
            type="button"
            onClick={handleClearLogs}
            disabled={clearing || logs.length === 0}
            className="px-4 py-3 rounded-xl bg-red-950/40 hover:bg-red-900/30 text-red-300 border border-red-900/40 text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-40"
          >
            Clear History
          </button>
        </div>
      </div>

      {/* Copyable Meta Configuration Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-[#2D2D30] bg-[#18181A] p-5 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Cloud Callback URL:</span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(callbackUrl)
                toast.success('Callback URL copied!')
              }}
              className="text-[9px] text-[#E3B859] hover:underline uppercase font-bold"
            >
              Copy Link
            </button>
          </div>
          <input
            readOnly
            value={callbackUrl}
            className="w-full bg-[#141416] border border-[#2D2D30] rounded-xl px-3 py-2 text-xs font-mono text-gray-300 focus:outline-none"
          />
          <span className="text-[10px] text-gray-600 block leading-normal">
            Configure this target URL under Webhook settings in the Meta App Developer Console.
          </span>
        </div>

        <div className="rounded-2xl border border-[#2D2D30] bg-[#18181A] p-5 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Verify Token:</span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(verifyToken)
                toast.success('Verify Token copied!')
              }}
              className="text-[9px] text-[#E3B859] hover:underline uppercase font-bold"
            >
              Copy Token
            </button>
          </div>
          <input
            readOnly
            value={verifyToken}
            className="w-full bg-[#141416] border border-[#2D2D30] rounded-xl px-3 py-2 text-xs font-mono text-gray-300 focus:outline-none"
          />
          <span className="text-[10px] text-gray-600 block leading-normal">
            Enter this verification token under Meta Webhook configurations to authenticate the handshake challenge.
          </span>
        </div>
      </div>

      {/* Main Debugger Area */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Left Side: Recent Handshake & Payload Logs */}
        <div className="md:col-span-2 rounded-2xl border border-[#2D2D30] bg-[#18181A] p-6 space-y-4">
          <div className="flex justify-between items-center border-b border-[#2D2D30] pb-2">
            <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider">📡 Incoming Webhook Feed</h3>
            <span className="text-[10px] text-green-500 font-bold uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-ping" />
              Live Listening (3s Poll)
            </span>
          </div>

          {loading ? (
            <div className="py-20 text-center text-xs text-gray-500 animate-pulse font-semibold">Reading webhook logs...</div>
          ) : logs.length === 0 ? (
            <div className="py-24 text-center text-xs text-gray-500 uppercase border border-dashed border-[#2D2D30]/65 rounded-2xl">
              No Meta Webhooks received yet. Try clicking "Simulate Event" above!
            </div>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {logs.map((log, index) => {
                const dateStr = new Date(log.timestamp).toLocaleTimeString()
                const isSelected = selectedLog?.timestamp === log.timestamp

                return (
                  <div
                    key={index}
                    onClick={() => setSelectedLog(log)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer flex justify-between items-center ${
                      isSelected
                        ? 'bg-[#222225] border-[#E3B859]'
                        : 'bg-[#141416] border-[#2D2D30]/50 hover:border-gray-600'
                    }`}
                  >
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-purple-900/30 text-purple-300">
                          {log.object}
                        </span>
                        <span className="text-gray-500 text-[10px] font-semibold">{dateStr}</span>
                      </div>
                      <div className="text-gray-300 font-medium">
                        Sender: <span className="font-mono text-gray-400">{log.senderId}</span>
                      </div>
                      {log.snippet && (
                        <div className="text-[10px] text-gray-500 font-semibold italic truncate max-w-sm">
                          "{log.snippet}"
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      className="px-2.5 py-1.5 bg-gray-800 text-[10px] font-bold uppercase rounded-lg hover:bg-gray-700 transition-colors"
                    >
                      Inspect
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Right Side: Payload Inspection Panel */}
        <div className="rounded-2xl border border-[#2D2D30] bg-[#18181A] p-6 space-y-4">
          <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider border-b border-[#2D2D30] pb-2">
            🔍 Payload Inspector
          </h3>

          {!selectedLog ? (
            <div className="py-32 text-center text-xs text-gray-600 uppercase">
              Select a webhook event from the feed to inspect the raw JSON response payload
            </div>
          ) : (
            <div className="space-y-4 text-xs">
              <div className="space-y-1">
                <div className="text-gray-500 font-bold uppercase text-[9px]">Event Type:</div>
                <div className="font-black text-white text-md uppercase">{selectedLog.object}</div>
              </div>
              
              <div className="space-y-1">
                <div className="text-gray-500 font-bold uppercase text-[9px]">Received Timestamp:</div>
                <div className="font-mono text-gray-300">{new Date(selectedLog.timestamp).toLocaleString()}</div>
              </div>

              <div className="space-y-2">
                <div className="text-gray-500 font-bold uppercase text-[9px]">JSON Payload Structure:</div>
                <pre className="p-4 bg-[#0E0E10] border border-[#2D2D30] rounded-xl overflow-x-auto text-[10px] font-mono text-purple-300 max-h-[300px] overflow-y-auto">
                  {JSON.stringify(selectedLog.payload, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
