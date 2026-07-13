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
  Activity,
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
  errorLog?: string
  qstash_message_id?: string
  created_at?: string
  published_at?: string
  published_id?: string
}

interface CloudinaryAsset {
  publicId: string
  url: string
  bytes?: number
  createdAt?: string
  resourceType?: string
}

const isVideoUrl = (url: string) => {
  if (!url) return false
  return url.toLowerCase().includes('/video/upload/') || url.toLowerCase().match(/\.(mp4|webm|mov|avi|mkv|ogg)($|\?)/)
}

// Reusable countdown hook
function useCountdown(targetISO: string | null) {
  const [timeLeft, setTimeLeft] = useState('')
  const [isPast, setIsPast] = useState(false)
  useEffect(() => {
    if (!targetISO) return
    const calc = () => {
      const parsedTime = new Date(targetISO).getTime()
      if (isNaN(parsedTime)) {
        setIsPast(true)
        setTimeLeft('')
        return
      }
      const diff = parsedTime - Date.now()
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
  const [defaultTime, setDefaultTime] = useState(() => {
    if (typeof window !== 'undefined') {
      const now = new Date()
      return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    }
    return '12:00'
  })
  const [useDefaultTime, setUseDefaultTime] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('useDefaultTime')
      return saved !== null ? saved === 'true' : true
    }
    return true
  })

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
  const [activeDayPosts, setActiveDayPosts] = useState<{ day: number; posts: CalendarPost[] } | null>(null)
  const [reschedulingPostId, setReschedulingPostId] = useState<string | null>(null)

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
          status: item.status,
          errorLog: item.error_log,
          qstash_message_id: item.qstash_message_id,
          created_at: item.created_at,
          published_at: item.published_at,
          published_id: item.published_id
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
      
      const now = new Date()
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      setModalTime(currentTime)
      
      setModalCaption('Scheduled via Calendar Drag & Drop')
      setModalPlatforms(['facebook'])
      setIsModalOpen(true)
    }
  }

  const handleRescheduleClick = (post: CalendarPost) => {
    setReschedulingPostId(post.id)
    
    const postDate = new Date(post.time)
    setModalDate(postDate)
    
    const hours = String(postDate.getHours()).padStart(2, '0')
    const minutes = String(postDate.getMinutes()).padStart(2, '0')
    setModalTime(`${hours}:${minutes}`)
    
    setModalImageUrl(post.imageUrl || '')
    setModalCaption(post.title || '')
    setModalPlatforms([post.platform])
    
    // Close detail modal, open schedule modal
    setSelectedPost(null)
    setIsModalOpen(true)
  }

  const handleSaveModalPost = async () => {
    if (!modalDate) return
    setSavingPost(true)
    const toastId = toast.loading(reschedulingPostId ? 'Updating scheduled post...' : 'Scheduling post...')
    try {
      const scheduledDate = new Date(modalDate)
      const [hours, minutes] = modalTime.split(':').map(Number)
      scheduledDate.setHours(hours || 12, minutes || 0, 0, 0)

      if (reschedulingPostId) {
        // Rescheduling an existing post!
        const res = await fetch(`/api/backend-v3/automation/workflows/publish/queue/${reschedulingPostId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            platform: modalPlatforms[0] || 'facebook',
            content: modalCaption,
            media_url: modalImageUrl || null,
            scheduled_at: scheduledDate.toISOString()
          })
        })
        if (!res.ok) {
          throw new Error('Failed to update scheduled post')
        }
        toast.success('Post successfully rescheduled!', { id: toastId })
        setReschedulingPostId(null)
      } else {
        // Creating a new post!
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
      }
      
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
      
      const errorMsg = err.message || 'Unknown immediate publishing error'
      
      // Update database status to failed and save the error message
      try {
        await fetch('/api/backend-v3/automation/workflows/publish/queue/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: post.id,
            status: 'failed',
            error_log: errorMsg
          })
        })
        
        // Update selectedPost state directly so the user sees the error log in the modal instantly!
        setSelectedPost(prev => prev ? { ...prev, status: 'failed', errorLog: errorMsg } : null)
        
        fetchCalendarPosts()
      } catch (dbErr) {
        console.error('Failed to write failure logs to database:', dbErr)
      }
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
              onChange={e => {
                const val = e.target.checked
                setUseDefaultTime(val)
                localStorage.setItem('useDefaultTime', String(val))
              }}
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
                    {asset.resourceType === 'video' || isVideoUrl(asset.url) ? (
                      <>
                        <video src={asset.url} muted playsInline className="w-full h-full object-cover select-none pointer-events-none" />
                        <div className="absolute top-1.5 right-1.5 p-1 bg-black/60 rounded text-white flex items-center justify-center pointer-events-none">
                          <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </div>
                      </>
                    ) : (
                      <img src={asset.url} alt="asset" className="w-full h-full object-cover select-none pointer-events-none" />
                    )}
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
                  onClick={() => {
                    if (items.length > 0) {
                      setActiveDayPosts({ day, posts: items })
                    }
                  }}
                  className={`bg-white min-h-[100px] p-2 text-xs flex flex-col hover:bg-slate-50 transition-all border-r border-b border-slate-100 relative group/cell ${
                    items.length > 0 ? 'cursor-pointer hover:border-slate-300' : ''
                  }`}
                >
                  <span className={`font-extrabold block mb-1 text-[10px] w-5 h-5 flex items-center justify-center rounded-full ${isToday ? 'bg-rose-600 text-white' : 'text-slate-400'}`}>{day}</span>
                  
                  <div className="flex flex-wrap gap-1 mt-1.5 h-6 overflow-hidden">
                    {loading && items.length === 0 ? (
                      <div className="w-2.5 h-2.5 rounded-full bg-slate-100 animate-pulse" />
                    ) : (
                      items.map((item) => {
                        const isScheduled = item.status === 'scheduled'
                        const isFailed = item.status === 'failed'
                        let dotColor = 'bg-blue-500' // Facebook published
                        if (isScheduled) dotColor = 'bg-amber-500'
                        else if (isFailed) dotColor = 'bg-red-500'
                        else if (item.type === 'ig' || item.platform === 'instagram') dotColor = 'bg-purple-500' // Instagram published

                        return (
                          <span
                            key={item.id}
                            title={`${new Date(item.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}: ${item.title}`}
                            className={`w-2.5 h-2.5 rounded-full ${dotColor} border border-white shadow-sm shrink-0 transition-transform hover:scale-125`}
                          />
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
              <h3 className="font-extrabold text-slate-900 text-sm">{reschedulingPostId ? 'Reschedule Post' : 'Schedule Dropped Post'}</h3>
              <button
                onClick={() => {
                  setIsModalOpen(false)
                  setReschedulingPostId(null)
                }}
                className="text-slate-400 hover:text-slate-900 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
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
                  <label className="block text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1.5">Selected Visual Asset</label>
                  {isVideoUrl(modalImageUrl) ? (
                    <video src={modalImageUrl} controls className="rounded-xl max-h-32 object-cover border border-slate-200 w-full" />
                  ) : (
                    <img src={modalImageUrl} alt="dropped" className="rounded-xl max-h-32 object-cover border border-slate-200 w-full" />
                  )}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false)
                    setReschedulingPostId(null)
                  }}
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

      {/* Daily Posts List Modal */}
      {activeDayPosts && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 select-none animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 w-full max-w-lg space-y-4 shadow-2xl text-slate-800 animate-scaleIn">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">
                  Scheduled &amp; Published Posts
                </h3>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                  {monthNames[month]} {activeDayPosts.day}, {year}
                </p>
              </div>
              <button
                onClick={() => setActiveDayPosts(null)}
                className="text-slate-400 hover:text-slate-900 transition-colors p-1 rounded-lg hover:bg-slate-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 overflow-y-auto max-h-[350px] pr-1">
              {activeDayPosts.posts.map((post) => {
                const formattedTime = new Date(post.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                const isScheduled = post.status === 'scheduled'
                const isFailed = post.status === 'failed'
                const isInstagram = post.platform === 'instagram' || post.type === 'ig'

                return (
                  <button
                    key={post.id}
                    onClick={() => {
                      handlePostClick(post)
                      setActiveDayPosts(null)
                    }}
                    className="w-full text-left flex gap-3 p-3 rounded-xl border border-slate-100 hover:border-slate-300 hover:bg-slate-50 transition-all group cursor-pointer"
                  >
                    {post.imageUrl && (
                      <div className="w-12 h-12 rounded-lg overflow-hidden border border-slate-100 shrink-0 bg-slate-50 relative">
                        {isVideoUrl(post.imageUrl) ? (
                          <>
                            <video src={post.imageUrl} muted playsInline className="w-full h-full object-cover" />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/35">
                              <svg className="w-4 h-4 fill-white" viewBox="0 0 24 24">
                                <path d="M8 5v14l11-7z" />
                              </svg>
                            </div>
                          </>
                        ) : (
                          <img src={post.imageUrl} alt="post visual" className="w-full h-full object-cover" />
                        )}
                      </div>
                    )}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-rose-600 uppercase font-mono tracking-wider">
                          {formattedTime}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {/* Platform badge */}
                          {isInstagram ? (
                            <span className="bg-purple-50 text-purple-600 border border-purple-100 rounded-md px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider">
                              Instagram
                            </span>
                          ) : (
                            <span className="bg-blue-50 text-blue-600 border border-blue-100 rounded-md px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider">
                              Facebook
                            </span>
                          )}
                          {/* Status badge */}
                          {isScheduled ? (
                            <span className="bg-amber-50 text-amber-600 border border-amber-100 rounded-md px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider">
                              Scheduled
                            </span>
                          ) : isFailed ? (
                            <span className="bg-red-50 text-red-600 border border-red-100 rounded-md px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider animate-pulse">
                              Failed
                            </span>
                          ) : (
                            <span className="bg-green-50 text-green-600 border border-green-100 rounded-md px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider">
                              Published
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-xs font-semibold text-slate-700 truncate group-hover:text-slate-900 transition-colors">
                        {post.title}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
            
            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setActiveDayPosts(null)}
                className="py-2 px-4 rounded-xl border border-slate-200 text-slate-500 font-bold hover:bg-slate-50 transition-colors text-xs"
              >
                Close
              </button>
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
          onReschedule={handleRescheduleClick}
          onClose={() => {
            setSelectedPost(null)
            setAnalyticsData(null)
            setShowAnalyticsPanel(false)
            fetchCalendarPosts()
          }}
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
  onReschedule: (post: CalendarPost) => void
  onClose: () => void
}

function PostDetailModal({
  post: initialPost,
  analyticsLoading,
  analyticsData,
  showAnalyticsPanel,
  setShowAnalyticsPanel,
  publishingNow,
  onPublishNow,
  onReschedule,
  onClose
}: PostDetailModalProps) {
  const [post, setLocalPost] = useState<CalendarPost>(initialPost)
  const [currentStatus, setCurrentStatus] = useState<string>(initialPost.status || 'scheduled')
  const [secSinceOverdue, setSecSinceOverdue] = useState(() => {
    const releaseTime = new Date(initialPost.time).getTime()
    const diff = Date.now() - releaseTime
    return diff > 0 ? Math.floor(diff / 1000) : 0
  })

  const isScheduled = currentStatus === 'scheduled'
  const postTime = post.time
  const { timeLeft, isPast } = useCountdown(isScheduled ? postTime : null)

  const postDate = new Date(postTime)
  const formattedDate = postDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  const formattedTime = postDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  const isPlatformIG = post.type === 'ig' || post.platform === 'instagram'

  // Poll status when scheduled and overdue
  useEffect(() => {
    if (currentStatus !== 'scheduled') return

    const releaseTime = new Date(post.time).getTime()
    
    const intervalId = setInterval(async () => {
      const diff = releaseTime - Date.now()
      
      // Track seconds passed after scheduled time
      if (diff <= 0) {
        setSecSinceOverdue(prev => prev + 2)
      }
      
      // Start polling when we are within 5 seconds of the post time, or past it
      if (diff <= 5000) {
        try {
          const res = await fetch(`/api/backend-v3/automation/workflows/publish/queue/${post.id}`)
          if (res.ok) {
            const data = await res.json()
            if (data.queue && data.queue.length > 0) {
              const item = data.queue[0]
              if (item.status !== 'scheduled') {
                setCurrentStatus(item.status)
                setLocalPost(prev => ({
                  ...prev,
                  status: item.status,
                  published_id: item.published_id,
                  published_at: item.published_at,
                  errorLog: item.error_log
                }))
              }
            }
          }
        } catch (err) {
          console.error('Failed to poll queue status:', err)
        }
      }
    }, 2000)

    return () => clearInterval(intervalId)
  }, [post.id, post.time, currentStatus])

  const statCards = [
    { label: 'Likes', value: analyticsData?.likes ?? 0, icon: <Heart className="w-4 h-4 text-rose-500" />, color: 'text-rose-600' },
    { label: 'Comments', value: analyticsData?.comments ?? 0, icon: <MessageCircle className="w-4 h-4 text-blue-500" />, color: 'text-blue-600' },
    { label: 'Shares', value: analyticsData?.shares ?? 0, icon: <Share2 className="w-4 h-4 text-green-500" />, color: 'text-green-600' },
    { label: 'Impressions', value: analyticsData?.impressions ?? 0, icon: <Eye className="w-4 h-4 text-purple-500" />, color: 'text-purple-600' },
    { label: 'Reach', value: analyticsData?.reach ?? 0, icon: <Zap className="w-4 h-4 text-orange-500" />, color: 'text-orange-600' },
    { label: 'Views', value: analyticsData?.views ?? 0, icon: <BarChart3 className="w-4 h-4 text-slate-500" />, color: 'text-slate-600' },
  ]

  // Generate logs array based on the post properties
  const logs = [];

  // 1. Queue creation
  if (post.created_at || post.time) {
    logs.push({
      time: post.created_at ? new Date(post.created_at) : new Date(new Date(post.time).getTime() - 60000),
      label: 'Post Queue Created',
      desc: `Scheduled for platform: ${post.platform || post.type || 'meta'}`
    });
  }

  // 2. QStash queueing
  if (post.qstash_message_id) {
    logs.push({
      time: post.created_at ? new Date(post.created_at) : new Date(new Date(post.time).getTime() - 60000),
      label: 'QStash Scheduled',
      desc: `Delayed trigger registered (ID: ${post.qstash_message_id.substring(0, 12)}...)`
    });
  }

  // 3. Status transitions
  if (currentStatus === 'published') {
    logs.push({
      time: post.published_at ? new Date(post.published_at) : new Date(post.time),
      label: 'Published Successfully',
      desc: `Posted live! Meta ID: ${post.published_id || 'N/A'}`
    });
  } else if (currentStatus === 'failed') {
    logs.push({
      time: new Date(),
      label: 'Publishing Failed',
      desc: post.errorLog || 'Unknown publishing error'
    });
  } else {
    // scheduled
    const isOverdue = !timeLeft;
    if (isOverdue) {
      if (secSinceOverdue < 45) {
        logs.push({
          time: new Date(post.time),
          label: 'n8n Workflow Triggered',
          desc: 'Trigger signal received. Dispatching API call...'
        });
      } else {
        logs.push({
          time: new Date(post.time),
          label: 'Awaiting Queue Execution',
          desc: 'Scheduled time reached. Queue runner is processing...'
        });
      }
    } else {
      logs.push({
        time: new Date(post.time),
        label: 'Scheduled Execution Queued',
        desc: `Waiting for release at ${formattedTime}`
      });
    }
  }

  // Sort logs by time ascending
  logs.sort((a, b) => a.time.getTime() - b.time.getTime());

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg shadow-2xl text-slate-800 overflow-hidden max-h-[90vh] flex flex-col">
        
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
              currentStatus === 'scheduled'
                ? 'bg-amber-100 text-amber-700 border border-amber-200'
                : currentStatus === 'failed'
                ? 'bg-red-105 text-red-700 border border-red-200'
                : 'bg-green-100 text-green-700 border border-green-200'
            }`}>
              {currentStatus === 'scheduled' ? 'Scheduled' : currentStatus === 'failed' ? 'Failed' : 'Published'}
            </span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-900 transition-colors p-1 rounded-lg hover:bg-white/60">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto flex-1">

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
          {currentStatus === 'scheduled' ? (
            <div className="space-y-3">
              {(!timeLeft && secSinceOverdue < 45) ? (
                <div className="rounded-xl p-4 border bg-blue-50 border-blue-200 flex items-center justify-between gap-4 animate-pulse">
                  <div className="flex items-center gap-4">
                    <div className="p-2.5 rounded-lg bg-blue-100">
                      <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-blue-500">
                        Status
                      </p>
                      <p className="text-sm font-black text-blue-700">Publishing...</p>
                      <p className="text-[10px] text-blue-500 mt-0.5">n8n workflow is executing. Please wait...</p>
                    </div>
                  </div>
                </div>
              ) : (
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
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <button
                      onClick={() => onReschedule(post)}
                      className="px-3.5 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      Reschedule
                    </button>
                    {!timeLeft && (
                      <button
                        onClick={() => onPublishNow(post)}
                        disabled={publishingNow}
                        className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-rose-600/10 disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                        {publishingNow ? 'Publishing...' : 'Publish Now'}
                      </button>
                    )}
                  </div>
                </div>
              )}
              {post.errorLog && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 text-xs text-red-700 flex flex-col gap-1">
                  <span className="font-extrabold text-[9px] uppercase tracking-wider text-red-500 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-500" /> Log Reason / Error Output
                  </span>
                  <p className="font-mono bg-white/60 border border-red-100/50 rounded-lg p-2 mt-1 leading-relaxed text-[10px] break-words max-h-24 overflow-y-auto">
                    {post.errorLog}
                  </p>
                </div>
              )}
            </div>
          ) : currentStatus === 'failed' ? (
            <div className="space-y-3">
              <div className="rounded-xl p-4 border bg-red-50 border-red-200 flex items-center gap-4">
                <div className="p-2.5 rounded-lg bg-red-105">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-red-500">Status</p>
                  <p className="text-sm font-black text-red-700">Publishing Failed</p>
                  <p className="text-[10px] text-red-600 mt-0.5">{post.errorLog || 'Unknown Meta API error'}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => onReschedule(post)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Clock className="w-3.5 h-3.5 text-slate-500" /> Reschedule Post
                </button>
                <button
                  onClick={() => onPublishNow(post)}
                  disabled={publishingNow}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" /> {publishingNow ? 'Publishing...' : 'Retry Publish'}
                </button>
              </div>
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

          {/* Preview media */}
          {post.imageUrl && (
            <div className="rounded-xl overflow-hidden border border-slate-100 max-h-40 w-full flex items-center justify-center bg-slate-50">
              {isVideoUrl(post.imageUrl) ? (
                <video src={post.imageUrl} controls className="w-full max-h-40 object-contain" />
              ) : (
                <img src={post.imageUrl} alt="post preview" className="w-full h-full object-cover" />
              )}
            </div>
          )}

          {/* Analytics section */}
          {currentStatus === 'published' && (
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

          {/* Logs View Section */}
          <div className="border-t border-slate-100 pt-4 space-y-2.5">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-slate-500" /> Activity &amp; Execution Logs
            </p>
            <div className="bg-slate-50 border border-slate-200/50 rounded-xl p-4 space-y-3.5 max-h-36 overflow-y-auto">
              {logs.map((log, index) => {
                const logFormattedTime = log.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                const isFailed = log.label.includes('Failed');
                const isSuccess = log.label.includes('Success');

                return (
                  <div key={index} className="flex gap-3 relative group text-left">
                    {index < logs.length - 1 && (
                      <div className="absolute left-[5px] top-[14px] bottom-[-20px] w-0.5 bg-slate-200" />
                    )}
                    <div className={`w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm mt-0.5 shrink-0 z-10 ${
                      isFailed ? 'bg-red-500 ring-2 ring-red-100' : isSuccess ? 'bg-green-500 ring-2 ring-green-100' : 'bg-slate-400 ring-2 ring-slate-100'
                    }`} />
                    <div className="space-y-0.5 flex-1 min-w-0">
                      <div className="flex justify-between items-baseline gap-2">
                        <p className={`text-[11px] font-bold truncate ${isFailed ? 'text-red-700' : isSuccess ? 'text-green-700' : 'text-slate-700'}`}>
                          {log.label}
                        </p>
                        <span className="text-[9px] font-bold text-slate-400 font-mono shrink-0">{logFormattedTime}</span>
                      </div>
                      <p className="text-[10px] text-slate-500 break-words leading-normal">
                        {log.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

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
