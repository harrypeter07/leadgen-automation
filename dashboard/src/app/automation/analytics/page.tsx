'use client'

import React, { useState, useEffect } from 'react'

interface SummaryStats {
  totalFollowers: number
  totalReach: number
  totalImpressions: number
  totalEngagement: number
}

interface PlatformDetails {
  id: string | null
  name?: string
  username?: string
  followers: number
  reach: number
  engagement?: number
  impressions?: number
  picture: string | null
}

export default function AnalyticsInsightsPage() {
  const [stats, setStats] = useState<SummaryStats | null>(null)
  const [platforms, setPlatforms] = useState<{ facebook: PlatformDetails; instagram: PlatformDetails } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const res = await fetch('/api/meta/insights')
        const data = await res.json()
        if (res.ok && data.success) {
          setStats(data.summary)
          setPlatforms(data.platforms)
        } else {
          setError(data.error || 'Failed to fetch insights')
        }
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchAnalytics()
  }, [])

  return (
    <div className="space-y-8 select-none text-white">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black tracking-tight">📈 Analytics & Insights</h1>
        <p className="mt-1 text-sm text-gray-500 font-medium">Real-time audience reach, impressions, engagement, and profile metrics fetched via Meta API.</p>
      </div>

      {loading ? (
        <div className="py-20 text-center text-gray-500 animate-pulse text-sm">Loading performance metrics…</div>
      ) : error ? (
        <div className="rounded-2xl border border-red-900/30 bg-red-950/20 p-6 space-y-3">
          <div className="text-sm font-bold text-red-400">⚠️ API Configuration Limit</div>
          <p className="text-xs text-gray-400 leading-relaxed">
            Could not fetch profile reach and follower growth. Ensure your Facebook Page Access Token and Instagram Business ID are fully configured in settings, and the token has the necessary permissions (<code className="text-red-300">read_insights</code>, <code className="text-red-300">instagram_basic</code>).
          </p>
          <div className="text-[10px] font-mono text-red-300 bg-black/40 p-3 rounded-lg overflow-x-auto">
            Error: {error}
          </div>
        </div>
      ) : (
        <>
          {/* KPI Grid */}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Total Followers', value: stats?.totalFollowers.toLocaleString() || '0', icon: '👥', desc: 'Combined audience size' },
              { label: 'Total Reach', value: stats?.totalReach.toLocaleString() || '0', icon: '🌐', desc: 'Daily unique views' },
              { label: 'Total Impressions', value: stats?.totalImpressions.toLocaleString() || '0', icon: '📈', desc: 'Daily total views' },
              { label: 'Total Engagement', value: stats?.totalEngagement.toLocaleString() || '0', icon: '🎯', desc: 'Comments & reactions' },
            ].map(kpi => (
              <div key={kpi.label} className="rounded-2xl border border-[#2D2D30] bg-[#18181A] p-6 space-y-4 shadow-sm relative overflow-hidden">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">{kpi.label}</span>
                <div className="space-y-1">
                  <h3 className="text-2xl font-black tracking-tight">{kpi.value}</h3>
                  <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">{kpi.desc}</p>
                </div>
                <span className="absolute right-4 bottom-4 text-2xl opacity-10">{kpi.icon}</span>
              </div>
            ))}
          </div>

          {/* Platform Performance breakdown */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Facebook card */}
            {platforms?.facebook && (
              <div className="rounded-2xl border border-[#2D2D30] bg-[#18181A] p-6 space-y-5">
                <div className="flex items-center gap-3 border-b border-[#2D2D30] pb-3">
                  {platforms.facebook.picture ? (
                    <img src={platforms.facebook.picture} alt="FB" className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <span className="text-2xl">📘</span>
                  )}
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-wider">{platforms.facebook.name || 'Facebook Page'}</h3>
                    <span className="text-[10px] text-gray-500 font-mono">ID: {platforms.facebook.id}</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="p-3 bg-[#141416] rounded-xl border border-[#2D2D30]/60">
                    <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest block mb-1">Followers</span>
                    <span className="text-sm font-black font-mono">{platforms.facebook.followers.toLocaleString()}</span>
                  </div>
                  <div className="p-3 bg-[#141416] rounded-xl border border-[#2D2D30]/60">
                    <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest block mb-1">Reach</span>
                    <span className="text-sm font-black font-mono">{platforms.facebook.reach.toLocaleString()}</span>
                  </div>
                  <div className="p-3 bg-[#141416] rounded-xl border border-[#2D2D30]/60">
                    <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest block mb-1">Engagement</span>
                    <span className="text-sm font-black font-mono">{platforms.facebook.engagement?.toLocaleString() || '0'}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Instagram card */}
            {platforms?.instagram && (
              <div className="rounded-2xl border border-[#2D2D30] bg-[#18181A] p-6 space-y-5">
                <div className="flex items-center gap-3 border-b border-[#2D2D30] pb-3">
                  {platforms.instagram.picture ? (
                    <img src={platforms.instagram.picture} alt="IG" className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <span className="text-2xl">📸</span>
                  )}
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-wider">@{platforms.instagram.username}</h3>
                    <span className="text-[10px] text-gray-500 font-mono">ID: {platforms.instagram.id}</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="p-3 bg-[#141416] rounded-xl border border-[#2D2D30]/60">
                    <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest block mb-1">Followers</span>
                    <span className="text-sm font-black font-mono">{platforms.instagram.followers.toLocaleString()}</span>
                  </div>
                  <div className="p-3 bg-[#141416] rounded-xl border border-[#2D2D30]/60">
                    <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest block mb-1">Reach</span>
                    <span className="text-sm font-black font-mono">{platforms.instagram.reach.toLocaleString()}</span>
                  </div>
                  <div className="p-3 bg-[#141416] rounded-xl border border-[#2D2D30]/60">
                    <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest block mb-1">Impressions</span>
                    <span className="text-sm font-black font-mono">{platforms.instagram.impressions?.toLocaleString() || '0'}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
