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

  function togglePlatform(p: string) {
    setSelectedPlatforms(prev =>
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
    )
  }

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

  async function handleMediaUpload(source: 'file' | 'drive') {
    setUploading(true)
    const toastId = toast.loading(source === 'drive' ? 'Converting Drive link…' : 'Uploading image…')
    try {
      let res: Response
      if (source === 'drive') {
        if (!driveInput.trim()) { toast.error('Enter a Google Drive link first', { id: toastId }); setUploading(false); return }
        res = await fetch('/api/meta/media-upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ driveUrl: driveInput.trim() }),
        })
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
        <form onSubmit={handlePublish} className="grid gap-6 lg:grid-cols-3">
          {/* Composer */}
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
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Post Content</label>
                <span className={`text-[10px] font-mono ${charCount > charLimit * 0.9 ? 'text-red-400' : 'text-gray-500'}`}>{charCount} / {charLimit.toLocaleString()}</span>
              </div>
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="Write your post caption here… or use AI to generate one."
                rows={8}
                className="w-full bg-[#141416] border border-[#2D2D30] rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500 transition-colors resize-none leading-relaxed"
              />
            </div>

            {/* Image / Media Panel */}
            {selectedPlatforms.includes('instagram') && (
              <div className="space-y-3">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block">Image for Instagram <span className="text-red-400">*</span></label>

                {/* Option A: Upload file */}
                <div className="flex gap-2">
                  <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={() => handleMediaUpload('file')} />
                  <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                    className="px-3 py-2 rounded-xl bg-[#141416] border border-[#2D2D30] text-gray-400 text-xs font-bold hover:text-white hover:border-gray-500 transition-colors disabled:opacity-40">
                    {uploading ? '⏳ Uploading…' : '📁 Upload File'}
                  </button>
                  <span className="text-gray-600 text-xs self-center">or</span>

                  {/* Option B: Google Drive link */}
                  <input
                    value={driveInput}
                    onChange={e => setDriveInput(e.target.value)}
                    placeholder="Google Drive share link…"
                    className="flex-1 bg-[#141416] border border-[#2D2D30] rounded-xl px-3 py-2 text-xs text-white font-mono placeholder-gray-600 focus:outline-none focus:border-gray-500"
                  />
                  <button type="button" onClick={() => handleMediaUpload('drive')} disabled={uploading || !driveInput.trim()}
                    className="px-3 py-2 rounded-xl bg-blue-950/40 border border-blue-900/30 text-blue-300 text-xs font-bold hover:bg-blue-900/30 transition-colors disabled:opacity-40">
                    {uploading ? '⏳' : '☁️ Upload'}
                  </button>
                </div>

                {/* Current URL + Preview */}
                {imageUrl && (
                  <div className="space-y-2">
                    <div className="flex gap-2 items-center">
                      <input value={imageUrl} onChange={e => setImageUrl(e.target.value)}
                        className="flex-1 bg-[#141416] border border-green-800/40 rounded-xl px-3 py-2 text-[10px] text-green-400 font-mono focus:outline-none" />
                      <button type="button" onClick={() => setImageUrl('')} className="text-gray-500 hover:text-red-400 text-xs">✕</button>
                    </div>
                    <img src={imageUrl} alt="preview" className="rounded-xl max-h-40 object-cover border border-[#2D2D30]" onError={e => (e.currentTarget.style.display = 'none')} />
                  </div>
                )}
              </div>
            )}

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

          {/* Preview panel */}
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
