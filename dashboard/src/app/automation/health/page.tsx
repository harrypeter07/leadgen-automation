'use client'

import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'

interface SystemHealthData {
  meta_oauth_status: 'connected' | 'disconnected'
  facebook_connected: boolean
  instagram_connected: boolean
  messenger_connected: boolean
  whatsapp_connected: boolean
  n8n_connected: boolean
  webhooks_verified: boolean
  token_expiry_countdown: string
  last_successful_sync: string
  last_graph_api_error: string
}

export default function SystemHealthPage() {
  const [health, setHealth] = useState<SystemHealthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)

  async function fetchHealthData() {
    try {
      const res = await fetch('/api/automation/workflows/health')
      const data = await res.json()
      if (res.ok) {
        setHealth(data)
      } else {
        toast.error(data.error || 'Failed to fetch system diagnostics.')
      }
    } catch (err) {
      console.error('Error loading health data:', err)
      toast.error('Network error fetching health details.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchHealthData()
  }, [])

  async function handleRunSync() {
    setSyncing(true)
    const toastId = toast.loading('Initiating system diagnostics scan...')
    try {
      await fetchHealthData()
      toast.success('Diagnostics verification completed successfully!', { id: toastId })
    } catch {
      toast.error('Diagnostics check failed.', { id: toastId })
    } finally {
      setSyncing(false)
    }
  }

  const getStatusIndicator = (active: boolean) => {
    return active ? (
      <span className="flex items-center gap-1.5 text-xs text-green-400 font-bold bg-green-950/40 border border-green-900/30 px-3 py-1 rounded-xl">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
        ✓ Connected
      </span>
    ) : (
      <span className="flex items-center gap-1.5 text-xs text-red-400 font-bold bg-red-950/20 border border-red-900/30 px-3 py-1 rounded-xl">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
        ✗ Disconnected
      </span>
    )
  }

  return (
    <div className="space-y-8 select-none text-white animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#2D2D30] pb-6">
        <div>
          <h1 className="text-3xl font-black tracking-tight">🩺 System Diagnostics & Health</h1>
          <p className="mt-1 text-sm text-gray-500 font-medium">Verify connection states, tokens expiry, webhooks delivery, and API transaction error logs.</p>
        </div>
        <button
          onClick={handleRunSync}
          disabled={syncing || loading}
          className="rounded-xl bg-[#E3B859] hover:bg-[#d4ac50] disabled:opacity-40 text-[#141416] text-xs font-bold uppercase tracking-wider px-6 py-3.5 transition-colors shadow-md flex items-center gap-2"
        >
          {syncing ? 'Running Scan...' : '🔄 Run Diagnostics'}
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400 text-xs font-semibold">Running diagnostics checks...</div>
      ) : health ? (
        <div className="grid gap-6 md:grid-cols-3">
          {/* Left Column: API Connections Status */}
          <div className="md:col-span-2 space-y-6">
            <div className="rounded-2xl border border-[#2D2D30] bg-[#18181A] p-6 space-y-5">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-[#2D2D30] pb-2">🔋 Provider Connect status</h3>
              
              <div className="space-y-4">
                {[
                  { name: 'Meta OAuth Connection', status: health.meta_oauth_status === 'connected', desc: 'Secure connection app credentials status.' },
                  { name: 'Facebook Pages Integration', status: health.facebook_connected, desc: 'Link to retrieve public Page profile details.' },
                  { name: 'Instagram Business Accounts', status: health.instagram_connected, desc: 'Instagram Professional Business API mapping.' },
                  { name: 'Messenger Platform Webhooks', status: health.messenger_connected, desc: 'Messenger inbound/outbound subscription state.' },
                  { name: 'WhatsApp Cloud API', status: health.whatsapp_connected, desc: 'WABA permanent credentials linkage.' }
                ].map((item, idx) => (
                  <div key={idx} className="p-4 bg-[#141416] border border-[#2D2D30]/60 rounded-xl flex justify-between items-center text-xs">
                    <div className="space-y-1">
                      <span className="font-bold text-white block text-sm">{item.name}</span>
                      <span className="text-[10px] text-gray-500 font-medium">{item.desc}</span>
                    </div>
                    {getStatusIndicator(item.status)}
                  </div>
                ))}
              </div>
            </div>

            {/* Logs error register */}
            <div className="rounded-2xl border border-red-900/30 bg-[#18181A] p-6 space-y-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-red-900/40 pb-2 text-red-400">⚠️ Last Graph API Error Details</h3>
              <div className="p-4 bg-[#141416] border border-[#2D2D30]/60 rounded-xl text-xs font-mono text-gray-400 leading-relaxed max-h-[120px] overflow-y-auto">
                {health.last_graph_api_error || 'None'}
              </div>
            </div>
          </div>

          {/* Right Column: Engine Sync status */}
          <div className="space-y-6">
            {/* Sync diagnostics */}
            <div className="rounded-2xl border border-[#2D2D30] bg-[#18181A] p-6 space-y-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-[#2D2D30] pb-2">📋 Sync & Scheduler Metrics</h3>
              <div className="space-y-4 text-xs font-semibold">
                <div className="p-3.5 bg-[#141416] border border-[#2D2D30]/60 rounded-xl">
                  <span className="text-[9px] uppercase text-gray-500 block mb-0.5">Token Expiry Countdown</span>
                  <strong className="text-white text-md block">{health.token_expiry_countdown}</strong>
                </div>

                <div className="p-3.5 bg-[#141416] border border-[#2D2D30]/60 rounded-xl">
                  <span className="text-[9px] uppercase text-gray-500 block mb-0.5">Last Successful Sync</span>
                  <strong className="text-white text-md block">{new Date(health.last_successful_sync).toLocaleString()}</strong>
                </div>

                <div className="p-3.5 bg-[#141416] border border-[#2D2D30]/60 rounded-xl flex justify-between items-center">
                  <div>
                    <span className="text-[9px] uppercase text-gray-500 block mb-0.5">n8n Engine connected</span>
                    <strong className="text-white text-md block">{health.n8n_connected ? 'Active' : 'Degraded'}</strong>
                  </div>
                  <span className={`w-2.5 h-2.5 rounded-full ${health.n8n_connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                </div>

                <div className="p-3.5 bg-[#141416] border border-[#2D2D30]/60 rounded-xl flex justify-between items-center">
                  <div>
                    <span className="text-[9px] uppercase text-gray-500 block mb-0.5">Webhooks verification status</span>
                    <strong className="text-white text-md block">{health.webhooks_verified ? 'Verified' : 'Failed'}</strong>
                  </div>
                  <span className={`w-2.5 h-2.5 rounded-full ${health.webhooks_verified ? 'bg-green-500' : 'bg-red-500'}`} />
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500">No system diagnostics cache load available.</div>
      )}
    </div>
  )
}
