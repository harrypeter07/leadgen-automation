// dashboard/src/app/dashboard/page.tsx
'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { formatDistanceToNow } from 'date-fns'
import { supabaseBrowser } from '@/lib/supabase'
import type { Lead } from '@/types/lead'
import StatusBadge from '../leads/components/StatusBadge'
import { 
  Users, 
  TrendingUp, 
  Radio, 
  Search, 
  Brain, 
  Send, 
  ListFilter, 
  ArrowUpRight,
  ShieldCheck,
  Zap,
  BarChart3
} from 'lucide-react'

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
    { key: 'new', label: 'New', color: 'border-blue-500/20 bg-blue-950/20 text-blue-300' },
    { key: 'whatsapp_sent', label: 'WhatsApp Sent', color: 'border-emerald-500/20 bg-emerald-950/20 text-emerald-300' },
    { key: 'email_sent', label: 'Email Sent', color: 'border-purple-500/20 bg-purple-950/20 text-purple-300' },
    { key: 'replied', label: 'Replied', color: 'border-amber-500/20 bg-amber-950/20 text-amber-300' },
    { key: 'converted', label: 'Converted', color: 'border-blue-400/40 bg-blue-600/20 text-blue-200 font-bold' },
    { key: 'skip', label: 'Skipped', color: 'border-zinc-800 bg-zinc-900/40 text-zinc-400' },
  ]

  return (
    <div className="p-4 sm:p-8 space-y-8 select-none text-foreground max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-blue-500/15 pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
            Dashboard Overview
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30 font-mono font-normal">
              PRO
            </span>
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-zinc-400 font-medium">{today}</p>
        </div>
        <div className="flex items-center gap-2.5 glass px-4 py-2 rounded-xl text-xs text-blue-300 font-mono border border-blue-500/25 shadow-sm self-start md:self-auto">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
          </span>
          Live Monitoring (15s polling)
        </div>
      </div>

      {/* Main Stats Row & Conversion Widget (Blue Glow Aesthetic) */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Leads */}
        <div className="rounded-2xl glass glow-border p-6 flex flex-col justify-between shadow-xl min-h-[140px] relative overflow-hidden group">
          <div className="absolute top-0 right-0 h-24 w-24 bg-blue-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-blue-500/20 transition-all" />
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-4 h-4 text-blue-400" /> Total Leads
            </span>
            <span className="text-[10px] bg-blue-500/15 border border-blue-500/30 text-blue-300 px-2 py-0.5 rounded-md font-mono font-bold">ALL</span>
          </div>
          <h3 className="mt-4 text-4xl font-black text-white tracking-tight font-mono">
            {loadingStats ? '...' : (stats?.total ?? 0).toLocaleString()}
          </h3>
        </div>

        {/* Added (7d) */}
        <div className="rounded-2xl glass glow-border p-6 flex flex-col justify-between shadow-xl min-h-[140px] relative overflow-hidden group">
          <div className="absolute top-0 right-0 h-24 w-24 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-emerald-500/20 transition-all" />
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-emerald-400" /> Added (7d)
            </span>
            <span className="text-[10px] bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 px-2 py-0.5 rounded-md font-mono font-bold">+100%</span>
          </div>
          <h3 className="mt-4 text-4xl font-black text-emerald-400 tracking-tight font-mono">
            {loadingStats ? '...' : (stats?.addedLast7Days ?? 0).toLocaleString()}
          </h3>
        </div>

        {/* Outreach Rate */}
        <div className="rounded-2xl glass glow-border p-6 flex flex-col justify-between shadow-xl min-h-[140px] relative overflow-hidden group">
          <div className="absolute top-0 right-0 h-24 w-24 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-indigo-500/20 transition-all" />
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-indigo-400" /> Outreach Rate
            </span>
            <span className="text-[10px] bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 px-2 py-0.5 rounded-md font-mono font-bold">RATIO</span>
          </div>
          <div>
            <h3 className="mt-4 text-4xl font-black text-indigo-300 tracking-tight font-mono">
              {loadingStats ? '...' : `${stats?.conversionStats?.rate ?? 0}%`}
            </h3>
            <span className="text-[10px] text-zinc-400 block mt-1 font-mono">
              {stats?.conversionStats?.replied ?? 0} replied | {stats?.conversionStats?.converted ?? 0} converted
            </span>
          </div>
        </div>

        {/* Active Channels */}
        <div className="rounded-2xl glass glow-border p-6 flex flex-col justify-between shadow-xl min-h-[140px]">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <Radio className="w-4 h-4 text-blue-400" /> Channels
            </span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <div className="flex flex-wrap gap-1.5 mt-4">
            <span className="px-2.5 py-1 bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 rounded-lg text-[10px] font-mono font-bold">WhatsApp</span>
            <span className="px-2.5 py-1 bg-purple-500/15 text-purple-300 border border-purple-500/30 rounded-lg text-[10px] font-mono font-bold">Emails</span>
            <span className="px-2.5 py-1 bg-blue-500/15 text-blue-300 border border-blue-500/30 rounded-lg text-[10px] font-mono font-bold">n8n AI</span>
          </div>
        </div>
      </div>

      {/* Visual Analytics Row: Growth & Providers */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Leads Growth Chart (Daily distribution) */}
        <div className="rounded-2xl glass glow-border p-6 shadow-xl">
          <h3 className="font-bold text-white mb-4 flex justify-between items-center text-sm">
            <span className="uppercase tracking-wider text-[11px] text-zinc-400 flex items-center gap-1.5">
              <BarChart3 className="w-4 h-4 text-blue-400" /> Lead Growth Timeline
            </span>
            <span className="text-[10px] text-blue-300 font-mono">Last 7 Days</span>
          </h3>
          <div className="flex items-end justify-between h-40 pt-4 px-2">
            {loadingStats ? (
              <div className="w-full text-center text-xs text-zinc-500 py-10">Loading growth chart...</div>
            ) : !stats?.dailyDistribution || stats.dailyDistribution.length === 0 ? (
              <div className="w-full text-center text-xs text-zinc-500 py-10">No recent leads activity</div>
            ) : (
              stats.dailyDistribution.map((day) => {
                const max = Math.max(...stats.dailyDistribution.map(d => d.count), 1)
                const pct = (day.count / max) * 100
                return (
                  <div key={day.date} className="flex flex-col items-center gap-2 flex-1 group">
                    <span className="text-[9px] font-mono text-blue-300 opacity-0 group-hover:opacity-100 transition-opacity duration-200">{day.count}</span>
                    <div className="w-6 sm:w-8 bg-blue-950/40 group-hover:bg-blue-600 rounded-xl transition-all duration-300 relative overflow-hidden border border-blue-500/20" style={{ height: `${Math.max(12, pct)}px` }}>
                      <div className="absolute inset-0 bg-gradient-to-t from-blue-600 to-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    </div>
                    <span className="text-[9px] text-zinc-400 font-mono uppercase">{day.date}</span>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Provider Distribution Card */}
        <div className="rounded-2xl glass glow-border p-6 shadow-xl">
          <h3 className="font-bold text-white mb-6 text-sm uppercase tracking-wider text-[11px] text-zinc-400 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-blue-400" /> Leads by Provider Channel
          </h3>
          <div className="space-y-5">
            {loadingStats ? (
              <div className="text-center text-xs text-zinc-500 py-10">Loading channels...</div>
            ) : !stats?.providerComparison || stats.providerComparison.length === 0 ? (
              <div className="text-center text-xs text-zinc-500 py-10">No channel data available</div>
            ) : (
              stats.providerComparison.map((p) => {
                const max = stats.total || 1
                const pct = Math.round((p.count / max) * 100)
                return (
                  <div key={p.source} className="space-y-2">
                    <div className="flex justify-between text-xs font-semibold text-zinc-300">
                      <span className="capitalize">{p.source.replace(/_/g, ' ')}</span>
                      <span className="font-mono text-blue-400">{p.count} leads ({pct}%)</span>
                    </div>
                    <div className="w-full bg-blue-950/40 rounded-full h-2.5 p-0.5 border border-blue-500/20">
                      <div className="bg-gradient-to-r from-blue-500 to-indigo-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
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
        <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
          <ListFilter className="w-4 h-4 text-blue-400" /> Pipeline Distribution
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {statusCards.map((card) => {
            const count = stats?.statusCounts[card.key] ?? 0
            return (
              <div key={card.key} className={`rounded-2xl border p-4 shadow-md transition-all duration-200 ${card.color}`}>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider opacity-80">{card.label}</span>
                <p className="mt-2 text-2xl font-black tracking-tight font-mono">{loadingStats ? '...' : count}</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Cities and Categories Tables */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl glass glow-border shadow-xl overflow-hidden">
          <div className="border-b border-blue-500/15 px-6 py-4 bg-blue-950/20">
            <h3 className="font-bold text-white text-xs uppercase tracking-wider text-zinc-400">Top Cities</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b border-blue-500/15 text-left text-zinc-400 uppercase font-mono tracking-wider">
                  <th className="px-6 py-3.5 font-semibold">City</th>
                  <th className="px-6 py-3.5 font-semibold text-right">Count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-500/10">
                {loadingStats ? (
                  <tr>
                    <td colSpan={2} className="px-6 py-5 text-center text-zinc-500">Loading data...</td>
                  </tr>
                ) : !stats?.topCities || stats.topCities.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="px-6 py-5 text-center text-zinc-500">No data found</td>
                  </tr>
                ) : (
                  stats.topCities.map((row) => (
                    <tr key={row.name} className="hover:bg-blue-500/10 transition-colors">
                      <td className="px-6 py-3.5 text-zinc-200 font-medium">{row.name}</td>
                      <td className="px-6 py-3.5 text-blue-400 text-right font-mono font-bold">{row.count}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl glass glow-border shadow-xl overflow-hidden">
          <div className="border-b border-blue-500/15 px-6 py-4 bg-blue-950/20">
            <h3 className="font-bold text-white text-xs uppercase tracking-wider text-zinc-400">Top Categories</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b border-blue-500/15 text-left text-zinc-400 uppercase font-mono tracking-wider">
                  <th className="px-6 py-3.5 font-semibold">Category</th>
                  <th className="px-6 py-3.5 font-semibold text-right">Count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-500/10">
                {loadingStats ? (
                  <tr>
                    <td colSpan={2} className="px-6 py-5 text-center text-zinc-500">Loading data...</td>
                  </tr>
                ) : !stats?.topCategories || stats.topCategories.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="px-6 py-5 text-center text-zinc-500">No data found</td>
                  </tr>
                ) : (
                  stats.topCategories.map((row) => (
                    <tr key={row.name} className="hover:bg-blue-500/10 transition-colors">
                      <td className="px-6 py-3.5 text-zinc-200 font-medium">{row.name}</td>
                      <td className="px-6 py-3.5 text-blue-400 text-right font-mono font-bold">{row.count}</td>
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
        <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4">Recent Leads</h2>
        {loadingLeads ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-6">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-36 animate-pulse rounded-2xl glass glow-border" />
            ))}
          </div>
        ) : recentLeads.length === 0 ? (
          <div className="text-center py-10 rounded-2xl glass glow-border text-zinc-400 text-xs font-medium">
            No leads in database yet.
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-6">
            {recentLeads.map((lead) => (
              <div key={lead.id} className="rounded-2xl glass glow-border p-5 flex flex-col justify-between hover:border-blue-500/40 shadow-xl transition-all duration-200">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-bold text-zinc-100 text-sm line-clamp-1" title={lead.name}>{lead.name}</h4>
                    <StatusBadge status={lead.status} />
                  </div>
                  <p className="text-[10px] text-blue-300 font-mono font-bold uppercase tracking-wider mt-2">{lead.category || 'No Category'}</p>
                  <p className="text-xs text-zinc-400 font-medium mt-0.5">{lead.city || 'No City'}</p>
                </div>
                <div className="mt-5 pt-3 border-t border-white/5 text-[10px] text-zinc-400 flex items-center justify-between font-mono">
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
        <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4">Quick Controls</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link
            href="/scraper"
            className="flex items-center justify-center gap-2 rounded-2xl glass glow-border hover:bg-blue-600/20 text-xs font-bold uppercase tracking-wider text-blue-300 py-4 shadow-lg transition-all duration-150"
          >
            <Search className="w-4 h-4" /> Run Scraper
          </Link>
          <button
            onClick={triggerAiWorkflow}
            disabled={triggeringAi}
            className="flex items-center justify-center gap-2 rounded-2xl glass glow-border hover:bg-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold uppercase tracking-wider text-blue-300 py-4 shadow-lg transition-all duration-150"
          >
            {triggeringAi ? (
              <span className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Brain className="w-4 h-4" />
            )}
            Run AI Personalise
          </button>
          <button
            onClick={triggerOutreachWorkflow}
            disabled={triggeringOutreach}
            className="flex items-center justify-center gap-2 rounded-2xl glass glow-border hover:bg-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold uppercase tracking-wider text-blue-300 py-4 shadow-lg transition-all duration-150"
          >
            {triggeringOutreach ? (
              <span className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            Send Outreach
          </button>
          <Link
            href="/leads"
            className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-xs font-bold uppercase tracking-wider text-white py-4 shadow-lg shadow-blue-500/20 transition-all duration-150 border border-blue-400/30"
          >
            <Users className="w-4 h-4" /> View All Leads
            <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  )
}
