'use client'

import React, { useState, useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { GeminiKeyModal } from '@/components/gemini-key-modal'
import { Edit, Sparkles, Send, Calendar, Image as ImageIcon, Check, Loader2, Upload, History } from 'lucide-react'

export default function PublishComposerPage() {
  const [content, setContent] = useState('')
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['facebook', 'instagram'])
  const [imageUrl, setImageUrl] = useState('')
  const [scheduledFor, setScheduledFor] = useState('')
  const [generatingCaption, setGeneratingCaption] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [activeIgName, setActiveIgName] = useState('Instagram Account')
  const [activeFbName, setActiveFbName] = useState('Facebook Page')
  const [geminiModalOpen, setGeminiModalOpen] = useState(false)

  useEffect(() => {
    fetch('/api/automation/accounts')
      .then(r => r.json())
      .then(data => {
        if (data.accounts) {
          const ig = data.accounts.find((a: any) => a.platform === 'instagram' && a.is_active)
          const fb = data.accounts.find((a: any) => (a.platform === 'facebook' || a.platform === 'messenger') && a.is_active)
          if (ig) setActiveIgName(ig.account_name)
          if (fb) setActiveFbName(fb.account_name)
        }
      }).catch(() => {})
  }, [])

  const togglePlatform = (p: string) => {
    setSelectedPlatforms(prev =>
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
    )
  }

  // AI Caption Generator via Gemini
  async function handleGenerateCaption() {
    setGeneratingCaption(true)
    const toastId = toast.loading('Generating AI caption with Gemini...')
    try {
      const res = await fetch('/api/meta/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Write a compelling, high-converting social media caption for Instagram and Facebook about: ${content || 'our latest features and product highlights'}. Include popular hashtags.`
        })
      })
      const data = await res.json()
      if (res.ok && data.reply) {
        setContent(data.reply)
        toast.success('Gemini AI caption generated!', { id: toastId })
      } else {
        throw new Error(data.error || 'Failed to generate caption')
      }
    } catch (err: any) {
      toast.error(err.message, { id: toastId })
    } finally {
      setGeneratingCaption(false)
    }
  }

  // Handle Publish Post
  async function handlePublish() {
    if (!content.trim()) {
      toast.error('Please enter post content or caption')
      return
    }
    if (selectedPlatforms.length === 0) {
      toast.error('Select at least one platform to publish to')
      return
    }

    setPublishing(true)
    const toastId = toast.loading('Publishing post to selected channels...')

    try {
      let successCount = 0
      if (selectedPlatforms.includes('instagram')) {
        const res = await fetch('/api/meta/instagram/post', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image_url: imageUrl || 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
            caption: content
          })
        })
        if (res.ok) successCount++
      }

      if (selectedPlatforms.includes('facebook')) {
        const res = await fetch('/api/meta/facebook/posts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: content,
            link: imageUrl
          })
        })
        if (res.ok) successCount++
      }

      toast.success(`Post published successfully to ${successCount} platforms!`, { id: toastId })
      setContent('')
      setImageUrl('')
    } catch (err: any) {
      toast.error(err.message || 'Publishing failed', { id: toastId })
    } finally {
      setPublishing(false)
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Reusable Gemini Key Modal */}
      <GeminiKeyModal open={geminiModalOpen} onOpenChange={setGeminiModalOpen} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl border border-border bg-card">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
            <Edit className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">Multi-Channel Post Composer</h1>
            <p className="text-xs text-muted-foreground">Draft, enhance with Gemini AI, preview, and publish to Facebook & Instagram.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setGeminiModalOpen(true)}
            className="gap-1.5 border-blue-500/30 text-blue-400 bg-blue-500/10 hover:bg-blue-500/20"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Set Gemini Key</span>
          </Button>

          <Button
            variant="secondary"
            size="sm"
            disabled={generatingCaption}
            onClick={handleGenerateCaption}
            className="gap-1.5 text-purple-400 bg-purple-500/10 border border-purple-500/30 hover:bg-purple-500/20"
          >
            {generatingCaption ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            <span>Gemini AI Enhance</span>
          </Button>
          <Button
            size="sm"
            disabled={publishing || !content.trim()}
            onClick={handlePublish}
            className="gap-1.5"
          >
            {publishing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            <span>Publish Now</span>
          </Button>
        </div>
      </div>

      {/* Form Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left Form Controls (7 cols) */}
        <Card className="md:col-span-7 space-y-4 p-5">
          {/* Target Accounts Selection */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground">Target Social Channels</label>
            <div className="grid grid-cols-2 gap-3">
              <div
                onClick={() => togglePlatform('facebook')}
                className={`p-3 rounded-xl border cursor-pointer transition-colors flex items-center justify-between ${
                  selectedPlatforms.includes('facebook') ? 'border-primary bg-primary/10' : 'border-border bg-card'
                }`}
              >
                <div>
                  <p className="text-xs font-semibold text-foreground">Facebook Page</p>
                  <p className="text-[11px] text-muted-foreground">{activeFbName}</p>
                </div>
                {selectedPlatforms.includes('facebook') && <Check className="w-4 h-4 text-primary" />}
              </div>

              <div
                onClick={() => togglePlatform('instagram')}
                className={`p-3 rounded-xl border cursor-pointer transition-colors flex items-center justify-between ${
                  selectedPlatforms.includes('instagram') ? 'border-primary bg-primary/10' : 'border-border bg-card'
                }`}
              >
                <div>
                  <p className="text-xs font-semibold text-foreground">Instagram Business</p>
                  <p className="text-[11px] text-muted-foreground">@{activeIgName}</p>
                </div>
                {selectedPlatforms.includes('instagram') && <Check className="w-4 h-4 text-primary" />}
              </div>
            </div>
          </div>

          {/* Post Content / Caption Area */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground">Post Caption & Content</label>
              <Button variant="ghost" size="sm" onClick={handleGenerateCaption} className="h-6 text-[11px] text-purple-400">
                <Sparkles className="w-3 h-3 mr-1" /> Auto-Write with Gemini
              </Button>
            </div>
            <textarea
              rows={6}
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="What do you want to share with your audience? Write or generate with AI..."
              className="w-full rounded-md border border-input bg-background p-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring font-sans"
            />
          </div>

          {/* Image URL Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Image / Media Asset URL</label>
            <Input
              value={imageUrl}
              onChange={e => setImageUrl(e.target.value)}
              placeholder="https://images.unsplash.com/... or Cloudinary image link"
              className="font-mono text-xs"
            />
          </div>
        </Card>

        {/* Right Live Preview Card (5 cols) */}
        <Card className="md:col-span-5 flex flex-col p-5 space-y-4">
          <CardTitle className="text-xs font-semibold">Live Social Post Preview</CardTitle>
          <div className="border border-border rounded-xl p-4 bg-muted/20 flex-1 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs">
                S
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">Stratnent Official</p>
                <p className="text-[10px] text-muted-foreground">Just now · Public</p>
              </div>
            </div>
            {imageUrl ? (
              <img src={imageUrl} alt="preview" className="w-full h-44 object-cover rounded-lg border border-border" />
            ) : (
              <div className="w-full h-44 rounded-lg bg-muted flex flex-col items-center justify-center text-muted-foreground text-xs gap-1">
                <ImageIcon className="w-6 h-6 text-muted-foreground/40" />
                <span>Media Asset Preview</span>
              </div>
            )}
            <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">
              {content || 'Your post caption preview will appear here...'}
            </p>
          </div>
        </Card>
      </div>
    </div>
  )
}
