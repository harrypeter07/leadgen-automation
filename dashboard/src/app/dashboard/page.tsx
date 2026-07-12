// dashboard/src/app/dashboard/page.tsx
'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { formatDistanceToNow } from 'date-fns'
import { supabaseBrowser } from '@/lib/supabase'
import type { Lead } from '@/types/lead'
import StatusBadge from '../leads/components/StatusBadge'

interface Stats {
  total: number
  statusCounts: Record<string, number>
  addedLast7Days: number
  topCities: { name: string; count: number }[]
  topCategories: { name: string; count: number }[]
  providerComparison: { source: string; count: number }[]
  dailyDistribution: { date: string; count: number }[]
  conversionStats: { rate: number; sent: number; replied: number; converted: number }
}

export default function HomeDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [recentLeads, setRecentLeads] = useState<Lead[]>([])
  const [loadingStats, setLoadingStats] = useState(true)
  const [loadingLeads, setLoadingLeads] = useState(true)
  const [triggeringAi, setTriggeringAi] = useState(false)
  const [triggeringOutreach, setTriggeringOutreach] = useState(false)

  // 1. Fetch stats
  async function fetchStats() {
    try {
      const res = await fetch('/api/stats')
      if (res.ok) {
        const data = await res.json()
        setStats(data)
      }
    } catch (err) {
      console.error('Error fetching stats:', err)
    } finally {
      setLoadingStats(false)
    }
  }

  // 2. Fetch recent leads
  async function fetchRecentLeads() {
    try {
      const { data, error } = await supabaseBrowser
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5)

      if (error) throw error
      setRecentLeads((data ?? []) as Lead[])
    } catch (err: unknown) {
      console.error('Error fetching recent leads:', err)
    } finally {
      setLoadingLeads(false)
    }
  }

  useEffect(() => {
    fetchStats()
    fetchRecentLeads()

    const interval = setInterval(() => {
      fetchStats()
      fetchRecentLeads()
    }, 15000)

    return () => clearInterval(interval)
  }, [])

  // 3. Trigger manual AI workflow
  async function triggerAiWorkflow() {
    setTriggeringAi(true)
    const toastId = toast.loading('Triggering AI Personalisation...')
    try {
      const res = await fetch('/api/workflows/trigger-ai', { method: 'POST' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to trigger workflow')
      }
      toast.success('AI Personalisation workflow triggered!', { id: toastId })
      localStorage.setItem('leadgen_last_ai_trigger', new Date().toISOString())
      fetchStats()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to trigger AI workflow'
      toast.error(message, { id: toastId })
    } finally {
      setTriggeringAi(false)
    }
  }

  // 4. Trigger manual Outreach workflow
  async function triggerOutreachWorkflow() {
    setTriggeringOutreach(true)
    const toastId = toast.loading('Triggering Outreach workflow...')
    try {
      const res = await fetch('/api/workflows/trigger-outreach', { method: 'POST' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to trigger workflow')
      }
      toast.success('Outreach workflow triggered successfully!', { id: toastId })
      localStorage.setItem('leadgen_last_outreach_trigger', new Date().toISOString())
      fetchStats()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to trigger Outreach workflow'
      toast.error(message, { id: toastId })
    } finally {
      setTriggeringOutreach(false)
    }
  }

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  // Status mapping to match specifications
  const statusCards = [
    { key: 'new', label: 'New', color: 'border-[#ECEAE4] bg-white text-gray-800' },
    { key: 'whatsapp_sent', label: 'WhatsApp Sent', color: 'border-[#ECEAE4] bg-white text-gray-800' },
    { key: 'email_sent', label: 'Email Sent', color: 'border-[#ECEAE4] bg-white text-gray-800' },
    { key: 'replied', label: 'Replied', color: 'border-[#ECEAE4] bg-white text-gray-800' },
    { key: 'converted', label: 'Converted', color: 'border-[#ECEAE4] bg-white text-gray-800 font-bold' },
    { key: 'skip', label: 'Skipped', color: 'border-[#ECEAE4] bg-white text-gray-400' },
  ]

  return (
    <div className="space-y-8 select-none text-[#2D2D2D]">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-[#1C1C1E] tracking-tight">Dashboard Overview</h1>
          <p className="mt-1 text-sm text-gray-500 font-medium">{today}</p>
        </div>
        <div className="flex items-center gap-2 bg-white border border-[#E4E3DD] rounded-xl px-4 py-2.5 text-xs text-gray-500 font-semibold shadow-sm self-start md:self-auto">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#E3B859] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#E3B859]"></span>
          </span>
          Live Monitoring (15s refresh)
        </div>
      </div>

      {/* Main Stats Row & Conversion Widget (Stratnent Pastel Aesthetic) */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Leads */}
        <div className="rounded-2xl bg-[#D4E0CD] p-6 flex flex-col justify-between shadow-[0_4px_20px_-4px_rgba(0,0,0,0.02)] min-h-[140px]">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-[#3B4D3C] uppercase tracking-wider">Total Leads</span>
            <span className="text-[10px] bg-[#3B4D3C]/10 text-[#3B4D3C] px-2 py-0.5 rounded-full font-bold">ALL</span>
          </div>
          <h3 className="mt-4 text-4xl font-black text-[#2E3A2F] tracking-tight">
            {loadingStats ? '...' : (stats?.total ?? 0).toLocaleString()}
          </h3>
        </div>

        {/* Added (7d) */}
        <div className="rounded-2xl bg-[#F9D99A] p-6 flex flex-col justify-between shadow-[0_4px_20px_-4px_rgba(0,0,0,0.02)] min-h-[140px]">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-[#5C451F] uppercase tracking-wider">Added (7d)</span>
            <span className="text-[10px] bg-[#5C451F]/10 text-[#5C451F] px-2 py-0.5 rounded-full font-bold">+100%</span>
          </div>
          <h3 className="mt-4 text-4xl font-black text-[#4A391D] tracking-tight">
            {loadingStats ? '...' : (stats?.addedLast7Days ?? 0).toLocaleString()}
          </h3>
        </div>

        {/* Outreach Rate */}
        <div className="rounded-2xl bg-gradient-to-br from-[#9FB1F7] to-[#7E96F5] p-6 flex flex-col justify-between shadow-[0_4px_20px_-4px_rgba(0,0,0,0.02)] min-h-[140px] text-white">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold uppercase tracking-wider opacity-90">Outreach Rate</span>
            <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-bold">Ratio</span>
          </div>
          <div>
            <h3 className="mt-4 text-4xl font-black tracking-tight">
              {loadingStats ? '...' : `${stats?.conversionStats?.rate ?? 0}%`}
            </h3>
            <span className="text-[9px] opacity-80 block mt-1">
              {stats?.conversionStats?.replied ?? 0} replied | {stats?.conversionStats?.converted ?? 0} converted
            </span>
          </div>
        </div>

        {/* Active Channels */}
        <div className="rounded-2xl bg-white border border-[#E4E3DD] p-6 flex flex-col justify-between shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] min-h-[140px]">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Active Channels</span>
            <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
          </div>
          <div className="flex flex-wrap gap-1.5 mt-4">
            <span className="px-2.5 py-1 bg-green-50 text-green-700 border border-green-200/50 rounded-lg text-[9px] font-bold">WhatsApp</span>
            <span className="px-2.5 py-1 bg-purple-50 text-purple-700 border border-purple-200/50 rounded-lg text-[9px] font-bold">Emails</span>
            <span className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200/50 rounded-lg text-[9px] font-bold">n8n</span>
          </div>
        </div>
      </div>

      {/* Visual Analytics Row: Growth & Providers */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Leads Growth Chart (Daily distribution) */}
        <div className="rounded-2xl bg-white border border-[#E4E3DD] p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)]">
          <h3 className="font-bold text-[#1C1C1E] mb-4 flex justify-between items-center text-sm">
            <span className="uppercase tracking-wider text-[11px] text-gray-500">Lead growth timeline</span>
            <span className="text-[10px] text-gray-400 font-normal">Last 7 Days</span>
          </h3>
          <div className="flex items-end justify-between h-40 pt-4 px-2">
            {loadingStats ? (
              <div className="w-full text-center text-xs text-gray-400 py-10">Loading growth chart...</div>
            ) : !stats?.dailyDistribution || stats.dailyDistribution.length === 0 ? (
              <div className="w-full text-center text-xs text-gray-400 py-10">No recent leads activity</div>
            ) : (
              stats.dailyDistribution.map((day) => {
                const max = Math.max(...stats.dailyDistribution.map(d => d.count), 1)
                const pct = (day.count / max) * 100
                return (
                  <div key={day.date} className="flex flex-col items-center gap-2 flex-1 group">
                    <span className="text-[9px] font-bold text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity duration-200">{day.count}</span>
                    <div className="w-6 sm:w-8 bg-[#ECEAE4] group-hover:bg-[#1C1C1E] rounded-xl transition-all duration-300 relative overflow-hidden" style={{ height: `${Math.max(10, pct)}px` }}>
                      <div className="absolute inset-0 bg-[#1C1C1E] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    </div>
                    <span className="text-[9px] text-gray-400 font-semibold uppercase">{day.date}</span>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Provider Distribution Card */}
        <div className="rounded-2xl bg-white border border-[#E4E3DD] p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)]">
          <h3 className="font-bold text-[#1C1C1E] mb-6 text-sm uppercase tracking-wider text-[11px] text-gray-500">Leads by Provider Channel</h3>
          <div className="space-y-5">
            {loadingStats ? (
              <div className="text-center text-xs text-gray-400 py-10">Loading channels...</div>
            ) : !stats?.providerComparison || stats.providerComparison.length === 0 ? (
              <div className="text-center text-xs text-gray-400 py-10">No channel data available</div>
            ) : (
              stats.providerComparison.map((p) => {
                const max = stats.total || 1
                const pct = Math.round((p.count / max) * 100)
                return (
                  <div key={p.source} className="space-y-2">
                    <div className="flex justify-between text-xs font-bold text-gray-700">
                      <span className="capitalize">{p.source.replace(/_/g, ' ')}</span>
                      <span>{p.count} leads ({pct}%)</span>
                    </div>
                    <div className="w-full bg-[#F4F3EF] rounded-full h-2.5 p-0.5">
                      <div className="bg-[#1C1C1E] h-1.5 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* Status Pipeline Cards */}
      <div>
        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Pipeline Distribution</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {statusCards.map((card) => {
            const count = stats?.statusCounts[card.key] ?? 0
            return (
              <div key={card.key} className={`rounded-2xl border border-[#E4E3DD] p-5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)] transition-all duration-200 ${card.color}`}>
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{card.label}</span>
                <p className="mt-3 text-3xl font-black text-[#1C1C1E] tracking-tight">{loadingStats ? '...' : count}</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Cities and Categories Tables */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl bg-white border border-[#E4E3DD] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="border-b border-[#E4E3DD] px-6 py-4 bg-gray-50/50">
            <h3 className="font-bold text-[#1C1C1E] text-xs uppercase tracking-wider text-gray-500">Top Cities</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b border-[#E4E3DD] text-left text-gray-400 uppercase tracking-wider">
                  <th className="px-6 py-4 font-bold">City</th>
                  <th className="px-6 py-4 font-bold text-right">Count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E3DD]/60">
                {loadingStats ? (
                  <tr>
                    <td colSpan={2} className="px-6 py-5 text-center text-gray-400">Loading data...</td>
                  </tr>
                ) : !stats?.topCities || stats.topCities.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="px-6 py-5 text-center text-gray-400">No data found</td>
                  </tr>
                ) : (
                  stats.topCities.map((row) => (
                    <tr key={row.name} className="hover:bg-[#F4F3EF]/30 transition-colors">
                      <td className="px-6 py-4 text-gray-800 font-semibold">{row.name}</td>
                      <td className="px-6 py-4 text-gray-600 text-right font-mono font-bold">{row.count}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-[#E4E3DD] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="border-b border-[#E4E3DD] px-6 py-4 bg-gray-50/50">
            <h3 className="font-bold text-[#1C1C1E] text-xs uppercase tracking-wider text-gray-500">Top Categories</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b border-[#E4E3DD] text-left text-gray-400 uppercase tracking-wider">
                  <th className="px-6 py-4 font-bold">Category</th>
                  <th className="px-6 py-4 font-bold text-right">Count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E3DD]/60">
                {loadingStats ? (
                  <tr>
                    <td colSpan={2} className="px-6 py-5 text-center text-gray-400">Loading data...</td>
                  </tr>
                ) : !stats?.topCategories || stats.topCategories.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="px-6 py-5 text-center text-gray-400">No data found</td>
                  </tr>
                ) : (
                  stats.topCategories.map((row) => (
                    <tr key={row.name} className="hover:bg-[#F4F3EF]/30 transition-colors">
                      <td className="px-6 py-4 text-gray-800 font-semibold">{row.name}</td>
                      <td className="px-6 py-4 text-gray-600 text-right font-mono font-bold">{row.count}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Recent Leads */}
      <div>
        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Recent Leads</h2>
        {loadingLeads ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-6">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-36 animate-pulse rounded-2xl bg-white border border-[#E4E3DD]" />
            ))}
          </div>
        ) : recentLeads.length === 0 ? (
          <div className="text-center py-10 rounded-2xl border border-[#E4E3DD] bg-white text-gray-400 text-xs font-semibold">
            No leads in database yet.
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-6">
            {recentLeads.map((lead) => (
              <div key={lead.id} className="rounded-2xl border border-[#E4E3DD] bg-white p-5 flex flex-col justify-between hover:border-gray-400 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)] hover:scale-[1.01] transition-all duration-200">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-bold text-gray-800 text-sm line-clamp-1" title={lead.name}>{lead.name}</h4>
                    <StatusBadge status={lead.status} />
                  </div>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-2">{lead.category || 'No Category'}</p>
                  <p className="text-xs text-gray-400 font-medium mt-0.5">{lead.city || 'No City'}</p>
                </div>
                <div className="mt-5 pt-3 border-t border-gray-100 text-[10px] text-gray-400 flex items-center justify-between font-medium">
                  <span className="capitalize">{lead.source.replace(/_/g, ' ')}</span>
                  <span>
                    {lead.created_at ? (() => {
                      try {
                        const d = new Date(lead.created_at);
                        return isNaN(d.getTime()) ? '—' : formatDistanceToNow(d, { addSuffix: true });
                      } catch {
                        return '—';
                      }
                    })() : '—'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions Row */}
      <div>
        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Quick Controls</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link
            href="/scraper"
            className="flex items-center justify-center gap-2 rounded-2xl border border-[#E4E3DD] bg-white hover:bg-gray-50 text-xs font-bold uppercase tracking-wider text-gray-700 py-4.5 shadow-sm transition-all duration-150"
          >
            🗺️ Run Scraper
          </Link>
          <button
            onClick={triggerAiWorkflow}
            disabled={triggeringAi}
            className="flex items-center justify-center gap-2 rounded-2xl border border-[#E4E3DD] bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold uppercase tracking-wider text-gray-700 py-4.5 shadow-sm transition-all duration-150"
          >
            {triggeringAi ? (
              <span className="w-4 h-4 border-2 border-gray-700 border-t-transparent rounded-full animate-spin" />
            ) : (
              '🤖'
            )}
            Run AI Personalise
          </button>
          <button
            onClick={triggerOutreachWorkflow}
            disabled={triggeringOutreach}
            className="flex items-center justify-center gap-2 rounded-2xl border border-[#E4E3DD] bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold uppercase tracking-wider text-gray-700 py-4.5 shadow-sm transition-all duration-150"
          >
            {triggeringOutreach ? (
              <span className="w-4 h-4 border-2 border-gray-700 border-t-transparent rounded-full animate-spin" />
            ) : (
              '📤'
            )}
            Send Outreach
          </button>
          <Link
            href="/leads"
            className="flex items-center justify-center gap-2 rounded-2xl bg-[#1C1C1E] hover:bg-[#252528] text-xs font-bold uppercase tracking-wider text-white py-4.5 shadow-md shadow-gray-950/10 transition-all duration-150"
          >
            📋 View All Leads
          </Link>
        </div>
      </div>
    </div>
  )
}
