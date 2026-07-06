'use client'

import React, { useState } from 'react'
import toast from 'react-hot-toast'

export default function SocialInboxPage() {
  const [selectedThread, setSelectedThread] = useState('1')
  const [replyText, setReplyText] = useState('')
  const [aiGenerating, setAiGenerating] = useState(false)
  const [activeFilter, setActiveFilter] = useState<'open' | 'closed' | 'spam'>('open')

  // CRM edit states
  const [leadName, setLeadName] = useState('Singapore Cafe Coffee')
  const [leadPhone, setLeadPhone] = useState('+65 9182 7304')
  const [leadEmail, setLeadEmail] = useState('contact@singaporecafe.sg')
  const [pipelineStage, setPipelineStage] = useState('nurtured')
  const [estimatedValue, setEstimatedValue] = useState(2500)
  const [internalNotes, setInternalNotes] = useState('Lead expressed strong interest in slow-load website mockup presentation.')

  const threads = [
    { id: '1', name: 'Singapore Cafe Coffee', lastMessage: 'Would love to see the website mockup layout!', time: '10m ago', platform: 'whatsapp', unread: true, status: 'open', score: 85, intent: 'positive', priority: 'high' },
    { id: '2', name: 'Zarss Tester Page', lastMessage: 'How do I integrate the API keys?', time: '1h ago', platform: 'messenger', unread: false, status: 'open', score: 40, intent: 'neutral', priority: 'medium' },
    { id: '3', name: '@restaurant_sg', lastMessage: 'Is this redesign free or paid?', time: '3h ago', platform: 'instagram', unread: true, status: 'open', score: 90, intent: 'positive', priority: 'high' },
    { id: '4', name: 'Spam Lead Advert', lastMessage: 'Buy 1000 reviews for your Google profile!', time: '2d ago', platform: 'whatsapp', unread: false, status: 'spam', score: 5, intent: 'spam', priority: 'low' },
  ]

  const chatMessages: Record<string, { sender: 'lead' | 'system'; body: string; time: string; type?: string; buttons?: string[] }[]> = {
    '1': [
      { sender: 'system', body: 'Hey Singapore Cafe Coffee! We made a free modern mockup for your website showing a 3x speed improvement. Want to check it out?', time: '11:00 AM' },
      { sender: 'lead', body: 'Hey! Oh wow, that sounds interesting. Would love to see the website mockup layout!', time: '11:05 AM' }
    ],
    '2': [
      { sender: 'lead', body: 'Hey there! How do I integrate the API keys?', time: '10:00 AM' }
    ],
    '3': [
      { sender: 'system', body: 'Hi! Spotted some SEO bugs on your Instagram landing page. We generated a free design proposal for your cafe. Let us know if you want to inspect it.', time: '9:00 AM' },
      { sender: 'lead', body: 'Is this redesign free or paid?', time: '9:15 AM' }
    ],
    '4': [
      { sender: 'lead', body: 'Buy 1000 reviews for your Google profile! Special offers starting from $49.', time: 'Jul 4' }
    ]
  }

  const currentMessages = chatMessages[selectedThread] || []
  const currentThreadMeta = threads.find(t => t.id === selectedThread)

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault()
    if (!replyText.trim()) return
    toast.success('Message dispatched to platform adapter!')
    setReplyText('')
  }

  const handleGenerateAIResponse = () => {
    setAiGenerating(true)
    const toastId = toast.loading('Gemini draft suggestion loading...', { duration: 2000 })
    setTimeout(() => {
      setReplyText("It is completely free! We build a custom home page design to show you the performance improvements first. If you like it, we can discuss the full redesign packages. Shall I send over the link?")
      setAiGenerating(false)
      toast.success('AI Response drafted!')
    }, 2000)
  }

  const handleSaveCRMDetails = (e: React.FormEvent) => {
    e.preventDefault()
    toast.success('CRM Lead Record updated successfully!')
  }

  const filteredThreads = threads.filter(t => t.status === activeFilter)

  return (
    <div className="space-y-8 select-none">
      {/* Header */}
      <div className="flex justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">Unified Inbox & CRM</h1>
          <p className="mt-1 text-sm text-gray-500 font-medium">Power conversations, validate incoming triggers, log CRM details, and toggle AI auto-responders.</p>
        </div>
        <div className="flex gap-2">
          {['open', 'closed', 'spam'].map(filter => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter as any)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors border ${
                activeFilter === filter
                  ? 'bg-[#E3B859] border-[#E3B859] text-[#141416]'
                  : 'bg-[#18181A] border-[#2D2D30] text-gray-400 hover:text-white'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-4 border border-[#2D2D30] rounded-2xl overflow-hidden bg-[#18181A] h-[650px]">
        {/* Left column: Conversation list */}
        <div className="border-r border-[#2D2D30] flex flex-col divide-y divide-[#2D2D30]">
          <div className="p-4 bg-[#141416]">
            <input
              type="text"
              placeholder="Search conversations..."
              className="w-full bg-[#18181A] border border-[#2D2D30] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#E3B859]"
            />
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-[#2D2D30]/60">
            {filteredThreads.map((t) => (
              <div
                key={t.id}
                onClick={() => setSelectedThread(t.id)}
                className={`p-4 cursor-pointer hover:bg-[#202022] transition-colors text-xs space-y-2 relative ${
                  selectedThread === t.id ? 'bg-[#222225]' : ''
                }`}
              >
                {t.unread && <span className="absolute top-4 right-4 w-2 h-2 rounded-full bg-blue-500" />}
                <div className="flex justify-between items-center pr-4">
                  <span className="font-bold text-white block">{t.name}</span>
                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{t.time}</span>
                </div>
                <p className="text-gray-400 truncate leading-relaxed">{t.lastMessage}</p>
                <div className="flex items-center justify-between pt-1">
                  <span className="inline-block text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-gray-800 text-gray-400">
                    {t.platform.toUpperCase()}
                  </span>
                  {t.intent && (
                    <span className={`inline-block text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${
                      t.intent === 'positive' ? 'bg-green-950/40 text-green-400' :
                      t.intent === 'spam' ? 'bg-red-950/40 text-red-400' : 'bg-gray-800 text-gray-500'
                    }`}>
                      {t.intent}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Center column: Active chat workspace */}
        <div className="md:col-span-2 flex flex-col justify-between h-full bg-[#141416]">
          {/* Chat header */}
          <div className="p-4 border-b border-[#2D2D30] bg-[#18181A] flex justify-between items-center text-xs">
            <div>
              <span className="font-bold text-white block">
                {threads.find((t) => t.id === selectedThread)?.name || 'Thread'}
              </span>
              <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider mt-0.5 block">
                Platform: {currentThreadMeta?.platform.toUpperCase()} • Priority:{' '}
                <strong className={currentThreadMeta?.priority === 'high' ? 'text-red-400' : 'text-gray-400'}>
                  {currentThreadMeta?.priority?.toUpperCase()}
                </strong>
              </span>
            </div>
            <div className="flex gap-2">
              <button className="px-3 py-1.5 rounded bg-gray-800 text-white hover:bg-gray-700 font-bold uppercase tracking-wider text-[9px]">
                Archive
              </button>
              <button className="px-3 py-1.5 rounded bg-blue-950 text-blue-400 border border-blue-900/30 font-bold uppercase tracking-wider text-[9px]">
                Assign
              </button>
            </div>
          </div>

          {/* Chat message history bubbles */}
          <div className="flex-1 p-5 overflow-y-auto space-y-4">
            {currentMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.sender === 'lead' ? 'justify-start' : 'justify-end'}`}>
                <div className={`p-4 rounded-2xl max-w-sm text-xs leading-relaxed ${
                  msg.sender === 'lead'
                    ? 'bg-[#18181A] text-gray-200 border border-[#2D2D30]'
                    : 'bg-[#E3B859] text-[#141416] font-medium'
                }`}>
                  <p>{msg.body}</p>
                  <span className={`text-[8px] font-bold uppercase block mt-1.5 text-right ${
                    msg.sender === 'lead' ? 'text-gray-500' : 'text-gray-900/60'
                  }`}>{msg.time}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Chat reply input form */}
          <form onSubmit={handleSendReply} className="p-4 border-t border-[#2D2D30] bg-[#18181A] space-y-3">
            <textarea
              rows={2}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              className="w-full bg-[#141416] border border-[#2D2D30] focus:border-[#E3B859] rounded-xl px-4 py-2.5 text-xs focus:outline-none transition-colors resize-none"
              placeholder="Type message reply to prospect..."
            />
            <div className="flex justify-between items-center">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleGenerateAIResponse}
                  disabled={aiGenerating}
                  className="text-[#E3B859] hover:text-[#d4ac50] text-[10px] font-bold uppercase tracking-wider disabled:opacity-50"
                >
                  ✨ AI Response Draft
                </button>
                <select
                  onChange={(e) => setReplyText(e.target.value)}
                  className="bg-[#141416] border border-[#2D2D30] rounded px-2 py-1 text-[9px] font-bold uppercase text-gray-400"
                >
                  <option value="">📋 Template</option>
                  <option value="Hi! Yes, our custom speed mockups are entirely free with no obligations. Shall I schedule a walk-through?">mockup_intro</option>
                  <option value="Great! Let's arrange a brief 10-minute demo this week to review the audit results. What day works best?">book_meeting</option>
                </select>
              </div>
              <button
                type="submit"
                className="rounded-xl bg-[#E3B859] hover:bg-[#d4ac50] text-[#141416] text-xs font-bold uppercase tracking-wider px-5 py-2.5 transition-colors shadow-md"
              >
                Send Reply
              </button>
            </div>
          </form>
        </div>

        {/* Right column: CRM integration panel */}
        <div className="p-5 overflow-y-auto space-y-6 flex flex-col justify-between h-full border-l border-[#2D2D30]/65">
          <div className="space-y-6">
            <div className="flex justify-between items-center border-b border-[#2D2D30] pb-2">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">🎯 Lead Profile (CRM)</h3>
              {currentThreadMeta && (
                <span className="text-[10px] font-mono text-[#E3B859] bg-[#E3B859]/10 px-2 py-0.5 rounded font-bold">
                  Score: {currentThreadMeta.score}
                </span>
              )}
            </div>

            <form onSubmit={handleSaveCRMDetails} className="space-y-4 text-xs">
              <div>
                <label className="block text-gray-500 text-[9px] font-bold uppercase tracking-wider mb-1.5">Contact Name</label>
                <input
                  type="text"
                  value={leadName}
                  onChange={(e) => setLeadName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#141416] border border-[#2D2D30] rounded-lg text-white text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-gray-500 text-[9px] font-bold uppercase tracking-wider mb-1.5">Phone Number</label>
                <input
                  type="text"
                  value={leadPhone}
                  onChange={(e) => setLeadPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-[#141416] border border-[#2D2D30] rounded-lg text-white text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-gray-500 text-[9px] font-bold uppercase tracking-wider mb-1.5">Email Address</label>
                <input
                  type="text"
                  value={leadEmail}
                  onChange={(e) => setLeadEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-[#141416] border border-[#2D2D30] rounded-lg text-white text-xs focus:outline-none"
                />
              </div>

              <div className="grid gap-2 grid-cols-2">
                <div>
                  <label className="block text-gray-500 text-[9px] font-bold uppercase tracking-wider mb-1.5">Pipeline Stage</label>
                  <select
                    value={pipelineStage}
                    onChange={(e) => setPipelineStage(e.target.value)}
                    className="w-full px-2 py-2 bg-[#141416] border border-[#2D2D30] rounded-lg text-white text-[10px]"
                  >
                    <option value="qualified">Qualified</option>
                    <option value="nurtured">Nurtured</option>
                    <option value="proposal_sent">Proposal Sent</option>
                    <option value="demo_scheduled">Demo Scheduled</option>
                    <option value="closed_won">Closed Won</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-500 text-[9px] font-bold uppercase tracking-wider mb-1.5">Est. Value ($)</label>
                  <input
                    type="number"
                    value={estimatedValue}
                    onChange={(e) => setEstimatedValue(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-2 py-2 bg-[#141416] border border-[#2D2D30] rounded-lg text-white text-xs focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-500 text-[9px] font-bold uppercase tracking-wider mb-1.5">Internal Notes</label>
                <textarea
                  rows={3}
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-[#141416] border border-[#2D2D30] rounded-lg text-white text-xs focus:outline-none resize-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-[#222225] border border-[#2D2D30] hover:bg-[#2A2A2E] text-white text-[10px] font-bold uppercase tracking-wider rounded-lg transition-colors"
              >
                💾 Update CRM Details
              </button>
            </form>
          </div>

          <div className="pt-4 border-t border-[#2D2D30]/60 space-y-2 text-[10px] text-gray-400 font-semibold leading-relaxed">
            <span className="text-white block uppercase tracking-wider text-[9px]">🤖 AI Conversation Insights</span>
            <p><strong>Summary:</strong> Contact is checking pricing structures of custom redesign templates.</p>
            <p><strong>Intent Classification:</strong> Positive</p>
          </div>
        </div>
      </div>
    </div>
  )
}
