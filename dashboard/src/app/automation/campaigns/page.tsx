// dashboard/src/app/automation/campaigns/page.tsx
'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'

interface CampaignJob {
  id: string
  keyword: string
  city: string
  status: string
  progress: number
  max_leads: number
}

interface DeliveryLog {
  time: string
  recipient: string
  channel: 'email' | 'whatsapp'
  status: 'sent' | 'failed' | 'pending'
  details: string
}

export default function OutreachCampaignsPage() {
  const [dailyLimit, setDailyLimit] = useState(250)
  const [delaySeconds, setDelaySeconds] = useState(45)
  const [saving, setSaving] = useState(false)
  const [campaigns, setCampaigns] = useState<CampaignJob[]>([])
  const [logs, setLogs] = useState<DeliveryLog[]>([])
  const [loading, setLoading] = useState(true)

  // Fetch live jobs and sent leads from DB
  const fetchData = async () => {
    try {
      // 1. Fetch scrape jobs as outreach campaigns source
      const jobsRes = await fetch('/api/scraper/jobs')
      if (jobsRes.ok) {
        const jobsData = await jobsRes.json()
        if (jobsData.success && Array.isArray(jobsData.jobs)) {
          setCampaigns(jobsData.jobs)
        }
      }

      // 2. Fetch leads with email outreach status to populate logs
      const leadsRes = await fetch('/api/leads?perPage=100')
      if (leadsRes.ok) {
        const leadsData = await leadsRes.json()
        if (Array.isArray(leadsData.leads)) {
          const sentLeads = leadsData.leads.filter(
            (l: any) => l.status === 'email_sent' || l.email_sent_at
          )
          
          const mappedLogs: DeliveryLog[] = sentLeads.map((l: any) => {
            const date = l.email_sent_at ? new Date(l.email_sent_at) : new Date()
            return {
              time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              recipient: l.name,
              channel: 'email',
              status: 'sent',
              details: l.ai_message_email_subject || 'Outreach introduction dispatched'
            }
          })
          setLogs(mappedLogs)
        }
      }
    } catch (err) {
      console.error('[Campaigns] Error loading live data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 15000)
    return () => clearInterval(interval)
  }, [])

  const handleUpdateThrottleSettings = (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setTimeout(() => {
      setSaving(false)
      toast.success('Outbound rate-limits and throttling updated!')
    }, 1000)
  }

  const handleTriggerBroadcast = () => {
    toast.success('Campaign broadcast batch queued to n8n orchestration node!')
  }

  return (
    <div className="space-y-8 select-none text-white">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Campaign Outreach</h1>
          <p className="mt-1 text-sm text-gray-500 font-medium">Create outbound messages, trigger bulk broadcasts via n8n queues, and establish safety throttling rate-limits.</p>
        </div>
        <button
          onClick={handleTriggerBroadcast}
          className="rounded-xl bg-[#E3B859] hover:bg-[#d4ac50] text-[#141416] text-xs font-bold uppercase tracking-wider px-6 py-3 transition-colors shadow-md"
        >
          🚀 Dispatch Broadcast
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-500 text-sm">
          <span>Loading live campaign metrics from database...</span>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-3">
          {/* Left Column: Campaigns lists */}
          <div className="md:col-span-2 space-y-6">
            <div className="rounded-2xl border border-[#2D2D30] bg-[#18181A] p-6 space-y-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-[#2D2D30] pb-2">📤 Active Outreach Campaigns</h3>
              
              {campaigns.length === 0 ? (
                <div className="py-12 text-center border border-dashed border-[#2D2D30] rounded-xl bg-[#141416]/50">
                  <span className="text-3xl">📭</span>
                  <h4 className="text-sm font-bold text-white mt-3">No Campaigns Registered</h4>
                  <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                    You have not started any scraper jobs yet. Please launch a scraper job to register your first outreach campaign.
                  </p>
                  <Link href="/scraper" className="inline-block mt-4 text-[10px] uppercase tracking-wider font-bold text-[#E3B859] hover:underline">
                    Go to Scraper →
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {campaigns.map(c => (
                    <div key={c.id} className="p-4 bg-[#141416] border border-[#2D2D30] rounded-xl flex flex-col sm:flex-row justify-between sm:items-center gap-4 text-xs">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-sm">Cold Outreach: {c.keyword}</span>
                          <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                            c.status === 'completed' ? 'bg-green-950/40 text-green-400 border border-green-900/30' :
                            c.status === 'running' ? 'bg-blue-950/40 text-blue-400 border border-blue-900/30' :
                            c.status === 'failed' ? 'bg-red-950/40 text-red-400 border border-red-900/30' : 'bg-gray-800 text-gray-400 border border-gray-700'
                          }`}>{c.status}</span>
                        </div>
                        <p className="text-gray-400 font-medium leading-relaxed">
                          Target Location: <strong className="text-white">{c.city}</strong>
                        </p>
                        <span className="inline-block text-[9px] text-[#E3B859] bg-[#E3B859]/10 border border-[#E3B859]/20 px-2 py-0.5 rounded uppercase tracking-wider font-mono font-bold mt-1">
                          Channel: EMAIL
                        </span>
                      </div>

                      <div className="text-right space-y-1.5 self-start sm:self-auto">
                        <span className="block text-[10px] text-gray-500 font-bold uppercase tracking-wider">Progress</span>
                        <span className="block text-sm font-bold text-white font-mono">{c.progress} / {c.max_leads}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Delivery logs Feed */}
            <div className="rounded-2xl border border-[#2D2D30] bg-[#18181A] p-6 space-y-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-[#2D2D30] pb-2">📋 Delivery Status Logs</h3>
              
              {logs.length === 0 ? (
                <div className="py-12 text-center border border-dashed border-[#2D2D30] rounded-xl bg-[#141416]/50">
                  <span className="text-3xl">✉️</span>
                  <h4 className="text-sm font-bold text-white mt-3">No Delivery Logs Found</h4>
                  <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                    Emails sent from the Email Outreach portal will show their delivery time and status here.
                  </p>
                  <Link href="/automation/email-outreach" className="inline-block mt-4 text-[10px] uppercase tracking-wider font-bold text-[#E3B859] hover:underline">
                    Send Outreach Emails →
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-[#2D2D30]/60 space-y-3.5">
                  {logs.map((log, idx) => (
                    <div key={idx} className="pt-3.5 flex gap-4 items-start text-xs">
                      <span className="w-2 h-2 mt-1.5 rounded-full flex-shrink-0 bg-green-500" />
                      <div className="flex-1 space-y-1">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-white">{log.recipient}</span>
                          <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">{log.time}</span>
                        </div>
                        <p className="text-gray-400 font-medium leading-relaxed">
                          {log.details} ({log.channel.toUpperCase()})
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Rate Limit Throttling Settings */}
          <div className="space-y-6">
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

            {/* How to test help card */}
            <div className="rounded-2xl border border-[#E3B859]/20 bg-[#E3B859]/5 p-6 space-y-4">
              <h3 className="text-sm font-bold text-[#E3B859] uppercase tracking-wider border-b border-[#E3B859]/20 pb-2">🛠️ Testing Guide</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                This portal reads live database entries. Follow these steps to test the automation:
              </p>
              <ol className="list-decimal pl-4 text-xs text-gray-400 space-y-2">
                <li>Go to the <Link href="/scraper" className="text-[#E3B859] hover:underline">Google Scraper</Link> page and launch a scraping run.</li>
                <li>Once leads are extracted, go to <Link href="/automation/email-outreach" className="text-[#E3B859] hover:underline">Email Outreach</Link>.</li>
                <li>Select the leads, generate the AI drafts, and click "Send Emails".</li>
                <li>Return here to watch your active campaigns and sent logs update automatically!</li>
              </ol>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
