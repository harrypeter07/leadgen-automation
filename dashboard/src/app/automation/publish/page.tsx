'use client'

import React, { useState, useRef } from 'react'
import toast from 'react-hot-toast'
import { 
  Upload, 
  History, 
  Folder, 
  Cloud, 
  Search, 
  Sparkles, 
  Send, 
  Calendar, 
  Check, 
  AlertCircle, 
  Inbox,
  Image as ImageIcon,
  Music,
  MapPin,
  UserPlus,
  ChevronDown,
  ChevronUp
} from 'lucide-react'

interface PostJob {
  id: string
  content: string
  platforms: string[]
  imageUrl?: string
  scheduledFor?: string
  status: 'draft' | 'published' | 'scheduled' | 'failed'
  publishedAt?: string
  fbPostId?: string
  igPostId?: string
  logs?: string[]
}

const PLATFORMS = [
  { 
    id: 'facebook',  
    label: 'Facebook Page',  
    icon: (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
      </svg>
    ), 
    color: 'border-blue-200 text-blue-700 bg-blue-50/20 hover:bg-blue-50/50',  
    active: 'bg-blue-50 border-blue-600 text-blue-800 ring-2 ring-blue-600/10' 
  },
  { 
    id: 'instagram', 
    label: 'Instagram',       
    icon: (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
      </svg>
    ), 
    color: 'border-rose-200 text-rose-700 bg-rose-50/20 hover:bg-rose-50/50',  
    active: 'bg-rose-50 border-rose-600 text-rose-800 ring-2 ring-rose-600/10' 
  },
]

export default function PublishComposerPage() {
  const [content, setContent]                   = useState('')
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['facebook'])
  const [imageUrl, setImageUrl]                 = useState('')
  const [driveInput, setDriveInput]             = useState('')
  const [scheduledFor, setScheduledFor]         = useState('')
  const [generatingCaption, setGeneratingCaption] = useState(false)
  const [publishing, setPublishing]             = useState(false)
  const [uploading, setUploading]               = useState(false)
  const [jobs, setJobs]                         = useState<PostJob[]>([])
  const [activeTab, setActiveTab]               = useState<'compose' | 'history'>('compose')
  const [publishLog, setPublishLog]             = useState<string[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  
  // Cloudinary Integration States
  const [mediaMode, setMediaMode]               = useState<'supabase' | 'cloudinary'>('supabase')
  const [cloudinaryFolder, setCloudinaryFolder] = useState('')
  const [cloudinaryAssets, setCloudinaryAssets] = useState<Array<{ publicId: string; url: string }>>([])
  const [scanningFolder, setScanningFolder]     = useState(false)
  const cloudinaryFileRef = useRef<HTMLInputElement>(null)

  // Instagram Specific Options
  const [locationId, setLocationId] = useState('')
  const [userTags, setUserTags] = useState('')
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false)
  
  // Audio Search States
  const [songQuery, setSongQuery] = useState('')
  const [searchingSongs, setSearchingSongs] = useState(false)
  const [songs, setSongs] = useState<Array<{ id: string; title: string; artist: string; coverUrl?: string }>>([])
  const [selectedSong, setSelectedSong] = useState<{ id: string; title: string; artist: string; coverUrl?: string } | null>(null)

  // Song Search handler
  async function handleSearchSongs() {
    if (!songQuery.trim()) return
    setSearchingSongs(true)
    try {
      const res = await fetch(`/api/meta/instagram/audio/search?q=${encodeURIComponent(songQuery.trim())}`)
      const data = await res.json()
      if (res.ok && data.success) {
        setSongs(data.songs || [])
        if (data.songs.length === 0) {
          toast.error('No songs found matching query')
        }
      } else {
        toast.error(data.error || 'Failed to search songs')
      }
    } catch (err) {
      toast.error('Error searching songs')
    }
    setSearchingSongs(false)
  }

  function togglePlatform(p: string) {
    setSelectedPlatforms(prev =>
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
    )
  }

  React.useEffect(() => {
    const draft = localStorage.getItem('draft_post_caption')
    if (draft) {
      setContent(draft)
      localStorage.removeItem('draft_post_caption')
    }
  }, [])

  React.useEffect(() => {
    if (mediaMode === 'cloudinary') {
      handleScanCloudinaryFolder()
    }
  }, [mediaMode])

  async function handleGenerateAICaption() {
    setGeneratingCaption(true)
    const toastId = toast.loading('Generating AI caption…')
    try {
      const topic = content.trim() || 'business automation and lead generation'
      const res = await fetch('/api/meta/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Write a compelling, engaging social media caption about: ${topic}. Include 3-5 relevant hashtags at the end. Max 300 characters. Make it punchy and professional.`,
          persona: 'You are a professional social media copywriter. Write in an engaging, concise style that drives engagement and conversions.',
        }),
      })
      const data = await res.json()
      if (res.ok && data.reply) {
        setContent(prev => (prev ? prev + '\n\n' : '') + data.reply)
        toast.success('AI caption ready!', { id: toastId })
      } else {
        throw new Error(data.error || 'AI generation failed')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'AI failed', { id: toastId })
    }
    setGeneratingCaption(false)
  }

  async function handleMediaUpload(source: 'file' | 'drive' | 'cloudinary_file') {
    setUploading(true)
    const toastId = toast.loading(
      source === 'drive' ? 'Converting Drive link…' : 
      source === 'cloudinary_file' ? 'Uploading to Cloudinary…' : 'Uploading image…'
    )
    try {
      let res: Response
      if (source === 'drive') {
        if (!driveInput.trim()) { toast.error('Enter a Google Drive link first', { id: toastId }); setUploading(false); return }
        res = await fetch('/api/meta/media-upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ driveUrl: driveInput.trim() }),
        })
      } else if (source === 'cloudinary_file') {
        const file = cloudinaryFileRef.current?.files?.[0]
        if (!file) { toast.error('Select a file first', { id: toastId }); setUploading(false); return }
        const formData = new FormData()
        formData.append('file', file)
        res = await fetch('/api/meta/cloudinary', { method: 'POST', body: formData })
      } else {
        const file = fileRef.current?.files?.[0]
        if (!file) { toast.error('Select a file first', { id: toastId }); setUploading(false); return }
        const formData = new FormData()
        formData.append('file', file)
        res = await fetch('/api/meta/media-upload', { method: 'POST', body: formData })
      }
      const data = await res.json()
      if (res.ok && data.publicUrl) {
        setImageUrl(data.publicUrl)
        setDriveInput('')
        toast.success('Media uploaded! Public URL ready.', { id: toastId })
      } else {
        throw new Error(data.error || 'Upload failed')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed', { id: toastId })
    }
    setUploading(false)
  }

  async function handleScanCloudinaryFolder() {
    setScanningFolder(true)
    const toastId = toast.loading(`Scanning folder "${cloudinaryFolder || 'root'}"…`)
    try {
      const res = await fetch(`/api/meta/cloudinary?folder=${encodeURIComponent(cloudinaryFolder)}`)
      const data = await res.json()
      if (res.ok && data.success) {
        setCloudinaryAssets(data.assets || [])
        toast.success(`Found ${data.assets?.length || 0} assets!`, { id: toastId })
      } else {
        throw new Error(data.error || 'Scan failed')
      }
    } catch (err: any) {
      toast.error(err.message, { id: toastId })
    }
    setScanningFolder(false)
  }

  function addLog(msg: string) {
    setPublishLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`])
  }

  async function handlePublish(e: React.FormEvent) {
    e.preventDefault()
    if (selectedPlatforms.length === 0) { toast.error('Select at least one platform.'); return }
    if (!content.trim())                { toast.error('Post content cannot be empty.');  return }

    // If scheduled, queue both platforms via backend queue (QStash → n8n)
    if (scheduledFor) {
      setPublishing(true)
      setPublishLog([])
      const toastId = toast.loading('Scheduling post…')
      addLog('Scheduling post to queue…')

      let anySuccess = false
      let anyFail    = false

      for (const platform of selectedPlatforms) {
        if (platform === 'instagram' && !imageUrl) {
          addLog('Instagram: ❌ No image URL — upload an image first')
          toast.error('Instagram requires an image.')
          anyFail = true
          continue
        }
        try {
          addLog(`${platform}: Queuing scheduled post for ${new Date(scheduledFor).toLocaleString()}…`)
          const isVideo = imageUrl && (imageUrl.toLowerCase().includes('/video/upload/') || imageUrl.toLowerCase().match(/\.(mp4|webm|mov|avi|mkv|ogg)($|\?)/));
          const res = await fetch('/api/backend-v3/automation/workflows/publish/queue', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              platform,
              account_name: platform === 'instagram' ? 'Instagram Business' : 'Meta Page',
              content,
              media_url: imageUrl || null,
              scheduled_at: new Date(scheduledFor).toISOString(),
              audio_id: platform === 'instagram' && selectedSong?.id ? selectedSong.id : null,
              location_id: locationId || null,
              user_tags: userTags ? userTags.split(',').map(u => u.trim()).filter(Boolean) : null,
              media_type: platform === 'instagram' && isVideo ? 'reels' : 'image'
            }),
          })
          const data = await res.json()
          if (res.ok && data.success) {
            anySuccess = true
            addLog(`${platform}: ✅ Scheduled! Queue ID: ${data.post?.id || 'ok'} — Will publish at ${new Date(scheduledFor).toLocaleString()}`)
          } else {
            anyFail = true
            const errMsg = data.error || 'Failed to queue'
            addLog(`${platform}: ❌ Queue failed — ${errMsg}`)
            toast.error(`${platform}: ${errMsg}`)
          }
        } catch (err) {
          anyFail = true
          addLog(`${platform}: ❌ Network error — ${err}`)
          toast.error(`${platform} scheduling error`)
        }
      }

      const results: PostJob = {
        id:           String(Date.now()),
        content,
        platforms:    selectedPlatforms,
        imageUrl:     imageUrl || undefined,
        scheduledFor: scheduledFor,
        status:       anySuccess ? 'scheduled' : 'failed',
        logs:         publishLog,
      }
      setJobs(prev => [results, ...prev])
      setPublishing(false)

      if (anySuccess) {
        toast.success('Post scheduled! Will publish via n8n at the set time.', { id: toastId })
        setContent('')
        setImageUrl('')
        setScheduledFor('')
        setLocationId('')
        setUserTags('')
        setSelectedSong(null)
        setSongs([])
        setSongQuery('')
        setActiveTab('history')
      } else {
        toast.error('Scheduling failed. See log below.', { id: toastId })
      }
      return
    }

    // Immediate publish (no scheduledFor)
    setPublishing(true)
    setPublishLog([])
    const toastId = toast.loading('Publishing post…')
    addLog('Starting publish job…')

    const results: PostJob = {
      id:          String(Date.now()),
      content,
      platforms:   selectedPlatforms,
      imageUrl:    imageUrl || undefined,
      scheduledFor: scheduledFor || undefined,
      status:      'draft',
      logs:        [],
    }

    let anySuccess = false
    let anyFail    = false

    // Publish to Facebook
    if (selectedPlatforms.includes('facebook')) {
      addLog('Facebook: Sending post to Graph API…')
      try {
        const res  = await fetch('/api/meta/facebook/post', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            action:  'publish',
            message: content,
            ...(imageUrl ? { image_url: imageUrl } : {}),
          }),
        })
        const data = await res.json()
        if (res.ok && data.success && data.data?.id) {
          results.fbPostId = data.data.id
          anySuccess = true
          addLog(`Facebook: ✅ Published! Post ID: ${data.data.id}`)
        } else {
          anyFail = true
          const errMsg = data.error?.message || data.error || 'Failed'
          addLog(`Facebook: ❌ Failed — ${errMsg}`)
          toast.error(`Facebook: ${errMsg}`)
        }
      } catch (err) {
        anyFail = true
        addLog(`Facebook: ❌ Network error — ${err}`)
        toast.error('Facebook publish error')
      }
    }

    // Publish to Instagram (requires image URL for IG)
    if (selectedPlatforms.includes('instagram')) {
      if (!imageUrl) {
        addLog('Instagram: ❌ No image URL — upload an image first')
        toast.error('Instagram requires an image. Upload one using the media panel.')
        anyFail = true
      } else {
        addLog(`Instagram: Creating media container with image…`)
        try {
          const res  = await fetch('/api/meta/instagram/post', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ 
              image_url: imageUrl, 
              caption: content,
              audio_id: selectedSong?.id || undefined,
              location_id: locationId || undefined,
              user_tags: userTags ? userTags.split(',').map(u => u.trim()).filter(Boolean) : undefined
            }),
          })
          const data = await res.json()
          if (res.ok && data.success) {
            results.igPostId = data.data?.id
            anySuccess = true
            addLog(`Instagram: ✅ Published! Media ID: ${data.data?.id || 'ok'}`)
          } else {
            anyFail = true
            const errMsg = data.error?.message || data.error || 'Failed'
            addLog(`Instagram: ❌ Failed — ${errMsg}`)
            addLog(`Instagram: Hint — image URL must be publicly accessible (not Google Drive direct view)`)
            toast.error(`Instagram: ${errMsg}`)
          }
        } catch (err) {
          anyFail = true
          addLog(`Instagram: ❌ Network error — ${err}`)
          toast.error('Instagram publish error')
        }
      }
    }

    results.status = anySuccess ? (anyFail ? 'draft' : 'published') : 'failed'
    results.publishedAt = anySuccess ? new Date().toISOString() : undefined
    results.logs = publishLog

    setJobs(prev => [results, ...prev])
    setPublishing(false)

    if (anySuccess && !anyFail) {
      toast.success('Published successfully!', { id: toastId })
      addLog('Done — all platforms published.')
      setContent('')
      setImageUrl('')
      setScheduledFor('')
      setLocationId('')
      setUserTags('')
      setSelectedSong(null)
      setSongs([])
      setSongQuery('')
      setActiveTab('history')
    } else if (anyFail && !anySuccess) {
      toast.error('Publish failed. See log panel below.', { id: toastId })
      addLog('Done — all platforms failed.')
    } else {
      toast.success('Partially published.', { id: toastId })
      addLog('Done — some platforms failed.')
      setActiveTab('history')
    }
  }

  const charCount = content.length
  const charLimit = 63206 // FB char limit

  return (
    <div className="space-y-6 text-slate-800 select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 flex items-center gap-2">
            <Upload className="w-7 h-7 text-rose-600" /> Content Publisher
          </h1>
          <p className="mt-1 text-sm text-slate-500">Publish directly to Facebook Page and Instagram Business account via the Graph API.</p>
        </div>
        {/* Tab switcher */}
        <div className="flex gap-1 bg-slate-100 border border-slate-200 rounded-xl p-1">
          <button onClick={() => setActiveTab('compose')}  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'compose'  ? 'bg-white text-slate-800 border border-slate-200 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>Compose</button>
          <button onClick={() => setActiveTab('history')}  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'history'  ? 'bg-white text-slate-800 border border-slate-200 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>History {jobs.length > 0 ? `(${jobs.length})` : ''}</button>
        </div>
      </div>

      {activeTab === 'compose' && (
        <form onSubmit={handlePublish} className="grid gap-6 lg:grid-cols-12">
          {/* Column 1: Media Library Browser Panel (Wider Layout: col-span-4) */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 space-y-4 lg:col-span-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Folder className="w-4 h-4 text-rose-600" /> Media Library
              </h3>
              <div className="flex gap-1 bg-slate-100 border border-slate-200 rounded-lg p-0.5">
                <button type="button" onClick={() => setMediaMode('supabase')}
                  className={`px-2 py-1 rounded text-[8px] font-bold uppercase transition-all ${mediaMode === 'supabase' ? 'bg-white text-slate-800 border border-slate-150 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}>
                  Drive
                </button>
                <button type="button" onClick={() => setMediaMode('cloudinary')}
                  className={`px-2 py-1 rounded text-[8px] font-bold uppercase transition-all ${mediaMode === 'cloudinary' ? 'bg-white text-slate-800 border border-slate-150 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}>
                  Cloudinary
                </button>
              </div>
            </div>

            {mediaMode === 'supabase' ? (
              <div className="space-y-3">
                <div className="space-y-2">
                  <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={() => handleMediaUpload('file')} />
                  <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-100 transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5">
                    <Upload className="w-3.5 h-3.5" /> {uploading ? 'Uploading…' : 'Upload Local File'}
                  </button>
                  <div className="text-center text-[10px] text-slate-400 font-bold uppercase">or</div>
                  <input
                    value={driveInput}
                    onChange={e => setDriveInput(e.target.value)}
                    placeholder="Google Drive share link…"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-rose-500 transition-colors"
                  />
                  <button type="button" onClick={() => handleMediaUpload('drive')} disabled={uploading || !driveInput.trim()}
                    className="w-full px-3 py-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs font-bold hover:bg-rose-100/50 transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5">
                    <Cloud className="w-3.5 h-3.5" /> Upload Drive Link
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input ref={cloudinaryFileRef} type="file" accept="image/*,video/*" className="hidden" onChange={() => handleMediaUpload('cloudinary_file')} />
                  <button type="button" onClick={() => cloudinaryFileRef.current?.click()} disabled={uploading}
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-100 transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5">
                    <Upload className="w-3 h-3" /> {uploading ? '⏳' : 'Upload'}
                  </button>
                  <button type="button" onClick={handleScanCloudinaryFolder} disabled={scanningFolder}
                    className="px-3 py-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs font-bold hover:bg-rose-100/50 transition-colors flex items-center justify-center gap-1.5">
                    <Search className="w-3 h-3" /> {scanningFolder ? '⏳' : 'Scan'}
                  </button>
                </div>
                <input
                  value={cloudinaryFolder}
                  onChange={e => setCloudinaryFolder(e.target.value)}
                  placeholder="Cloudinary folder path…"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-rose-500 transition-colors"
                />

                {/* Scanned assets grid */}
                {cloudinaryAssets.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto p-2 bg-slate-50 border border-slate-200 rounded-xl">
                    {cloudinaryAssets.map(asset => (
                      <button
                        key={asset.publicId}
                        type="button"
                        onClick={() => setImageUrl(asset.url)}
                        className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                          imageUrl === asset.url ? 'border-rose-600 shadow-sm' : 'border-transparent hover:border-slate-300'
                        }`}
                      >
                        <img src={asset.url} alt="asset" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="py-10 text-center text-[10px] text-slate-400 font-bold uppercase border border-dashed border-slate-200 rounded-xl">
                    No Cloudinary assets
                  </div>
                )}
              </div>
            )}

            {/* Current URL preview inside Media Library column */}
            {imageUrl && (
              <div className="border-t border-slate-150 pt-3 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Attached Asset:</span>
                  <button type="button" onClick={() => setImageUrl('')} className="text-slate-400 hover:text-rose-600 text-[10px] font-bold transition-colors">Remove</button>
                </div>
                <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                  <img src={imageUrl} alt="selected" className="w-full max-h-32 object-cover" onError={e => (e.currentTarget.style.display = 'none')} />
                </div>
              </div>
            )}
          </div>

          {/* Column 2 & 3: Composer (Post Form) (Wider Layout: col-span-5) */}
          <div className="lg:col-span-5 bg-white border border-slate-200 shadow-sm p-5 rounded-2xl space-y-4">
            {/* Platform selector */}
            <div>
              <label className="text-[10px] font-bold text-slate-450 uppercase tracking-widest block mb-2">Publish To</label>
              <div className="flex gap-3">
                {PLATFORMS.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => togglePlatform(p.id)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-bold transition-all ${selectedPlatforms.includes(p.id) ? p.active : `bg-slate-50 border-slate-200 ${p.color}`}`}
                  >
                    <span>{p.icon}</span>{p.label}
                    {selectedPlatforms.includes(p.id) && <Check className="ml-1 w-3.5 h-3.5 text-green-600" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Caption textarea */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[10px] font-bold text-slate-455 uppercase tracking-widest">Post Caption</label>
                <span className={`text-[10px] font-mono ${charCount > charLimit * 0.9 ? 'text-rose-500 font-bold' : 'text-slate-455'}`}>{charCount} / {charLimit.toLocaleString()}</span>
              </div>
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="Write your post caption here… or use AI to generate one."
                rows={4}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-rose-500 transition-colors resize-none leading-relaxed"
              />
            </div>

            {/* Instagram Specific Advanced Options Accordion */}
            {selectedPlatforms.includes('instagram') && (
              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/50">
                <button
                  type="button"
                  onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                  className="w-full flex justify-between items-center px-4 py-3 bg-slate-50 border-b border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-700 hover:bg-slate-100 transition-all"
                >
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-rose-600" /> Instagram Advanced Settings
                  </span>
                  {showAdvancedOptions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {showAdvancedOptions && (
                  <div className="p-4 space-y-4 bg-white">
                    {/* Location Tag */}
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-500" /> Location ID
                      </label>
                      <input
                        value={locationId}
                        onChange={e => setLocationId(e.target.value)}
                        placeholder="E.g., 103095316393962 (Meta Location Page ID)"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-rose-500 transition-all font-mono"
                      />
                    </div>

                    {/* User Tags */}
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                        <UserPlus className="w-3.5 h-3.5 text-slate-500" /> User Tags (Comma-separated)
                      </label>
                      <input
                        value={userTags}
                        onChange={e => setUserTags(e.target.value)}
                        placeholder="E.g., stratnent, kashii.singh"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-rose-500 transition-all font-mono"
                      />
                    </div>

                    {/* Song Search / Add Audio */}
                    <div className="space-y-2">
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                        <Music className="w-3.5 h-3.5 text-slate-500" /> Background Music / Audio
                      </label>
                      
                      <div className="flex gap-2">
                        <input
                          value={songQuery}
                          onChange={e => setSongQuery(e.target.value)}
                          placeholder="Search songs, artists, genres..."
                          className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-rose-500 transition-all"
                        />
                        <button
                          type="button"
                          onClick={handleSearchSongs}
                          disabled={searchingSongs || !songQuery.trim()}
                          className="px-3.5 py-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs font-bold hover:bg-rose-100/50 disabled:opacity-40 transition-all"
                        >
                          {searchingSongs ? 'Searching...' : 'Search'}
                        </button>
                      </div>

                      {/* Selected Song Indicator */}
                      {selectedSong && (
                        <div className="flex items-center justify-between p-2.5 bg-green-50/50 border border-green-200 rounded-xl">
                          <div className="flex items-center gap-2">
                            {selectedSong.coverUrl ? (
                              <img src={selectedSong.coverUrl} alt="Cover" className="w-8 h-8 rounded object-cover border border-green-200" />
                            ) : (
                              <div className="w-8 h-8 rounded bg-green-100 border border-green-200 flex items-center justify-center"><Music className="w-4 h-4 text-green-600" /></div>
                            )}
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-800 truncate">{selectedSong.title}</p>
                              <p className="text-[10px] text-slate-500 truncate">{selectedSong.artist}</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectedSong(null)}
                            className="text-[9px] font-black uppercase text-rose-600 hover:text-rose-700 transition-colors"
                          >
                            Remove
                          </button>
                        </div>
                      )}

                      {/* Search Results list */}
                      {songs.length > 0 && (
                        <div className="border border-slate-200 rounded-xl bg-slate-50 p-2 max-h-36 overflow-y-auto space-y-1">
                          {songs.map(song => (
                            <button
                              key={song.id}
                              type="button"
                              onClick={() => {
                                setSelectedSong(song)
                                setSongs([])
                                setSongQuery('')
                              }}
                              className="w-full text-left flex items-center justify-between p-2 hover:bg-white rounded-lg transition-all border border-transparent hover:border-slate-200 group"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                {song.coverUrl ? (
                                  <img src={song.coverUrl} alt="Cover" className="w-8 h-8 rounded object-cover border border-slate-200" />
                                ) : (
                                  <div className="w-8 h-8 rounded bg-slate-200 flex items-center justify-center"><Music className="w-4 h-4 text-slate-500" /></div>
                                )}
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-slate-800 truncate group-hover:text-rose-600">{song.title}</p>
                                  <p className="text-[10px] text-slate-500 truncate">{song.artist}</p>
                                </div>
                              </div>
                              <span className="text-[9px] font-bold text-rose-600 bg-rose-50 border border-rose-100 rounded px-1.5 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-wider">Select</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Schedule */}
            <div>
              <label className="text-[10px] font-bold text-slate-455 uppercase tracking-widest block mb-2">Schedule (optional)</label>
              <input
                type="datetime-local"
                value={scheduledFor}
                onChange={e => setScheduledFor(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-rose-500 transition-colors"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button type="button" onClick={handleGenerateAICaption} disabled={generatingCaption}
                className="px-4 py-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs font-bold hover:bg-rose-100/50 transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5">
                {generatingCaption ? 'Generating…' : <span className="flex items-center gap-1"><Sparkles className="w-3.5 h-3.5" /> AI Caption</span>}
              </button>
              <button type="submit" disabled={publishing || !content.trim() || selectedPlatforms.length === 0}
                className="flex-1 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-rose-600/10 flex items-center justify-center gap-1.5">
                {publishing ? 'Publishing…' : scheduledFor ? <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Schedule Post</span> : <span className="flex items-center gap-1.5"><Send className="w-3.5 h-3.5" /> Publish Now</span>}
              </button>
            </div>

            {/* Publish Log */}
            {publishLog.length > 0 && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-1 max-h-40 overflow-y-auto">
                <div className="text-[9px] font-bold text-slate-450 uppercase tracking-widest mb-1">Publish Log</div>
                {publishLog.map((line, i) => (
                  <div key={i} className={`text-[10px] font-mono ${
                    line.includes('✅') || line.includes('Success') ? 'text-green-600 font-bold' : line.includes('❌') || line.includes('Error') ? 'text-rose-600 font-bold' : 'text-slate-500'
                  }`}>{line}</div>
                ))}
              </div>
            )}
          </div>

          {/* Column 4: Live Preview & Requirements Panel (Wider Layout: col-span-3) */}
          <div className="lg:col-span-3 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 space-y-3">
              <h3 className="text-[10px] font-bold text-slate-450 uppercase tracking-widest">Preview</h3>
              {content ? (
                <div className="space-y-2">
                  <div className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">{content}</div>
                  {imageUrl && (
                    <div className="text-[10px] font-mono text-rose-500 truncate flex items-center gap-1">
                      <ImageIcon className="w-3.5 h-3.5 text-rose-500" /> {imageUrl}
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-24 flex items-center justify-center text-slate-400 text-xs">Preview will appear here…</div>
              )}
              <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-150">
                {selectedPlatforms.map(p => {
                  const pl = PLATFORMS.find(x => x.id === p)
                  return (
                    <span key={p} className="text-[10px] font-bold bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full text-slate-600 flex items-center gap-1">
                      {pl?.icon} {pl?.label}
                    </span>
                  )
                })}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 space-y-2">
              <h3 className="text-[10px] font-bold text-slate-450 uppercase tracking-widest">Requirements</h3>
              <div className="space-y-1.5 text-[11px]">
                {[
                  { label: 'Facebook: Page Access Token', ok: true },
                  { label: 'Instagram: Business Account', ok: true },
                  { label: 'Instagram: Image URL required', ok: !selectedPlatforms.includes('instagram') || !!imageUrl },
                  { label: 'Caption not empty',            ok: content.trim().length > 0 },
                ].map(r => (
                  <div key={r.label} className={`flex items-center gap-2 ${r.ok ? 'text-green-600 font-semibold' : 'text-rose-500 font-bold'}`}>
                    {r.ok ? <Check className="w-3.5 h-3.5 text-green-650" /> : <AlertCircle className="w-3.5 h-3.5 text-rose-500" />}
                    <span>{r.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </form>
      )}

      {activeTab === 'history' && (
        <div className="space-y-3">
          {jobs.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-12 text-center text-slate-400">
              <Inbox className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">No posts published yet this session</div>
            </div>
          ) : (
            jobs.map(job => (
              <div key={job.id} className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-xs text-slate-700 leading-relaxed line-clamp-2">{job.content}</p>
                  <span className={`flex-shrink-0 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                    job.status === 'published' ? 'bg-green-50 border-green-200 text-green-700' :
                    job.status === 'failed'    ? 'bg-rose-50 border-rose-200 text-rose-750' :
                    job.status === 'scheduled' ? 'bg-blue-50 border-blue-200 text-blue-700' :
                    'bg-slate-50 border-slate-200 text-slate-600'
                  }`}>{job.status}</span>
                </div>
                <div className="flex flex-wrap gap-2 text-[10px] text-slate-400 font-mono">
                  {job.platforms.map(p => <span key={p} className="flex items-center gap-1">{PLATFORMS.find(x => x.id === p)?.icon} {p}</span>)}
                  {job.fbPostId && <span>FB: {job.fbPostId}</span>}
                  {job.igPostId && <span>IG: {job.igPostId}</span>}
                  {job.publishedAt && <span>at {new Date(job.publishedAt).toLocaleTimeString()}</span>}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
