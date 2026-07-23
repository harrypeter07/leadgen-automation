'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import toast from 'react-hot-toast'
import AutoReplyModal from './AutoReplyModal'
import { GeminiKeyModal } from '@/components/gemini-key-modal'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Sparkles, Send, RefreshCw, Bot, MessageSquare, Plus, Key, Settings as SettingsIcon, Paperclip, CheckCircle, AlertCircle } from 'lucide-react'

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

const PLATFORM_COLOR: Record<string, string> = {
  messenger: 'text-blue-400',
  instagram: 'text-pink-400',
  facebook:  'text-blue-500',
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
  const [showAutoReply, setShowAutoReply]   = useState(false)
  const [geminiModalOpen, setGeminiModalOpen] = useState(false)
  const [isTyping, setIsTyping]             = useState(false)

  // Active connected account
  const [activeAccountIgBizId, setActiveAccountIgBizId] = useState<string>('17841411718913026')
  const [activeAccountPageId, setActiveAccountPageId] = useState<string>('1165738093294228')

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef    = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    fetch('/api/meta/active-account')
      .then(r => r.json())
      .then(data => {
        if (data.found) {
          if (data.instagramBusinessId) setActiveAccountIgBizId(data.instagramBusinessId)
          if (data.pageId) setActiveAccountPageId(data.pageId)
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  // Fetch threads
  const fetchThreads = useCallback(async () => {
    setLoadingThreads(true)
    try {
      const res = await fetch('/api/meta/instagram/messages?limit=25')
      const data = await res.json()
      if (res.ok && data.threads) {
        setThreads(data.threads)
      }
    } catch (err) {
      console.error('Failed to load threads:', err)
    } finally {
      setLoadingThreads(false)
    }
  }, [])

  useEffect(() => { fetchThreads() }, [fetchThreads])

  // Fetch messages for selected thread
  const fetchMessages = useCallback(async (thread: Thread) => {
    setLoadingMsgs(true)
    try {
      const rawId = thread.id.replace('ig_', '')
      const platform = thread.platform === 'instagram' ? 'instagram' : 'facebook'
      const res  = await fetch(`/api/meta/${platform}/messages/${rawId}?limit=50`)
      const data = await res.json()

      if (res.ok && data.data) {
        const rawMsgs = data.data.data || data.data || []
        const mapped: Message[] = rawMsgs.map((m: any) => ({
          id: m.id || String(Math.random()),
          sender: (m.from?.id === activeAccountPageId || m.from?.id === activeAccountIgBizId) ? 'system' : 'lead',
          body: m.message || (m.attachments?.data?.length ? '' : '(media)'),
          time: m.created_time ? formatMessageTime(m.created_time) : '',
          rawTime: m.created_time,
          attachments: m.attachments?.data || [],
        })).reverse()
        setMessages(mapped)
      }
    } catch (err) {
      console.error('fetchMessages error:', err)
    } finally {
      setLoadingMsgs(false)
    }
  }, [activeAccountPageId, activeAccountIgBizId])

  async function openThread(thread: Thread) {
    setSelectedThread(thread)
    setMessages([])
    await fetchMessages(thread)
    setTimeout(() => textareaRef.current?.focus(), 100)
  }

  // Send reply
  async function handleSendReply(e: React.FormEvent) {
    e.preventDefault()
    if (!replyText.trim() || !selectedThread) return
    setSending(true)

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
      const endpoint = selectedThread.platform === 'instagram'
        ? '/api/meta/instagram/messages'
        : '/api/meta/facebook/messages'
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient_id: recipientId, text: sentText }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success('Reply sent!')
        setTimeout(() => fetchMessages(selectedThread), 1500)
      } else {
        setMessages(prev => prev.filter(m => m.id !== optimisticId))
        setReplyText(sentText)
        throw new Error(data.error?.message || 'Send failed')
      }
    } catch (err: any) {
      toast.error(err.message || 'Send failed')
    } finally {
      setSending(false)
    }
  }

  // AI Generate Response using Gemini API
  async function handleGenerateAI() {
    if (!selectedThread) return
    setAiGenerating(true)
    setIsTyping(true)
    const toastId = toast.loading('Generating AI reply via Gemini...')
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
        toast.success('Gemini AI draft generated!', { id: toastId })
        textareaRef.current?.focus()
      } else {
        throw new Error(data.error || 'AI generation failed')
      }
    } catch (err: any) {
      toast.error(err.message || 'AI failed', { id: toastId })
    } finally {
      setIsTyping(false)
      setAiGenerating(false)
    }
  }

  const visibleThreads = filter === 'all' ? threads : threads.filter(t => t.platform === filter)

  return (
    <div className="space-y-4">
      {/* Reusable Gemini API Key Modal */}
      <GeminiKeyModal open={geminiModalOpen} onOpenChange={setGeminiModalOpen} />
      {showAutoReply && <AutoReplyModal onClose={() => setShowAutoReply(false)} />}

      {/* Inbox Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-border bg-card">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-foreground">Unified Social Inbox</h1>
            <p className="text-xs text-muted-foreground">Manage Instagram and Facebook DMs with AI Quick Replies.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Inline Gemini API Key button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setGeminiModalOpen(true)}
            className="gap-1.5 border-blue-500/30 text-blue-400 bg-blue-500/10 hover:bg-blue-500/20"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Set Gemini Key</span>
          </Button>

          <Button variant="outline" size="sm" onClick={() => setShowAutoReply(true)} className="gap-1.5">
            <Bot className="w-3.5 h-3.5" />
            <span>AI Bot Rules</span>
          </Button>
          <Button variant="secondary" size="sm" onClick={fetchThreads}>
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Main Inbox Layout Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 h-[calc(100vh-210px)]">
        {/* Thread Sidebar (4 cols) */}
        <Card className="md:col-span-4 flex flex-col overflow-hidden h-full">
          <CardHeader className="p-3 border-b border-border space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">Conversations</span>
              <Badge variant="outline" className="text-[10px]">{visibleThreads.length} active</Badge>
            </div>
            {/* Filter buttons */}
            <div className="grid grid-cols-3 gap-1 p-1 bg-muted rounded-lg text-xs">
              <button
                onClick={() => setFilter('all')}
                className={`py-1 rounded-md text-[11px] font-medium transition-colors ${filter === 'all' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground'}`}
              >
                All
              </button>
              <button
                onClick={() => setFilter('messenger')}
                className={`py-1 rounded-md text-[11px] font-medium transition-colors ${filter === 'messenger' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground'}`}
              >
                Messenger
              </button>
              <button
                onClick={() => setFilter('instagram')}
                className={`py-1 rounded-md text-[11px] font-medium transition-colors ${filter === 'instagram' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground'}`}
              >
                Instagram
              </button>
            </div>
          </CardHeader>

          <CardContent className="p-0 flex-1 overflow-y-auto">
            {loadingThreads ? (
              <div className="p-4 space-y-3">
                {[1,2,3,4].map(i => <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />)}
              </div>
            ) : visibleThreads.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground space-y-1">
                <MessageSquare className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
                <p className="font-medium text-foreground">No threads found</p>
                <p>Select a different filter or refresh conversations.</p>
              </div>
            ) : (
              visibleThreads.map(t => (
                <div
                  key={t.id}
                  onClick={() => openThread(t)}
                  className={`p-3.5 border-b border-border cursor-pointer transition-colors hover:bg-accent/50 ${selectedThread?.id === t.id ? 'bg-accent border-l-2 border-l-primary' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="text-xs font-semibold text-foreground truncate">{t.name}</span>
                    <span className="text-[10px] text-muted-foreground flex-shrink-0">{t.time}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{t.lastMessage}</p>
                  <div className="mt-1 flex items-center gap-1.5">
                    <Badge variant="outline" className={`text-[9px] capitalize ${PLATFORM_COLOR[t.platform]}`}>
                      {t.platform}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Thread Chat Detail (8 cols) */}
        <Card className="md:col-span-8 flex flex-col overflow-hidden h-full">
          {!selectedThread ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground space-y-3">
              <div className="p-4 rounded-full bg-primary/10 text-primary">
                <MessageSquare className="w-8 h-8" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Select a conversation</p>
                <p className="text-xs">Choose a thread from the left sidebar to view messages and generate AI responses.</p>
              </div>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <CardHeader className="p-4 border-b border-border flex flex-row items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs">
                    {selectedThread.name[0]?.toUpperCase()}
                  </div>
                  <div>
                    <CardTitle className="text-sm font-semibold">{selectedThread.name}</CardTitle>
                    <span className={`text-[10px] capitalize ${PLATFORM_COLOR[selectedThread.platform]}`}>
                      {selectedThread.platform}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setGeminiModalOpen(true)} className="gap-1 text-xs border-blue-500/30 text-blue-400">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Gemini Key</span>
                  </Button>
                </div>
              </CardHeader>

              {/* Chat Messages */}
              <CardContent className="p-4 flex-1 overflow-y-auto space-y-3">
                {loadingMsgs ? (
                  <div className="space-y-3 pt-4">
                    {[1,2,3].map(i => (
                      <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                        <div className="h-10 w-40 rounded-xl bg-muted animate-pulse" />
                      </div>
                    ))}
                  </div>
                ) : messages.length === 0 ? (
                  <div className="py-12 text-center text-xs text-muted-foreground">
                    No message history loaded for this thread.
                  </div>
                ) : (
                  messages.map(m => (
                    <div key={m.id} className={`flex ${m.sender === 'system' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-md p-3 rounded-xl text-xs space-y-1 ${
                        m.sender === 'system' 
                          ? 'bg-primary text-primary-foreground font-medium rounded-br-none' 
                          : 'bg-muted text-foreground rounded-bl-none border border-border'
                      }`}>
                        <p>{m.body}</p>
                        <span className="text-[9px] opacity-70 block text-right">{m.time}</span>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </CardContent>

              {/* Reply Compose Bar */}
              <div className="p-3 border-t border-border bg-card flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <textarea
                    ref={textareaRef}
                    rows={1}
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleSendReply(e)
                      }
                    }}
                    placeholder={`Reply via ${selectedThread.platform}...`}
                    className="flex-1 bg-background border border-input rounded-md px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none min-h-[38px]"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={aiGenerating}
                    onClick={handleGenerateAI}
                    className="gap-1 text-purple-400 border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>AI Draft</span>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={!replyText.trim() || sending}
                    onClick={handleSendReply}
                    className="gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send</span>
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
