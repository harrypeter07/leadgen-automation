'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { formatDistanceToNow } from 'date-fns'
import { supabaseBrowser } from '@/lib/supabase'
import type { Lead } from '@/types/lead'
import StatusBadge from './leads/components/StatusBadge'

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
    }, 15000) // auto-refresh every 15 seconds

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
    { key: 'new', label: 'New', color: 'border-slate-800 bg-slate-900/30 text-slate-400' },
    { key: 'whatsapp_sent', label: 'WhatsApp Sent', color: 'border-blue-900/40 bg-blue-950/20 text-blue-400' },
    { key: 'email_sent', label: 'Email Sent', color: 'border-violet-900/40 bg-violet-950/20 text-violet-400' },
    { key: 'replied', label: 'Replied', color: 'border-amber-900/40 bg-amber-950/20 text-amber-400' },
    { key: 'converted', label: 'Converted', color: 'border-green-900/40 bg-green-950/20 text-green-400' },
    { key: 'skip', label: 'Skipped', color: 'border-red-900/40 bg-red-950/20 text-red-400' },
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Lead Gen Dashboard</h1>
          <p className="mt-1 text-sm text-gray-400">{today}</p>
        </div>
        <div className="flex items-center gap-2 bg-gray-900 border border-gray-800 rounded-lg px-4 py-2 text-xs text-gray-400 self-start md:self-auto">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
          </span>
          Live Monitoring (15s auto-refresh)
        </div>
      </div>

      {/* Main Stats Row & Conversion Widget */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6 flex flex-col justify-between">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Leads</span>
          <h3 className="mt-2 text-3xl font-black text-white">{loadingStats ? '...' : stats?.total ?? 0}</h3>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6 flex flex-col justify-between">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Added Last 7 Days</span>
          <h3 className="mt-2 text-3xl font-black text-purple-400">{loadingStats ? '...' : stats?.addedLast7Days ?? 0}</h3>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6 flex flex-col justify-between">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Outreach Conversion</span>
          <div>
            <h3 className="mt-2 text-3xl font-black text-green-400">
              {loadingStats ? '...' : `${stats?.conversionStats?.rate ?? 0}%`}
            </h3>
            <span className="text-[10px] text-gray-400 block mt-1">
              Positive response ratio: {stats?.conversionStats?.replied ?? 0} replied, {stats?.conversionStats?.converted ?? 0} converted
            </span>
          </div>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6 flex flex-col justify-between">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Active Channels</span>
          <div className="flex gap-2 mt-2">
            <span className="px-2 py-1 bg-green-950 text-green-400 border border-green-900 rounded text-[10px] font-bold">WhatsApp</span>
            <span className="px-2 py-1 bg-purple-950 text-purple-400 border border-purple-900 rounded text-[10px] font-bold">Emails</span>
            <span className="px-2 py-1 bg-blue-950 text-blue-400 border border-blue-900 rounded text-[10px] font-bold">n8n triggers</span>
          </div>
        </div>
      </div>

      {/* Visual Analytics Row: Growth & Providers */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Leads Growth Chart (Daily distribution) */}
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
          <h3 className="font-bold text-gray-200 mb-4 flex justify-between items-center text-sm">
            <span>📈 Lead Growth Timeline</span>
            <span className="text-[10px] text-gray-500">Last 7 Days</span>
          </h3>
          <div className="flex items-end justify-between h-32 pt-4">
            {loadingStats ? (
              <div className="w-full text-center text-xs text-gray-500">Loading growth chart...</div>
            ) : !stats?.dailyDistribution || stats.dailyDistribution.length === 0 ? (
              <div className="w-full text-center text-xs text-gray-500">No recent leads activity</div>
            ) : (
              stats.dailyDistribution.map((day) => {
                const max = Math.max(...stats.dailyDistribution.map(d => d.count), 1)
                const pct = (day.count / max) * 100
                return (
                  <div key={day.date} className="flex flex-col items-center gap-1.5 flex-1 group">
                    <span className="text-[9px] text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity duration-200">{day.count}</span>
                    <div className="w-6 sm:w-8 bg-purple-950/60 border border-purple-900/30 group-hover:bg-purple-600 rounded-t transition-all duration-300" style={{ height: `${Math.max(10, pct)}%` }} />
                    <span className="text-[9px] text-gray-400 font-semibold">{day.date}</span>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Provider Distribution Card */}
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
          <h3 className="font-bold text-gray-200 mb-4 text-sm">🌐 Leads by Provider Channel</h3>
          <div className="space-y-4">
            {loadingStats ? (
              <div className="text-center text-xs text-gray-500 py-6">Loading channels...</div>
            ) : !stats?.providerComparison || stats.providerComparison.length === 0 ? (
              <div className="text-center text-xs text-gray-500 py-6">No channel data available</div>
            ) : (
              stats.providerComparison.map((p) => {
                const max = stats.total || 1
                const pct = Math.round((p.count / max) * 100)
                return (
                  <div key={p.source} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold text-gray-300">
                      <span className="capitalize">{p.source.replace(/_/g, ' ')}</span>
                      <span>{p.count} leads ({pct}%)</span>
                    </div>
                    <div className="w-full bg-gray-950 rounded-full h-2 border border-gray-850 p-0.5">
                      <div className="bg-purple-600 h-1 rounded-full" style={{ width: `${pct}%` }} />
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
        <h2 className="text-lg font-bold text-gray-200 mb-4">Pipeline Distribution</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {statusCards.map((card) => {
            const count = stats?.statusCounts[card.key] ?? 0
            return (
              <div key={card.key} className={`rounded-xl border p-4 transition-all duration-200 ${card.color}`}>
                <span className="text-xs font-medium">{card.label}</span>
                <p className="mt-2 text-2xl font-black text-white">{loadingStats ? '...' : count}</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Cities and Categories Tables */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-800 bg-gray-900/40 overflow-hidden">
          <div className="border-b border-gray-800 px-5 py-4 bg-gray-900/60">
            <h3 className="font-bold text-gray-200">Top Cities</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-left text-gray-400">
                  <th className="px-5 py-3 font-semibold">City</th>
                  <th className="px-5 py-3 font-semibold text-right">Count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/40">
                {loadingStats ? (
                  <tr>
                    <td colSpan={2} className="px-5 py-4 text-center text-gray-500">Loading data...</td>
                  </tr>
                ) : !stats?.topCities || stats.topCities.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="px-5 py-4 text-center text-gray-500">No data found</td>
                  </tr>
                ) : (
                  stats.topCities.map((row) => (
                    <tr key={row.name} className="hover:bg-gray-800/20">
                      <td className="px-5 py-3 text-white font-medium">{row.name}</td>
                      <td className="px-5 py-3 text-gray-300 text-right">{row.count}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-gray-800 bg-gray-900/40 overflow-hidden">
          <div className="border-b border-gray-800 px-5 py-4 bg-gray-900/60">
            <h3 className="font-bold text-gray-200">Top Categories</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-left text-gray-400">
                  <th className="px-5 py-3 font-semibold">Category</th>
                  <th className="px-5 py-3 font-semibold text-right">Count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/40">
                {loadingStats ? (
                  <tr>
                    <td colSpan={2} className="px-5 py-4 text-center text-gray-500">Loading data...</td>
                  </tr>
                ) : !stats?.topCategories || stats.topCategories.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="px-5 py-4 text-center text-gray-500">No data found</td>
                  </tr>
                ) : (
                  stats.topCategories.map((row) => (
                    <tr key={row.name} className="hover:bg-gray-800/20">
                      <td className="px-5 py-3 text-white font-medium">{row.name}</td>
                      <td className="px-5 py-3 text-gray-300 text-right">{row.count}</td>
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
        <h2 className="text-lg font-bold text-gray-200 mb-4">Recent Leads</h2>
        {loadingLeads ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-32 animate-pulse rounded-xl bg-gray-900 border border-gray-800" />
            ))}
          </div>
        ) : recentLeads.length === 0 ? (
          <div className="text-center py-8 rounded-xl border border-gray-800 bg-gray-900/20 text-gray-500 text-sm">
            No leads in database yet.
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4">
            {recentLeads.map((lead) => (
              <div key={lead.id} className="rounded-xl border border-gray-800 bg-gray-900/30 p-5 flex flex-col justify-between hover:border-gray-700 transition-all duration-200">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-bold text-white text-sm line-clamp-1" title={lead.name}>{lead.name}</h4>
                    <StatusBadge status={lead.status} />
                  </div>
                  <p className="text-xs text-gray-400 mt-2">{lead.category || 'No Category'}</p>
                  <p className="text-xs text-gray-500 mt-1">{lead.city || 'No City'}</p>
                </div>
                <div className="mt-4 pt-3 border-t border-gray-800/60 text-[10px] text-gray-500 flex items-center justify-between">
                  <span>{lead.source}</span>
                  <span>{formatDistanceToNow(new Date(lead.created_at), { addSuffix: true })}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions Row */}
      <div>
        <h2 className="text-lg font-bold text-gray-200 mb-4">Quick Controls</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link
            href="/scraper"
            className="flex items-center justify-center gap-2 rounded-xl border border-gray-800 bg-gray-900 hover:bg-gray-800/80 hover:border-gray-700 text-sm font-semibold text-white py-4 transition-all duration-150"
          >
            🗺️ Run Scraper
          </Link>
          <button
            onClick={triggerAiWorkflow}
            disabled={triggeringAi}
            className="flex items-center justify-center gap-2 rounded-xl border border-gray-800 bg-gray-900 hover:bg-gray-800/80 hover:border-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold text-white py-4 transition-all duration-150"
          >
            {triggeringAi ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              '🤖'
            )}
            Run AI Personalise
          </button>
          <button
            onClick={triggerOutreachWorkflow}
            disabled={triggeringOutreach}
            className="flex items-center justify-center gap-2 rounded-xl border border-gray-800 bg-gray-900 hover:bg-gray-800/80 hover:border-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold text-white py-4 transition-all duration-150"
          >
            {triggeringOutreach ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              '📤'
            )}
            Send Outreach
          </button>
          <Link
            href="/leads"
            className="flex items-center justify-center gap-2 rounded-xl border border-purple-900/60 bg-purple-950/20 hover:bg-purple-900/30 text-sm font-semibold text-purple-300 py-4 transition-all duration-150"
          >
            📋 View All Leads
          </Link>
        </div>
      </div>
    </div>
  )
}
