'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import toast from 'react-hot-toast'
import {
  Calendar,
  Image as ImageIcon,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertTriangle,
  BarChart3,
  Heart,
  MessageCircle,
  Eye,
  Share2,
  ThumbsUp,
  ExternalLink,
  X,
  Timer,
  Zap,
  Send,
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
  shares?: number
  impressions?: number
  reach?: number
  views?: number
  status?: string // 'scheduled', 'failed', 'published'
}

interface CloudinaryAsset {
  publicId: string
  url: string
  bytes?: number
  createdAt?: string
}

// Reusable countdown hook
function useCountdown(targetISO: string | null) {
  const [timeLeft, setTimeLeft] = useState('')
  const [isPast, setIsPast] = useState(false)
  useEffect(() => {
    if (!targetISO) return
    const calc = () => {
      const diff = new Date(targetISO).getTime() - Date.now()
      if (diff <= 0) {
        setIsPast(true)
        setTimeLeft('')
        return
      }
      setIsPast(false)
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      if (h > 0) setTimeLeft(`${h}h ${m}m ${s}s`)
      else if (m > 0) setTimeLeft(`${m}m ${s}s`)
      else setTimeLeft(`${s}s`)
    }
    calc()
    const id = setInterval(calc, 1000)
    return () => clearInterval(id)
  }, [targetISO])
  return { timeLeft, isPast }
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

  // Modal Scheduling states (for drop-to-schedule)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalDate, setModalDate] = useState<Date | null>(null)
  const [modalImageUrl, setModalImageUrl] = useState('')
  const [modalCaption, setModalCaption] = useState('')
  const [modalTime, setModalTime] = useState('12:00')
  const [modalPlatforms, setModalPlatforms] = useState<string[]>(['facebook'])
  const [savingPost, setSavingPost] = useState(false)

  // Post Detail Modal states (for clicking calendar events)
  const [selectedPost, setSelectedPost] = useState<CalendarPost | null>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [analyticsData, setAnalyticsData] = useState<Partial<CalendarPost> | null>(null)
  const [showAnalyticsPanel, setShowAnalyticsPanel] = useState(false)

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
            content: 'Scheduled via Calendar Drag & Drop',
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
      setModalCaption('Scheduled via Calendar Drag & Drop')
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

  // Open post detail modal
  const handlePostClick = async (post: CalendarPost) => {
    setSelectedPost(post)
    setShowAnalyticsPanel(false)
    setAnalyticsData(null)

    // If published, try to load analytics
    if (post.status !== 'scheduled' && post.permalink) {
      setAnalyticsLoading(true)
      try {
        const res = await fetch(`/api/meta/posts/${post.id}/insights`)
        const data = await res.json()
        if (res.ok && data) {
          setAnalyticsData({
            likes: data.likes ?? post.likes ?? 0,
            comments: data.comments ?? post.comments ?? 0,
            shares: data.shares ?? post.shares ?? 0,
            impressions: data.impressions ?? post.impressions ?? 0,
            reach: data.reach ?? post.reach ?? 0,
            views: data.views ?? post.views ?? 0,
          })
        } else {
          // Fallback to data already in post object
          setAnalyticsData({
            likes: post.likes ?? 0,
            comments: post.comments ?? 0,
            shares: post.shares ?? 0,
            impressions: post.impressions ?? 0,
            reach: post.reach ?? 0,
            views: post.views ?? 0,
          })
        }
      } catch {
        setAnalyticsData({
          likes: post.likes ?? 0,
          comments: post.comments ?? 0,
          shares: post.shares ?? 0,
          impressions: post.impressions ?? 0,
          reach: post.reach ?? 0,
          views: post.views ?? 0,
        })
      } finally {
        setAnalyticsLoading(false)
      }
    }
  }

  const [publishingNow, setPublishingNow] = useState(false)

  const handlePublishNow = async (post: CalendarPost) => {
    setPublishingNow(true)
    const toastId = toast.loading('Publishing to Meta API immediately...')
    try {
      let publishedId = ''
      const isInstagram = post.platform === 'instagram' || post.type === 'ig'

      if (isInstagram) {
        const res = await fetch('/api/meta/instagram/post', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image_url: post.imageUrl || '',
            caption: post.title || ''
          })
        })
        const data = await res.json()
        if (!res.ok || !data.success) {
          throw new Error(data.error?.message || data.error || 'Instagram publish failed')
        }
        publishedId = data.data?.id || data.id || 'ig_published'
      } else {
        const res = await fetch('/api/meta/facebook/post', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'publish',
            message: post.title || '',
            link: post.imageUrl || ''
          })
        })
        const data = await res.json()
        if (!res.ok || !data.success) {
          throw new Error(data.error?.message || data.error || 'Facebook publish failed')
        }
        publishedId = data.data?.id || data.id || 'fb_published'
      }

      // Update the queue status in Supabase DB via our backend queue callback
      const callbackRes = await fetch('/api/backend-v3/automation/workflows/publish/queue/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: post.id,
          status: 'published',
          published_id: publishedId
        })
      })

      if (callbackRes.ok) {
        toast.success('Successfully published live!', { id: toastId })
        setSelectedPost(null)
        fetchCalendarPosts()
      } else {
        const callbackData = await callbackRes.json()
        throw new Error(callbackData.error || 'Failed to update calendar status in database')
      }
    } catch (err: any) {
      console.error('Immediate publish failed:', err)
      toast.error(err.message || 'Immediate publish failed', { id: toastId })
    } finally {
      setPublishingNow(false)
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
          <p className="mt-1 text-sm text-slate-500 font-bold uppercase tracking-wider">Drag visual assets onto dates · Click events for details &amp; analytics</p>
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
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-rose-600 font-mono transition-colors"
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
              className="text-[9px] text-rose-600 hover:text-rose-700 uppercase font-bold transition-colors flex items-center gap-1"
            >
              <RefreshCw className={`w-3 h-3 ${scanningFolder ? 'animate-spin' : ''}`} />
              {scanningFolder ? 'Scanning...' : 'Refresh'}
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
                <button onClick={handlePrevMonth} className="p-1.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors flex items-center justify-center"><ChevronLeft className="w-4 h-4" /></button>
                <button onClick={handleNextMonth} className="p-1.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors flex items-center justify-center"><ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>
            <button
              onClick={fetchCalendarPosts}
              className="text-xs font-bold text-slate-500 hover:text-rose-600 transition-colors flex items-center gap-1"
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
              const isToday = day === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear()
              return (
                <div
                  key={day}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleDropMedia(e, day)}
                  className="bg-white min-h-[120px] p-2.5 text-xs flex flex-col hover:bg-slate-50/50 transition-all border-r border-b border-slate-100 relative group/cell"
                >
                  <span className={`font-extrabold block mb-1 text-[10px] w-5 h-5 flex items-center justify-center rounded-full ${isToday ? 'bg-rose-600 text-white' : 'text-slate-400'}`}>{day}</span>
                  
                  <div className="space-y-1 flex-1 overflow-y-auto max-h-[85px] scrollbar-none">
                    {loading && items.length === 0 ? (
                      <div className="h-4 bg-slate-100 rounded animate-pulse" />
                    ) : (
                      items.map((item) => {
                        const formattedTime = new Date(item.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        const isScheduled = item.status === 'scheduled'

                        return (
                          <button
                            key={item.id}
                            onClick={() => handlePostClick(item)}
                            className={`w-full text-left block p-1 rounded border text-[9px] font-semibold tracking-wide leading-tight truncate transition-all hover:scale-[1.02] hover:shadow-sm cursor-pointer ${
                              isScheduled
                                ? 'bg-amber-50 text-amber-700 border-amber-200 border-dashed hover:bg-amber-100/80'
                                : item.type === 'ig'
                                ? 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100/80'
                                : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100/80'
                            }`}
                          >
                            <span className="block text-[7px] font-black opacity-60 uppercase mb-0.5">
                              {formattedTime} {isScheduled && '• SCHED'}
                            </span>
                            {item.title}
                          </button>
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

      {/* Drop Scheduling Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 select-none animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl text-slate-800">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 className="font-extrabold text-slate-900 text-sm">Schedule Dropped Post</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-900 transition-colors"><X className="w-4 h-4" /></button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1.5">Selected Date</label>
                  <input
                    type="text"
                    readOnly
                    value={modalDate ? modalDate.toLocaleDateString() : ''}
                    className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-slate-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1.5">Posting Time</label>
                  <input
                    type="time"
                    value={modalTime}
                    onChange={e => setModalTime(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-rose-600 font-mono transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1.5">Publish To</label>
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
                <label className="block text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1.5">Post Caption</label>
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
                  <label className="block text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1.5">Selected Image</label>
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

      {/* Post Detail Modal */}
      {selectedPost && (
        <PostDetailModal
          post={selectedPost}
          analyticsLoading={analyticsLoading}
          analyticsData={analyticsData}
          showAnalyticsPanel={showAnalyticsPanel}
          setShowAnalyticsPanel={setShowAnalyticsPanel}
          publishingNow={publishingNow}
          onPublishNow={handlePublishNow}
          onClose={() => { setSelectedPost(null); setAnalyticsData(null); setShowAnalyticsPanel(false) }}
        />
      )}
    </div>
  )
}

/* ─── Post Detail Modal Component ─── */
interface PostDetailModalProps {
  post: CalendarPost
  analyticsLoading: boolean
  analyticsData: Partial<CalendarPost> | null
  showAnalyticsPanel: boolean
  setShowAnalyticsPanel: (v: boolean) => void
  publishingNow: boolean
  onPublishNow: (post: CalendarPost) => Promise<void>
  onClose: () => void
}

function PostDetailModal({
  post,
  analyticsLoading,
  analyticsData,
  showAnalyticsPanel,
  setShowAnalyticsPanel,
  publishingNow,
  onPublishNow,
  onClose
}: PostDetailModalProps) {
  const isScheduled = post.status === 'scheduled'
  const postTime = post.time
  const { timeLeft, isPast } = useCountdown(isScheduled ? postTime : null)

  const postDate = new Date(postTime)
  const formattedDate = postDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  const formattedTime = postDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  const isPlatformIG = post.type === 'ig' || post.platform === 'instagram'

  const statCards = [
    { label: 'Likes', value: analyticsData?.likes ?? 0, icon: <Heart className="w-4 h-4 text-rose-500" />, color: 'text-rose-600' },
    { label: 'Comments', value: analyticsData?.comments ?? 0, icon: <MessageCircle className="w-4 h-4 text-blue-500" />, color: 'text-blue-600' },
    { label: 'Shares', value: analyticsData?.shares ?? 0, icon: <Share2 className="w-4 h-4 text-green-500" />, color: 'text-green-600' },
    { label: 'Impressions', value: analyticsData?.impressions ?? 0, icon: <Eye className="w-4 h-4 text-purple-500" />, color: 'text-purple-600' },
    { label: 'Reach', value: analyticsData?.reach ?? 0, icon: <Zap className="w-4 h-4 text-orange-500" />, color: 'text-orange-600' },
    { label: 'Views', value: analyticsData?.views ?? 0, icon: <BarChart3 className="w-4 h-4 text-slate-500" />, color: 'text-slate-600' },
  ]

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg shadow-2xl text-slate-800 overflow-hidden">
        
        {/* Header banner */}
        <div className={`px-6 py-4 flex items-center justify-between ${isPlatformIG ? 'bg-gradient-to-r from-purple-50 to-pink-50 border-b border-purple-100' : 'bg-gradient-to-r from-blue-50 to-sky-50 border-b border-blue-100'}`}>
          <div className="flex items-center gap-2.5">
            {isPlatformIG ? (
              <svg className="w-5 h-5 text-purple-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
              </svg>
            ) : (
              <svg className="w-5 h-5 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
            )}
            <span className={`text-xs font-black uppercase tracking-wider ${isPlatformIG ? 'text-purple-700' : 'text-blue-700'}`}>
              {isPlatformIG ? 'Instagram' : 'Facebook'} Post
            </span>
            <span className={`ml-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
              isScheduled
                ? 'bg-amber-100 text-amber-700 border border-amber-200'
                : isPast
                ? 'bg-green-100 text-green-700 border border-green-200'
                : 'bg-rose-100 text-rose-700 border border-rose-200'
            }`}>
              {isScheduled ? 'Scheduled' : 'Published'}
            </span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-900 transition-colors p-1 rounded-lg hover:bg-white/60">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">

          {/* Caption */}
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Caption</p>
            <p className="text-sm text-slate-800 font-medium leading-relaxed line-clamp-3">{post.title || '(No caption)'}</p>
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
              <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">Date</p>
              <p className="text-xs font-bold text-slate-800">{formattedDate}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
              <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">Time</p>
              <p className="text-xs font-bold text-slate-800 font-mono">{formattedTime}</p>
            </div>
          </div>

          {/* Status block */}
          {isScheduled ? (
            <div className={`rounded-xl p-4 border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
              timeLeft
                ? 'bg-amber-50 border-amber-200'
                : 'bg-orange-50 border-orange-200'
            }`}>
              <div className="flex items-center gap-4">
                <div className={`p-2.5 rounded-lg ${timeLeft ? 'bg-amber-100' : 'bg-orange-100'}`}>
                  <Timer className={`w-5 h-5 ${timeLeft ? 'text-amber-600' : 'text-orange-600'}`} />
                </div>
                <div>
                  <p className={`text-[9px] font-black uppercase tracking-widest ${timeLeft ? 'text-amber-500' : 'text-orange-500'}`}>
                    {timeLeft ? 'Publishing In' : 'Overdue — Not Yet Posted'}
                  </p>
                  {timeLeft ? (
                    <p className="text-xl font-black text-amber-700 font-mono tabular-nums">{timeLeft}</p>
                  ) : (
                    <p className="text-sm font-bold text-orange-700">Check your Meta credentials and queue runner.</p>
                  )}
                </div>
              </div>
              {!timeLeft && (
                <button
                  onClick={() => onPublishNow(post)}
                  disabled={publishingNow}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-rose-600/10 disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                  {publishingNow ? 'Publishing...' : 'Publish Now'}
                </button>
              )}
            </div>
          ) : (
            <div className="rounded-xl p-4 border bg-green-50 border-green-200 flex items-center gap-4">
              <div className="p-2.5 rounded-lg bg-green-100">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-green-500">Status</p>
                <p className="text-sm font-black text-green-700">Posted Successfully</p>
                <p className="text-[10px] text-green-600 mt-0.5">{formattedDate} at {formattedTime}</p>
              </div>
            </div>
          )}

          {/* Preview image */}
          {post.imageUrl && (
            <div className="rounded-xl overflow-hidden border border-slate-100 max-h-40">
              <img src={post.imageUrl} alt="post preview" className="w-full h-full object-cover" />
            </div>
          )}

          {/* Analytics section */}
          {!isScheduled && (
            <>
              <div className="border-t border-slate-100 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                    <BarChart3 className="w-3.5 h-3.5 text-rose-500" /> Post Analytics
                  </p>
                  <button
                    onClick={() => setShowAnalyticsPanel(!showAnalyticsPanel)}
                    className="text-[9px] font-black text-rose-600 hover:text-rose-700 uppercase tracking-wider flex items-center gap-1 transition-colors"
                  >
                    {showAnalyticsPanel ? 'Hide' : 'View Analytics'} <ExternalLink className="w-3 h-3" />
                  </button>
                </div>

                {analyticsLoading ? (
                  <div className="grid grid-cols-3 gap-2">
                    {[...Array(6)].map((_, i) => (
                      <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />
                    ))}
                  </div>
                ) : showAnalyticsPanel ? (
                  <div className="grid grid-cols-3 gap-2">
                    {statCards.map((s) => (
                      <div key={s.label} className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex flex-col items-center text-center hover:border-slate-200 hover:shadow-sm transition-all">
                        {s.icon}
                        <p className={`text-lg font-black mt-1 ${s.color}`}>{(s.value as number).toLocaleString()}</p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{s.label}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex gap-4 flex-wrap">
                    {statCards.slice(0, 3).map((s) => (
                      <div key={s.label} className="flex items-center gap-1.5">
                        {s.icon}
                        <span className={`text-sm font-black ${s.color}`}>{(s.value as number).toLocaleString()}</span>
                        <span className="text-[9px] text-slate-400 font-bold uppercase">{s.label}</span>
                      </div>
                    ))}
                    <button
                      onClick={() => setShowAnalyticsPanel(true)}
                      className="text-[9px] font-black text-slate-400 hover:text-rose-600 uppercase tracking-wider transition-colors"
                    >
                      +{statCards.length - 3} more
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Footer actions */}
          <div className="flex gap-2 pt-1">
            {post.permalink && (
              <a
                href={post.permalink}
                target="_blank"
                rel="noreferrer"
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs text-center hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" /> View Post
              </a>
            )}
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-rose-600 text-white font-bold text-xs hover:bg-rose-700 transition-colors shadow-sm shadow-rose-600/15"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
