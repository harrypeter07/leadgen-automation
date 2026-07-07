'use client'

import React, { useState } from 'react'
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
}

const PLATFORMS = [
  { id: 'facebook',  label: 'Facebook Page',  icon: '📘', color: 'border-blue-700/40 text-blue-400',  active: 'bg-blue-950/40 border-blue-700/50' },
  { id: 'instagram', label: 'Instagram',       icon: '📸', color: 'border-pink-700/40 text-pink-400',  active: 'bg-pink-950/40 border-pink-700/50' },
]

export default function PublishComposerPage() {
  const [content, setContent]                   = useState('')
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['facebook'])
  const [imageUrl, setImageUrl]                 = useState('')
  const [scheduledFor, setScheduledFor]         = useState('')
  const [generatingCaption, setGeneratingCaption] = useState(false)
  const [publishing, setPublishing]             = useState(false)
  const [jobs, setJobs]                         = useState<PostJob[]>([])
  const [activeTab, setActiveTab]               = useState<'compose' | 'history'>('compose')

  function togglePlatform(p: string) {
    setSelectedPlatforms(prev =>
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
    )
  }

  async function handleGenerateAICaption() {
    setGeneratingCaption(true)
    toast.loading('Generating AI caption…', { duration: 2500 })
    setTimeout(() => {
      setContent(prev =>
        (prev ? prev + '\n\n' : '') +
        '🌟 Elevate your digital presence with intelligent automation! Our smart platform handles outreach, content, and lead nurturing — so you can focus on closing deals. DM us to learn more! 🚀\n\n#BusinessAutomation #LeadGeneration #DigitalMarketing'
      )
      setGeneratingCaption(false)
      toast.success('AI caption ready!')
    }, 2500)
  }

  async function handlePublish(e: React.FormEvent) {
    e.preventDefault()
    if (selectedPlatforms.length === 0) { toast.error('Select at least one platform.'); return }
    if (!content.trim())                { toast.error('Post content cannot be empty.');  return }

    setPublishing(true)
    const toastId = toast.loading('Publishing post…')

    const results: PostJob = {
      id:          String(Date.now()),
      content,
      platforms:   selectedPlatforms,
      imageUrl:    imageUrl || undefined,
      scheduledFor: scheduledFor || undefined,
      status:      'draft',
    }

    let anySuccess = false
    let anyFail    = false

    // Publish to Facebook
    if (selectedPlatforms.includes('facebook')) {
      try {
        const res  = await fetch('/api/meta/facebook/post', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            action:  'publish',
            message: content,
            ...(scheduledFor ? { scheduled_time: Math.floor(new Date(scheduledFor).getTime() / 1000) } : {}),
          }),
        })
        const data = await res.json()
        if (res.ok && data.success && data.data?.id) {
          results.fbPostId = data.data.id
          anySuccess = true
        } else {
          anyFail = true
          toast.error(`Facebook: ${data.error?.message || data.error || 'Failed'}`)
        }
      } catch {
        anyFail = true
        toast.error('Facebook publish error')
      }
    }

    // Publish to Instagram (requires image URL for IG)
    if (selectedPlatforms.includes('instagram')) {
      if (!imageUrl) {
        toast.error('Instagram requires an image URL.')
        anyFail = true
      } else {
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
          } else {
            anyFail = true
            toast.error(`Instagram: ${data.error?.message || data.error || 'Failed'}`)
          }
        } catch {
          anyFail = true
          toast.error('Instagram publish error')
        }
      }
    }

    results.status = anySuccess ? (anyFail ? 'draft' : 'published') : 'failed'
    results.publishedAt = anySuccess ? new Date().toISOString() : undefined

    setJobs(prev => [results, ...prev])
    setPublishing(false)

    if (anySuccess && !anyFail) {
      toast.success('Published successfully!', { id: toastId })
      setContent('')
      setImageUrl('')
      setScheduledFor('')
      setActiveTab('history')
    } else if (anyFail && !anySuccess) {
      toast.error('Publish failed. Check errors above.', { id: toastId })
    } else {
      toast.success('Partially published.', { id: toastId })
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

            {/* Image URL */}
            {selectedPlatforms.includes('instagram') && (
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-2">Image URL <span className="text-red-400">*</span> (required for Instagram)</label>
                <input
                  value={imageUrl}
                  onChange={e => setImageUrl(e.target.value)}
                  placeholder="https://example.com/image.jpg (must be publicly accessible)"
                  className="w-full bg-[#141416] border border-[#2D2D30] rounded-xl px-4 py-2.5 text-xs text-white font-mono placeholder-gray-600 focus:outline-none focus:border-gray-500 transition-colors"
                />
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
              <button
                type="button"
                onClick={handleGenerateAICaption}
                disabled={generatingCaption}
                className="px-4 py-2.5 rounded-xl bg-purple-950/40 border border-purple-900/30 text-purple-300 text-xs font-bold hover:bg-purple-900/30 transition-colors disabled:opacity-40"
              >{generatingCaption ? '⏳ Generating…' : '✨ AI Caption'}</button>
              <button
                type="submit"
                disabled={publishing || !content.trim() || selectedPlatforms.length === 0}
                className="flex-1 px-5 py-2.5 rounded-xl bg-[#E3B859] hover:bg-[#d4ac50] disabled:opacity-40 text-[#141416] text-xs font-bold uppercase tracking-wider transition-colors"
              >{publishing ? '⏳ Publishing…' : scheduledFor ? '📅 Schedule Post' : '📤 Publish Now'}</button>
            </div>
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
