// dashboard/src/components/command-palette.tsx
'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Search, LayoutDashboard, Users, MessageSquare, Zap, Share2, BarChart3, Settings, Command } from 'lucide-react'

export default function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const router = useRouter()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
      if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  if (!open) return null

  const commands = [
    { label: 'Go to Command Center', icon: <LayoutDashboard className="w-4 h-4" />, action: () => router.push('/dashboard') },
    { label: 'Go to Leads & Intelligence Workspace', icon: <Users className="w-4 h-4" />, action: () => router.push('/leads') },
    { label: 'Go to Outreach & Messaging Workspace', icon: <MessageSquare className="w-4 h-4" />, action: () => router.push('/outreach') },
    { label: 'Go to Automation Engine Workspace', icon: <Zap className="w-4 h-4" />, action: () => router.push('/automation') },
    { label: 'Go to Publishing & Media Workspace', icon: <Share2 className="w-4 h-4" />, action: () => router.push('/publishing') },
    { label: 'Go to Analytics & Metrics Workspace', icon: <BarChart3 className="w-4 h-4" />, action: () => router.push('/analytics') },
    { label: 'Go to System Settings', icon: <Settings className="w-4 h-4" />, action: () => router.push('/settings') },
  ]

  const filtered = commands.filter((c) => c.label.toLowerCase().includes(query.toLowerCase()))

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start justify-center pt-24 px-4">
      <div className="w-full max-w-xl glass glow-border rounded-2xl shadow-2xl overflow-hidden border border-blue-500/30">
        <div className="flex items-center px-4 border-b border-blue-500/20 bg-blue-950/20">
          <Search className="w-4 h-4 text-blue-400 mr-3" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search workspace..."
            className="w-full py-4 bg-transparent text-sm text-white placeholder-zinc-400 focus:outline-none"
            autoFocus
          />
          <kbd className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/20 border border-blue-500/30 text-blue-300">
            ESC
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-xs text-zinc-400">No matching commands found.</div>
          ) : (
            filtered.map((cmd) => (
              <button
                key={cmd.label}
                onClick={() => {
                  cmd.action()
                  setOpen(false)
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-zinc-300 hover:text-white hover:bg-blue-600/20 transition-all text-left"
              >
                <span className="text-blue-400">{cmd.icon}</span>
                <span className="flex-1">{cmd.label}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
