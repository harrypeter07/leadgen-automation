'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { formatDistanceToNow } from 'date-fns'
import { supabaseBrowser } from '@/lib/supabase'
import type { Lead } from '@/types/lead'
import { 
  Button, 
  Badge, 
  Card, 
  StatCard, 
  HeroCard, 
  GalleryCard, 
  Tabs, 
  SearchInput,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell
} from '@/components'
import { 
  Users, 
  TrendingUp, 
  Radio, 
  Search, 
  Brain, 
  Send, 
  BarChart3, 
  ArrowUpRight,
  ShieldCheck,
  Zap,
  ListFilter
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
  const [activeFilterTab, setActiveFilterTab] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

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

  async function fetchRecentLeads() {
    try {
      const { data, error } = await supabaseBrowser
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(6)

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
      fetchStats()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to trigger AI workflow'
      toast.error(message, { id: toastId })
    } finally {
      setTriggeringAi(false)
    }
  }

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
      fetchStats()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to trigger Outreach workflow'
      toast.error(message, { id: toastId })
    } finally {
      setTriggeringOutreach(false)
    }
  }

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })

  const filterTabs = [
    { id: 'all', label: 'All Leads', count: stats?.total ?? 0 },
    { id: 'new', label: 'New', count: stats?.statusCounts?.new ?? 0 },
    { id: 'sent', label: 'Outreached', count: (stats?.statusCounts?.email_sent ?? 0) + (stats?.statusCounts?.whatsapp_sent ?? 0) },
    { id: 'replied', label: 'Replied', count: stats?.statusCounts?.replied ?? 0 },
    { id: 'converted', label: 'Converted', count: stats?.statusCounts?.converted ?? 0 },
  ]

  const filteredLeads = recentLeads.filter(lead => {
    const matchesSearch = lead.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (lead.city && lead.city.toLowerCase().includes(searchQuery.toLowerCase())) ||
                          (lead.category && lead.category.toLowerCase().includes(searchQuery.toLowerCase()))
    
    if (!matchesSearch) return false
    if (activeFilterTab === 'all') return true
    if (activeFilterTab === 'new') return lead.status === 'new'
    if (activeFilterTab === 'sent') return lead.status === 'email_sent' || lead.status === 'whatsapp_sent'
    if (activeFilterTab === 'replied') return lead.status === 'replied'
    if (activeFilterTab === 'converted') return lead.status === 'converted'
    return true
  })

  return (
    <div className="space-y-10 max-w-7xl mx-auto">
      {/* Top Hero Section */}
      <HeroCard
        eyebrow="OVERVIEW"
        title="Marketing & Lead Generation Intelligence"
        description={`Real-time lead acquisition, AI persona enrichment, and social outreach performance. Active as of ${today}.`}
        variant="sage"
        action={
          <div className="flex items-center gap-3 flex-wrap">
            <Button
              variant="primary"
              onClick={triggerAiWorkflow}
              loading={triggeringAi}
              iconType="arrow-right"
            >
              Run AI Personalise
            </Button>
            <Button
              variant="secondary"
              onClick={triggerOutreachWorkflow}
              loading={triggeringOutreach}
              iconType="arrow-right"
            >
              Send Outreach
            </Button>
          </div>
        }
      />

      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          label="Total Leads"
          value={loadingStats ? '...' : (stats?.total ?? 0).toLocaleString()}
          variant="lavender"
          subtext="Total leads in database"
        />
        <StatCard
          label="Added (7 Days)"
          value={loadingStats ? '...' : `+${stats?.addedLast7Days ?? 0}`}
          variant="cream"
          subtext="New leads acquired this week"
        />
        <StatCard
          label="Outreach Conversion Rate"
          value={loadingStats ? '...' : `${stats?.conversionStats?.rate ?? 0}%`}
          variant="sage"
          subtext={`${stats?.conversionStats?.converted ?? 0} converted from ${stats?.conversionStats?.sent ?? 0} sent`}
        />
        <Card variant="ink" className="flex flex-col justify-between p-6">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-bold uppercase tracking-eyebrow text-lime">
              Active Engines
            </span>
            <span className="w-2.5 h-2.5 rounded-full bg-lime animate-pulse" />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge variant="lime">WhatsApp</Badge>
            <Badge variant="dark">Emails</Badge>
            <Badge variant="lime">n8n AI</Badge>
          </div>
        </Card>
      </div>

      {/* Tab Navigation & Search Bar */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <Tabs
            tabs={filterTabs}
            activeTab={activeFilterTab}
            onChange={setActiveFilterTab}
            variant="primary"
          />
          <div className="w-full sm:w-72">
            <SearchInput
              placeholder="Search leads by name, city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Gallery List Item Cards Grid */}
        {loadingLeads ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-40 rounded-lg bg-page-alt animate-pulse" />
            ))}
          </div>
        ) : filteredLeads.length === 0 ? (
          <Card variant="page-alt" className="p-10 text-center text-text-muted text-sm font-medium">
            No leads match the selected filter criteria.
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredLeads.map((lead) => (
              <GalleryCard
                key={lead.id}
                title={lead.name}
                avatar={lead.name.substring(0, 1).toUpperCase()}
                badge={
                  <Badge
                    variant={
                      lead.status === 'converted' ? 'lime' :
                      lead.status === 'replied' ? 'sage' :
                      lead.status === 'email_sent' || lead.status === 'whatsapp_sent' ? 'lavender' : 'muted'
                    }
                  >
                    {lead.status.replace(/_/g, ' ')}
                  </Badge>
                }
                description={lead.category ? `${lead.category} • ${lead.city || 'Location N/A'}` : (lead.city || 'Lead Record')}
                caption={lead.created_at ? `Acquired ${formatDistanceToNow(new Date(lead.created_at), { addSuffix: true })}` : 'Recent'}
              />
            ))}
          </div>
        )}
      </div>

      {/* Analytics Breakdown & Top Cities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Cities Card Table */}
        <Card variant="page-alt" className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-lg text-ink font-display">Top Cities</h3>
            <Badge variant="dark">GEOGRAPHY</Badge>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>City Name</TableHead>
                <TableHead className="text-right">Lead Count</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingStats ? (
                <TableRow>
                  <TableCell colSpan={2} className="text-center text-text-muted">Loading cities...</TableCell>
                </TableRow>
              ) : !stats?.topCities || stats.topCities.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={2} className="text-center text-text-muted">No city data available</TableCell>
                </TableRow>
              ) : (
                stats.topCities.slice(0, 5).map((row) => (
                  <TableRow key={row.name}>
                    <TableCell className="font-semibold">{row.name}</TableCell>
                    <TableCell className="text-right font-mono font-bold">{row.count}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>

        {/* Top Categories Card Table */}
        <Card variant="page-alt" className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-lg text-ink font-display">Top Business Categories</h3>
            <Badge variant="lime">INDUSTRY</Badge>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Lead Count</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingStats ? (
                <TableRow>
                  <TableCell colSpan={2} className="text-center text-text-muted">Loading categories...</TableCell>
                </TableRow>
              ) : !stats?.topCategories || stats.topCategories.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={2} className="text-center text-text-muted">No category data available</TableCell>
                </TableRow>
              ) : (
                stats.topCategories.slice(0, 5).map((row) => (
                  <TableRow key={row.name}>
                    <TableCell className="font-semibold">{row.name}</TableCell>
                    <TableCell className="text-right font-mono font-bold">{row.count}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  )
}
