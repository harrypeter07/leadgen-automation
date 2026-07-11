'use client'

import React, { useState, useRef } from 'react'
import toast from 'react-hot-toast'

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
  { id: 'facebook',  label: 'Facebook Page',  icon: '📘', color: 'border-blue-700/40 text-blue-400',  active: 'bg-blue-950/40 border-blue-700/50' },
  { id: 'instagram', label: 'Instagram',       icon: '📸', color: 'border-pink-700/40 text-pink-400',  active: 'bg-pink-950/40 border-pink-700/50' },
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
            ...(scheduledFor ? { scheduled_time: Math.floor(new Date(scheduledFor).getTime() / 1000) } : {}),
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
            body:    JSON.stringify({ image_url: imageUrl, caption: content }),
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
    <div className="space-y-6 text-white select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight">📤 Content Publisher</h1>
          <p className="mt-1 text-sm text-gray-500">Publish directly to Facebook Page and Instagram Business account via the Graph API.</p>
        </div>
        {/* Tab switcher */}
        <div className="flex gap-1 bg-[#141416] border border-[#2D2D30] rounded-xl p-1">
          <button onClick={() => setActiveTab('compose')}  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors ${activeTab === 'compose'  ? 'bg-[#222225] text-white' : 'text-gray-500 hover:text-white'}`}>✏️ Compose</button>
          <button onClick={() => setActiveTab('history')}  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors ${activeTab === 'history'  ? 'bg-[#222225] text-white' : 'text-gray-500 hover:text-white'}`}>📋 History {jobs.length > 0 ? `(${jobs.length})` : ''}</button>
        </div>
      </div>

      {activeTab === 'compose' && (
        <form onSubmit={handlePublish} className="grid gap-6 lg:grid-cols-4">
          {/* Column 1: Media Library Browser Panel */}
          <div className="rounded-2xl border border-[#2D2D30] bg-[#141416] p-4 space-y-4">
            <div className="flex justify-between items-center border-b border-[#2D2D30] pb-2">
              <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider">📁 Media Library</h3>
              <div className="flex gap-1 bg-[#1A1A1C] border border-[#2D2D30] rounded-lg p-0.5">
                <button type="button" onClick={() => setMediaMode('supabase')}
                  className={`px-2 py-1 rounded text-[8px] font-bold uppercase transition-colors ${mediaMode === 'supabase' ? 'bg-[#2D2D30] text-white' : 'text-gray-500 hover:text-white'}`}>
                  Drive
                </button>
                <button type="button" onClick={() => setMediaMode('cloudinary')}
                  className={`px-2 py-1 rounded text-[8px] font-bold uppercase transition-colors ${mediaMode === 'cloudinary' ? 'bg-[#2D2D30] text-white' : 'text-gray-500 hover:text-white'}`}>
                  Cloudinary
                </button>
              </div>
            </div>

            {mediaMode === 'supabase' ? (
              <div className="space-y-3">
                <div className="space-y-2">
                  <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={() => handleMediaUpload('file')} />
                  <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                    className="w-full px-3 py-2 rounded-xl bg-[#1C1C1F] border border-[#2D2D30] text-gray-300 text-xs font-bold hover:text-white transition-colors disabled:opacity-40 text-center">
                    {uploading ? '⏳ Uploading…' : '📁 Upload Local File'}
                  </button>
                  <div className="text-center text-[10px] text-gray-600 font-bold uppercase">or</div>
                  <input
                    value={driveInput}
                    onChange={e => setDriveInput(e.target.value)}
                    placeholder="Google Drive share link…"
                    className="w-full bg-[#1C1C1F] border border-[#2D2D30] rounded-xl px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none"
                  />
                  <button type="button" onClick={() => handleMediaUpload('drive')} disabled={uploading || !driveInput.trim()}
                    className="w-full px-3 py-2 rounded-xl bg-blue-950/40 border border-blue-900/30 text-blue-300 text-xs font-bold hover:bg-blue-900/30 transition-colors disabled:opacity-40">
                    ☁️ Upload Drive Link
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input ref={cloudinaryFileRef} type="file" accept="image/*,video/*" className="hidden" onChange={() => handleMediaUpload('cloudinary_file')} />
                  <button type="button" onClick={() => cloudinaryFileRef.current?.click()} disabled={uploading}
                    className="flex-1 px-3 py-2 rounded-xl bg-[#1C1C1F] border border-[#2D2D30] text-gray-400 text-xs font-bold hover:text-white hover:border-gray-500 transition-colors disabled:opacity-40 text-center">
                    {uploading ? '⏳' : '📤 Upload'}
                  </button>
                  <button type="button" onClick={handleScanCloudinaryFolder} disabled={scanningFolder}
                    className="px-3 py-2 rounded-xl bg-purple-950/40 border border-purple-900/30 text-purple-300 text-xs font-bold hover:bg-purple-900/30 transition-colors">
                    {scanningFolder ? '⏳' : '🔍 Scan'}
                  </button>
                </div>
                <input
                  value={cloudinaryFolder}
                  onChange={e => setCloudinaryFolder(e.target.value)}
                  placeholder="Cloudinary folder path…"
                  className="w-full bg-[#1C1C1F] border border-[#2D2D30] rounded-xl px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none"
                />

                {/* Scanned assets grid */}
                {cloudinaryAssets.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto p-2 bg-[#0E0E10] border border-[#2D2D30] rounded-xl">
                    {cloudinaryAssets.map(asset => (
                      <button
                        key={asset.publicId}
                        type="button"
                        onClick={() => setImageUrl(asset.url)}
                        className={`relative aspect-square rounded-lg overflow-hidden border-2 ${
                          imageUrl === asset.url ? 'border-[#E3B859]' : 'border-transparent'
                        }`}
                      >
                        <img src={asset.url} alt="asset" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="py-10 text-center text-[10px] text-gray-650 uppercase border border-dashed border-[#2D2D30] rounded-xl">
                    No Cloudinary assets
                  </div>
                )}
              </div>
            )}

            {/* Current URL preview inside Media Library column */}
            {imageUrl && (
              <div className="border-t border-[#2D2D30] pt-3 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">Attached Asset:</span>
                  <button type="button" onClick={() => setImageUrl('')} className="text-gray-550 hover:text-red-400 text-[10px]">Remove</button>
                </div>
                <div className="relative rounded-xl overflow-hidden border border-[#2D2D30] bg-[#141416]">
                  <img src={imageUrl} alt="selected" className="w-full max-h-32 object-cover" onError={e => (e.currentTarget.style.display = 'none')} />
                </div>
              </div>
            )}
          </div>

          {/* Column 2 & 3: Composer (Post Form) */}
          <div className="lg:col-span-2 space-y-4">
            {/* Platform selector */}
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-2">Publish To</label>
              <div className="flex gap-3">
                {PLATFORMS.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => togglePlatform(p.id)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-bold transition-all ${selectedPlatforms.includes(p.id) ? p.active : `bg-[#141416] ${p.color} hover:opacity-80`}`}
                  >
                    <span>{p.icon}</span>{p.label}
                    {selectedPlatforms.includes(p.id) && <span className="ml-1 text-green-400">✓</span>}
                  </button>
                ))}
              </div>
            </div>

            {/* Caption textarea */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Post Caption</label>
                <span className={`text-[10px] font-mono ${charCount > charLimit * 0.9 ? 'text-red-400' : 'text-gray-500'}`}>{charCount} / {charLimit.toLocaleString()}</span>
              </div>
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="Write your post caption here… or use AI to generate one."
                rows={4}
                className="w-full bg-[#141416] border border-[#2D2D30] rounded-xl px-4 py-3 text-sm text-white placeholder-gray-650 focus:outline-none focus:border-gray-500 transition-colors resize-none leading-relaxed"
              />
            </div>

            {/* Schedule */}
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-2">Schedule (optional)</label>
              <input
                type="datetime-local"
                value={scheduledFor}
                onChange={e => setScheduledFor(e.target.value)}
                className="bg-[#141416] border border-[#2D2D30] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-gray-500 transition-colors"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button type="button" onClick={handleGenerateAICaption} disabled={generatingCaption}
                className="px-4 py-2.5 rounded-xl bg-purple-950/40 border border-purple-900/30 text-purple-300 text-xs font-bold hover:bg-purple-900/30 transition-colors disabled:opacity-40">
                {generatingCaption ? '⏳ Generating…' : '✨ AI Caption'}
              </button>
              <button type="submit" disabled={publishing || !content.trim() || selectedPlatforms.length === 0}
                className="flex-1 px-5 py-2.5 rounded-xl bg-[#E3B859] hover:bg-[#d4ac50] disabled:opacity-40 text-[#141416] text-xs font-bold uppercase tracking-wider transition-colors">
                {publishing ? '⏳ Publishing…' : scheduledFor ? '📅 Schedule Post' : '📤 Publish Now'}
              </button>
            </div>

            {/* Publish Log */}
            {publishLog.length > 0 && (
              <div className="rounded-xl border border-[#2D2D30] bg-[#0A0A0C] p-3 space-y-1 max-h-40 overflow-y-auto">
                <div className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1">Publish Log</div>
                {publishLog.map((line, i) => (
                  <div key={i} className={`text-[10px] font-mono ${
                    line.includes('✅') ? 'text-green-400' : line.includes('❌') ? 'text-red-400' : 'text-gray-400'
                  }`}>{line}</div>
                ))}
              </div>
            )}
          </div>

          {/* Column 4: Live Preview & Requirements Panel */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-[#2D2D30] bg-[#141416] p-4 space-y-3">
              <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Preview</h3>
              {content ? (
                <div className="space-y-2">
                  <div className="text-xs text-white whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">{content}</div>
                  {imageUrl && (
                    <div className="text-[10px] font-mono text-purple-400 truncate">🖼 {imageUrl}</div>
                  )}
                </div>
              ) : (
                <div className="h-24 flex items-center justify-center text-gray-600 text-xs">Preview will appear here…</div>
              )}
              <div className="flex flex-wrap gap-1.5 pt-2 border-t border-[#2D2D30]">
                {selectedPlatforms.map(p => {
                  const pl = PLATFORMS.find(x => x.id === p)
                  return (
                    <span key={p} className="text-[10px] font-bold bg-[#222225] border border-[#2D2D30] px-2 py-0.5 rounded-full text-gray-400">
                      {pl?.icon} {pl?.label}
                    </span>
                  )
                })}
              </div>
            </div>
            <div className="rounded-2xl border border-[#2D2D30] bg-[#141416] p-4 space-y-2">
              <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Requirements</h3>
              <div className="space-y-1.5 text-[11px]">
                {[
                  { label: 'Facebook: Page Access Token', ok: true },
                  { label: 'Instagram: Business Account', ok: true },
                  { label: 'Instagram: Image URL required', ok: !selectedPlatforms.includes('instagram') || !!imageUrl },
                  { label: 'Caption not empty',            ok: content.trim().length > 0 },
                ].map(r => (
                  <div key={r.label} className={`flex items-center gap-2 ${r.ok ? 'text-green-400' : 'text-amber-400'}`}>
                    <span>{r.ok ? '✓' : '!'}</span>
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
            <div className="rounded-2xl border border-[#2D2D30] bg-[#141416] p-12 text-center text-gray-600">
              <div className="text-4xl mb-3">📭</div>
              <div className="text-sm">No posts published yet this session.</div>
            </div>
          ) : (
            jobs.map(job => (
              <div key={job.id} className="p-5 rounded-2xl border border-[#2D2D30] bg-[#141416] space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-xs text-gray-200 leading-relaxed line-clamp-2">{job.content}</p>
                  <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                    job.status === 'published' ? 'bg-green-900/30 border-green-800/30 text-green-300' :
                    job.status === 'failed'    ? 'bg-red-900/30 border-red-800/30 text-red-300' :
                    job.status === 'scheduled' ? 'bg-blue-900/30 border-blue-800/30 text-blue-300' :
                    'bg-gray-800/30 border-gray-700/30 text-gray-400'
                  }`}>{job.status}</span>
                </div>
                <div className="flex flex-wrap gap-2 text-[10px] text-gray-500 font-mono">
                  {job.platforms.map(p => <span key={p}>{PLATFORMS.find(x => x.id === p)?.icon} {p}</span>)}
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
