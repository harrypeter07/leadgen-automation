// dashboard/src/app/publishing/page.tsx
'use client'

import React, { useState } from 'react'

export default function PublishingWorkspacePage() {
  const [activeTab, setActiveTab] = useState<'queue' | 'media' | 'calendar' | 'ai-images'>('queue')

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Workspace Header & Tab Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-blue-500/15 pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
            Publishing & Media Workspace
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-zinc-400 font-medium">
            Manage social media publishing queues, media asset libraries, content calendars, and AI images.
          </p>
        </div>

        {/* Tab Selector Controls */}
        <div className="flex items-center gap-1.5 glass p-1.5 rounded-xl border border-blue-500/25 self-start sm:self-auto flex-wrap">
          <button
            onClick={() => setActiveTab('queue')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'queue'
                ? 'bg-blue-600/30 text-white border border-blue-500/40 shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Publishing Queue
          </button>
          <button
            onClick={() => setActiveTab('media')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'media'
                ? 'bg-blue-600/30 text-white border border-blue-500/40 shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Media Library
          </button>
          <button
            onClick={() => setActiveTab('calendar')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'calendar'
                ? 'bg-blue-600/30 text-white border border-blue-500/40 shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Content Calendar
          </button>
          <button
            onClick={() => setActiveTab('ai-images')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'ai-images'
                ? 'bg-blue-600/30 text-white border border-blue-500/40 shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            AI Generator
          </button>
        </div>
      </div>

      {/* Workspace Tab Views */}
      {activeTab === 'queue' && (
        <div className="rounded-2xl glass glow-border p-8 shadow-xl text-center space-y-4">
          <h3 className="text-xl font-bold text-white">Meta Container Post Publishing Queue</h3>
          <p className="text-xs text-zinc-400 max-w-lg mx-auto">
            Schedule and publish image posts, carousel albums, and video Reels directly to Facebook Pages and Instagram Business accounts.
          </p>
          <div className="p-6 rounded-xl bg-blue-950/20 border border-blue-500/20 text-xs font-mono text-blue-300 inline-block">
            Status: Container Engine Idle
          </div>
        </div>
      )}

      {activeTab === 'media' && (
        <div className="rounded-2xl glass glow-border p-8 shadow-xl text-center space-y-4">
          <h3 className="text-xl font-bold text-white">Media Asset Library</h3>
          <p className="text-xs text-zinc-400 max-w-lg mx-auto">
            Upload, tag, and organize brand images and videos for multi-channel social media posts.
          </p>
          <div className="p-6 rounded-xl bg-blue-950/20 border border-blue-500/20 text-xs font-mono text-blue-300 inline-block">
            Storage Engine: Active
          </div>
        </div>
      )}

      {activeTab === 'calendar' && (
        <div className="rounded-2xl glass glow-border p-8 shadow-xl text-center space-y-4">
          <h3 className="text-xl font-bold text-white">Content Calendar View</h3>
          <p className="text-xs text-zinc-400 max-w-lg mx-auto">
            Visual month/week calendar grid displaying scheduled outreach dispatches and social posts.
          </p>
          <div className="p-6 rounded-xl bg-blue-950/20 border border-blue-500/20 text-xs font-mono text-blue-300 inline-block">
            Calendar Sync: Up to date
          </div>
        </div>
      )}

      {activeTab === 'ai-images' && (
        <div className="rounded-2xl glass glow-border p-8 shadow-xl text-center space-y-4">
          <h3 className="text-xl font-bold text-white">AI Image Generation Studio</h3>
          <p className="text-xs text-zinc-400 max-w-lg mx-auto">
            Generate custom promotional banners and social media creatives using AI models.
          </p>
          <div className="p-6 rounded-xl bg-blue-950/20 border border-blue-500/20 text-xs font-mono text-blue-300 inline-block">
            Studio Model: Ready
          </div>
        </div>
      )}
    </div>
  )
}
