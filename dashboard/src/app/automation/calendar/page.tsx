'use client'

import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'

interface CalendarPost {
  id: string
  platform: 'facebook' | 'instagram'
  title: string
  time: string
  type: 'ig' | 'fb'
  imageUrl?: string
  permalink?: string
  likes: number
  comments: number
}

export default function ContentCalendarPage() {
  const [posts, setPosts] = useState<CalendarPost[]>([])
  const [loading, setLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(new Date())

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const firstDayIndex = new Date(year, month, 1).getDay()
  const daysInMonthCount = new Date(year, month + 1, 0).getDate()

  const daysArray = Array.from({ length: daysInMonthCount }, (_, i) => i + 1)

  useEffect(() => {
    const fetchCalendarPosts = async () => {
      setLoading(false)
      try {
        const res = await fetch('/api/meta/posts?limit=50')
        const data = await res.json()
        if (res.ok && data.posts) {
          setPosts(data.posts)
        }
      } catch (err: any) {
        console.error('Failed to load posts for calendar:', err)
        toast.error('Failed to load calendar events')
      } finally {
        setLoading(false)
      }
    }
    fetchCalendarPosts()
  }, [])

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1))
  }

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1))
  }

  // Group posts by day
  const postsByDay: Record<number, CalendarPost[]> = {}
  posts.forEach(post => {
    const postDate = new Date(post.time)
    if (postDate.getFullYear() === year && postDate.getMonth() === month) {
      const day = postDate.getDate()
      if (!postsByDay[day]) postsByDay[day] = []
      postsByDay[day].push(post)
    }
  })

  return (
    <div className="space-y-8 select-none text-white">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black tracking-tight">📅 Content Calendar</h1>
        <p className="mt-1 text-sm text-gray-500 font-medium">Real-time scheduling overview of your published and planned posts on Facebook and Instagram.</p>
      </div>

      <div className="rounded-2xl border border-[#2D2D30] bg-[#18181A] p-6 space-y-6">
        {/* Month Selector header */}
        <div className="flex justify-between items-center border-b border-[#2D2D30] pb-4">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-bold text-white tracking-tight">{monthNames[month]} {year}</h2>
            <div className="flex gap-1">
              <button onClick={handlePrevMonth} className="px-3 py-1.5 bg-[#141416] border border-[#2D2D30] hover:bg-gray-800 rounded-lg text-xs font-bold font-mono">◀</button>
              <button onClick={handleNextMonth} className="px-3 py-1.5 bg-[#141416] border border-[#2D2D30] hover:bg-gray-800 rounded-lg text-xs font-bold font-mono">▶</button>
            </div>
          </div>
          <span className="text-xs font-mono text-gray-500">Real-Time Sync Active</span>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-px bg-[#2D2D30] overflow-hidden rounded-xl">
          {daysOfWeek.map((day) => (
            <div key={day} className="bg-[#141416] py-3 text-center text-[10px] font-bold text-gray-500 uppercase tracking-wider border-b border-[#2D2D30]">
              {day}
            </div>
          ))}

          {/* Dummy empty grid offset for starting day of the month */}
          {Array.from({ length: firstDayIndex }).map((_, i) => (
            <div key={`empty-${i}`} className="bg-[#18181A] min-h-[120px] p-2 text-xs" />
          ))}

          {daysArray.map((day) => {
            const items = postsByDay[day] || []
            return (
              <div key={day} className="bg-[#18181A] min-h-[120px] p-3 text-xs flex flex-col justify-between hover:bg-[#202022] transition-colors border-r border-b border-[#2D2D30]/40">
                <span className="font-bold text-gray-400 block mb-1 text-[10px]">{day}</span>
                
                <div className="space-y-1.5 flex-1 overflow-y-auto max-h-[85px] scrollbar-none">
                  {loading ? (
                    <div className="h-4 bg-[#141416] rounded animate-pulse" />
                  ) : (
                    items.map((item) => {
                      const formattedTime = new Date(item.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      return (
                        <a
                          key={item.id}
                          href={item.permalink || '#'}
                          target="_blank"
                          rel="noreferrer"
                          className={`block p-1.5 rounded border text-[9px] font-semibold tracking-wide leading-tight truncate ${
                            item.type === 'ig'
                              ? 'bg-purple-950/30 text-purple-400 border-purple-900/30 hover:bg-purple-900/20'
                              : 'bg-blue-950/30 text-blue-400 border-blue-900/30 hover:bg-blue-900/20'
                          }`}
                        >
                          <span className="block text-[8px] font-bold opacity-60 uppercase">{formattedTime}</span>
                          {item.title}
                        </a>
                      )
                    })
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
