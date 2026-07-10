'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import toast from 'react-hot-toast'
import AutoReplyModal from './AutoReplyModal'

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
  rawTime?: string
  attachments?: Array<{
    id: string
    mime_type?: string
    file_url?: string
    name?: string
    image_data?: { url?: string }
  }>
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
const PLATFORM_GRADIENT: Record<string, string> = {
  messenger: 'from-blue-600 to-blue-500',
  instagram: 'from-pink-600 to-purple-600',
  facebook:  'from-blue-700 to-blue-500',
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

function formatMessageTime(ts: string) {
  try {
    const d = new Date(ts)
    const today = new Date()
    const isToday = d.toDateString() === today.toDateString()
    if (isToday) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch { return ts }
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

  const existingRecipients = threads
    .filter(t => t.platform === platform && t.participantId)
    .map(t => ({ id: t.participantId!, name: t.name, platform: t.platform }))

  const filtered = searchQuery
    ? existingRecipients.filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : existingRecipients

  async function handleSend() {
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
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-white font-black text-lg">✏️ New DM</h2>
            <p className="text-[10px] text-gray-500 mt-0.5">Send a reply to an existing conversation</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl transition-colors">✕</button>
        </div>

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

        <div className="space-y-1.5">
          <label className="text-[9px] font-bold text-gray-500 uppercase tracking-wider block">
            Select Recipient
            <span className="ml-1 text-gray-600 normal-case font-normal">(from existing conversations)</span>
          </label>
          {existingRecipients.length === 0 ? (
            <div className="bg-[#141416] border border-[#2D2D30] rounded-xl p-4 text-center">
              <p className="text-xs text-gray-500 font-semibold">No {platform} conversations yet.</p>
              <div className="mt-2 bg-amber-950/20 border border-amber-900/30 rounded-lg p-2 text-[10px] text-amber-400">
                ⚠️ App is in Dev Mode — only app testers appear
              </div>
            </div>
          ) : (
            <>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search contacts…"
                className="w-full bg-[#141416] border border-[#2D2D30] rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-gray-500"
              />
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

        <div className="space-y-1.5">
          <label className="text-[9px] font-bold text-gray-500 uppercase tracking-wider block">Message</label>
          <textarea
            rows={3}
            value={message}
            onChange={e => setMessage(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSend() }}
            placeholder={selectedUser ? `Message to ${selectedUser.name}…` : 'Select a recipient first…'}
            disabled={!selectedUser}
            className="w-full bg-[#141416] border border-[#2D2D30] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-gray-500 transition-colors resize-none disabled:opacity-40"
          />
        </div>

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
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-40 bg-gradient-to-r ${PLATFORM_GRADIENT[platform]} text-white`}
          >
            {sending ? '⏳ Sending…' : `📤 Send ${platform === 'instagram' ? 'IG DM' : 'Message'}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Typing Indicator ─────────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="bg-[#222225] border border-[#2D2D30] rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
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
  const [showAutoReply, setShowAutoReply]   = useState(false)
  const [isTyping, setIsTyping]             = useState(false)

  // Thread specific autopilot state overrides
  const [autopilotOverrides, setAutopilotOverrides] = useState<Record<string, boolean>>({})
  const [globalAutopilotEnabled, setGlobalAutopilotEnabled] = useState(false)

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const pollingRef     = useRef<NodeJS.Timeout | null>(null)
  const selectedThreadRef = useRef<Thread | null>(null)
  const textareaRef    = useRef<HTMLTextAreaElement>(null)

  // Keep ref in sync
  useEffect(() => { selectedThreadRef.current = selectedThread }, [selectedThread])

  // Auto-scroll to bottom whenever messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  // ── Autopilot settings ─────────────────────────────────────────────────────
  const fetchAutopilotSettings = useCallback(async () => {
    try {
      const [overridesRes, configRes] = await Promise.all([
        fetch('/api/meta/instagram/thread-autopilot'),
        fetch('/api/meta/instagram/auto-reply'),
      ])
      const overridesData = await overridesRes.json()
      const configData = await configRes.json()
      if (overridesRes.ok && overridesData.success) {
        setAutopilotOverrides(overridesData.overrides || {})
      }
      if (configRes.ok && configData.success) {
        setGlobalAutopilotEnabled(configData.chatbotEnabled || false)
      }
    } catch (err) {
      console.error('Failed to load autopilot settings:', err)
    }
  }, [])

  useEffect(() => { fetchAutopilotSettings() }, [fetchAutopilotSettings])

  const senderId = selectedThread?.participantId || selectedThread?.id.replace('ig_', '')
  const threadOverride = senderId ? autopilotOverrides[senderId] : undefined
  const isAutopilotActive = threadOverride !== undefined ? threadOverride : globalAutopilotEnabled

  async function toggleThreadAutopilot() {
    if (!selectedThread || !senderId) return
    const nextState = !isAutopilotActive
    const toastId = toast.loading(`${nextState ? 'Enabling' : 'Disabling'} Autopilot…`)
    try {
      const res = await fetch('/api/meta/instagram/thread-autopilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senderId, enabled: nextState }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setAutopilotOverrides(data.overrides || {})
        toast.success(`Autopilot ${nextState ? 'ON' : 'OFF'} for this chat!`, { id: toastId })
      } else {
        throw new Error(data.error || 'Failed to update')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed', { id: toastId })
    }
  }

  // ── Fetch threads ──────────────────────────────────────────────────────────
  const fetchThreads = useCallback(async (silent = false) => {
    if (!silent) setLoadingThreads(true)
    const fetched: Thread[] = []

    try {
      const fbRes  = await fetch('/api/meta/facebook/messages?limit=20')
      const fbData = await fbRes.json()
      const fbConvs = fbData.data?.data ?? fbData.data ?? []
      if (Array.isArray(fbConvs) && fbConvs.length > 0) {
        for (const conv of fbConvs) {
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
      const igConvs = igData.data?.data ?? igData.data ?? []
      if (Array.isArray(igConvs) && igConvs.length > 0) {
        for (const conv of igConvs) {
          const msgs = conv.messages?.data || []
          const last = msgs[0]
          const otherParticipant = conv.participants?.data?.find(
            (p: { id: string; name?: string; username?: string }) =>
              p.username !== 'smritifyp' && p.id !== '17841411718913026'
          ) || conv.participants?.data?.[0]
          const displayName = otherParticipant?.name || (otherParticipant?.username ? `@${otherParticipant.username}` : 'Instagram User')
          fetched.push({
            id: `ig_${conv.id}`,
            name: displayName,
            platform: 'instagram',
            lastMessage: last?.message || (last ? '📎 Attachment' : '(no message)'),
            time: conv.updated_time ? timeAgo(conv.updated_time) : (last?.created_time ? timeAgo(last.created_time) : ''),
            unread: false,
            participantId: otherParticipant?.id,
          })
        }
        setIgError('')
      } else if (igData.error) {
        setIgError(typeof igData.error === 'object' ? igData.error.message || JSON.stringify(igData.error) : igData.error)
      } else {
        setIgError('')
      }
    } catch { /* ignore */ }

    setThreads(fetched)
    if (!silent) setLoadingThreads(false)
  }, [])

  useEffect(() => { fetchThreads() }, [fetchThreads])

  // ── Fetch messages for selected thread ────────────────────────────────────
  const fetchMessages = useCallback(async (thread: Thread, silent = false) => {
    if (!silent) setLoadingMsgs(true)
    try {
      const rawId = thread.id.replace('ig_', '')
      const platform = thread.platform === 'instagram' ? 'instagram' : 'facebook'
      const res  = await fetch(`/api/meta/${platform}/messages/${rawId}?limit=50`)
      const data = await res.json()

      if (!res.ok || !data.success) {
        if (!silent) setMessages([])
        if (!silent) setLoadingMsgs(false)
        return
      }

      const rawMsgs: Array<{
        id: string
        from?: { name?: string; username?: string; id?: string }
        message?: string
        created_time?: string
        attachments?: { data?: Array<{ id: string; mime_type?: string; file_url?: string; name?: string; image_data?: { url?: string } }> }
      }> = data.data?.data ?? data.data ?? []

      const pageId = '1165738093294228'
      const myIgId = '17841411718913026'

      const mapped: Message[] = rawMsgs.map(m => ({
        id:     m.id || String(Math.random()),
        sender: ((m.from?.id === pageId || m.from?.id === myIgId) ? 'system' : 'lead') as 'system' | 'lead',
        body:   m.message || (m.attachments?.data?.length ? '' : '(media)'),
        time:   m.created_time ? formatMessageTime(m.created_time) : '',
        rawTime: m.created_time,
        attachments: m.attachments?.data || [],
      })).reverse()

      setMessages(prev => {
        // Only update if messages actually changed (avoid flicker during polling)
        if (JSON.stringify(prev.map(m => m.id)) === JSON.stringify(mapped.map(m => m.id))) return prev
        return mapped
      })
    } catch (err) {
      console.error('[Inbox] fetchMessages error:', err)
    }
    if (!silent) setLoadingMsgs(false)
  }, [])

  // ── Real-time polling ──────────────────────────────────────────────────────
  useEffect(() => {
    if (pollingRef.current) clearInterval(pollingRef.current)

    if (selectedThread) {
      // Poll every 4 seconds for new messages
      pollingRef.current = setInterval(() => {
        if (selectedThreadRef.current) {
          fetchMessages(selectedThreadRef.current, true)
        }
      }, 4000)
    }

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [selectedThread, fetchMessages])

  async function openThread(thread: Thread) {
    // Stop existing poll
    if (pollingRef.current) clearInterval(pollingRef.current)
    setSelectedThread(thread)
    setMessages([])
    await fetchMessages(thread)
    // Focus reply input
    setTimeout(() => textareaRef.current?.focus(), 100)
  }

  // ── Send reply ─────────────────────────────────────────────────────────────
  async function handleSendReply(e: React.FormEvent) {
    e.preventDefault()
    if (!replyText.trim() || !selectedThread) return
    setSending(true)

    // Optimistically add message
    const optimisticId = `opt_${Date.now()}`
    const optimisticMsg: Message = {
      id: optimisticId,
      sender: 'system',
      body: replyText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }
    setMessages(prev => [...prev, optimisticMsg])
    const sentText = replyText
    setReplyText('')

    try {
      const recipientId = selectedThread.participantId || selectedThread.id.replace('ig_', '')
      const endpoint    = selectedThread.platform === 'instagram'
        ? '/api/meta/instagram/messages'
        : '/api/meta/facebook/messages'
      const res  = await fetch(endpoint, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ recipient_id: recipientId, text: sentText }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success('Sent!', { duration: 1500 })

        // Trigger n8n webhook for outbound manual message
        const n8nUrl = '/api/meta/n8n-trigger'
        fetch(n8nUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'manual_reply',
            platform: selectedThread.platform,
            recipientId,
            threadId: selectedThread.id,
            senderName: selectedThread.name,
            message: sentText,
            timestamp: new Date().toISOString(),
          }),
        }).catch(() => {})

        // Refresh messages after short delay to get server-assigned ID
        setTimeout(() => fetchMessages(selectedThread, true), 1500)
      } else {
        // Rollback optimistic update on failure
        setMessages(prev => prev.filter(m => m.id !== optimisticId))
        setReplyText(sentText)
        throw new Error(data.error?.message || data.error || 'Send failed')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Send failed')
    }
    setSending(false)
  }

  // ── AI Generate ───────────────────────────────────────────────────────────
  async function handleGenerateAI() {
    if (!selectedThread) return
    setAiGenerating(true)
    setIsTyping(true)
    const toastId = toast.loading('Generating AI response…')
    try {
      const history = messages.slice(-6).map(m => ({
        role: m.sender === 'system' ? 'system' : 'user',
        text: m.body,
      }))
      const lastUserMsg = messages.filter(m => m.sender === 'lead').slice(-1)[0]?.body || 'Hello'
      const res = await fetch('/api/meta/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: lastUserMsg, conversationHistory: history }),
      })
      const data = await res.json()
      if (res.ok && data.reply) {
        setReplyText(data.reply)
        toast.success('AI draft ready!', { id: toastId })
        textareaRef.current?.focus()
      } else {
        throw new Error(data.error || 'AI generation failed')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'AI failed', { id: toastId })
    }
    setIsTyping(false)
    setAiGenerating(false)
  }

  const visibleThreads = filter === 'all' ? threads : threads.filter(t => t.platform === filter)

  return (
    <>
      {showCompose && <ComposeDMModal onClose={() => { setShowCompose(false); fetchThreads() }} threads={threads} />}
      {showAutoReply && <AutoReplyModal onClose={() => setShowAutoReply(false)} />}

      <div className="flex flex-col h-[calc(100vh-120px)] rounded-2xl border border-[#2D2D30] overflow-hidden bg-[#0A0A0C] text-white select-none">
        <div className="flex flex-1 overflow-hidden">

          {/* ── Thread Sidebar ─────────────────────────────────────────────── */}
          <div className="w-72 flex-shrink-0 border-r border-[#2D2D30] flex flex-col bg-[#0E0E10]">
            <div className="p-4 border-b border-[#2D2D30] space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-black text-white tracking-tight">Inbox</h2>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setShowAutoReply(true)}
                    className="p-1.5 rounded-lg bg-[#141416] border border-[#2D2D30] hover:bg-[#1e1e21] text-xs transition-all"
                    title="AI Settings"
                  >
                    🤖
                  </button>
                  <button
                    onClick={() => setShowCompose(true)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white text-[10px] font-bold uppercase tracking-wider transition-all"
                  >
                    ✏️ New DM
                  </button>
                  <button
                    onClick={() => fetchThreads()}
                    className="p-1.5 rounded-lg bg-[#141416] border border-[#2D2D30] hover:bg-[#1e1e21] text-xs transition-all"
                    title="Refresh"
                  >
                    🔄
                  </button>
                </div>
              </div>

              {/* Platform filter tabs */}
              <div className="flex gap-1 bg-[#141416] rounded-xl p-1">
                {([
                  { key: 'all',       label: 'All',        icon: '🌐' },
                  { key: 'messenger', label: 'Messenger',   icon: '💬' },
                  { key: 'instagram', label: 'Instagram',   icon: '📸' },
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
                  <span className="text-xs font-semibold text-gray-500">No conversations found.</span>
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
                    className={`w-full text-left p-4 border-b border-[#1A1A1C] transition-all hover:bg-[#141416] group ${
                      selectedThread?.id === thread.id
                        ? 'bg-[#141416] border-l-2 border-l-purple-500'
                        : 'border-l-2 border-l-transparent'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Avatar */}
                      <div className={`w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center font-black text-xs text-white bg-gradient-to-br ${
                        thread.platform === 'instagram' ? 'from-pink-500 to-purple-600' : 'from-blue-500 to-blue-700'
                      }`}>
                        {thread.name[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <span className="text-xs font-bold text-white truncate">{thread.name}</span>
                          <span className="text-[9px] text-gray-600 flex-shrink-0">{thread.time}</span>
                        </div>
                        <p className="text-[11px] text-gray-500 truncate leading-tight">{thread.lastMessage}</p>
                        <span className={`text-[9px] font-semibold mt-0.5 inline-block ${PLATFORM_COLOR[thread.platform]}`}>
                          {PLATFORM_ICON[thread.platform]} {thread.platform}
                        </span>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* ── Chat Panel ──────────────────────────────────────────────────── */}
          <div className="flex-1 flex flex-col bg-[#0A0A0C]">
            {!selectedThread ? (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-600 gap-4">
                <div className="w-16 h-16 rounded-2xl bg-[#141416] border border-[#2D2D30] flex items-center justify-center text-3xl">
                  💬
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-gray-400">Select a conversation</p>
                  <p className="text-xs text-gray-600 mt-1">Choose from the left sidebar to start messaging</p>
                </div>
                <button
                  onClick={() => setShowCompose(true)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white text-xs font-bold uppercase tracking-wider transition-all"
                >
                  ✏️ Compose New DM
                </button>
              </div>
            ) : (
              <>
                {/* Chat header */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#2D2D30] bg-[#0E0E10]">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-xs text-white bg-gradient-to-br ${
                      selectedThread.platform === 'instagram' ? 'from-pink-500 to-purple-600' : 'from-blue-500 to-blue-700'
                    }`}>
                      {selectedThread.name[0]?.toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white leading-tight">{selectedThread.name}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`text-[9px] font-bold ${PLATFORM_COLOR[selectedThread.platform]}`}>
                          {PLATFORM_ICON[selectedThread.platform]} {selectedThread.platform}
                        </span>
                        <span className="text-gray-700">·</span>
                        <span className="text-[9px] text-gray-600">{selectedThread.time}</span>
                        {/* Live indicator */}
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" title="Live polling active" />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={toggleThreadAutopilot}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-wider transition-all ${
                        isAutopilotActive
                          ? 'bg-purple-950/50 border-purple-700/50 text-purple-300'
                          : 'bg-[#141416] border-[#2D2D30] text-gray-500 hover:text-white hover:border-gray-500'
                      }`}
                    >
                      🤖 Autopilot: {isAutopilotActive ? 'ON' : 'OFF'}
                    </button>
                    <button
                      onClick={() => setShowCompose(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#141416] border border-[#2D2D30] text-gray-400 text-[10px] font-bold hover:text-white hover:border-gray-500 transition-all"
                    >
                      ✏️ New DM
                    </button>
                  </div>
                </div>

                {/* Messages area */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
                  {loadingMsgs ? (
                    <div className="flex flex-col gap-3 pt-4">
                      {[1,2,3].map(i => (
                        <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                          <div className={`h-10 rounded-2xl bg-[#1A1A1C] animate-pulse ${i % 2 === 0 ? 'w-48' : 'w-36'}`} />
                        </div>
                      ))}
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-600 gap-2">
                      <span className="text-3xl">📭</span>
                      <span className="text-sm">No messages in this conversation yet.</span>
                    </div>
                  ) : (
                    <>
                      {messages.map((msg, idx) => {
                        const isSystem = msg.sender === 'system'
                        const showTime = idx === messages.length - 1 ||
                          messages[idx + 1]?.sender !== msg.sender ||
                          (idx < messages.length - 1 && msg.rawTime && messages[idx + 1]?.rawTime &&
                            Math.abs(new Date(msg.rawTime).getTime() - new Date(messages[idx + 1].rawTime!).getTime()) > 300000)

                        return (
                          <div key={msg.id} className={`flex ${isSystem ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-xs lg:max-w-md ${isSystem ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
                              <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                                isSystem
                                  ? 'bg-gradient-to-br from-[#E3B859] to-[#d4a84d] text-[#141416] font-semibold rounded-br-sm shadow-lg shadow-yellow-900/20'
                                  : 'bg-[#1E1E22] text-gray-100 border border-[#2D2D30] rounded-bl-sm'
                              }`}>
                                {msg.body && <p>{msg.body}</p>}
                                {msg.attachments && msg.attachments.length > 0 && msg.attachments.map(att => {
                                  const imgUrl = att.file_url || att.image_data?.url
                                  const isImage = att.mime_type?.startsWith('image') || (imgUrl && /\.(jpg|jpeg|png|gif|webp)/i.test(imgUrl))
                                  const isVideo = att.mime_type?.startsWith('video') || (imgUrl && /\.(mp4|mov|avi)/i.test(imgUrl || ''))
                                  if (isImage && imgUrl) return (
                                    <a key={att.id} href={imgUrl} target="_blank" rel="noreferrer" className="block mt-2">
                                      <img src={imgUrl} alt={att.name || 'attachment'} className="rounded-xl max-w-[220px] max-h-[200px] object-cover border border-white/10" />
                                    </a>
                                  )
                                  if (isVideo && imgUrl) return (
                                    <video key={att.id} src={imgUrl} controls className="rounded-xl mt-2 max-w-[220px]" />
                                  )
                                  return (
                                    <a key={att.id} href={imgUrl || '#'} target="_blank" rel="noreferrer"
                                      className="flex items-center gap-1.5 mt-2 text-[11px] underline opacity-80">
                                      📎 {att.name || 'Attachment'}
                                    </a>
                                  )
                                })}
                              </div>
                              {showTime && (
                                <span className={`text-[9px] px-1 ${isSystem ? 'text-gray-600 text-right' : 'text-gray-600'}`}>
                                  {msg.time}
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                      {isTyping && <TypingIndicator />}
                    </>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Reply bar */}
                <div className="px-4 py-3 border-t border-[#2D2D30] bg-[#0E0E10]">
                  <form onSubmit={handleSendReply} className="flex items-end gap-2">
                    <textarea
                      ref={textareaRef}
                      rows={1}
                      value={replyText}
                      onChange={e => {
                        setReplyText(e.target.value)
                        // Auto-resize
                        e.target.style.height = 'auto'
                        e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          handleSendReply(e)
                        }
                      }}
                      placeholder={`Reply via ${selectedThread.platform}… (Enter to send, Shift+Enter for newline)`}
                      className="flex-1 bg-[#141416] border border-[#2D2D30] rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#3D3D42] transition-colors resize-none leading-relaxed"
                      style={{ minHeight: '42px', maxHeight: '120px' }}
                    />
                    <button
                      type="button"
                      onClick={handleGenerateAI}
                      disabled={aiGenerating}
                      className="px-3 py-2.5 rounded-xl bg-purple-950/50 border border-purple-800/40 text-purple-300 text-xs font-bold hover:bg-purple-900/40 transition-colors disabled:opacity-40 flex items-center gap-1 whitespace-nowrap"
                    >
                      {aiGenerating ? '⏳' : '✨'} AI
                    </button>
                    <button
                      type="submit"
                      disabled={!replyText.trim() || sending}
                      className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#E3B859] to-[#d4a84d] text-[#141416] text-xs font-bold disabled:opacity-40 hover:from-[#edc060] hover:to-[#dbb050] transition-all flex items-center gap-1.5 whitespace-nowrap"
                    >
                      {sending ? '⏳' : '📤'} Send
                    </button>
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
