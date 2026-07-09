'use client'

import React, { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'

interface Thread {
  id: string
  name: string
  platform: 'messenger' | 'instagram' | 'facebook'
  lastMessage: string
  time: string
  unread: boolean
  participantId?: string
}

interface Message {
  id: string
  sender: 'lead' | 'system'
  body: string
  time: string
}

const PLATFORM_ICON: Record<string, string> = {
  messenger: '💬',
  instagram: '📸',
  facebook:  '📘',
}
const PLATFORM_COLOR: Record<string, string> = {
  messenger: 'text-blue-400',
  instagram: 'text-pink-400',
  facebook:  'text-blue-500',
}

function timeAgo(ts: string) {
  try {
    const diff = (Date.now() - new Date(ts).getTime()) / 1000
    if (diff < 60)    return `${Math.round(diff)}s ago`
    if (diff < 3600)  return `${Math.round(diff / 60)}m ago`
    if (diff < 86400) return `${Math.round(diff / 3600)}h ago`
    return new Date(ts).toLocaleDateString()
  } catch { return ts }
}

// ─── Dev Mode Banner ─────────────────────────────────────────────────────────
function DevModeBanner() {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null
  return (
    <div className="mx-4 mt-4 mb-0 bg-amber-950/30 border border-amber-800/40 rounded-xl p-3.5 text-[11px] text-amber-300 leading-relaxed relative">
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-2 right-2.5 text-amber-500 hover:text-amber-300 text-sm"
      >✕</button>
      <div className="font-black text-amber-400 mb-1">⚠️ App in Development Mode</div>
      <p>
        Your Meta app is in <strong>Development Mode</strong>. Instagram & Messenger APIs only return conversations with people who are added as <strong>Testers or Developers</strong> in your Meta app. Real followers (like Kashi Singh, smriti shah) won&apos;t appear until the app is <strong>submitted for App Review</strong> and approved.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <a
          href="https://developers.facebook.com/apps"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-900/40 border border-amber-800/40 text-amber-300 text-[10px] font-bold hover:bg-amber-900/60 transition-colors"
        >
          📋 Add Testers in App Dashboard →
        </a>
      </div>
    </div>
  )
}

// ─── Compose DM Modal ─────────────────────────────────────────────────────────
interface ComposeDMModalProps {
  onClose: () => void
  threads: Thread[]
}

function ComposeDMModal({ onClose, threads }: ComposeDMModalProps) {
  const [platform, setPlatform]       = useState<'instagram' | 'messenger'>('instagram')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedUser, setSelectedUser] = useState<{ id: string; name: string } | null>(null)
  const [message, setMessage]         = useState('')
  const [sending, setSending]         = useState(false)

  // Build recipient list from existing conversation threads
  const existingRecipients = threads
    .filter(t => t.platform === platform && t.participantId)
    .map(t => ({ id: t.participantId!, name: t.name, platform: t.platform }))

  const filtered = searchQuery
    ? existingRecipients.filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : existingRecipients

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedUser || !message.trim()) return
    setSending(true)
    const toastId = toast.loading('Sending DM…')
    try {
      const endpoint = platform === 'instagram'
        ? '/api/meta/instagram/messages'
        : '/api/meta/facebook/messages'
      const res  = await fetch(endpoint, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ recipient_id: selectedUser.id, text: message.trim() }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(`DM sent to ${selectedUser.name}!`, { id: toastId })
        setMessage('')
        setSelectedUser(null)
        onClose()
      } else {
        throw new Error(data.error?.message || data.error || 'Send failed')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Send failed', { id: toastId })
    }
    setSending(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-[#0E0E10] border border-[#2D2D30] rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-white font-black text-lg">✏️ New DM</h2>
            <p className="text-[10px] text-gray-500 mt-0.5">Send a reply to an existing conversation</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl transition-colors">✕</button>
        </div>

        {/* Platform Picker */}
        <div className="space-y-1.5">
          <label className="text-[9px] font-bold text-gray-500 uppercase tracking-wider block">Platform</label>
          <div className="flex gap-2">
            {(['instagram', 'messenger'] as const).map(p => (
              <button
                key={p}
                type="button"
                onClick={() => { setPlatform(p); setSelectedUser(null); setSearchQuery('') }}
                className={`flex-1 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all flex items-center justify-center gap-2 ${
                  platform === p
                    ? p === 'instagram'
                      ? 'bg-gradient-to-r from-pink-950/60 to-purple-950/60 border-pink-800/50 text-pink-300'
                      : 'bg-blue-950/40 border-blue-800/50 text-blue-300'
                    : 'bg-[#141416] border-[#2D2D30] text-gray-500 hover:text-gray-300'
                }`}
              >
                {PLATFORM_ICON[p]} {p === 'instagram' ? 'Instagram' : 'Messenger'}
              </button>
            ))}
          </div>
        </div>

        {/* Recipient picker from existing threads */}
        <div className="space-y-1.5">
          <label className="text-[9px] font-bold text-gray-500 uppercase tracking-wider block">
            Select Recipient
            <span className="ml-1 text-gray-600 normal-case font-normal">(from your existing conversations)</span>
          </label>
          {existingRecipients.length === 0 ? (
            <div className="bg-[#141416] border border-[#2D2D30] rounded-xl p-4 text-center">
              <p className="text-xs text-gray-500 font-semibold">No {platform} conversations yet.</p>
              <p className="text-[10px] text-gray-600 mt-1">
                {platform === 'instagram'
                  ? 'Ask someone to DM @smritifyp first to appear here.'
                  : 'Someone needs to message your Page first.'}
              </p>
              <div className="mt-2 bg-amber-950/20 border border-amber-900/30 rounded-lg p-2 text-[10px] text-amber-400">
                ⚠️ App is in Dev Mode — only app testers appear as senders
              </div>
            </div>
          ) : (
            <>
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search contacts…"
                  className="w-full bg-[#141416] border border-[#2D2D30] rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-gray-500"
                />
              </div>
              <div className="max-h-36 overflow-y-auto space-y-1 rounded-xl bg-[#141416] border border-[#2D2D30] p-1">
                {filtered.map(r => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setSelectedUser(r)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors ${
                      selectedUser?.id === r.id
                        ? 'bg-purple-950/40 text-white border border-purple-900/30'
                        : 'text-gray-400 hover:bg-[#1A1A1C] hover:text-white'
                    }`}
                  >
                    <span className="w-7 h-7 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-white text-[10px] font-black flex-shrink-0">
                      {r.name[0]?.toUpperCase()}
                    </span>
                    <span>{r.name}</span>
                    {selectedUser?.id === r.id && <span className="ml-auto text-green-400">✓</span>}
                  </button>
                ))}
                {filtered.length === 0 && (
                  <p className="text-center text-[10px] text-gray-600 py-2">No results for &quot;{searchQuery}&quot;</p>
                )}
              </div>
            </>
          )}
        </div>

        {/* Message */}
        <div className="space-y-1.5">
          <label className="text-[9px] font-bold text-gray-500 uppercase tracking-wider block">Message</label>
          <textarea
            required
            rows={3}
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder={selectedUser ? `Message to ${selectedUser.name}…` : 'Select a recipient first…'}
            disabled={!selectedUser}
            className="w-full bg-[#141416] border border-[#2D2D30] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-gray-500 transition-colors resize-none disabled:opacity-40"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-[#141416] border border-[#2D2D30] text-gray-400 text-xs font-bold hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={sending || !selectedUser || !message.trim()}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-40 ${
              platform === 'instagram'
                ? 'bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white'
                : 'bg-blue-600 hover:bg-blue-500 text-white'
            }`}
          >
            {sending ? '⏳ Sending…' : `📤 Send ${platform === 'instagram' ? 'IG DM' : 'Message'}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SocialInboxPage() {
  const [threads, setThreads]               = useState<Thread[]>([])
  const [messages, setMessages]             = useState<Message[]>([])
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null)
  const [replyText, setReplyText]           = useState('')
  const [sending, setSending]               = useState(false)
  const [loadingThreads, setLoadingThreads] = useState(true)
  const [loadingMsgs, setLoadingMsgs]       = useState(false)
  const [aiGenerating, setAiGenerating]     = useState(false)
  const [filter, setFilter]                 = useState<'all' | 'messenger' | 'instagram'>('all')
  const [igError, setIgError]               = useState('')
  const [fbError, setFbError]               = useState('')
  const [showCompose, setShowCompose]       = useState(false)

  const fetchThreads = useCallback(async () => {
    setLoadingThreads(true)
    const fetched: Thread[] = []

    try {
      const fbRes  = await fetch('/api/meta/facebook/messages?limit=20')
      const fbData = await fbRes.json()
      if (fbData.data && Array.isArray(fbData.data)) {
        for (const conv of fbData.data) {
          const msgs = conv.messages?.data || []
          const last = msgs[0]
          fetched.push({
            id: conv.id,
            name: conv.participants?.data?.[0]?.name || 'Messenger User',
            platform: 'messenger',
            lastMessage: last?.message || '(no message)',
            time: last?.created_time ? timeAgo(last.created_time) : '',
            unread: false,
            participantId: conv.participants?.data?.[0]?.id,
          })
        }
        setFbError('')
      } else if (fbData.error) {
        setFbError(typeof fbData.error === 'object' ? fbData.error.message || JSON.stringify(fbData.error) : fbData.error)
      }
    } catch { /* ignore */ }

    try {
      const igRes  = await fetch('/api/meta/instagram/messages?limit=20')
      const igData = await igRes.json()
      const igConvs = igData.data ?? []
      if (Array.isArray(igConvs) && igConvs.length > 0) {
        for (const conv of igConvs) {
          const msgs = conv.messages?.data || []
          const last = msgs[0]
          fetched.push({
            id: `ig_${conv.id}`,
            name: conv.participants?.data?.[0]?.name || 'Instagram User',
            platform: 'instagram',
            lastMessage: last?.message || '(no message)',
            time: last?.created_time ? timeAgo(last.created_time) : '',
            unread: false,
            participantId: conv.participants?.data?.[0]?.id,
          })
        }
        setIgError('')
      } else if (igData.error) {
        setIgError(typeof igData.error === 'object' ? igData.error.message || JSON.stringify(igData.error) : igData.error)
      } else {
        setIgError('') // no error, just empty (dev mode restriction)
      }
    } catch { /* ignore */ }

    setThreads(fetched)
    setLoadingThreads(false)
  }, [])

  useEffect(() => { fetchThreads() }, [fetchThreads])

  async function openThread(thread: Thread) {
    setSelectedThread(thread)
    setMessages([])
    setLoadingMsgs(true)
    try {
      const endpoint = thread.platform === 'instagram'
        ? `/api/meta/instagram/messages?limit=50`
        : `/api/meta/facebook/messages?limit=50`
      const res  = await fetch(endpoint)
      const data = await res.json()
      const convs = data.data || []
      const rawId = thread.id.replace('ig_', '')
      const conv  = convs.find((c: { id: string }) => c.id === rawId) || convs[0]
      const msgs  = conv?.messages?.data || []
      setMessages(msgs.map((m: { id: string; from?: { name?: string }; message?: string; created_time?: string }) => ({
        id:     m.id || String(Math.random()),
        sender: m.from?.name?.toLowerCase().includes('page') ? 'system' : 'lead',
        body:   m.message || '(media)',
        time:   m.created_time ? new Date(m.created_time).toLocaleTimeString() : '',
      })).reverse())
    } catch {
      setMessages([])
    }
    setLoadingMsgs(false)
  }

  async function handleSendReply(e: React.FormEvent) {
    e.preventDefault()
    if (!replyText.trim() || !selectedThread) return
    setSending(true)
    const toastId = toast.loading('Sending message…')
    try {
      const recipientId = selectedThread.participantId || selectedThread.id.replace('ig_', '')
      const endpoint    = selectedThread.platform === 'instagram'
        ? '/api/meta/instagram/messages'
        : '/api/meta/facebook/messages'
      const res  = await fetch(endpoint, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ recipient_id: recipientId, text: replyText }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success('Message sent!', { id: toastId })
        setMessages(prev => [...prev, {
          id:     String(Date.now()),
          sender: 'system',
          body:   replyText,
          time:   new Date().toLocaleTimeString(),
        }])
        setReplyText('')
      } else {
        throw new Error(data.error?.message || data.error || 'Send failed')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Send failed', { id: toastId })
    }
    setSending(false)
  }

  function handleGenerateAI() {
    setAiGenerating(true)
    toast.loading('Generating AI response…', { duration: 2000 })
    setTimeout(() => {
      setReplyText('Thank you for reaching out! We\'d love to help. Could you share more details about what you\'re looking for so we can provide the best solution for your needs?')
      setAiGenerating(false)
      toast.success('AI draft ready!')
    }, 1800)
  }

  const visibleThreads = filter === 'all' ? threads : threads.filter(t => t.platform === filter)

  return (
    <>
      {showCompose && <ComposeDMModal onClose={() => { setShowCompose(false); fetchThreads() }} threads={threads} />}

      <div className="flex flex-col h-[calc(100vh-120px)] gap-0 rounded-2xl border border-[#2D2D30] overflow-hidden bg-[#0E0E10] text-white select-none">

        {/* Dev Mode Banner at top */}
        <DevModeBanner />

        <div className="flex flex-1 overflow-hidden">
          {/* ── Thread Sidebar ─────────────────────────────────────────────── */}
          <div className="w-72 flex-shrink-0 border-r border-[#2D2D30] flex flex-col">
            <div className="p-4 border-b border-[#2D2D30] space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-white">💬 Inbox</h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowCompose(true)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-pink-600/80 to-purple-600/80 hover:from-pink-500 hover:to-purple-500 text-white text-[10px] font-bold uppercase tracking-wider transition-all"
                  >
                    <span>✏️</span><span>New DM</span>
                  </button>
                  <button onClick={fetchThreads} className="text-gray-500 hover:text-white text-xs transition-colors" title="Refresh">🔄</button>
                </div>
              </div>

              {/* Platform filter tabs */}
              <div className="flex gap-1 bg-[#141416] rounded-xl p-1">
                {([
                  { key: 'all',       label: 'All',       icon: '🌐' },
                  { key: 'messenger', label: 'Messenger',  icon: '💬' },
                  { key: 'instagram', label: 'Instagram',  icon: '📸' },
                ] as const).map(f => (
                  <button
                    key={f.key}
                    onClick={() => setFilter(f.key)}
                    className={`flex-1 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all flex flex-col items-center gap-0.5 ${
                      filter === f.key
                        ? f.key === 'instagram'
                          ? 'bg-gradient-to-b from-pink-950/80 to-purple-950/80 text-pink-300 border border-pink-900/40'
                          : f.key === 'messenger'
                          ? 'bg-blue-950/50 text-blue-300 border border-blue-900/40'
                          : 'bg-[#222225] text-white border border-[#3D3D40]'
                        : 'text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    <span className="text-sm">{f.icon}</span>
                    <span>{f.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Thread list */}
            <div className="flex-1 overflow-y-auto">
              {loadingThreads ? (
                <div className="flex flex-col gap-2 p-3">
                  {[1,2,3].map(i => <div key={i} className="h-16 rounded-xl bg-[#1A1A1C] animate-pulse" />)}
                </div>
              ) : visibleThreads.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-gray-600 gap-2 p-4 text-center">
                  <span className="text-3xl">{filter === 'instagram' ? '📸' : filter === 'messenger' ? '💬' : '📭'}</span>
                  <span className="text-xs font-semibold text-gray-400">
                    {filter === 'instagram'
                      ? 'No IG DMs visible — app in Dev Mode. Only app Testers\' DMs show.'
                      : filter === 'messenger'
                      ? 'No Messenger chats visible — ensure subscriptions are on.'
                      : 'No conversations found. App is in Development Mode.'}
                  </span>
                  {/* Show API errors if any */}
                  {filter === 'instagram' && igError && (
                    <p className="text-[10px] text-red-400 font-mono bg-red-950/20 border border-red-900/30 rounded p-2">{igError}</p>
                  )}
                  {filter === 'messenger' && fbError && (
                    <p className="text-[10px] text-red-400 font-mono bg-red-950/20 border border-red-900/30 rounded p-2">{fbError}</p>
                  )}
                </div>
              ) : (
                visibleThreads.map(thread => (
                  <button
                    key={thread.id}
                    onClick={() => openThread(thread)}
                    className={`w-full text-left p-3.5 border-b border-[#1A1A1C] transition-colors hover:bg-[#1A1A1C] ${selectedThread?.id === thread.id ? 'bg-[#1A1A1C] border-l-2 border-l-purple-500' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs ${PLATFORM_COLOR[thread.platform]}`}>{PLATFORM_ICON[thread.platform]}</span>
                        <span className="text-xs font-bold text-white truncate max-w-[140px]">{thread.name}</span>
                      </div>
                      <span className="text-[10px] text-gray-500 flex-shrink-0">{thread.time}</span>
                    </div>
                    <p className="text-[11px] text-gray-500 truncate">{thread.lastMessage}</p>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* ── Chat Panel ──────────────────────────────────────────────────── */}
          <div className="flex-1 flex flex-col">
            {!selectedThread ? (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-600 gap-4">
                <span className="text-5xl">💬</span>
                <span className="text-sm">Select a conversation to open it.</span>
                <button
                  onClick={() => setShowCompose(true)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white text-xs font-bold uppercase tracking-wider transition-all"
                >
                  ✏️ Compose New DM
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between p-4 border-b border-[#2D2D30]">
                  <div className="flex items-center gap-2.5">
                    <span className={`text-lg ${PLATFORM_COLOR[selectedThread.platform]}`}>{PLATFORM_ICON[selectedThread.platform]}</span>
                    <div>
                      <div className="text-sm font-bold text-white">{selectedThread.name}</div>
                      <div className="text-[10px] text-gray-500 capitalize">{selectedThread.platform} · {selectedThread.time}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowCompose(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-pink-950/40 to-purple-950/40 border border-pink-900/30 text-pink-300 text-[10px] font-bold hover:from-pink-900/40 transition-all"
                  >
                    ✏️ New DM
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {loadingMsgs ? (
                    <div className="flex items-center justify-center h-full text-gray-500 animate-pulse text-sm">Loading messages…</div>
                  ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-600 gap-2">
                      <span className="text-3xl">📭</span>
                      <span className="text-sm">No messages loaded yet.</span>
                    </div>
                  ) : (
                    messages.map(msg => (
                      <div key={msg.id} className={`flex ${msg.sender === 'system' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-xs lg:max-w-md px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed ${
                          msg.sender === 'system'
                            ? 'bg-[#E3B859] text-[#141416] font-semibold rounded-br-sm'
                            : 'bg-[#222225] text-gray-200 border border-[#2D2D30] rounded-bl-sm'
                        }`}>
                          {msg.body}
                          <div className={`text-[9px] mt-1 ${msg.sender === 'system' ? 'text-[#141416]/60' : 'text-gray-500'}`}>{msg.time}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="p-4 border-t border-[#2D2D30]">
                  <form onSubmit={handleSendReply} className="flex gap-2">
                    <input
                      value={replyText}
                      onChange={e => setReplyText(e.target.value)}
                      placeholder={`Reply via ${selectedThread.platform}…`}
                      className="flex-1 bg-[#141416] border border-[#2D2D30] rounded-xl px-3.5 py-2.5 text-xs text-white font-mono placeholder-gray-600 focus:outline-none focus:border-gray-500"
                    />
                    <button
                      type="button"
                      onClick={handleGenerateAI}
                      disabled={aiGenerating}
                      className="px-3 py-2.5 rounded-xl bg-purple-950/40 border border-purple-900/30 text-purple-300 text-xs font-bold hover:bg-purple-900/30 transition-colors disabled:opacity-40"
                    >✨ AI</button>
                    <button
                      type="submit"
                      disabled={!replyText.trim() || sending}
                      className="px-4 py-2.5 rounded-xl bg-[#E3B859] text-[#141416] text-xs font-bold disabled:opacity-40 hover:bg-[#d4ac50] transition-colors"
                    >{sending ? '⏳' : '📤 Send'}</button>
                  </form>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
