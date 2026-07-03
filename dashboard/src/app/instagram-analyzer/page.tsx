// dashboard/src/app/instagram-analyzer/page.tsx
'use client'

import React, { useState, useEffect, useRef } from 'react'
import toast from 'react-hot-toast'

interface InstagramPost {
  shortcode: string
  url: string
  thumbnail: string
  caption: string
  hashtags: string[]
  type: string
  likes_count: number
  comments_count: number
  date: string
}

interface BioLink {
  text: string
  href: string
}

interface InstagramReport {
  username: string
  display_name: string
  bio: string | null
  website: string | null
  bio_links: BioLink[]
  followers: number
  following: number
  posts_count: number
  verified: boolean
  health_score: number
  consistency_score: number
  engagement_rate: number
  posts: InstagramPost[]
  analytics?: {
    timeframe: string
    scraped_at: string
    total_analyzed: number
    likes: {
      average: number
      peak: number
      min: number
      total: number
    }
    comments: {
      average: number
      peak: number
      min: number
      total: number
    }
    posts_vs_reels: {
      posts: {
        count: number
        avg_likes: number
        avg_comments: number
      }
      reels: {
        count: number
        avg_likes: number
        avg_comments: number
      }
    }
    engagement_rate: number
    posts_per_week: number
    peak_post: {
      shortcode: string
      url: string
      likes: number
      comments: number
      date: string
      type: string
      caption: string
    } | null
    insights: {
      health_score: number
      consistency_score: number
    }
  }
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

  // Controls States
  const [timeframe, setTimeframe] = useState<'all' | '1m' | '3m' | '6m' | '1y'>('all')
  const [scrapeHistory, setScrapeHistory] = useState(true)
  const [scrapeReels, setScrapeReels] = useState(true)
  
  const logEndRef = useRef<HTMLDivElement | null>(null)

  // Auto-scroll logs terminal
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs])

  async function handleAudit(e: React.FormEvent) {
    e.preventDefault()
    if (!username.trim()) return

    setLoading(true)
    setReport(null)
    setLogs(['[System] Initializing Instagram profile audit connection...'])
    const toastId = toast.loading('Running Instagram profile audit...')

    // Polling function for active logs
    let pollCount = 0
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch('/api/backend-v3/logs')
        if (res.ok) {
          const data = await res.json()
          if (data.logs) {
            const igLogs = data.logs
              .filter((log: LogEntry) => log.message.includes('[Instagram Analyzer]'))
              .map((log: LogEntry) => {
                const time = new Date(log.timestamp).toLocaleTimeString()
                return `[${time}] ${log.message.replace('[Instagram Analyzer] ', '')}`
              })
            
            if (igLogs.length > 0) {
              setLogs(igLogs)
            }
          }
        }
      } catch (err) {
        console.error('Failed to poll active logs:', err)
      }
      
      // Safety limit: stop polling after 45 seconds if request hangs
      pollCount++
      if (pollCount > 45) {
        clearInterval(pollInterval)
      }
    }, 1000)

    try {
      const res = await fetch('/api/backend-v3/test/instagram', {
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

      if (res.ok && data.report) {
        setReport(data.report)
        // Fetch logs one final time to capture completeness
        const logsRes = await fetch('/api/backend-v3/logs')
        if (logsRes.ok) {
          const logsData = await logsRes.json()
          if (logsData.logs) {
            const igLogs = logsData.logs
              .filter((log: LogEntry) => log.message.includes('[Instagram Analyzer]'))
              .map((log: LogEntry) => {
                const time = new Date(log.timestamp).toLocaleTimeString()
                return `[${time}] ${log.message.replace('[Instagram Analyzer] ', '')}`
              })
            setLogs(igLogs)
          }
        }
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

  function getScoreColor(score: number) {
    if (score >= 80) return 'text-[#3B4D3C] bg-[#D4E0CD] border-[#B8C8B0]'
    if (score >= 50) return 'text-[#5C451F] bg-[#F9D99A] border-[#E8C584]'
    return 'text-red-700 bg-red-50 border-red-200'
  }

  return (
    <div className="space-y-8 text-[#2D2D2D] select-none">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-[#1C1C1E] tracking-tight">Instagram Engagement Profiler</h1>
        <p className="mt-1 text-sm text-gray-500 font-medium">Audit profile stats, consistency parameters, engagement ratios, and opportunity signals.</p>
      </div>

      {/* Input panel & Custom Controls */}
      <div className="rounded-2xl border border-[#E4E3DD] bg-white p-6 max-w-2xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] space-y-5">
        <form onSubmit={handleAudit} className="flex gap-4">
          <span className="flex items-center text-gray-400 pl-4 bg-[#F4F3EF] border border-[#E4E3DD] border-r-0 rounded-l-xl text-sm font-bold">@</span>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="username (e.g. abpnewstv, basantjoshiii)"
            required
            className="flex-1 rounded-r-xl bg-[#F4F3EF] border border-[#E4E3DD] border-l-0 px-4 py-3 text-xs text-[#2D2D2D] font-bold focus:outline-none focus:border-gray-500 placeholder-gray-400"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-[#1C1C1E] hover:bg-[#252528] disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold uppercase tracking-wider text-white px-6 py-3 transition-colors flex items-center gap-2"
          >
            {loading && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            {loading ? 'Analyzing...' : 'Run Audit'}
          </button>
        </form>

        {/* Diagnostic Parameters Toggles */}
        <div className="pt-2 border-t border-[#E4E3DD]/60 grid gap-4 sm:grid-cols-3 text-xs">
          {/* Timeframe Select */}
          <div>
            <label className="block text-[10px] font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Scrape Timeframe</label>
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value as typeof timeframe)}
              className="w-full rounded-xl bg-[#F4F3EF] border border-[#E4E3DD] px-3 py-2.5 text-xs text-[#2D2D2D] font-bold focus:outline-none focus:border-gray-500"
            >
              <option value="all">🔄 All Available Posts</option>
              <option value="1m">📅 Last 30 Days</option>
              <option value="3m">📅 Last 3 Months</option>
              <option value="6m">📅 Last 6 Months</option>
              <option value="1y">📅 Last 1 Year</option>
            </select>
          </div>

          {/* Scrape History Switch */}
          <div className="flex flex-col justify-end">
            <label className="flex items-center gap-3 cursor-pointer group select-none py-2.5">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={scrapeHistory}
                  onChange={(e) => setScrapeHistory(e.target.checked)}
                  className="sr-only"
                />
                <div className={`w-9 h-5.5 rounded-full transition-colors ${scrapeHistory ? 'bg-[#1C1C1E]' : 'bg-[#ECEAE4]'}`} />
                <div className={`absolute left-0.5 top-0.5 bg-white w-4.5 h-4.5 rounded-full transition-transform ${scrapeHistory ? 'translate-x-3.5' : 'translate-x-0'}`} />
              </div>
              <span className="text-[11px] font-bold text-gray-500 group-hover:text-gray-800 transition-colors uppercase tracking-wider">
                Analyze History
              </span>
            </label>
          </div>

          {/* Scrape Reels Switch */}
          <div className="flex flex-col justify-end">
            <label className="flex items-center gap-3 cursor-pointer group select-none py-2.5">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={scrapeReels}
                  onChange={(e) => setScrapeReels(e.target.checked)}
                  className="sr-only"
                />
                <div className={`w-9 h-5.5 rounded-full transition-colors ${scrapeReels ? 'bg-[#1C1C1E]' : 'bg-[#ECEAE4]'}`} />
                <div className={`absolute left-0.5 top-0.5 bg-white w-4.5 h-4.5 rounded-full transition-transform ${scrapeReels ? 'translate-x-3.5' : 'translate-x-0'}`} />
              </div>
              <span className="text-[11px] font-bold text-gray-500 group-hover:text-gray-800 transition-colors uppercase tracking-wider">
                Scrape Reels
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Real-time Logger Console Terminal */}
      {(loading || logs.length > 0) && (
        <div className="rounded-2xl border border-[#E4E3DD] bg-white overflow-hidden max-w-2xl flex flex-col h-[200px] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)]">
          <div className="bg-gray-50 px-4 py-3 border-b border-[#E4E3DD] flex items-center justify-between">
            <span className="font-bold text-[10px] text-gray-400 uppercase tracking-wider">📡 Scraper Engine Console Logs</span>
            {loading && (
              <span className="text-[10px] text-purple-600 font-bold uppercase tracking-wider animate-pulse flex items-center gap-1.5 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                Live streaming...
              </span>
            )}
          </div>
          <div className="flex-1 p-4 font-mono text-[10px] text-gray-600 overflow-y-auto space-y-1.5 bg-[#F4F3EF]/30">
            {logs.map((log, index) => (
              <div key={index} className="leading-relaxed break-all">
                <span className={log.startsWith('❌') ? 'text-red-650 font-bold' : 'text-gray-650'}>{log}</span>
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        </div>
      )}

      {/* Report results */}
      {report && (
        <div className="grid gap-6 lg:grid-cols-3 animate-fade-in">
          {/* Left panel: Info & Metrics */}
          <div className="lg:col-span-1 space-y-6">
            <div className="rounded-2xl border border-[#E4E3DD] bg-white p-6 space-y-4 text-center shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)]">
              <div className="space-y-1 flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-[#ECEAE4] flex items-center justify-center font-black text-xl text-gray-600 border border-[#E4E3DD]">
                  {report.username.substring(0, 2).toUpperCase()}
                </div>
                <h3 className="text-xl font-black text-[#1C1C1E] mt-3 flex items-center justify-center gap-1.5">
                  @{report.username}
                  {report.verified && (
                    <span className="text-blue-500 font-normal text-sm" title="Verified Account">
                      🛡️ Verified
                    </span>
                  )}
                </h3>
                <p className="text-xs text-gray-400 font-medium">{report.display_name}</p>
              </div>

              {report.bio && (
                <p className="text-xs text-gray-655 italic px-2 bg-[#F4F3EF]/50 py-3.5 rounded-xl border border-gray-100/60 leading-relaxed">&quot;{report.bio}&quot;</p>
              )}

              {report.website && (
                <a
                  href={report.website}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block text-xs text-blue-600 font-bold hover:underline max-w-[220px] truncate"
                >
                  🔗 {report.website.replace(/^https?:\/\//, '')}
                </a>
              )}

              {report.bio_links && report.bio_links.length > 0 && (
                <div className="space-y-2.5 mt-4 pt-4 border-t border-[#E4E3DD] text-left">
                  <h4 className="font-bold text-gray-400 uppercase text-[9px] tracking-wider">Bio Links</h4>
                  <div className="space-y-2">
                    {report.bio_links.map((link, idx) => (
                      <a
                        key={idx}
                        href={link.href}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-[#F4F3EF] border border-[#E4E3DD] text-xs text-gray-700 font-bold hover:bg-[#ECEAE4] transition-all"
                      >
                        <span>🔗</span>
                        <span className="truncate flex-1" title={link.href}>{link.text || link.href}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Score lists */}
            <div className="rounded-2xl border border-[#E4E3DD] bg-white p-5 space-y-4 text-xs shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)]">
              <h4 className="font-bold text-gray-400 uppercase text-[9px] tracking-wider border-b border-[#E4E3DD] pb-2">Operational Scores</h4>
              
              <div className="flex justify-between items-center border-b border-[#E4E3DD]/60 pb-2">
                <span className="text-gray-500 font-semibold">Health Index</span>
                <span className={`px-2.5 py-1 rounded-lg border text-[10px] font-bold ${getScoreColor(report.health_score)}`}>{report.health_score}</span>
              </div>
              <div className="flex justify-between items-center border-b border-[#E4E3DD]/60 pb-2">
                <span className="text-gray-500 font-semibold">Consistency</span>
                <span className={`px-2.5 py-1 rounded-lg border text-[10px] font-bold ${getScoreColor(report.consistency_score)}`}>{report.consistency_score}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 font-semibold">Engagement Rate</span>
                <span className="text-gray-800 font-black text-sm">{report.engagement_rate}%</span>
              </div>
            </div>
          </div>

          {/* Right panel: Statistics */}
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-2xl border border-[#E4E3DD] bg-white p-6 space-y-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)]">
              <h3 className="font-bold text-gray-500 text-xs uppercase tracking-wider border-b border-[#E4E3DD] pb-3">📊 Profile Audience Statistics</h3>
              
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="bg-[#D4E0CD] p-4.5 rounded-2xl">
                  <span className="text-[10px] text-[#3B4D3C] uppercase font-bold tracking-wider block">Followers</span>
                  <span className="text-2xl font-black text-[#2E3A2F] mt-1 block">{report.followers.toLocaleString()}</span>
                </div>
                <div className="bg-[#F9D99A] p-4.5 rounded-2xl">
                  <span className="text-[10px] text-[#5C451F] uppercase font-bold tracking-wider block">Following</span>
                  <span className="text-2xl font-black text-[#4A391D] mt-1 block">{report.following.toLocaleString()}</span>
                </div>
                <div className="bg-[#ECEAE4] p-4.5 rounded-2xl border border-[#E4E3DD]">
                  <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider block">Posts</span>
                  <span className="text-2xl font-black text-gray-800 mt-1 block">{report.posts_count.toLocaleString()}</span>
                </div>
              </div>

              {/* Mathematical Report details if available */}
              {report.analytics && (
                <div className="space-y-6 pt-2 border-t border-[#E4E3DD]">
                  <h4 className="font-bold text-gray-500 text-xs uppercase tracking-wider">📈 Mathematical Scraper Insights ({report.analytics.timeframe === 'all' ? 'All Time' : `Last ${report.analytics.timeframe.toUpperCase()}`})</h4>
                  
                  {/* Stats Grid */}
                  <div className="grid gap-4 sm:grid-cols-3 text-xs">
                    <div className="rounded-xl bg-[#F4F3EF] border border-[#E4E3DD] p-4 space-y-1.5">
                      <span className="text-gray-400 font-bold uppercase text-[9px] block">Engagement Averages</span>
                      <p className="text-gray-800 font-bold">👍 Likes: <span className="font-black font-mono">{report.analytics.likes.average.toLocaleString()}</span></p>
                      <p className="text-gray-800 font-bold">💬 Comments: <span className="font-black font-mono">{report.analytics.comments.average.toLocaleString()}</span></p>
                    </div>

                    <div className="rounded-xl bg-[#F4F3EF] border border-[#E4E3DD] p-4 space-y-1.5">
                      <span className="text-gray-400 font-bold uppercase text-[9px] block">Peak Metrics</span>
                      <p className="text-gray-800 font-bold">🔥 Max Likes: <span className="font-black font-mono">{report.analytics.likes.peak.toLocaleString()}</span></p>
                      <p className="text-gray-800 font-bold">🔥 Max Comments: <span className="font-black font-mono">{report.analytics.comments.peak.toLocaleString()}</span></p>
                    </div>

                    <div className="rounded-xl bg-[#F4F3EF] border border-[#E4E3DD] p-4 space-y-1.5">
                      <span className="text-gray-400 font-bold uppercase text-[9px] block">Posting Frequency</span>
                      <p className="text-gray-800 font-bold">📅 Cadence: <span className="font-black font-mono">{report.analytics.posts_per_week}</span> posts/week</p>
                      <p className="text-gray-800 font-bold">📊 Analyzed: <span className="font-black font-mono">{report.analytics.total_analyzed}</span> posts</p>
                    </div>
                  </div>

                  {/* Reels vs Posts Split */}
                  <div className="rounded-xl bg-[#F4F3EF] border border-[#E4E3DD] p-5 space-y-3.5 text-xs">
                    <h5 className="font-bold text-gray-500 uppercase text-[9px] tracking-wider border-b border-[#E4E3DD]/60 pb-1.5">🎥 Reels vs 🖼️ Posts Comparison</h5>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <span className="text-gray-450 font-bold text-[9px] uppercase tracking-wider block">Standard Image/Carousel Posts</span>
                        <p className="text-gray-800 font-semibold">Count: <span className="font-bold font-mono">{report.analytics.posts_vs_reels.posts.count}</span></p>
                        <p className="text-gray-800 font-semibold">Avg Likes: <span className="font-bold font-mono">{report.analytics.posts_vs_reels.posts.avg_likes.toLocaleString()}</span></p>
                        <p className="text-gray-800 font-semibold">Avg Comments: <span className="font-bold font-mono">{report.analytics.posts_vs_reels.posts.avg_comments.toLocaleString()}</span></p>
                      </div>
                      <div className="space-y-1.5 border-t sm:border-t-0 sm:border-l border-[#E4E3DD]/60 pt-3.5 sm:pt-0 sm:pl-4">
                        <span className="text-gray-455 font-bold text-[9px] uppercase tracking-wider block">Reels / Video Content</span>
                        <p className="text-gray-800 font-semibold">Count: <span className="font-bold font-mono">{report.analytics.posts_vs_reels.reels.count}</span></p>
                        <p className="text-gray-800 font-semibold">Avg Likes: <span className="font-bold font-mono">{report.analytics.posts_vs_reels.reels.avg_likes.toLocaleString()}</span></p>
                        <p className="text-gray-800 font-semibold">Avg Comments: <span className="font-bold font-mono">{report.analytics.posts_vs_reels.reels.avg_comments.toLocaleString()}</span></p>
                      </div>
                    </div>
                  </div>

                  {/* Peak engagement post */}
                  {report.analytics.peak_post && (
                    <div className="rounded-xl border border-[#E4E3DD] p-4.5 bg-gray-50 space-y-3 text-xs leading-relaxed">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-gray-500 uppercase text-[9px] tracking-wider">🔥 Peak Engagement Post</span>
                        <a href={report.analytics.peak_post.url} target="_blank" rel="noreferrer" className="text-blue-600 font-bold hover:underline">View Post &rarr;</a>
                      </div>
                      <p className="text-[10px] text-gray-600 line-clamp-2 italic leading-relaxed">&quot;{report.analytics.peak_post.caption || 'No caption'}&quot;</p>
                      <div className="flex justify-between items-center text-[10px] text-gray-450 pt-2 border-t border-gray-100 font-bold uppercase tracking-wider">
                        <span>👍 {report.analytics.peak_post.likes.toLocaleString()} Likes</span>
                        <span>💬 {report.analytics.peak_post.comments.toLocaleString()} Comments</span>
                        <span>📅 {new Date(report.analytics.peak_post.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Recent Posts & Reels Grid */}
              {report.posts && report.posts.length > 0 && (
                <div className="space-y-4 pt-2">
                  <h3 className="font-bold text-gray-700 text-xs uppercase tracking-wider flex items-center justify-between">
                    <span>📸 Scraped Timeline Feed ({report.posts.length})</span>
                    <span className="text-[9px] text-gray-400 font-normal">Chronological</span>
                  </h3>
                  
                  <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3">
                    {report.posts.map((post) => (
                      <a
                        key={post.shortcode}
                        href={post.url}
                        target="_blank"
                        rel="noreferrer"
                        className="group rounded-2xl border border-[#E4E3DD] bg-white overflow-hidden flex flex-col hover:border-gray-400 hover:scale-[1.02] transition-all duration-300 shadow-sm"
                      >
                        {/* Image Thumbnail */}
                        <div className="relative aspect-square w-full bg-[#F4F3EF] flex items-center justify-center overflow-hidden border-b border-[#E4E3DD]">
                          {post.thumbnail ? (
                            <img
                              src={post.thumbnail}
                              alt={post.caption}
                              className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <span className="text-gray-400 text-xs font-semibold">No Image</span>
                          )}
                          {/* Hover Stats */}
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-4 text-white text-xs font-bold transition-opacity duration-300">
                            <span>❤️ {post.likes_count.toLocaleString()}</span>
                            <span>💬 {post.comments_count.toLocaleString()}</span>
                          </div>
                          {/* Type Badge */}
                          <span className="absolute top-3 right-3 px-2 py-0.5 rounded-lg bg-black/60 text-[9px] font-bold text-gray-200 uppercase tracking-wider">
                            {post.type === 'reel' ? '🎥 Reel' : '🖼️ Post'}
                          </span>
                        </div>
                        
                        {/* Caption & Date */}
                        <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                          <p className="text-[10px] text-gray-600 line-clamp-2 leading-relaxed font-medium" title={post.caption}>
                            {post.caption}
                          </p>
                          
                          <div className="space-y-2 pt-2 border-t border-gray-50">
                            {/* Hashtags */}
                            {post.hashtags && post.hashtags.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {post.hashtags.slice(0, 3).map((tag, idx) => (
                                  <span key={idx} className="text-[9px] text-[#5C451F] font-bold font-mono">
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                            
                            <div className="flex justify-between items-center text-[9px] text-gray-400 font-semibold">
                              <span>📅 {new Date(post.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                            </div>
                          </div>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
