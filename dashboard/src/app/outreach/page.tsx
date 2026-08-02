// dashboard/src/app/outreach/page.tsx
'use client'

import React, { useState } from 'react'
import WhatsappManagerPage from '../whatsapp/page'

export default function OutreachWorkspacePage() {
  const [activeTab, setActiveTab] = useState<'whatsapp' | 'email' | 'inbox'>('whatsapp')

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Workspace Header & Tab Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-blue-500/15 pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
            Outreach & Communication Workspace
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-zinc-400 font-medium">
            Manage multi-channel WhatsApp messaging, SMTP email campaigns, and unified conversation streams.
          </p>
        </div>

        {/* Tab Selection Controls */}
        <div className="flex items-center gap-1.5 glass p-1.5 rounded-xl border border-blue-500/25 self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('whatsapp')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'whatsapp'
                ? 'bg-blue-600/30 text-white border border-blue-500/40 shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            WhatsApp Manager
          </button>
          <button
            onClick={() => setActiveTab('email')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'email'
                ? 'bg-blue-600/30 text-white border border-blue-500/40 shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Email Dispatcher
          </button>
          <button
            onClick={() => setActiveTab('inbox')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'inbox'
                ? 'bg-blue-600/30 text-white border border-blue-500/40 shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Unified Inbox
          </button>
        </div>
      </div>

      {/* Tab Content Views */}
      {activeTab === 'whatsapp' && (
        <div className="rounded-2xl">
          <WhatsappManagerPage />
        </div>
      )}

      {activeTab === 'email' && (
        <div className="rounded-2xl glass glow-border p-8 shadow-xl text-center space-y-4">
          <h3 className="text-xl font-bold text-white">SMTP Email Campaign Dispatcher</h3>
          <p className="text-xs text-zinc-400 max-w-lg mx-auto">
            Configured SMTP outreach mailers process queued leads with personalized subject lines and HTML bodies.
          </p>
          <div className="p-6 rounded-xl bg-blue-950/20 border border-blue-500/20 text-xs font-mono text-blue-300 inline-block">
            Status: Active & Ready for Dispatch
          </div>
        </div>
      )}

      {activeTab === 'inbox' && (
        <div className="rounded-2xl glass glow-border p-8 shadow-xl text-center space-y-4">
          <h3 className="text-xl font-bold text-white">Unified Multi-Channel Conversation Stream</h3>
          <p className="text-xs text-zinc-400 max-w-lg mx-auto">
            Consolidates incoming replies across WhatsApp, Messenger, and Instagram direct messages into a single thread view.
          </p>
          <div className="p-6 rounded-xl bg-blue-950/20 border border-blue-500/20 text-xs font-mono text-blue-300 inline-block">
            Status: Live Stream Listening
          </div>
        </div>
      )}
    </div>
  )
}
