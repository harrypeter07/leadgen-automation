'use client'

import React, { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import { 
  Calendar, 
  Image as ImageIcon, 
  RefreshCw, 
  Check, 
  AlertCircle, 
  Inbox, 
  ChevronLeft, 
  ChevronRight 
} from 'lucide-react'

interface CalendarPost {
  id: string
  platform: 'facebook' | 'instagram'
  title: string
  time: string
  type: 'ig' | 'fb'
  imageUrl?: string
  permalink?: string
  likes?: number
  comments?: number
  status?: string // 'scheduled', 'failed', 'published'
}

interface CloudinaryAsset {
  publicId: string
  url: string
  bytes?: number
  createdAt?: string
}

export default function ContentCalendarPage() {
  const [posts, setPosts] = useState<CalendarPost[]>([])
  const [loading, setLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(new Date())

  // Time scheduling states
  const [defaultTime, setDefaultTime] = useState('12:00')
  const [useDefaultTime, setUseDefaultTime] = useState(true)

  // Media Library states inside Calendar
  const [cloudinaryAssets, setCloudinaryAssets] = useState<CloudinaryAsset[]>([])
  const [cloudinaryFolder, setCloudinaryFolder] = useState('')
  const [scanningFolder, setScanningFolder] = useState(false)

  // Modal Scheduling states
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalDate, setModalDate] = useState<Date | null>(null)
  const [modalImageUrl, setModalImageUrl] = useState('')
  const [modalCaption, setModalCaption] = useState('')
  const [modalTime, setModalTime] = useState('12:00')
  const [modalPlatforms, setModalPlatforms] = useState<string[]>(['facebook'])
  const [savingPost, setSavingPost] = useState(false)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const firstDayIndex = new Date(year, month, 1).getDay()
  const daysInMonthCount = new Date(year, month + 1, 0).getDate()

  const daysArray = Array.from({ length: daysInMonthCount }, (_, i) => i + 1)

  const fetchCalendarPosts = useCallback(async () => {
    setLoading(true)
    try {
      // 1. Fetch published posts live from Meta API
      const res = await fetch('/api/meta/posts?limit=50')
      const data = await res.json()
      let publishedList: CalendarPost[] = []
      if (res.ok && data.posts) {
        publishedList = data.posts
      }

      // 2. Fetch queued / scheduled posts from postgres publishing queue
      const queueRes = await fetch('/api/backend-v3/automation/workflows/publish/queue')
      const queueData = await queueRes.json()
      let scheduledList: CalendarPost[] = []
      if (queueRes.ok && queueData.queue) {
        scheduledList = queueData.queue.map((item: any) => ({
          id: item.id,
          platform: item.platform,
          title: item.content || '(No caption)',
          time: item.scheduled_at,
          type: item.platform === 'instagram' ? 'ig' : 'fb',
          imageUrl: item.media_url,
          status: item.status
        }))
      }

      // Merge both live feeds
      setPosts([...publishedList, ...scheduledList])
    } catch (err: any) {
      console.error('Failed to load posts for calendar:', err)
      toast.error('Failed to load calendar events')
    } finally {
      setLoading(false)
    }
  }, [])

  const scanCloudinary = useCallback(async () => {
    setScanningFolder(true)
    try {
      const folderParam = cloudinaryFolder ? `folder=${encodeURIComponent(cloudinaryFolder)}` : ''
      const res = await fetch(`/api/meta/cloudinary?${folderParam}`)
      const data = await res.json()
      if (res.ok && data.assets) {
        setCloudinaryAssets(data.assets)
      }
    } catch (err) {
      console.error('Failed to scan Cloudinary inside calendar:', err)
    } finally {
      setScanningFolder(false)
    }
  }, [cloudinaryFolder])

  useEffect(() => {
    fetchCalendarPosts()
    scanCloudinary()
  }, [fetchCalendarPosts, scanCloudinary])

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1))
  }

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1))
  }

  // HTML5 Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, imageUrl: string) => {
    e.dataTransfer.setData('text/plain', imageUrl)
    e.dataTransfer.effectAllowed = 'copy'
  }

  const handleDropMedia = async (e: React.DragEvent, day: number) => {
    e.preventDefault()
    const imageUrl = e.dataTransfer.getData('text/plain')
    if (!imageUrl) return

    const droppedDate = new Date(year, month, day)

    if (useDefaultTime && defaultTime) {
      // Instant scheduling!
      const scheduledDate = new Date(droppedDate)
      const [hours, minutes] = defaultTime.split(':').map(Number)
      scheduledDate.setHours(hours || 12, minutes || 0, 0, 0)
      
      const toastId = toast.loading('Scheduling post...')
      try {
        const res = await fetch('/api/backend-v3/automation/workflows/publish/queue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            platform: 'facebook',
            account_name: 'Meta Page',
            content: 'Scheduled via Calendar Drag & Drop 🚀',
            media_url: imageUrl,
            scheduled_at: scheduledDate.toISOString()
          })
        })
        if (res.ok) {
          toast.success('Successfully scheduled for ' + scheduledDate.toLocaleDateString(), { id: toastId })
          fetchCalendarPosts()
        } else {
          throw new Error('Schedule failed')
        }
      } catch (err: any) {
        toast.error('Failed to schedule post', { id: toastId })
      }
    } else {
      // Open Modal for details customization
      setModalDate(droppedDate)
      setModalImageUrl(imageUrl)
      setModalTime(defaultTime || '12:00')
      setModalCaption('Scheduled via Calendar Drag & Drop 🚀')
      setModalPlatforms(['facebook'])
      setIsModalOpen(true)
    }
  }

  const handleSaveModalPost = async () => {
    if (!modalDate) return
    setSavingPost(true)
    const toastId = toast.loading('Scheduling post...')
    try {
      const scheduledDate = new Date(modalDate)
      const [hours, minutes] = modalTime.split(':').map(Number)
      scheduledDate.setHours(hours || 12, minutes || 0, 0, 0)

      for (const platform of modalPlatforms) {
        const res = await fetch('/api/backend-v3/automation/workflows/publish/queue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            platform,
            account_name: platform === 'instagram' ? 'Instagram Business' : 'Meta Page',
            content: modalCaption,
            media_url: modalImageUrl || null,
            scheduled_at: scheduledDate.toISOString()
          })
        })
        if (!res.ok) {
          throw new Error(`Schedule failed for ${platform}`)
        }
      }
      
      toast.success('Post successfully scheduled!', { id: toastId })
      setIsModalOpen(false)
      fetchCalendarPosts()
    } catch (err: any) {
      toast.error(err.message || 'Failed to schedule post', { id: toastId })
    } finally {
      setSavingPost(false)
    }
  }

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

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
    <div className="space-y-6 select-none text-slate-800 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 flex items-center gap-2">
            <Calendar className="w-7 h-7 text-rose-600" /> Content Calendar
          </h1>
          <p className="mt-1 text-sm text-slate-500 font-bold uppercase tracking-wider">Drag visual assets onto dates for quick scheduling.</p>
        </div>
      </div>

      {/* Control panel for scheduling */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-col md:flex-row gap-5 items-center justify-between shadow-sm">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500 font-black uppercase tracking-wider">Default Time:</span>
            <input
              type="time"
              value={defaultTime}
              onChange={e => setDefaultTime(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-850 focus:outline-none focus:border-rose-600 font-mono transition-colors"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="chkDefaultTime"
              checked={useDefaultTime}
              onChange={e => setUseDefaultTime(e.target.checked)}
              className="w-4 h-4 accent-rose-600 rounded border-slate-300 bg-slate-50 cursor-pointer"
            />
            <label htmlFor="chkDefaultTime" className="text-xs text-slate-500 font-medium cursor-pointer">Instant Schedule (No Dialog popup)</label>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest font-black">Meta Engine Active</span>
        </div>
      </div>

      {/* Main Grid: Left sidebar media | Right calendar grid */}
      <div className="grid gap-6 lg:grid-cols-4">
        {/* Left Panel: Draggable Media Library */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 h-[600px] flex flex-col shadow-sm">
          <div className="border-b border-slate-100 pb-2 flex justify-between items-center">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <ImageIcon className="w-4 h-4 text-rose-600" /> Draggable Media
            </h3>
            <button
              onClick={scanCloudinary}
              disabled={scanningFolder}
              className="text-[9px] text-rose-600 hover:text-rose-700 uppercase font-bold transition-colors"
            >
              {scanningFolder ? '⏳' : 'Refresh'}
            </button>
          </div>

          <div className="space-y-3 flex-1 flex flex-col min-h-0">
            <input
              value={cloudinaryFolder}
              onChange={e => setCloudinaryFolder(e.target.value)}
              placeholder="Search folder..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-rose-500 transition-colors"
            />

            {/* Draggable items list */}
            {cloudinaryAssets.length > 0 ? (
              <div className="grid grid-cols-2 gap-2 overflow-y-auto pr-1 flex-1">
                {cloudinaryAssets.map(asset => (
                  <div
                    key={asset.publicId}
                    draggable
                    onDragStart={(e) => handleDragStart(e, asset.url)}
                    className="relative w-full h-24 rounded-lg overflow-hidden border border-slate-200 hover:border-rose-400 hover:shadow-md transition-all cursor-grab active:cursor-grabbing group bg-slate-50"
                  >
                    <img src={asset.url} alt="asset" className="w-full h-full object-cover select-none pointer-events-none" />
                    <div className="absolute inset-0 bg-rose-950/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <span className="text-[8px] uppercase tracking-wider font-bold bg-rose-600 text-white px-2 py-0.5 rounded shadow-sm">DRAG</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-20 text-center text-xs text-slate-400 uppercase border border-dashed border-slate-200 rounded-xl flex-1 flex items-center justify-center">
                No Media Found
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: Calendar Container */}
        <div className="lg:col-span-3 rounded-2xl border border-slate-200 bg-white p-6 space-y-6 shadow-sm">
          {/* Month Selector header */}
          <div className="flex justify-between items-center border-b border-slate-100 pb-4">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-black text-slate-900 tracking-tight">{monthNames[month]} {year}</h2>
              <div className="flex gap-1">
                <button onClick={handlePrevMonth} className="p-1.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-lg text-slate-650 transition-colors flex items-center justify-center"><ChevronLeft className="w-4 h-4" /></button>
                <button onClick={handleNextMonth} className="p-1.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-lg text-slate-650 transition-colors flex items-center justify-center"><ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>
            <button
              onClick={fetchCalendarPosts}
              className="text-xs font-bold text-slate-455 hover:text-rose-600 transition-colors flex items-center gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Sync Live
            </button>
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-px bg-slate-200 overflow-hidden rounded-xl border border-slate-200">
            {daysOfWeek.map((day) => (
              <div key={day} className="bg-slate-50 py-3 text-center text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-100">
                {day}
              </div>
            ))}

            {/* Dummy empty grid offset */}
            {Array.from({ length: firstDayIndex }).map((_, i) => (
              <div key={`empty-${i}`} className="bg-slate-50/30 min-h-[120px] p-2 text-xs" />
            ))}

            {daysArray.map((day) => {
              const items = postsByDay[day] || []
              return (
                <div
                  key={day}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleDropMedia(e, day)}
                  className="bg-white min-h-[120px] p-2.5 text-xs flex flex-col justify-between hover:bg-slate-50/50 transition-all border-r border-b border-slate-100 relative group/cell"
                >
                  <span className="font-extrabold text-slate-400 block mb-1 text-[10px]">{day}</span>
                  
                  <div className="space-y-1 flex-1 overflow-y-auto max-h-[85px] scrollbar-none">
                    {loading && items.length === 0 ? (
                      <div className="h-4 bg-slate-100 rounded animate-pulse" />
                    ) : (
                      items.map((item) => {
                        const formattedTime = new Date(item.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        const isScheduled = item.status === 'scheduled'

                        return (
                          <a
                            key={item.id}
                            href={item.permalink || '#'}
                            target="_blank"
                            rel="noreferrer"
                            className={`block p-1 rounded border text-[9px] font-semibold tracking-wide leading-tight truncate transition-colors ${
                              isScheduled
                                ? 'bg-amber-50 text-amber-700 border-amber-250 border-dashed hover:bg-amber-100/50'
                                : item.type === 'ig'
                                ? 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100/50'
                                : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100/50'
                            }`}
                          >
                            <span className="block text-[7px] font-black opacity-60 uppercase mb-0.5">
                              {formattedTime} {isScheduled && '• SCHEDULED'}
                            </span>
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

      {/* Modal Dialog for Drop Scheduling */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 select-none animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl text-slate-800">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 className="font-extrabold text-slate-900 text-sm">Schedule Dropped Post</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-900 text-sm font-bold">✕</button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-450 text-[10px] font-bold uppercase tracking-wider mb-1.5">Selected Date</label>
                  <input
                    type="text"
                    readOnly
                    value={modalDate ? modalDate.toLocaleDateString() : ''}
                    className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-slate-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-450 text-[10px] font-bold uppercase tracking-wider mb-1.5">Posting Time</label>
                  <input
                    type="time"
                    value={modalTime}
                    onChange={e => setModalTime(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-rose-600 font-mono transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-455 text-[10px] font-bold uppercase tracking-wider mb-1.5">Publish To</label>
                <div className="flex gap-2">
                  {['facebook', 'instagram'].map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setModalPlatforms(prev =>
                        prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
                      )}
                      className={`flex-1 py-2.5 rounded-xl text-center border font-bold uppercase text-[10px] tracking-wider transition-all ${
                        modalPlatforms.includes(p)
                          ? 'bg-rose-600 border-rose-600 text-white shadow-sm shadow-rose-600/10'
                          : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-slate-455 text-[10px] font-bold uppercase tracking-wider mb-1.5">Post Caption</label>
                <textarea
                  rows={4}
                  value={modalCaption}
                  onChange={e => setModalCaption(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-rose-500 transition-colors resize-none leading-relaxed"
                  placeholder="Enter caption..."
                />
              </div>

              {modalImageUrl && (
                <div>
                  <label className="block text-slate-455 text-[10px] font-bold uppercase tracking-wider mb-1.5">Selected Image</label>
                  <img src={modalImageUrl} alt="dropped" className="rounded-xl max-h-32 object-cover border border-slate-200 w-full" />
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-500 font-bold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveModalPost}
                  disabled={savingPost || modalPlatforms.length === 0}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 text-white font-bold uppercase hover:bg-rose-700 transition-colors disabled:opacity-40 shadow-md shadow-rose-600/10"
                >
                  {savingPost ? 'Scheduling...' : 'Confirm Schedule'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
