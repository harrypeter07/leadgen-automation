'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import toast from 'react-hot-toast'
import { calculateInstagramStats, InstagramPost, InstagramProfile } from '@/utils/instagramStats'
import { 
  Button, 
  Badge, 
  Card, 
  StatCard, 
  HeroCard, 
  SearchInput, 
  Tabs 
} from '@/components'
import { Camera, Terminal, Shield, Sparkles, ExternalLink } from 'lucide-react'

interface BioLink {
  text: string
  href: string
}

interface InstagramReport extends InstagramProfile {
  bio_links: BioLink[]
  posts: InstagramPost[]
  reels: InstagramPost[]
}

interface LogEntry {
  timestamp: string
  level: string
  message: string
}

export default function InstagramAnalyzerPage() {
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<InstagramReport | null>(null)
  const [logs, setLogs] = useState<string[]>([])

  const [timeframe, setTimeframe] = useState<'all' | '1m' | '3m' | '6m' | '1y'>('all')
  const [scrapeHistory, setScrapeHistory] = useState(true)
  const [scrapeReels, setScrapeReels] = useState(true)

  const logEndRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs])

  const analytics = useMemo(() => {
    if (!report) return null
    return calculateInstagramStats(
      report,
      report.posts || [],
      report.reels || [],
      timeframe,
      scrapeHistory,
      scrapeReels
    )
  }, [report, timeframe, scrapeHistory, scrapeReels])

  async function handleAudit(e: React.FormEvent) {
    e.preventDefault()
    if (!username.trim()) return

    setLoading(true)
    setReport(null)
    setLogs(['[System] Initializing Instagram profile audit connection...'])
    const toastId = toast.loading('Running Instagram profile audit...')

    let pollCount = 0
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch('/api/instagram-logs')
        if (res.ok) {
          const data = await res.json()
          if (data.logs) {
            const igLogs = data.logs
              .filter((log: LogEntry) => log.message.includes('[Instagram Analyzer]'))
              .map((log: LogEntry) => {
                const time = new Date(log.timestamp).toLocaleTimeString()
                return `[${time}] ${log.message.replace('[Instagram Analyzer] ', '')}`
              })
            if (igLogs.length > 0) setLogs(igLogs)
          }
        }
      } catch (err) {
        console.error('Failed to poll logs:', err)
      }
      pollCount++
      if (pollCount > 45) clearInterval(pollInterval)
    }, 1000)

    try {
      const res = await fetch('/api/instagram-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim().replace(/^@/, ''),
          timeframe,
          scrapeHistory,
          scrapeReels
        })
      })

      const data = await res.json()
      clearInterval(pollInterval)

      if (res.status === 404 || data.error === 'profile_not_found') {
        toast.error('Instagram username does not exist.', { id: toastId })
        setLogs(prev => [...prev, `❌ Error: Profile @${username} does not exist.`])
        return
      }

      if (res.ok && data.report) {
        setReport(data.report)
        toast.success('Instagram audit completed!', { id: toastId })
      } else {
        throw new Error(data.error || 'Audit failed')
      }
    } catch (err: unknown) {
      clearInterval(pollInterval)
      const msg = err instanceof Error ? err.message : 'Error auditing profile'
      setLogs(prev => [...prev, `❌ Error: ${msg}`])
      toast.error(msg, { id: toastId })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-10 max-w-7xl mx-auto">
      {/* Hero Header */}
      <HeroCard
        eyebrow="INSTAGRAM ANALYZER"
        title="Social Media & Creator Profile Audit"
        description="Audit follower metrics, engagement ratios, reel frequency, and lead signals."
        variant="lavender"
      />

      {/* Audit Search Bar Card */}
      <Card variant="page-alt" className="p-8 space-y-6">
        <form onSubmit={handleAudit} className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <SearchInput
              placeholder="Enter Instagram username (e.g. abpnewstv, basantjoshiii)"
              value={username}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)}
              icon={<span className="font-bold text-ink">@</span>}
            />
          </div>
          <Button
            type="submit"
            loading={loading}
            variant="primary"
            size="default"
            iconType="arrow-right"
          >
            Run Audit
          </Button>
        </form>
      </Card>

      {/* Dark Ink Live Execution Log Terminal */}
      {(loading || logs.length > 0) && (
        <Card variant="ink" className="p-8 space-y-4">
          <div className="flex items-center justify-between border-b border-border-subtle/20 pb-4">
            <div className="flex items-center gap-2">
              <Terminal className="w-5 h-5 text-lime" />
              <h3 className="font-bold text-lg text-page font-display">Live Analysis Log</h3>
            </div>
            {loading && <Badge variant="lime">STREAMING</Badge>}
          </div>
          <div className="font-mono text-xs text-text-onDarkMuted space-y-1.5 max-h-48 overflow-y-auto">
            {logs.map((log, index) => (
              <p key={index} className="leading-relaxed">{log}</p>
            ))}
            <div ref={logEndRef} />
          </div>
        </Card>
      )}

      {/* Results Report Card */}
      {report && analytics && (
        <div className="space-y-8 animate-fade-in">
          {/* Stat Cards Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            <StatCard
              label="Followers"
              value={report.followers.toLocaleString()}
              variant="lavender"
            />
            <StatCard
              label="Following"
              value={report.following.toLocaleString()}
              variant="cream"
            />
            <StatCard
              label="Posts Count"
              value={report.posts_count.toLocaleString()}
              variant="sage"
            />
            <StatCard
              label="Engagement Rate"
              value={`${analytics.engagement_rate}%`}
              variant="lavender"
            />
          </div>

          {/* Profile Bio & Extracted Links */}
          <Card variant="page-alt" className="p-8 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-lime text-ink flex items-center justify-center font-bold text-lg">
                {report.username.substring(0, 2).toUpperCase()}
              </div>
              <div>
                <h3 className="font-bold text-xl text-ink font-display flex items-center gap-2">
                  @{report.username}
                  {report.verified && <Badge variant="lime">VERIFIED</Badge>}
                </h3>
                <p className="text-text-muted text-xs font-semibold">{report.display_name}</p>
              </div>
            </div>

            {report.bio && (
              <p className="text-sm text-text-body italic bg-page p-4 rounded-lg leading-relaxed">
                &quot;{report.bio}&quot;
              </p>
            )}

            {report.bio_links && report.bio_links.length > 0 && (
              <div className="pt-4 space-y-2">
                <span className="text-xs font-bold uppercase tracking-eyebrow text-text-muted">Bio Links</span>
                <div className="flex flex-wrap gap-2">
                  {report.bio_links.map((link, idx) => (
                    <a
                      key={idx}
                      href={link.href}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-page border border-border-subtle text-xs font-bold text-ink hover:bg-lime transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>{link.text || link.href}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}
