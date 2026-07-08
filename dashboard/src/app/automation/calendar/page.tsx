'use client'

import React from 'react'

export default function ContentCalendarPage() {
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const daysInMonth = Array.from({ length: 31 }, (_, i) => i + 1)
  
  const scheduledItems: Record<number, { title: string; type: 'ig' | 'fb'; time: string }[]> = {
    4: [{ title: 'Singapore Cafe Walkthrough', type: 'ig', time: '10:00 AM' }],
    8: [{ title: 'mockup delivery audit post', type: 'fb', time: '2:30 PM' }],
    15: [{ title: 'automated WhatsApp workflow tips', type: 'ig', time: '9:00 AM' }],
    22: [{ title: 'Growth campaign audit offering', type: 'ig', time: '4:15 PM' }],
    28: [{ title: 'System settings setup walkthrough', type: 'fb', time: '11:00 AM' }],
  }

  return (
    <div className="space-y-8 select-none">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-white tracking-tight">Content Calendar</h1>
        <p className="mt-1 text-sm text-gray-500 font-medium">Coordinate publishing workflows, review approval timelines, and drag posts between schedule dates.</p>
      </div>

      <div className="rounded-2xl border border-[#2D2D30] bg-[#18181A] p-6 space-y-6">
        {/* Month Selector header */}
        <div className="flex justify-between items-center border-b border-[#2D2D30] pb-4">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-bold text-white tracking-tight">July 2026</h2>
            <div className="flex gap-1">
              <button className="px-3 py-1.5 bg-[#141416] border border-[#2D2D30] hover:bg-gray-800 rounded-lg text-xs font-bold font-mono">◀</button>
              <button className="px-3 py-1.5 bg-[#141416] border border-[#2D2D30] hover:bg-gray-800 rounded-lg text-xs font-bold font-mono">▶</button>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="px-3 py-1.5 rounded-lg bg-[#E3B859] text-[#141416] text-xs font-bold uppercase tracking-wider">Month</button>
            <button className="px-3 py-1.5 rounded-lg bg-[#141416] border border-[#2D2D30] hover:bg-gray-800 text-xs font-bold uppercase tracking-wider text-gray-400">Week</button>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-px bg-[#2D2D30] overflow-hidden rounded-xl">
          {daysOfWeek.map((day) => (
            <div key={day} className="bg-[#141416] py-3 text-center text-[10px] font-bold text-gray-500 uppercase tracking-wider border-b border-[#2D2D30]">
              {day}
            </div>
          ))}

          {/* Dummy empty grid offset for Month starting day */}
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-[#18181A] min-h-[100px] p-2 text-xs" />
          ))}

          {daysInMonth.map((day) => {
            const items = scheduledItems[day] || []
            return (
              <div key={day} className="bg-[#18181A] min-h-[100px] p-3 text-xs flex flex-col justify-between hover:bg-[#202022] transition-colors border-r border-b border-[#2D2D30]/40">
                <span className="font-bold text-gray-400 block mb-1 text-[10px]">{day}</span>
                
                <div className="space-y-1.5 flex-1 overflow-y-auto">
                  {items.map((item, idx) => (
                    <div
                      key={idx}
                      className={`p-1.5 rounded border text-[9px] font-semibold tracking-wide leading-tight truncate cursor-pointer ${
                        item.type === 'ig'
                          ? 'bg-purple-950/30 text-purple-400 border-purple-900/30'
                          : 'bg-blue-950/30 text-blue-400 border-blue-900/30'
                      }`}
                    >
                      <span className="block text-[8px] font-bold opacity-60 uppercase">{item.time}</span>
                      {item.title}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
