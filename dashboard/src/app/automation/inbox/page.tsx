'use client'

import React, { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'

// ─── Types ────────────────────────────────────────────────────────────────────
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
  platform?: string
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

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SocialInboxPage() {
  const [threads, setThreads]           = useState<Thread[]>([])
  const [messages, setMessages]         = useState<Message[]>([])
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null)
  const [replyText, setReplyText]       = useState('')
  const [sending, setSending]           = useState(false)
  const [loadingThreads, setLoadingThreads] = useState(true)
  const [loadingMsgs, setLoadingMsgs]   = useState(false)
  const [aiGenerating, setAiGenerating] = useState(false)
  const [filter, setFilter]             = useState<'all' | 'messenger' | 'instagram'>('all')
  const [apiHint, setApiHint]           = useState('')

  // ── Fetch FB Messenger Conversations ────────────────────────────────────────
  const fetchThreads = useCallback(async () => {
    setLoadingThreads(true)
    const fetched: Thread[] = []

    try {
      // Facebook / Messenger conversations
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
      } else if (fbData.error) {
        setApiHint(`Facebook Messenger: ${typeof fbData.error === 'object' ? fbData.error.message || JSON.stringify(fbData.error) : fbData.error}`)
      }
    } catch { /* ignore */ }

    try {
      // Instagram conversations
      const igRes  = await fetch('/api/meta/instagram/messages?limit=20')
      const igData = await igRes.json()
      if (igData.data && Array.isArray(igData.data)) {
        for (const conv of igData.data) {
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
      }
    } catch { /* ignore */ }

    setThreads(fetched)
    setLoadingThreads(false)
  }, [])

  useEffect(() => { fetchThreads() }, [fetchThreads])

  // ── Thread selection → load messages ────────────────────────────────────────
  async function openThread(thread: Thread) {
    setSelectedThread(thread)
    setMessages([])
    setLoadingMsgs(true)

    try {
      // For messenger, fetch individual conversation messages
      const endpoint = thread.platform === 'instagram'
        ? `/api/meta/instagram/messages?limit=50`
        : `/api/meta/facebook/messages?limit=50`
      const res  = await fetch(endpoint)
      const data = await res.json()

      // Find the matching conversation
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

  // ── Send reply ───────────────────────────────────────────────────────────────
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

  // ── AI Draft ─────────────────────────────────────────────────────────────────
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
    <div className="flex h-[calc(100vh-120px)] gap-0 rounded-2xl border border-[#2D2D30] overflow-hidden bg-[#0E0E10] text-white select-none">

      {/* ── Thread Sidebar ─────────────────────────────────────────────────── */}
      <div className="w-72 flex-shrink-0 border-r border-[#2D2D30] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-[#2D2D30] space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white">💬 Inbox</h2>
            <button onClick={fetchThreads} className="text-gray-500 hover:text-white text-xs transition-colors">🔄</button>
          </div>
          {/* Platform filter tabs */}
          <div className="flex gap-1 bg-[#141416] rounded-xl p-1">
            {(['all', 'messenger', 'instagram'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex-1 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors ${filter === f ? 'bg-[#222225] text-white' : 'text-gray-500 hover:text-gray-300'}`}
              >{f === 'all' ? 'All' : f === 'messenger' ? '💬' : '📸'}</button>
            ))}
          </div>
        </div>

        {/* Thread list */}
        <div className="flex-1 overflow-y-auto">
          {loadingThreads ? (
            <div className="flex flex-col gap-2 p-3">
              {[1,2,3].map(i => (
                <div key={i} className="h-16 rounded-xl bg-[#1A1A1C] animate-pulse" />
              ))}
            </div>
          ) : visibleThreads.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-600 gap-2 p-4 text-center">
              <span className="text-2xl">📭</span>
              <span className="text-xs">No conversations found. Make sure your page has Messenger subscriptions.</span>
            </div>
          ) : (
            visibleThreads.map(thread => (
              <button
                key={thread.id}
                onClick={() => openThread(thread)}
                className={`w-full text-left p-3.5 border-b border-[#1A1A1C] transition-colors hover:bg-[#1A1A1C] ${selectedThread?.id === thread.id ? 'bg-[#1A1A1C]' : ''}`}
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

        {/* Hint */}
        {apiHint && (
          <div className="p-3 border-t border-[#2D2D30] text-[10px] text-amber-400 font-mono">{apiHint}</div>
        )}
      </div>

      {/* ── Chat Panel ─────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col">
        {!selectedThread ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-600 gap-3">
            <span className="text-5xl">💬</span>
            <span className="text-sm">Select a conversation to open it.</span>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="flex items-center justify-between p-4 border-b border-[#2D2D30]">
              <div className="flex items-center gap-2.5">
                <span className={`text-lg ${PLATFORM_COLOR[selectedThread.platform]}`}>{PLATFORM_ICON[selectedThread.platform]}</span>
                <div>
                  <div className="text-sm font-bold text-white">{selectedThread.name}</div>
                  <div className="text-[10px] text-gray-500 capitalize">{selectedThread.platform} · {selectedThread.time}</div>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loadingMsgs ? (
                <div className="flex items-center justify-center h-full text-gray-500 animate-pulse text-sm">Loading messages…</div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-600 gap-2">
                  <span className="text-3xl">📭</span>
                  <span className="text-sm">No messages in this conversation yet.</span>
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

            {/* Reply composer */}
            <div className="p-4 border-t border-[#2D2D30] space-y-2">
              <form onSubmit={handleSendReply} className="flex gap-2">
                <input
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  placeholder={`Reply via ${selectedThread.platform}…`}
                  className="flex-1 bg-[#141416] border border-[#2D2D30] rounded-xl px-3.5 py-2.5 text-xs text-white font-mono placeholder-gray-600 focus:outline-none focus:border-gray-500 transition-colors"
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
  )
}
