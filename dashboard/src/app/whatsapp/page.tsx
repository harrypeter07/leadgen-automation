// dashboard/src/app/whatsapp/page.tsx
'use client'

import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { formatDistanceToNow } from 'date-fns'
import { QRCodeSVG } from 'qrcode.react'
import { supabaseBrowser } from '@/lib/supabase'
import type { Lead } from '@/types/lead'
import { Smartphone, Play, Square, RefreshCw, Terminal, Send, AlertTriangle, ShieldCheck, CheckCircle2 } from 'lucide-react'

export default function WhatsappManagerPage() {
  const [connected, setConnected] = useState<boolean | null>(null)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(true)

  // QR state
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [qrMessage, setQrMessage] = useState('')
  const [qrCountdown, setQrCountdown] = useState(30)

  // Test message state
  const [testPhone, setTestPhone] = useState('')
  const [countryCode, setCountryCode] = useState('+91')
  const [testMessage, setTestMessage] = useState('')
  const [sendingTest, setSendingTest] = useState(false)
  const sendAbortRef = React.useRef<AbortController | null>(null)

  // Disconnect state
  const [disconnecting, setDisconnecting] = useState(false)

  // Recent messages state
  const [recentSent, setRecentSent] = useState<Lead[]>([])
  const [loadingRecent, setLoadingRecent] = useState(true)

  // Session Status State
  interface SessionStatus {
    state: 'idle' | 'connecting' | 'qr_waiting' | 'connected' | 'disconnected'
    whatsappReady: boolean
    serviceStartedAt: string | null
    qrGeneratedAt: string | null
    qrFileExists: boolean
    sessionAuthenticatedAt: string | null
    lastDisconnectReason: string | null
  }
  const [sessionStatus, setSessionStatus] = useState<SessionStatus | null>(null)
  const [uptimeStr, setUptimeStr] = useState('00:00:00')
  const [qrAgeStr, setQrAgeStr] = useState('')
  const [reconnecting, setReconnecting] = useState(false)
  const [connecting, setConnecting] = useState(false)

  // Logs State
  interface LogEntry {
    timestamp: string
    level: 'info' | 'success' | 'warn' | 'error'
    message: string
  }
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [isPaused, setIsPaused] = useState(false)
  const isPausedRef = React.useRef(isPaused)

  useEffect(() => {
    isPausedRef.current = isPaused
  }, [isPaused])

  const logsContainerRef = React.useRef<HTMLDivElement>(null)

  // 1. Fetch connection status
  async function fetchStatus() {
    try {
      const res = await fetch('/api/whatsapp/health')
      if (res.ok) {
        const data = await res.json()
        setConnected(data.ready)
      } else {
        setConnected(false)
      }
    } catch {
      setConnected(false)
    } finally {
      setLastChecked(new Date())
      setLoadingStatus(false)
    }
  }

  // 2. Fetch session status details
  async function fetchSessionStatus() {
    try {
      const res = await fetch('/api/whatsapp/status')
      if (res.ok) {
        const data: SessionStatus = await res.json()
        setSessionStatus(data)

        if (data.serviceStartedAt) {
          const diff = Math.max(0, Date.now() - new Date(data.serviceStartedAt).getTime())
          const hrs = String(Math.floor(diff / 3600000)).padStart(2, '0')
          const mins = String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0')
          const secs = String(Math.floor((diff % 60000) / 1000)).padStart(2, '0')
          setUptimeStr(`${hrs}:${mins}:${secs}`)
        }

        if (data.qrGeneratedAt) {
          setQrAgeStr(formatDistanceToNow(new Date(data.qrGeneratedAt), { addSuffix: true }))
        }
      }
    } catch {
      // Ignore transient network errors
    }
  }

  // 3. Fetch logs
  async function fetchLogs() {
    if (isPausedRef.current) return
    try {
      const res = await fetch('/api/whatsapp/logs')
      if (res.ok) {
        const data = await res.json()
        if (data.logs) {
          setLogs(data.logs)
        }
      }
    } catch {
      // Ignore transient log fetching errors
    }
  }

  // 4. Fetch QR Code from backend API
  async function fetchQrCode() {
    try {
      const res = await fetch('/api/whatsapp/qr')
      const data = await res.json()

      if (data.ready) {
        setConnected(true)
        setQrCode(null)
      } else if (data.qrCode) {
        setQrCode(data.qrCode)
        setQrMessage('')
      } else {
        setQrMessage(data.message || 'Waiting for QR Code...')
      }
    } catch {
      setQrMessage('Failed to fetch QR Code')
    }
  }

  // 5. Fetch Recent Sent Messages
  async function fetchRecentSent() {
    try {
      const { data, error } = await supabaseBrowser
        .from('leads')
        .select('*')
        .eq('status', 'whatsapp_sent')
        .order('whatsapp_sent_at', { ascending: false })
        .limit(10)

      if (error) throw error
      setRecentSent((data ?? []) as Lead[])
    } catch {
      // Ignore
    } finally {
      setLoadingRecent(false)
    }
  }

  // Disconnect Handler
  async function handleDisconnectService() {
    if (!confirm('Are you sure you want to stop the WhatsApp connection service?')) return

    setDisconnecting(true)
    const toastId = toast.loading('Stopping WhatsApp connection...')

    try {
      const res = await fetch('/api/whatsapp/disconnect', { method: 'POST' })
      if (res.ok) {
        toast.success('WhatsApp service stopped.', { id: toastId })
        setConnected(false)
        setQrCode(null)
        fetchSessionStatus()
        fetchLogs()
      } else {
        toast.error('Failed to stop service.', { id: toastId })
      }
    } catch {
      toast.error('Error stopping service.', { id: toastId })
    } finally {
      setDisconnecting(false)
    }
  }

  // Reconnect Handler
  async function handleReconnect() {
    if (reconnecting) return
    setReconnecting(true)
    const toastId = toast.loading('Initiating reconnect...')
    try {
      const res = await fetch('/api/whatsapp/reconnect', {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to reconnect')
      }
      toast.success('Reconnect successfully initiated!', { id: toastId })
      fetchSessionStatus()
      fetchLogs()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to reconnect'
      toast.error(message, { id: toastId })
    } finally {
      setReconnecting(false)
    }
  }

  // Connect Action Handler
  async function handleConnectService() {
    setConnecting(true)
    const toastId = toast.loading('Initiating connection...')
    try {
      const res = await fetch('/api/whatsapp/connect', {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to connect')
      }
      toast.success('Connection successfully initiated!', { id: toastId })
      fetchSessionStatus()
      fetchLogs()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to connect'
      toast.error(message, { id: toastId })
    } finally {
      setConnecting(false)
    }
  }

  // Logs Auto-Scroll Effect
  useEffect(() => {
    if (logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight
    }
  }, [logs])

  // Polling rates optimized
  useEffect(() => {
    fetchStatus()
    fetchRecentSent()

    const statusInterval = setInterval(fetchStatus, 35000)
    const recentInterval = setInterval(fetchRecentSent, 45000)

    return () => {
      clearInterval(statusInterval)
      clearInterval(recentInterval)
    }
  }, [])

  useEffect(() => {
    fetchSessionStatus()
    fetchLogs()

    const sessionInterval = setInterval(fetchSessionStatus, 30000)
    const logsInterval = setInterval(fetchLogs, 15000)

    return () => {
      clearInterval(sessionInterval)
      clearInterval(logsInterval)
    }
  }, [])

  // QR refresh loop
  useEffect(() => {
    if (connected === true) {
      setQrCode(null)
      return
    }

    fetchQrCode()
    setQrCountdown(30)

    const qrInterval = setInterval(() => {
      fetchQrCode()
      setQrCountdown(30)
    }, 30000)

    const timerInterval = setInterval(() => {
      setQrCountdown((prev) => (prev > 1 ? prev - 1 : 30))
    }, 1000)

    return () => {
      clearInterval(qrInterval)
      clearInterval(timerInterval)
    }
  }, [connected])

  // Test Message Handler
  async function handleSendTestMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!testPhone.trim() || !testMessage.trim()) {
      toast.error('Recipient phone and Message content are required')
      return
    }

    setSendingTest(true)
    const toastId = toast.loading('Sending test message...')
    
    sendAbortRef.current = new AbortController()

    let finalPhone = testPhone.trim()
    if (!finalPhone.startsWith('+')) {
      finalPhone = countryCode + finalPhone.replace(/^0+/, '')
    }

    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: finalPhone,
          message: testMessage.trim(),
        }),
        signal: sendAbortRef.current.signal,
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to send message')
      }

      toast.success('Test message sent successfully!', { id: toastId })
      setTestMessage('')
      fetchRecentSent()
      fetchLogs()
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        toast.error('Message send operation aborted', { id: toastId })
      } else {
        const message = err instanceof Error ? err.message : 'Failed to send test message'
        toast.error(message, { id: toastId })
      }
    } finally {
      setSendingTest(false)
      sendAbortRef.current = null
    }
  }

  function handleAbortMessage() {
    if (sendAbortRef.current) {
      sendAbortRef.current.abort()
    }
  }

  return (
    <div className="p-4 sm:p-8 space-y-8 select-none text-foreground max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-blue-500/15 pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
            <Smartphone className="w-7 h-7 text-blue-400" /> WhatsApp Engine Manager
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-zinc-400 font-medium">Configure automated outreach channels, verify QR authentication sheets, and monitor active socket links.</p>
        </div>
        <div className="flex gap-2">
          {(!sessionStatus || sessionStatus.state === 'idle' || sessionStatus.state === 'disconnected') ? (
            <button
              onClick={handleConnectService}
              disabled={connecting}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-4 py-2.5 text-xs font-bold uppercase font-mono tracking-wider disabled:opacity-50 transition-all shadow-lg shadow-emerald-500/20"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              {connecting ? 'Connecting...' : 'Start Connection'}
            </button>
          ) : (sessionStatus.state === 'connecting' || sessionStatus.state === 'qr_waiting') ? (
            <button
              onClick={handleDisconnectService}
              disabled={disconnecting}
              className="flex items-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white px-4 py-2.5 text-xs font-bold uppercase font-mono tracking-wider disabled:opacity-50 transition-all shadow-lg shadow-rose-500/20"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              {disconnecting ? 'Stopping...' : 'Stop Connection'}
            </button>
          ) : (
            <>
              <button
                onClick={handleReconnect}
                disabled={reconnecting}
                className="flex items-center gap-2 rounded-xl glass glow-border hover:bg-blue-600/20 text-blue-300 px-4 py-2.5 text-xs font-bold uppercase font-mono tracking-wider disabled:opacity-50 transition-all shadow-md"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${reconnecting ? 'animate-spin' : ''}`} />
                {reconnecting ? 'Resetting...' : 'Reset Session'}
              </button>
              <button
                onClick={handleDisconnectService}
                disabled={disconnecting}
                className="flex items-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white px-4 py-2.5 text-xs font-bold uppercase font-mono tracking-wider disabled:opacity-50 transition-all shadow-md shadow-rose-500/20"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                {disconnecting ? 'Stopping...' : 'Disconnect'}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column: Bot status and controls */}
        <div className="lg:col-span-1 space-y-6">
          {/* Status Box */}
          <div className={`rounded-2xl glass glow-border p-6 shadow-xl border ${
            connected === null
              ? 'border-blue-500/20 bg-blue-950/20'
              : connected
                ? 'border-emerald-500/30 bg-emerald-950/20'
                : 'border-rose-500/30 bg-rose-950/20'
          }`}>
            <div className="flex justify-between items-start">
              <span className={`text-[10px] font-mono font-bold uppercase tracking-wider ${connected ? 'text-emerald-300' : 'text-zinc-400'}`}>
                Engine Socket Connection
              </span>
              <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-md font-mono font-bold uppercase tracking-wider text-zinc-300">Status</span>
            </div>

            {loadingStatus ? (
              <h3 className="mt-4 text-3xl font-black text-zinc-300 tracking-tight font-mono">Checking Status...</h3>
            ) : connected ? (
              <div className="space-y-4">
                <h3 className="mt-4 text-3xl font-black text-emerald-400 tracking-tight font-mono flex items-center gap-2">
                  <CheckCircle2 className="w-7 h-7" /> Connected
                </h3>
                <div className="text-[11px] text-emerald-300/90 font-mono space-y-1">
                  <p>✓ Automated outreach channels are active</p>
                  <p>✓ Uptime: {uptimeStr}</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <h3 className="mt-4 text-3xl font-black text-rose-400 tracking-tight font-mono flex items-center gap-2">
                  <AlertTriangle className="w-7 h-7" /> Disconnected
                </h3>
                <div className="text-[11px] text-rose-300/90 font-mono space-y-1">
                  <p>⚠️ Bot socket link is currently down</p>
                  <p>⚠️ Authenticate QR sheet to log back in</p>
                </div>
              </div>
            )}
            
            {lastChecked && (
              <span className="text-[9px] text-zinc-500 block mt-5 font-mono font-bold uppercase tracking-wider">
                Last checked: {lastChecked.toLocaleTimeString()}
              </span>
            )}
          </div>

          {/* QR Authentication scanner */}
          {connected === false && (
            <div className="rounded-2xl glass glow-border p-6 shadow-xl space-y-4 flex flex-col items-center">
              <h4 className="font-bold text-white text-xs uppercase tracking-wider self-start text-zinc-400 font-mono">Scan QR Code</h4>
              
              {(!sessionStatus || sessionStatus.state === 'idle' || sessionStatus.state === 'disconnected') ? (
                <div className="w-[232px] h-[232px] rounded-2xl bg-black/40 border border-blue-500/20 flex flex-col items-center justify-center text-center p-6 text-xs text-zinc-400 font-semibold space-y-3">
                  <span className="text-xl">💤</span>
                  <p>WhatsApp connection is stopped.</p>
                  <button
                    onClick={handleConnectService}
                    disabled={connecting}
                    className="rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 text-[10px] font-bold uppercase tracking-wider disabled:opacity-50 transition-all font-mono"
                  >
                    {connecting ? 'Connecting...' : 'Start Connection'}
                  </button>
                </div>
              ) : qrCode ? (
                <div className="bg-white p-4 rounded-2xl border border-blue-500/30 shadow-inner">
                  <QRCodeSVG value={qrCode} size={200} />
                </div>
              ) : (
                <div className="w-[232px] h-[232px] rounded-2xl bg-black/40 border border-blue-500/20 flex items-center justify-center text-center p-6 text-xs text-zinc-400 font-semibold font-mono">
                  {qrMessage || 'Generating connection code...'}
                </div>
              )}

              {(sessionStatus && sessionStatus.state !== 'idle' && sessionStatus.state !== 'disconnected') && (
                <>
                  <div className="text-center w-full">
                    <span className="text-[9px] font-mono font-bold text-zinc-400 uppercase tracking-wider">QR Code Refresh In</span>
                    <p className="text-xl font-black text-blue-400 tracking-tight font-mono">{qrCountdown}s</p>
                    {qrAgeStr && <span className="text-[9px] text-zinc-400 font-mono">Generated: {qrAgeStr}</span>}
                  </div>

                  <div className="w-full text-[10px] text-zinc-300 leading-relaxed bg-blue-950/30 p-3.5 rounded-xl border border-blue-500/20 font-mono">
                    Open WhatsApp on your phone &rarr; Tap Menu or Settings &rarr; Select Linked Devices &rarr; Tap Link a Device.
                  </div>
                </>
              )}
            </div>
          )}

          {/* Manual Test Message Input */}
          <div className="rounded-2xl glass glow-border p-6 shadow-xl">
            <h3 className="font-bold text-white text-md mb-4 uppercase tracking-wider text-[11px] text-zinc-400 font-mono flex items-center gap-1.5">
              <Send className="w-3.5 h-3.5 text-blue-400" /> Manual Socket Send
            </h3>
            <form onSubmit={handleSendTestMessage} className="space-y-4">
              <div>
                <label className="block text-[10px] font-mono font-bold text-zinc-400 mb-1 uppercase tracking-wider">Recipient Phone</label>
                <div className="flex gap-2">
                  <select
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                    className="rounded-xl bg-black/50 border border-white/10 px-3 py-2.5 text-xs text-zinc-200 font-mono focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="+91">🇮🇳 +91 (IN)</option>
                    <option value="+1">🇺🇸 +1 (US)</option>
                    <option value="+44">🇬🇧 +44 (UK)</option>
                    <option value="+61">🇦🇺 +61 (AU)</option>
                    <option value="+971">🇦🇪 +971 (AE)</option>
                    <option value="+966">🇸🇦 +966 (SA)</option>
                    <option value="+49">🇩🇪 +49 (DE)</option>
                    <option value="+33">🇫🇷 +33 (FR)</option>
                    <option value="+65">🇸🇬 +65 (SG)</option>
                  </select>
                  <input
                    type="text"
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    placeholder={
                      countryCode === '+91' ? 'e.g. 9876543210' :
                      countryCode === '+1' ? 'e.g. 2025550143' :
                      countryCode === '+44' ? 'e.g. 7911123456' :
                      'Enter phone number digits...'
                    }
                    required
                    className="flex-1 rounded-xl bg-black/50 border border-white/10 px-3.5 py-2.5 text-xs text-zinc-200 font-mono focus:outline-none focus:border-blue-500 placeholder-zinc-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-mono font-bold text-zinc-400 mb-1 uppercase tracking-wider">Message Content</label>
                <textarea
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  placeholder="Type test message details..."
                  required
                  rows={3}
                  className="w-full rounded-xl bg-black/50 border border-white/10 px-3.5 py-2.5 text-xs text-zinc-200 font-mono focus:outline-none focus:border-blue-500 placeholder-zinc-500 resize-none leading-relaxed"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={sendingTest || connected === false}
                  className="flex-1 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold uppercase tracking-wider font-mono text-white py-3 shadow-md shadow-blue-500/20 transition-all"
                >
                  {sendingTest ? 'Sending...' : 'Send Message'}
                </button>
                {sendingTest && (
                  <button
                    type="button"
                    onClick={handleAbortMessage}
                    className="px-4 rounded-xl bg-rose-950/40 hover:bg-rose-900/40 border border-rose-500/30 text-rose-300 text-xs font-mono font-bold uppercase tracking-wider"
                  >
                    Abort
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Service Disconnect Control */}
          <div className="rounded-2xl glass border border-rose-500/30 bg-rose-950/20 p-5 space-y-3 shadow-xl text-xs">
            <h4 className="font-bold text-rose-300 uppercase text-[10px] font-mono tracking-wider">Danger Controls</h4>
            <p className="text-[10px] text-rose-300/80 leading-relaxed font-medium">Terminate underlying Puppeteer worker. This stops all socket loops.</p>
            <button
              onClick={handleDisconnectService}
              disabled={disconnecting}
              className="w-full rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white font-bold uppercase font-mono tracking-wider py-3 text-[10px] transition-all shadow-md shadow-rose-500/20"
            >
              {disconnecting ? 'Stopping Service...' : 'Force Disconnect Service'}
            </button>
          </div>
        </div>

        {/* Right column: Logs & Send History */}
        <div className="lg:col-span-2 space-y-6">
          {/* Logs terminal */}
          <div className="rounded-2xl glass glow-border p-6 shadow-xl flex flex-col h-[320px]">
            <div className="flex items-center justify-between border-b border-blue-500/15 pb-3 mb-4">
              <h3 className="font-bold text-white text-md uppercase tracking-wider text-[11px] text-zinc-400 font-mono flex items-center gap-2">
                <Terminal className="w-4 h-4 text-blue-400" /> Active WhatsApp Event Logs
              </h3>
              <button
                onClick={() => setIsPaused(!isPaused)}
                className={`px-3 py-1 rounded-lg border text-[9px] font-bold uppercase tracking-wider font-mono transition-colors ${
                  isPaused ? 'bg-amber-500/15 text-amber-300 border-amber-500/30' : 'bg-blue-500/10 text-blue-300 border-blue-500/20 hover:bg-blue-500/20'
                }`}
              >
                {isPaused ? '⏸ Paused' : '⚡ Live'}
              </button>
            </div>

            <div
              ref={logsContainerRef}
              className="flex-1 overflow-y-auto p-4 rounded-xl bg-zinc-950 border border-white/10 font-mono text-[10px] text-zinc-300 space-y-2 leading-relaxed"
            >
              {logs.length === 0 ? (
                <p className="text-zinc-500 italic">No console events captured yet.</p>
              ) : (
                logs.map((log, idx) => (
                  <div key={idx} className="break-all">
                    <span className="text-zinc-500 font-semibold mr-1.5">
                      [{new Date(log.timestamp).toLocaleTimeString()}]
                    </span>
                    <span className={`uppercase font-bold text-[8px] px-1 py-0.2 rounded border mr-1.5 ${
                      log.level === 'error' ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' :
                      log.level === 'warn' ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' :
                      log.level === 'success' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' :
                      'bg-blue-500/15 text-blue-300 border-blue-500/30'
                    }`}>
                      {log.level}
                    </span>
                    <span className={
                      log.level === 'error' ? 'text-rose-300 font-bold' :
                      log.level === 'success' ? 'text-emerald-300 font-medium' :
                      'text-zinc-200'
                    }>
                      {log.message}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Send history */}
          <div className="rounded-2xl glass glow-border p-6 shadow-xl">
            <h3 className="font-bold text-white text-md mb-4 uppercase tracking-wider text-[11px] text-zinc-400 font-mono">📜 Recent Outreach Logs</h3>

            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="border-b border-blue-500/15 text-left text-zinc-400 uppercase tracking-wider text-[9px] font-mono font-bold">
                    <th className="pb-3.5 pr-4">Recipient</th>
                    <th className="pb-3.5 pr-4">Phone</th>
                    <th className="pb-3.5 pr-4">Status</th>
                    <th className="pb-3.5">Sent At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-500/10 text-zinc-300">
                  {loadingRecent ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-zinc-500 font-mono">Loading history...</td>
                    </tr>
                  ) : recentSent.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-zinc-500 font-medium">No recent outreach messages found.</td>
                    </tr>
                  ) : (
                    recentSent.map((lead) => (
                      <tr key={lead.id} className="hover:bg-blue-500/10 transition-colors">
                        <td className="py-3 pr-4 font-bold text-white">{lead.name}</td>
                        <td className="py-3 pr-4 font-mono text-[10px] text-zinc-400">{lead.phone || '—'}</td>
                        <td className="py-3 pr-4">
                          <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
                            Sent
                          </span>
                        </td>
                        <td className="py-3 text-zinc-400 font-mono text-[10px]">
                          {lead.whatsapp_sent_at ? (() => {
                            try {
                              const d = new Date(lead.whatsapp_sent_at);
                              return isNaN(d.getTime()) ? '—' : formatDistanceToNow(d, { addSuffix: true });
                            } catch {
                              return '—';
                            }
                          })() : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
