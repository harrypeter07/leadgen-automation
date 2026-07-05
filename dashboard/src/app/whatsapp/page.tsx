// dashboard/src/app/whatsapp/page.tsx
'use client'

import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { formatDistanceToNow } from 'date-fns'
import { QRCodeSVG } from 'qrcode.react'
import { supabaseBrowser } from '@/lib/supabase'
import type { Lead } from '@/types/lead'

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

  // 2. Fetch QR code
  async function fetchQrCode() {
    try {
      const res = await fetch('/api/whatsapp/qr')
      if (res.ok) {
        const data = await res.json()
        setQrCode(data.qr)
        setQrMessage(data.message || '')
      }
    } catch {
      setQrMessage('Failed to fetch QR')
    }
  }

  // 3. Fetch recent sent messages
  async function fetchRecentSent() {
    try {
      const { data, error } = await supabaseBrowser
        .from('leads')
        .select('*')
        .not('whatsapp_sent_at', 'is', null)
        .order('whatsapp_sent_at', { ascending: false })
        .limit(10)

      if (error) throw error
      setRecentSent((data ?? []) as Lead[])
    } catch (err) {
      console.error('Error fetching recent sent messages:', err)
    } finally {
      setLoadingRecent(false)
    }
  }

  // 3b. Fetch detailed session status
  async function fetchSessionStatus() {
    try {
      const res = await fetch('/api/whatsapp/status')
      if (res.ok) {
        const data = await res.json()
        setSessionStatus(data)
      }
    } catch (err) {
      console.error('Error fetching session status:', err)
    }
  }

  // 3c. Fetch logs
  async function fetchLogs() {
    if (isPausedRef.current) return
    try {
      const res = await fetch('/api/whatsapp/logs')
      if (res.ok) {
        const data = await res.json()
        setLogs(data.logs || [])
      }
    } catch (err) {
      console.error('Error fetching logs:', err)
    }
  }

  // Uptime Timer Effect
  useEffect(() => {
    if (!sessionStatus?.serviceStartedAt) return
    const start = new Date(sessionStatus.serviceStartedAt).getTime()
    const timer = setInterval(() => {
      const diff = Date.now() - start
      if (diff < 0) return
      const secs = Math.floor(diff / 1000)
      const h = Math.floor(secs / 3600).toString().padStart(2, '0')
      const m = Math.floor((secs % 3600) / 60).toString().padStart(2, '0')
      const s = (secs % 60).toString().padStart(2, '0')
      setUptimeStr(`${h}:${m}:${s}`)
    }, 1000)
    return () => clearInterval(timer)
  }, [sessionStatus?.serviceStartedAt])

  // QR Age Timer Effect
  useEffect(() => {
    if (!sessionStatus?.qrGeneratedAt || !sessionStatus.qrFileExists) {
      setQrAgeStr('')
      return
    }
    const qrTime = new Date(sessionStatus.qrGeneratedAt).getTime()
    const timer = setInterval(() => {
      const diff = Date.now() - qrTime
      const secs = Math.floor(Math.max(0, diff / 1000))
      setQrAgeStr(`${secs}s ago`)
    }, 1000)
    return () => clearInterval(timer)
  }, [sessionStatus?.qrGeneratedAt, sessionStatus?.qrFileExists])

  // Reconnect Action Handler
  async function handleReconnect() {
    if (!confirm('This will log out the current WhatsApp session. Continue?')) {
      return
    }
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

  // Polling rates optimized to decrease load on backend (30s+ intervals)
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

  // QR refresh loop (runs only when disconnected)
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
    
    // Create new abort controller
    sendAbortRef.current = new AbortController()

    // Normalize phone number
    let finalPhone = testPhone.trim()
    if (!finalPhone.startsWith('+')) {
      // Remove any leading zeroes and non-digit characters
      finalPhone = finalPhone.replace(/^0+/, '').replace(/\D/g, '')
      finalPhone = `${countryCode}${finalPhone}`
    }
    
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: finalPhone,
          message: testMessage.trim()
        }),
        signal: sendAbortRef.current.signal
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to send message')
      }

      toast.success('Test message sent successfully!', { id: toastId })
      setTestMessage('')
      fetchRecentSent()
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        toast.error('Message transmission cancelled', { id: toastId })
      } else {
        const msg = err instanceof Error ? err.message : 'Error sending message'
        toast.error(msg, { id: toastId })
      }
    } finally {
      setSendingTest(false)
      sendAbortRef.current = null
    }
  }

  // Abort active message transmission
  function handleAbortMessage() {
    if (sendAbortRef.current) {
      sendAbortRef.current.abort()
    }
  }

  // Force disconnect handler
  async function handleDisconnectService() {
    if (!confirm('Warning: This will terminate the entire underlying WhatsApp service. You will need to re-authenticate. Continue?')) {
      return
    }
    setDisconnecting(true)
    const toastId = toast.loading('Disconnecting service...')
    try {
      const res = await fetch('/api/whatsapp/disconnect', { method: 'POST' })
      if (!res.ok) throw new Error('Failed to disconnect service')
      toast.success('WhatsApp service stopped successfully!', { id: toastId })
      setConnected(false)
      setQrCode(null)
      fetchSessionStatus()
      fetchLogs()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to disconnect'
      toast.error(msg, { id: toastId })
    } finally {
      setDisconnecting(false)
    }
  }

  return (
    <div className="space-y-8 text-[#2D2D2D] select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-[#1C1C1E] tracking-tight">WhatsApp Engine Manager</h1>
          <p className="mt-1 text-sm text-gray-500 font-medium">Configure automated outreach channels, verify QR authentication sheets, and monitor active socket links.</p>
        </div>
        <div className="flex gap-2">
          {(!sessionStatus || sessionStatus.state === 'idle' || sessionStatus.state === 'disconnected') ? (
            <button
              onClick={handleConnectService}
              disabled={connecting}
              className="flex items-center gap-2 rounded-xl bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 text-xs font-bold uppercase tracking-wider disabled:opacity-50 transition-colors"
            >
              {connecting ? 'Connecting...' : '▶ Start Connection'}
            </button>
          ) : (sessionStatus.state === 'connecting' || sessionStatus.state === 'qr_waiting') ? (
            <button
              onClick={handleDisconnectService}
              disabled={disconnecting}
              className="flex items-center gap-2 rounded-xl bg-red-650 hover:bg-red-700 text-white px-4 py-2.5 text-xs font-bold uppercase tracking-wider disabled:opacity-50 transition-colors"
            >
              {disconnecting ? 'Stopping...' : '⏹ Stop Connection'}
            </button>
          ) : (
            <>
              <button
                onClick={handleReconnect}
                disabled={reconnecting}
                className="flex items-center gap-2 rounded-xl bg-[#1C1C1E] hover:bg-[#252528] text-white px-4 py-2.5 text-xs font-bold uppercase tracking-wider disabled:opacity-50 transition-colors"
              >
                {reconnecting ? 'Resetting...' : '🔄 Reset Session'}
              </button>
              <button
                onClick={handleDisconnectService}
                disabled={disconnecting}
                className="flex items-center gap-2 rounded-xl bg-red-650 hover:bg-red-700 text-white px-4 py-2.5 text-xs font-bold uppercase tracking-wider disabled:opacity-50 transition-colors"
              >
                {disconnecting ? 'Stopping...' : '⏹ Disconnect'}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column: Bot status and controls */}
        <div className="lg:col-span-1 space-y-6">
          {/* Status Box */}
          <div className={`rounded-2xl p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] border ${
            connected === null
              ? 'bg-[#ECEAE4] border-[#E4E3DD]'
              : connected
                ? 'bg-[#D4E0CD] border-[#B8C8B0]'
                : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex justify-between items-start">
              <span className={`text-[10px] font-bold uppercase tracking-wider ${connected ? 'text-[#3B4D3C]' : 'text-gray-500'}`}>
                Engine Socket Connection
              </span>
              <span className="text-[10px] bg-white/40 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Status</span>
            </div>

            {loadingStatus ? (
              <h3 className="mt-4 text-3xl font-black text-gray-700 tracking-tight">Checking Status...</h3>
            ) : connected ? (
              <div className="space-y-4">
                <h3 className="mt-4 text-3xl font-black text-[#2E3A2F] tracking-tight">Connected</h3>
                <div className="text-[11px] text-[#3B4D3C]/80 font-semibold space-y-1">
                  <p>✓ Automated outreach channels are active</p>
                  <p>✓ Uptime: {uptimeStr}</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <h3 className="mt-4 text-3xl font-black text-red-700 tracking-tight">Disconnected</h3>
                <div className="text-[11px] text-red-650 font-semibold space-y-1">
                  <p>⚠️ Bot socket link is currently down</p>
                  <p>⚠️ Authenticate QR sheet to log back in</p>
                </div>
              </div>
            )}
            
            {lastChecked && (
              <span className="text-[9px] text-gray-400 block mt-5 font-bold uppercase tracking-wider">
                Last checked: {lastChecked.toLocaleTimeString()}
              </span>
            )}
          </div>

          {/* QR Authentication scanner */}
          {connected === false && (
            <div className="rounded-2xl border border-[#E4E3DD] bg-white p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] space-y-4 flex flex-col items-center">
              <h4 className="font-bold text-[#1C1C1E] text-xs uppercase tracking-wider self-start text-gray-500">Scan QR Code</h4>
              
              {(!sessionStatus || sessionStatus.state === 'idle' || sessionStatus.state === 'disconnected') ? (
                <div className="w-[232px] h-[232px] rounded-2xl bg-gray-50 border border-[#E4E3DD] flex flex-col items-center justify-center text-center p-6 text-xs text-gray-400 font-semibold space-y-3">
                  <span className="text-xl">💤</span>
                  <p>WhatsApp connection is stopped.</p>
                  <button
                    onClick={handleConnectService}
                    disabled={connecting}
                    className="rounded-xl bg-green-600 hover:bg-green-700 text-white px-4 py-2 text-[10px] font-bold uppercase tracking-wider disabled:opacity-50 transition-colors"
                  >
                    {connecting ? 'Connecting...' : 'Start Connection'}
                  </button>
                </div>
              ) : qrCode ? (
                <div className="bg-white p-4 rounded-2xl border border-[#E4E3DD] shadow-inner">
                  <QRCodeSVG value={qrCode} size={200} />
                </div>
              ) : (
                <div className="w-[232px] h-[232px] rounded-2xl bg-gray-50 border border-[#E4E3DD] flex items-center justify-center text-center p-6 text-xs text-gray-400 font-semibold">
                  {qrMessage || 'Generating connection code...'}
                </div>
              )}

              {(sessionStatus && sessionStatus.state !== 'idle' && sessionStatus.state !== 'disconnected') && (
                <>
                  <div className="text-center w-full">
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">QR Code Refresh In</span>
                    <p className="text-xl font-black text-gray-800 tracking-tight font-mono">{qrCountdown}s</p>
                    {qrAgeStr && <span className="text-[9px] text-gray-400 font-medium">Generated: {qrAgeStr}</span>}
                  </div>

                  <div className="w-full text-[10px] text-gray-400 leading-relaxed bg-[#F4F3EF] p-4 rounded-xl border border-[#E4E3DD] font-medium">
                    Open WhatsApp on your phone &rarr; Tap Menu or Settings &rarr; Select Linked Devices &rarr; Tap Link a Device.
                  </div>
                </>
              )}
            </div>
          )}

          {/* Manual Test Message Input */}
          <div className="rounded-2xl border border-[#E4E3DD] bg-white p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)]">
            <h3 className="font-bold text-[#1C1C1E] text-md mb-4 uppercase tracking-wider text-[11px] text-gray-500">⚙️ Manual Socket Send</h3>
            <form onSubmit={handleSendTestMessage} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-wider">Recipient Phone</label>
                <div className="flex gap-2">
                  <select
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                    className="rounded-xl bg-[#F4F3EF] border border-[#E4E3DD] px-3 py-2.5 text-xs text-[#2D2D2D] font-semibold focus:outline-none focus:border-gray-500 cursor-pointer"
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
                    className="flex-1 rounded-xl bg-[#F4F3EF] border border-[#E4E3DD] px-3.5 py-2.5 text-xs text-[#2D2D2D] font-semibold focus:outline-none focus:border-gray-500 placeholder-gray-400"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-wider">Message Content</label>
                <textarea
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  placeholder="Type test message details..."
                  required
                  rows={3}
                  className="w-full rounded-xl bg-[#F4F3EF] border border-[#E4E3DD] px-3.5 py-2.5 text-xs text-[#2D2D2D] font-semibold focus:outline-none focus:border-gray-500 placeholder-gray-400 resize-none leading-relaxed"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={sendingTest || connected === false}
                  className="flex-1 rounded-xl bg-[#1C1C1E] hover:bg-[#252528] disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold uppercase tracking-wider text-white py-3.5 shadow-sm transition-colors"
                >
                  {sendingTest ? 'Sending...' : 'Send Message'}
                </button>
                {sendingTest && (
                  <button
                    type="button"
                    onClick={handleAbortMessage}
                    className="px-4 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-xs font-bold uppercase tracking-wider"
                  >
                    Abort
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Service Disconnect Control */}
          <div className="rounded-2xl border border-red-100 bg-red-50/20 p-5 space-y-3 shadow-sm text-xs">
            <h4 className="font-bold text-red-950 uppercase text-[9px] tracking-wider">Danger Controls</h4>
            <p className="text-[10px] text-red-650 leading-relaxed font-semibold">Terminate underlying Puppeteer worker. This stops all socket loops.</p>
            <button
              onClick={handleDisconnectService}
              disabled={disconnecting}
              className="w-full rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white font-bold uppercase tracking-wider py-3 text-[10px] transition-colors"
            >
              {disconnecting ? 'Stopping Service...' : 'Force Disconnect Service'}
            </button>
          </div>
        </div>

        {/* Right column: Logs & Send History */}
        <div className="lg:col-span-2 space-y-6">
          {/* Logs terminal */}
          <div className="rounded-2xl border border-[#E4E3DD] bg-white p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] flex flex-col h-[320px]">
            <div className="flex items-center justify-between border-b border-[#E4E3DD] pb-3 mb-4">
              <h3 className="font-bold text-[#1C1C1E] text-md uppercase tracking-wider text-[11px] text-gray-500">📟 Active WhatsApp Event Logs</h3>
              <button
                onClick={() => setIsPaused(!isPaused)}
                className={`px-3 py-1 rounded-lg border text-[9px] font-bold uppercase tracking-wider transition-colors ${
                  isPaused ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-gray-50 text-gray-500 border-[#E4E3DD] hover:bg-gray-100'
                }`}
              >
                {isPaused ? '⏸ Paused' : '⚡ Live'}
              </button>
            </div>

            <div
              ref={logsContainerRef}
              className="flex-1 overflow-y-auto p-4 rounded-xl bg-[#F4F3EF] border border-[#E4E3DD] font-mono text-[10px] text-gray-600 space-y-2 leading-relaxed"
            >
              {logs.length === 0 ? (
                <p className="text-gray-400 italic">No console events captured yet.</p>
              ) : (
                logs.map((log, idx) => (
                  <div key={idx} className="break-all">
                    <span className="text-gray-400 font-semibold mr-1.5">
                      [{new Date(log.timestamp).toLocaleTimeString()}]
                    </span>
                    <span className={`uppercase font-bold text-[8px] px-1 py-0.2 rounded border mr-1.5 ${
                      log.level === 'error' ? 'bg-red-50 text-red-700 border-red-200' :
                      log.level === 'warn' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                      log.level === 'success' ? 'bg-green-50 text-green-700 border-green-250' :
                      'bg-gray-100 text-gray-500 border-gray-200'
                    }`}>
                      {log.level}
                    </span>
                    <span className={
                      log.level === 'error' ? 'text-red-650 font-bold' :
                      log.level === 'success' ? 'text-green-750 font-medium' :
                      'text-gray-700'
                    }>
                      {log.message}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Send history */}
          <div className="rounded-2xl border border-[#E4E3DD] bg-white p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)]">
            <h3 className="font-bold text-[#1C1C1E] text-md mb-4 uppercase tracking-wider text-[11px] text-gray-500">📜 Recent Outreach Logs</h3>

            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="border-b border-[#E4E3DD] text-left text-gray-400 uppercase tracking-wider text-[9px] font-bold">
                    <th className="pb-3.5 pr-4">Recipient</th>
                    <th className="pb-3.5 pr-4">Phone</th>
                    <th className="pb-3.5 pr-4">Status</th>
                    <th className="pb-3.5">Sent At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4E3DD]/60 text-gray-700">
                  {loadingRecent ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-gray-400">Loading history...</td>
                    </tr>
                  ) : recentSent.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-gray-400 font-semibold">No recent outreach messages found.</td>
                    </tr>
                  ) : (
                    recentSent.map((lead) => (
                      <tr key={lead.id} className="hover:bg-[#F4F3EF]/30 transition-colors">
                        <td className="py-3 pr-4 font-bold text-gray-900">{lead.name}</td>
                        <td className="py-3 pr-4 font-mono text-[10px] text-gray-500">{lead.phone || '—'}</td>
                        <td className="py-3 pr-4">
                          <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-green-50 border border-green-200 text-green-700">
                            Sent
                          </span>
                        </td>
                        <td className="py-3 text-gray-405 font-medium">
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
