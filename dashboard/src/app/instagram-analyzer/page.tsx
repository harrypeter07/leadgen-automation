'use client'

import React, { useState } from 'react'
import toast from 'react-hot-toast'

interface InstagramReport {
  username: string
  display_name: string
  bio: string | null
  website: string | null
  followers: number
  following: number
  posts_count: number
  verified: boolean
  health_score: number
  consistency_score: number
  engagement_rate: number
}

export default function InstagramAnalyzerPage() {
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<InstagramReport | null>(null)

  async function handleAudit(e: React.FormEvent) {
    e.preventDefault()
    if (!username.trim()) return

    setLoading(true)
    const toastId = toast.loading('Running Instagram profile audit...')
    try {
      const res = await fetch('/api/backend-v3/test/instagram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim().replace(/^@/, '') })
      })

      const data = await res.json()
      if (res.ok && data.report) {
        setReport(data.report)
        toast.success('Instagram audit completed!', { id: toastId })
      } else {
        throw new Error(data.error || 'Audit failed')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error auditing profile'
      toast.error(msg, { id: toastId })
    } finally {
      setLoading(false)
    }
  }

  function getScoreColor(score: number) {
    if (score >= 80) return 'text-green-400 border-green-500/30 bg-green-950/20'
    if (score >= 50) return 'text-yellow-400 border-yellow-500/30 bg-yellow-950/20'
    return 'text-red-400 border-red-500/30 bg-red-950/20'
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Instagram Engagement Profiler</h1>
        <p className="mt-1 text-sm text-gray-400">Audit profile stats, consistency parameters, engagement ratios, and opportunity signals.</p>
      </div>

      {/* Input panel */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6 max-w-2xl">
        <form onSubmit={handleAudit} className="flex gap-4">
          <span className="flex items-center text-gray-500 pl-3 bg-gray-950 border border-gray-800 border-r-0 rounded-l-lg text-sm select-none">@</span>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="username"
            required
            className="flex-1 rounded-r-lg bg-gray-950 border border-gray-800 border-l-0 px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-colors"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-semibold text-white px-6 py-2.5 transition-colors flex items-center gap-2"
          >
            {loading && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            {loading ? 'Analyzing...' : 'Run Audit'}
          </button>
        </form>
      </div>

      {/* Report results */}
      {report && (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left panel: Info & Metrics */}
          <div className="lg:col-span-1 space-y-4">
            <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6 space-y-4 text-center">
              <div className="space-y-1">
                <h3 className="text-xl font-bold text-white flex items-center justify-center gap-1.5">
                  @{report.username}
                  {report.verified && (
                    <span className="text-blue-400" title="Verified Account">
                      🛡️
                    </span>
                  )}
                </h3>
                <p className="text-xs text-gray-400">{report.display_name}</p>
              </div>

              {report.bio && (
                <p className="text-xs text-gray-300 italic px-2">&quot;{report.bio}&quot;</p>
              )}

              {report.website && (
                <a
                  href={report.website}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block text-xs text-purple-400 hover:text-purple-300 hover:underline max-w-[220px] truncate"
                >
                  🔗 {report.website}
                </a>
              )}
            </div>

            {/* Score lists */}
            <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5 space-y-4 text-xs">
              <h4 className="font-bold text-gray-200 uppercase text-[10px] border-b border-gray-850 pb-2">Operational Scores</h4>
              
              <div className="flex justify-between items-center border-b border-gray-850/40 pb-2">
                <span className="text-gray-400">Health Index</span>
                <span className={`px-2 py-0.5 rounded font-bold ${getScoreColor(report.health_score)}`}>{report.health_score}</span>
              </div>
              <div className="flex justify-between items-center border-b border-gray-850/40 pb-2">
                <span className="text-gray-400">Content Consistency</span>
                <span className={`px-2 py-0.5 rounded font-bold ${getScoreColor(report.consistency_score)}`}>{report.consistency_score}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Engagement Rate</span>
                <span className="text-purple-400 font-bold text-sm">{report.engagement_rate}%</span>
              </div>
            </div>
          </div>

          {/* Right panel: Statistics */}
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6 space-y-6">
              <h3 className="font-bold text-gray-200 text-sm border-b border-gray-855 pb-2">📊 Profile Audience Statistics</h3>
              
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="bg-gray-950/60 p-4 rounded-xl border border-gray-850">
                  <span className="text-[10px] text-gray-500 uppercase font-semibold block">Followers</span>
                  <span className="text-2xl font-black text-white">{report.followers.toLocaleString()}</span>
                </div>
                <div className="bg-gray-950/60 p-4 rounded-xl border border-gray-850">
                  <span className="text-[10px] text-gray-500 uppercase font-semibold block">Following</span>
                  <span className="text-2xl font-black text-white">{report.following.toLocaleString()}</span>
                </div>
                <div className="bg-gray-950/60 p-4 rounded-xl border border-gray-850">
                  <span className="text-[10px] text-gray-500 uppercase font-semibold block">Posts</span>
                  <span className="text-2xl font-black text-white">{report.posts_count.toLocaleString()}</span>
                </div>
              </div>

              {/* Insights */}
              <div className="space-y-4 pt-2">
                <h4 className="font-bold text-gray-300 text-xs uppercase text-[10px]">Presence Opportunity Signals</h4>
                <div className="grid gap-3 sm:grid-cols-2 text-xs">
                  <div className="rounded-lg bg-gray-950 border border-gray-850 p-3 space-y-1">
                    <span className="text-gray-500 font-semibold block">Profile Completeness</span>
                    <span className="text-gray-200">{report.bio && report.website ? '✅ Fully Configured' : '⚠️ Missing Bio Links'}</span>
                  </div>
                  <div className="rounded-lg bg-gray-950 border border-gray-850 p-3 space-y-1">
                    <span className="text-gray-500 font-semibold block">Consistency Index</span>
                    <span className="text-gray-200">{report.posts_count > 50 ? '✅ Active account' : '⚠️ Low active cadence'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
