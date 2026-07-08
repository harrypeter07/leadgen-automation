'use client'

import React from 'react'

export default function AnalyticsInsightsPage() {
  const kpis = [
    { label: 'Followers Growth', value: '45,820', change: '+8.4%', desc: 'Across connected Meta accounts' },
    { label: 'Total Reach', value: '245.8K', change: '+14.2%', desc: 'Unique platform page viewers' },
    { label: 'Engagement Rate', value: '5.2%', change: '+0.8%', desc: 'Likes, comments, shares average' },
    { label: 'Response Time', value: '4m 12s', change: '-1m 30s', desc: 'Average AI reply dispatch speed' },
  ]

  return (
    <div className="space-y-8 select-none">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-white tracking-tight">Analytics & Insights</h1>
        <p className="mt-1 text-sm text-gray-500 font-medium">Monitor audience growth, page impressions, campaign response latencies, and cross-channel conversion stats.</p>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-2xl border border-[#2D2D30] bg-[#18181A] p-6 space-y-4 shadow-sm">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">{kpi.label}</span>
            <div className="space-y-1">
              <h3 className="text-2xl font-black text-white tracking-tight">{kpi.value}</h3>
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider">
                <span className={kpi.change.startsWith('+') ? 'text-green-400' : 'text-green-400'}>{kpi.change}</span>
                <span className="text-gray-600">vs last month</span>
              </div>
            </div>
            <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">{kpi.desc}</p>
          </div>
        ))}
      </div>

      {/* Placeholder Charts Panel */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-[#2D2D30] bg-[#18181A] p-6 space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-[#2D2D30] pb-2">📈 Reach & Impressions Over Time</h3>
          
          <div className="h-64 flex items-end gap-3 pt-6 px-4">
            {[40, 55, 45, 60, 75, 90, 85, 100, 95, 110, 105, 120].map((h, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2 group cursor-pointer">
                <div 
                  style={{ height: `${h}%` }}
                  className="w-full bg-gradient-to-t from-blue-500/40 to-[#E3B859]/60 hover:to-[#E3B859] rounded-lg transition-all duration-300 relative"
                >
                  <span className="absolute -top-6 left-1/2 -translate-x-1/2 bg-[#2D2D30] border border-gray-700 px-1.5 py-0.5 rounded text-[8px] text-white opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap font-mono">{h * 2}K</span>
                </div>
                <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider font-mono">M{i+1}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-[#2D2D30] bg-[#18181A] p-6 space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-[#2D2D30] pb-2">🎯 Engagement Breakdown by Channel</h3>
          
          <div className="h-64 flex flex-col justify-center space-y-4 px-4 text-xs font-semibold">
            {[
              { name: 'Instagram Feed Posts', count: '48%', color: 'w-[48%] bg-purple-500/80' },
              { name: 'WhatsApp Bot Dialogs', count: '32%', color: 'w-[32%] bg-green-500/80' },
              { name: 'Facebook Pages Outbound', count: '14%', color: 'w-[14%] bg-blue-500/80' },
              { name: 'Messenger Platform replies', count: '6%', color: 'w-[6%] bg-pink-500/80' },
            ].map(item => (
              <div key={item.name} className="space-y-1.5">
                <div className="flex justify-between text-[10px] uppercase tracking-wider font-bold text-gray-400">
                  <span>{item.name}</span>
                  <span className="text-white font-mono">{item.count}</span>
                </div>
                <div className="w-full bg-gray-900 h-2.5 rounded-full overflow-hidden border border-[#2D2D30]/60">
                  <div className={`h-full rounded-full ${item.color}`} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
