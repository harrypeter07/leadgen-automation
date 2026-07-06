'use client'

import React, { useState } from 'react'
import toast from 'react-hot-toast'

export default function OutreachCampaignsPage() {
  const [dailyLimit, setDailyLimit] = useState(250)
  const [delaySeconds, setDelaySeconds] = useState(45)
  const [saving, setSaving] = useState(false)

  const campaigns = [
    { id: '1', name: 'Cold WhatsApp Website Audit Redesign', channel: 'whatsapp', audience: 'Slow Load Cafes Singapore', segment: 'Rating < 4.0', status: 'running', progress: '124/300' },
    { id: '2', name: 'Bulk Instagram DM proposal pitch', channel: 'instagram', audience: 'F&B Business IG Profiles', segment: 'Followers > 1K', status: 'paused', progress: '52/150' },
    { id: '3', name: 'System follow-up sequences', channel: 'messenger', audience: 'Inbound Inquiries', segment: 'No reply 48h', status: 'completed', progress: '90/90' },
  ]

  const deliveryLogs = [
    { time: '2 mins ago', recipient: 'Singapore Cafe Coffee', channel: 'whatsapp', status: 'sent', details: 'Template: mockup_intro dispatched' },
    { time: '12 mins ago', recipient: 'Staging Restaurant Cafe', channel: 'messenger', status: 'read', details: 'Text pitch delivered' },
    { time: '40 mins ago', recipient: 'Organic Bakery Ltd', channel: 'whatsapp', status: 'failed', details: 'Rate limit threshold reached (throttled)', error: 'Dispatch suspended' },
  ]

  const handleUpdateThrottleSettings = (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setTimeout(() => {
      setSaving(false)
      toast.success('Outbound rate-limits and throttling updated!')
    }, 1200)
  }

  const handleTriggerBroadcast = () => {
    toast.success('Campaign broadcast batch queued to n8n orchestration node!')
  }

  return (
    <div className="space-y-8 select-none">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">Campaign Outreach</h1>
          <p className="mt-1 text-sm text-gray-500 font-medium">Create outbound messages, trigger bulk broadcasts via n8n queues, and establish safety throttling rate-limits.</p>
        </div>
        <button
          onClick={handleTriggerBroadcast}
          className="rounded-xl bg-[#E3B859] hover:bg-[#d4ac50] text-[#141416] text-xs font-bold uppercase tracking-wider px-6 py-3 transition-colors shadow-md"
        >
          🚀 Dispatch Broadcast
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Left Column: Campaigns lists */}
        <div className="md:col-span-2 space-y-6">
          <div className="rounded-2xl border border-[#2D2D30] bg-[#18181A] p-6 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-[#2D2D30] pb-2">📤 Active Outreach Campaigns</h3>
            
            <div className="space-y-4">
              {campaigns.map(c => (
                <div key={c.id} className="p-4 bg-[#141416] border border-[#2D2D30] rounded-xl flex flex-col sm:flex-row justify-between sm:items-center gap-4 text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">{c.name}</span>
                      <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                        c.status === 'running' ? 'bg-green-950/40 text-green-400 border border-green-900/30' :
                        c.status === 'paused' ? 'bg-amber-950/40 text-amber-400 border border-amber-900/30' : 'bg-gray-800 text-gray-400 border border-gray-700'
                      }`}>{c.status}</span>
                    </div>
                    <p className="text-gray-400 font-medium leading-relaxed">
                      Target Audience: <strong className="text-white">{c.audience}</strong> • Segment: {c.segment}
                    </p>
                    <span className="inline-block text-[9px] text-[#E3B859] bg-[#E3B859]/10 border border-[#E3B859]/20 px-2 py-0.5 rounded uppercase tracking-wider font-mono font-bold mt-1">
                      Channel: {c.channel.toUpperCase()}
                    </span>
                  </div>

                  <div className="text-right space-y-1.5 self-start sm:self-auto">
                    <span className="block text-[10px] text-gray-500 font-bold uppercase tracking-wider">Progress</span>
                    <span className="block text-sm font-bold text-white font-mono">{c.progress}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Delivery logs Feed */}
          <div className="rounded-2xl border border-[#2D2D30] bg-[#18181A] p-6 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-[#2D2D30] pb-2">📋 Delivery Status Logs</h3>
            <div className="divide-y divide-[#2D2D30]/60 space-y-3.5">
              {deliveryLogs.map((log, idx) => (
                <div key={idx} className="pt-3.5 flex gap-4 items-start text-xs">
                  <span className={`w-2 h-2 mt-1.5 rounded-full flex-shrink-0 ${
                    log.status === 'sent' ? 'bg-green-500' :
                    log.status === 'read' ? 'bg-blue-500' : 'bg-red-500'
                  }`} />
                  <div className="flex-1 space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-white">{log.recipient}</span>
                      <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">{log.time}</span>
                    </div>
                    <p className="text-gray-400 font-medium leading-relaxed">
                      {log.details} ({log.channel.toUpperCase()})
                    </p>
                    {log.error && (
                      <span className="inline-block text-[9px] font-mono bg-red-950/20 text-red-400 border border-red-900/30 p-1.5 rounded-lg">
                        Error: {log.error}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Rate Limit Throttling Settings */}
        <div className="rounded-2xl border border-[#2D2D30] bg-[#18181A] p-6 space-y-4 h-fit">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-[#2D2D30] pb-2">⚙️ Rate-Limit Throttling</h3>
          
          <form onSubmit={handleUpdateThrottleSettings} className="space-y-4 text-xs">
            <div>
              <label className="block text-gray-500 text-[10px] font-bold uppercase tracking-wider mb-2">Daily Dispatch Threshold</label>
              <input
                type="number"
                value={dailyLimit}
                onChange={(e) => setDailyLimit(parseInt(e.target.value, 10) || 0)}
                className="w-full px-3 py-2 bg-[#141416] border border-[#2D2D30] rounded-lg text-white font-mono focus:outline-none"
              />
              <span className="text-[9px] text-gray-500 mt-1 block leading-normal uppercase">Maximum daily messages sent across all WhatsApp and Social accounts.</span>
            </div>

            <div>
              <label className="block text-gray-500 text-[10px] font-bold uppercase tracking-wider mb-2">Delay Between dispatches (sec)</label>
              <input
                type="number"
                value={delaySeconds}
                onChange={(e) => setDelaySeconds(parseInt(e.target.value, 10) || 0)}
                className="w-full px-3 py-2 bg-[#141416] border border-[#2D2D30] rounded-lg text-white font-mono focus:outline-none"
              />
              <span className="text-[9px] text-gray-500 mt-1 block leading-normal uppercase">Cool down interval between each queue message to avoid spam flags.</span>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full py-2.5 bg-[#222225] border border-[#2D2D30] hover:bg-[#2A2A2E] text-white text-[10px] font-bold uppercase tracking-wider rounded-xl transition-colors"
            >
              {saving ? 'Saving...' : '💾 Update Limits'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
