'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import toast from 'react-hot-toast'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { GeminiKeyModal } from '@/components/gemini-key-modal'
import {
  Calendar as CalendarIcon,
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
  Plus,
  Folder,
  Image as ImageIcon,
  Sparkles
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
  const [filter, setFilter] = useState<'all' | 'instagram' | 'facebook'>('all')
  const [viewMode, setViewMode] = useState<'calendar' | 'feed'>('calendar')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedPost, setSelectedPost] = useState<CalendarPost | null>(null)
  const [geminiModalOpen, setGeminiModalOpen] = useState(false)

  // Reschedule & Action modal states
  const [rescheduleDate, setRescheduleDate] = useState('')
  const [isRescheduling, setIsRescheduling] = useState(false)
  const [publishingNow, setPublishingNow] = useState(false)

  // Storage & Content Cell state
  const [storageSource, setStorageSource] = useState<'cloudinary' | 'supabase'>('cloudinary')
  const [cloudinaryAssets, setCloudinaryAssets] = useState<CloudinaryAsset[]>([])
  const [loadingCloudinary, setLoadingCloudinary] = useState(false)
  const [uploadingMedia, setUploadingMedia] = useState(false)
  const [draggedMediaUrl, setDraggedMediaUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchPosts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/meta/posts')
      const data = await res.json()
      if (res.ok && data.posts) {
        setPosts(data.posts)
      }
    } catch (err) {
      console.error('Failed to load posts:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchCloudinaryAssets = useCallback(async () => {
    setLoadingCloudinary(true)
    try {
      const res = await fetch('/api/meta/cloudinary?action=list')
      const data = await res.json()
      if (res.ok && data.assets) {
        setCloudinaryAssets(data.assets)
      }
    } catch (err) {
      console.error('Failed to load Cloudinary media:', err)
    } finally {
      setLoadingCloudinary(false)
    }
  }, [])

  useEffect(() => { 
    fetchPosts() 
    fetchCloudinaryAssets()
  }, [fetchPosts, fetchCloudinaryAssets])

  // Handle direct upload to Cloudinary or Supabase Storage
  const handleFileUpload = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return
    const file = files[0]
    setUploadingMedia(true)
    const toastId = toast.loading(`Uploading ${file.name} to ${storageSource === 'cloudinary' ? 'Cloudinary' : 'Supabase Storage'}...`)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const endpoint = storageSource === 'cloudinary' ? '/api/meta/cloudinary' : '/api/meta/media-upload'
      const res = await fetch(endpoint, { method: 'POST', body: formData })
      const data = await res.json()

      if (res.ok && data.publicUrl) {
        toast.success(`Uploaded to ${storageSource === 'cloudinary' ? 'Cloudinary' : 'Supabase Storage'}!`, { id: toastId })
        setCloudinaryAssets(prev => [{ publicId: data.publicId || data.fileName, url: data.publicUrl }, ...prev])
      } else {
        throw new Error(data.error || 'Upload failed')
      }
    } catch (err: any) {
      toast.error(err.message, { id: toastId })
    } finally {
      setUploadingMedia(false)
    }
  }

  // Drag-and-Drop onto Calendar Day Handler
  const handleDropOnDay = (e: React.DragEvent, dayNum: number) => {
    e.preventDefault()
    const mediaUrl = e.dataTransfer.getData('text/plain') || draggedMediaUrl
    if (!mediaUrl) return

    const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
    toast.success(`Selected media for ${dayStr}! Opening publisher...`)
    window.location.href = `/automation/publish?mediaUrl=${encodeURIComponent(mediaUrl)}&scheduledDate=${encodeURIComponent(dayStr)}`
  }

  // Handle Publish Now retry
  const handlePublishNow = async (post: CalendarPost) => {
    setPublishingNow(true)
    const toastId = toast.loading(`Publishing post to ${post.platform}...`)
    try {
      const endpoint = post.platform === 'instagram' 
        ? '/api/meta/instagram/post' 
        : '/api/meta/facebook/posts'
      
      const payload = post.platform === 'instagram'
        ? { image_url: post.imageUrl, caption: post.title }
        : { message: post.title, link: post.imageUrl }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(`Published post live to ${post.platform}!`, { id: toastId })
        fetchPosts()
        setSelectedPost(null)
      } else {
        throw new Error(data.error?.message || data.error || 'Failed to publish')
      }
    } catch (err: any) {
      toast.error(err.message, { id: toastId })
    } finally {
      setPublishingNow(false)
    }
  }

  // Handle Reschedule Post
  const handleReschedule = async () => {
    if (!selectedPost || !rescheduleDate) return
    setIsRescheduling(true)
    const toastId = toast.loading('Rescheduling post execution...')
    try {
      const res = await fetch(`/api/meta/posts/${selectedPost.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduled_at: rescheduleDate })
      })
      if (res.ok) {
        toast.success('Post rescheduled successfully!', { id: toastId })
        fetchPosts()
        setSelectedPost(null)
      } else {
        throw new Error('Reschedule failed')
      }
    } catch (err: any) {
      toast.error(err.message, { id: toastId })
    } finally {
      setIsRescheduling(false)
    }
  }

  const filteredPosts = filter === 'all' ? posts : posts.filter(p => p.platform === filter)

  // Monthly Calendar Math
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const firstDayOfMonth = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const days = []
  for (let i = 0; i < firstDayOfMonth; i++) days.push(null)
  for (let d = 1; d <= daysInMonth; d++) days.push(d)

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

  return (
    <div className="space-y-6">
      {/* Reusable Gemini Key Modal */}
      <GeminiKeyModal open={geminiModalOpen} onOpenChange={setGeminiModalOpen} />

      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*,video/*"
        className="hidden"
        onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
      />

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl border border-border bg-card">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
            <CalendarIcon className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">Interactive Content Calendar & Publisher</h1>
            <p className="text-xs text-muted-foreground">Schedule, track live post countdowns, inspect insights, and manage Cloudinary & Supabase media cell.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Inline Gemini Key button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setGeminiModalOpen(true)}
            className="gap-1.5 border-blue-500/30 text-blue-400 bg-blue-500/10 hover:bg-blue-500/20"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Set Gemini Key</span>
          </Button>

          <Button variant="outline" size="sm" onClick={fetchPosts} className="gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </Button>

          <Button size="sm" asChild className="gap-1.5">
            <a href="/automation/publish">
              <Plus className="w-3.5 h-3.5" />
              <span>Compose Post</span>
            </a>
          </Button>
        </div>
      </div>

      {/* Main Side-by-Side Layout: Calendar Grid + Content Cell Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left 3 Columns: Main Calendar / Feed Grid */}
        <div className="lg:col-span-3 space-y-6">
          <Card>
            <CardHeader className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => setCurrentDate(new Date(year, month - 1, 1))}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm font-semibold text-foreground min-w-[140px] text-center">
                    {monthNames[month]} {year}
                  </span>
                  <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => setCurrentDate(new Date(year, month + 1, 1))}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* View switcher tabs */}
                <div className="flex gap-1 bg-muted p-1 rounded-lg text-xs">
                  <button
                    onClick={() => setViewMode('calendar')}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${viewMode === 'calendar' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground'}`}
                  >
                    Calendar Grid
                  </button>
                  <button
                    onClick={() => setViewMode('feed')}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${viewMode === 'feed' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground'}`}
                  >
                    Feed Cards
                  </button>
                </div>

                {/* Platform Filter */}
                <div className="flex gap-1 bg-muted p-1 rounded-lg text-xs">
                  <button
                    onClick={() => setFilter('all')}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${filter === 'all' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground'}`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setFilter('instagram')}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${filter === 'instagram' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground'}`}
                  >
                    IG
                  </button>
                  <button
                    onClick={() => setFilter('facebook')}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${filter === 'facebook' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground'}`}
                  >
                    FB
                  </button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-4">
              {viewMode === 'calendar' ? (
                /* Interactive Monthly Calendar Grid with Drag Drop Receiver */
                <div className="space-y-2">
                  <div className="grid grid-cols-7 gap-1 text-center font-semibold text-xs text-muted-foreground mb-2">
                    <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
                  </div>
                  <div className="grid grid-cols-7 gap-2">
                    {days.map((dayNum, idx) => {
                      if (!dayNum) return <div key={`empty-${idx}`} className="h-28 rounded-lg bg-muted/20 border border-border/40" />
                      
                      const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
                      const dayPosts = filteredPosts.filter(p => p.time.startsWith(dayStr))

                      return (
                        <div
                          key={dayNum}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => handleDropOnDay(e, dayNum)}
                          className="h-28 p-2 rounded-lg border border-border bg-card flex flex-col justify-between hover:border-primary/50 transition-colors group relative"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-foreground">{dayNum}</span>
                            {dayPosts.length > 0 && (
                              <Badge variant="secondary" className="text-[9px] px-1.5 py-0">{dayPosts.length}</Badge>
                            )}
                          </div>

                          <div className="space-y-1 overflow-y-auto max-h-16">
                            {dayPosts.map(p => (
                              <div
                                key={p.id}
                                onClick={() => setSelectedPost(p)}
                                className={`p-1.5 rounded text-[10px] truncate cursor-pointer font-medium border ${
                                  p.platform === 'instagram'
                                    ? 'bg-pink-500/10 text-pink-400 border-pink-500/20'
                                    : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                }`}
                              >
                                {p.title}
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                /* Feed List View */
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredPosts.map(post => (
                    <div
                      key={post.id}
                      onClick={() => setSelectedPost(post)}
                      className="rounded-xl border border-border bg-card p-4 space-y-3 flex flex-col justify-between hover:border-primary/50 cursor-pointer transition-colors"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className={`text-[10px] capitalize ${post.platform === 'instagram' ? 'text-pink-400 border-pink-500/30' : 'text-blue-400 border-blue-500/30'}`}>
                            {post.platform}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {post.time}
                          </span>
                        </div>
                        {post.imageUrl && (
                          <img src={post.imageUrl} alt={post.title} className="w-full h-36 object-cover rounded-lg border border-border" />
                        )}
                        <p className="text-xs text-foreground font-medium line-clamp-2">{post.title}</p>
                      </div>

                      <div className="pt-2 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5 text-rose-400" /> {post.likes || 0}</span>
                          <span className="flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5 text-blue-400" /> {post.comments || 0}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right 1 Column: Content Cell & Storage Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="border-border">
            <CardHeader className="p-4 border-b border-border space-y-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-semibold flex items-center gap-2">
                  <Folder className="w-4 h-4 text-primary" />
                  <span>Content Cell Media</span>
                </CardTitle>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={fetchCloudinaryAssets}>
                  <RefreshCw className="w-3.5 h-3.5" />
                </Button>
              </div>

              {/* Storage Provider Tabs */}
              <div className="flex gap-1 bg-muted p-1 rounded-lg text-xs">
                <button
                  onClick={() => setStorageSource('cloudinary')}
                  className={`flex-1 py-1 rounded-md text-[11px] font-medium transition-colors ${storageSource === 'cloudinary' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground'}`}
                >
                  Cloudinary
                </button>
                <button
                  onClick={() => setStorageSource('supabase')}
                  className={`flex-1 py-1 rounded-md text-[11px] font-medium transition-colors ${storageSource === 'supabase' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground'}`}
                >
                  Supabase
                </button>
              </div>
            </CardHeader>

            <CardContent className="p-4 space-y-4">
              {/* Drag & Drop Upload Zone */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    handleFileUpload(e.dataTransfer.files)
                  }
                }}
                onClick={() => fileInputRef.current?.click()}
                className="p-4 rounded-xl border-2 border-dashed border-border hover:border-primary/50 bg-muted/20 hover:bg-muted/40 cursor-pointer text-center transition-all space-y-2 group"
              >
                {uploadingMedia ? (
                  <div className="flex flex-col items-center justify-center py-2 space-y-2 text-primary">
                    <RefreshCw className="w-6 h-6 animate-spin" />
                    <span className="text-xs font-medium">Uploading to {storageSource}...</span>
                  </div>
                ) : (
                  <>
                    <div className="w-8 h-8 mx-auto rounded-full bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                      <ImageIcon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-foreground">Drag & drop files here</p>
                      <p className="text-[10px] text-muted-foreground">or click to browse from device</p>
                    </div>
                    <Badge variant="outline" className="text-[9px]">
                      Uploads to {storageSource === 'cloudinary' ? 'Cloudinary CDN' : 'Supabase Storage'}
                    </Badge>
                  </>
                )}
              </div>

              {/* Helper instruction */}
              <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-[11px] text-blue-400 flex items-start gap-2">
                <Sparkles className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>Drag any media thumbnail from below onto a calendar day on the left to schedule!</span>
              </div>

              {/* Media Thumbnails Grid */}
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                {loadingCloudinary ? (
                  <div className="grid grid-cols-2 gap-2">
                    {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />)}
                  </div>
                ) : cloudinaryAssets.length === 0 ? (
                  <div className="text-center py-8 text-xs text-muted-foreground">
                    No files uploaded yet. Drag & drop above to add media!
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {cloudinaryAssets.map((asset) => (
                      <div
                        key={asset.publicId}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', asset.url)
                          setDraggedMediaUrl(asset.url)
                        }}
                        className="rounded-lg border border-border overflow-hidden bg-card group relative cursor-grab active:cursor-grabbing hover:border-primary/50 transition-all"
                      >
                        {isVideoUrl(asset.url) ? (
                          <video src={asset.url} className="w-full h-24 object-cover" />
                        ) : (
                          <img src={asset.url} alt={asset.publicId} className="w-full h-24 object-cover" />
                        )}

                        <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-1.5 p-1 transition-opacity">
                          <button
                            onClick={() => { navigator.clipboard.writeText(asset.url); toast.success('Media URL copied!') }}
                            className="w-full py-1 rounded bg-primary/80 hover:bg-primary text-primary-foreground text-[10px] font-semibold flex items-center justify-center gap-1"
                          >
                            Copy URL
                          </button>
                          <a
                            href={`/automation/publish?mediaUrl=${encodeURIComponent(asset.url)}`}
                            className="w-full py-1 rounded bg-secondary hover:bg-secondary/80 text-foreground text-[10px] font-semibold text-center"
                          >
                            Compose Post
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Post Detail & Analytics Modal */}
      {selectedPost && (
        <Dialog open={!!selectedPost} onOpenChange={() => setSelectedPost(null)}>
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={`capitalize ${selectedPost.platform === 'instagram' ? 'text-pink-400' : 'text-blue-400'}`}>
                {selectedPost.platform}
              </Badge>
              <DialogTitle className="text-sm font-semibold">{selectedPost.title}</DialogTitle>
            </div>
            <DialogDescription>Scheduled for {selectedPost.time}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {selectedPost.imageUrl && (
              <img src={selectedPost.imageUrl} alt="post" className="w-full max-h-48 object-cover rounded-lg border border-border" />
            )}

            {/* Analytics Stats */}
            <div className="grid grid-cols-3 gap-2 p-3 rounded-lg border border-border bg-muted/20 text-center">
              <div>
                <p className="text-xs text-muted-foreground">Likes</p>
                <p className="text-base font-bold text-rose-400">{selectedPost.likes || 0}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Comments</p>
                <p className="text-base font-bold text-blue-400">{selectedPost.comments || 0}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Shares</p>
                <p className="text-base font-bold text-emerald-400">{selectedPost.shares || 0}</p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={publishingNow}
                onClick={() => handlePublishNow(selectedPost)}
                className="flex-1 gap-1 text-xs"
              >
                <Send className="w-3.5 h-3.5" /> Retry Publish Now
              </Button>
              {selectedPost.permalink && (
                <Button variant="secondary" size="sm" asChild className="flex-1 gap-1 text-xs">
                  <a href={selectedPost.permalink} target="_blank" rel="noreferrer">
                    <ExternalLink className="w-3.5 h-3.5" /> View Post
                  </a>
                </Button>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedPost(null)}>Close</Button>
          </DialogFooter>
        </Dialog>
      )}
    </div>
  )
}
