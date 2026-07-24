'use client'

import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { Loader2, Check, X } from 'lucide-react'

interface Rule {
  keywords: string
  reply: string
}

interface Persona {
  name: string
  instructions: string
}

interface AutoReplyModalProps {
  onClose: () => void
  threadId?: string
  threadName?: string
}

export default function AutoReplyModal({ onClose, threadId, threadName }: AutoReplyModalProps) {
  const [rules, setRules] = useState<Rule[]>([])
  const [chatbotEnabled, setChatbotEnabled] = useState(false)
  const [chatbotPersona, setChatbotPersona] = useState('')
  const [personas, setPersonas] = useState<Persona[]>([])
  const [firstReplyDelay, setFirstReplyDelay] = useState(5)
  const [conversationDelay, setConversationDelay] = useState(2)
  const [staticReply, setStaticReply] = useState('')
  const [staticReplyEnabled, setStaticReplyEnabled] = useState(false)
  const [responseLength, setResponseLength] = useState<'extra_small' | 'short' | 'medium' | 'long'>('medium')
  
  // Dynamic Turn Directives & Business Link States
  const [firstTurnInst, setFirstTurnInst] = useState('')
  const [ongoingTurnInst, setOngoingTurnInst] = useState('')
  const [subscriptionLink, setSubscriptionLink] = useState('')
  const [maxDurationMins, setMaxDurationMins] = useState(3)
  const [maxTurns, setMaxTurns] = useState(6)
  const [inactivityHours, setInactivityHours] = useState(1)
  const [endingTalkInstruction, setEndingTalkInstruction] = useState('')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [availableModels, setAvailableModels] = useState<string[]>([])
  const [modelTestStatus, setModelTestStatus] = useState<Record<string, 'testing' | 'active' | 'limit_reached' | 'invalid' | 'idle'>>({})

  // Gemini API Key State
  const [geminiKey, setGeminiKey] = useState('')
  const [testingKey, setTestingKey] = useState(false)
  const [keyStatus, setKeyStatus] = useState<{ status: 'active' | 'invalid' | 'limit_reached' | 'idle'; message?: string }>({ status: 'idle' })

  // Custom persona creator inputs
  const [newPersonaName, setNewPersonaName] = useState('')
  const [newPersonaInst, setNewPersonaInst] = useState('')

  // Auto Reply Webhook Execution Logs State
  const [logs, setLogs] = useState<any[]>([])
  const [loadingLogs, setLoadingLogs] = useState(false)

  const fetchLogs = async () => {
    setLoadingLogs(true)
    try {
      const res = await fetch('/api/meta/instagram/auto-reply-logs')
      const data = await res.json()
      if (res.ok && data.success) {
        setLogs(data.logs || [])
      }
    } catch (err) {
      console.error('Failed to load auto-reply logs:', err)
    } finally {
      setLoadingLogs(false)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [])

  // Seeded default personas if none exist
  const DEFAULT_PERSONAS: Persona[] = [
    { name: 'Friendly Assistant', instructions: 'You are a warm, helpful, and concise customer support agent. Answer questions simply and invite them to leave their contact details.' },
    { name: 'Direct Sales Rep', instructions: 'You are a results-oriented sales representative. Highlight the benefits of our smart automation solutions starting at $99, and push for a scheduled demo or email address.' },
    { name: 'Technical Support', instructions: 'You are a clear, technical agent. Assist with troubleshooting API configurations, SMTP server checks, and Google Scraper parameters in a helpful tone.' },
  ]

  // Lock background body scroll when modal is open
  useEffect(() => {
    const originalStyle = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = originalStyle
    }
  }, [])

  // Test Gemini Key
  const handleTestKey = async () => {
    if (!geminiKey.trim()) return
    setTestingKey(true)
    setKeyStatus({ status: 'idle' })
    setAvailableModels([])
    setModelTestStatus({})
    const toastId = toast.loading('Testing Gemini API key...')
    try {
      const res = await fetch('/api/meta/gemini-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: geminiKey.trim() })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setKeyStatus({ status: 'active', message: 'Gemini key is active and working!' })
        setAvailableModels(data.models || [])
        toast.success('Gemini key is active and working!', { id: toastId })
      } else {
        const status = data.status || 'invalid'
        const errorMsg = data.error || 'Failed to verify key'
        setKeyStatus({ status, message: errorMsg })
        toast.error(`Key verification failed: ${errorMsg}`, { id: toastId })
      }
    } catch (err: any) {
      setKeyStatus({ status: 'invalid', message: err.message })
      toast.error(`Error: ${err.message}`, { id: toastId })
    } finally {
      setTestingKey(false)
    }
  }

  // Test Individual Model
  const handleTestModel = async (modelName: string) => {
    if (!geminiKey.trim()) return
    setModelTestStatus(prev => ({ ...prev, [modelName]: 'testing' }))
    try {
      const res = await fetch('/api/meta/gemini-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: geminiKey.trim(), model: modelName })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setModelTestStatus(prev => ({ ...prev, [modelName]: 'active' }))
        toast.success(`${modelName} verification succeeded!`)
      } else {
        const status = data.status === 'limit_reached' ? 'limit_reached' : 'invalid'
        setModelTestStatus(prev => ({ ...prev, [modelName]: status }))
        toast.error(`${modelName} failed: ${data.error || 'Verification failed'}`)
      }
    } catch (err: any) {
      setModelTestStatus(prev => ({ ...prev, [modelName]: 'invalid' }))
      toast.error(`Error verifying ${modelName}: ${err.message}`)
    }
  }

  // Load settings on mount
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const globalRes = await fetch('/api/meta/instagram/auto-reply')
        const globalData = await globalRes.json()
        
        let initialRules = []
        let initialChatbotEnabled = false
        let initialChatbotPersona = ''
        let initialPersonas = DEFAULT_PERSONAS
        let initialFirstReplyDelay = 5
        let initialConversationDelay = 2
        let initialStaticReply = ''
        let initialStaticReplyEnabled = false

        if (globalRes.ok) {
          initialRules = globalData.rules || []
          initialChatbotEnabled = globalData.chatbotEnabled
          initialChatbotPersona = globalData.chatbotPersona || ''
          initialPersonas = globalData.personas && globalData.personas.length > 0 ? globalData.personas : DEFAULT_PERSONAS
          initialFirstReplyDelay = globalData.firstReplyDelay !== undefined ? Number(globalData.firstReplyDelay) : 5
          initialConversationDelay = globalData.conversationDelay !== undefined ? Number(globalData.conversationDelay) : 2
          initialStaticReply = globalData.staticReply || ''
          initialStaticReplyEnabled = globalData.staticReplyEnabled || false
          if (globalData.responseLength) setResponseLength(globalData.responseLength)
          if (globalData.firstTurnInstruction) setFirstTurnInst(globalData.firstTurnInstruction)
          if (globalData.ongoingTurnInstruction) setOngoingTurnInst(globalData.ongoingTurnInstruction)
          if (globalData.subscriptionLink) setSubscriptionLink(globalData.subscriptionLink)
          if (globalData.maxDurationMins !== undefined) setMaxDurationMins(globalData.maxDurationMins)
          if (globalData.maxTurns !== undefined) setMaxTurns(globalData.maxTurns)
          if (globalData.inactivityHours !== undefined) setInactivityHours(globalData.inactivityHours)
          if (globalData.endingTalkInstruction) setEndingTalkInstruction(globalData.endingTalkInstruction)
        }

        if (threadId) {
          const threadRes = await fetch(`/api/meta/instagram/thread-config?senderId=${threadId}`)
          const threadData = await threadRes.json()
          if (threadRes.ok && threadData.success && threadData.config) {
            const cfg = threadData.config
            if (cfg.enabled !== undefined) initialChatbotEnabled = cfg.enabled
            if (cfg.persona !== undefined) initialChatbotPersona = cfg.persona
            if (cfg.firstReplyDelay !== undefined) initialFirstReplyDelay = Number(cfg.firstReplyDelay)
            if (cfg.conversationDelay !== undefined) initialConversationDelay = Number(cfg.conversationDelay)
            if (cfg.staticReply !== undefined) initialStaticReply = cfg.staticReply
            if (cfg.staticReplyEnabled !== undefined) initialStaticReplyEnabled = cfg.staticReplyEnabled
            if (cfg.responseLength !== undefined) setResponseLength(cfg.responseLength)
          }
        }

        // Fetch global SMTP/Gemini config settings
        try {
          const settingsRes = await fetch('/api/meta/settings')
          const settingsData = await settingsRes.json()
          if (settingsRes.ok && settingsData.settings) {
            setGeminiKey(settingsData.settings.GEMINI_API_KEY || '')
          }
        } catch (err) {
          console.warn('Failed to load global config:', err)
        }

        setRules(initialRules)
        setChatbotEnabled(initialChatbotEnabled)
        setChatbotPersona(initialChatbotPersona)
        setPersonas(initialPersonas)
        setFirstReplyDelay(initialFirstReplyDelay)
        setConversationDelay(initialConversationDelay)
        setStaticReply(initialStaticReply)
        setStaticReplyEnabled(initialStaticReplyEnabled)
      } catch (err) {
        console.error('Failed to load settings:', err)
        toast.error('Failed to load settings')
      } finally {
        setLoading(false)
      }
    }
    fetchSettings()
  }, [threadId])

  const handleAddRule = () => {
    setRules(prev => [...prev, { keywords: '', reply: '' }])
  }

  const handleRemoveRule = (index: number) => {
    setRules(prev => prev.filter((_, i) => i !== index))
  }

  const handleRuleChange = (index: number, field: keyof Rule, val: string) => {
    setRules(prev =>
      prev.map((r, i) => (i === index ? { ...r, [field]: val } : r))
    )
  }

  const handleAddCustomPersona = () => {
    if (!newPersonaName.trim() || !newPersonaInst.trim()) {
      toast.error('Enter both name and instructions for the persona')
      return
    }
    if (personas.some(p => p.name.toLowerCase() === newPersonaName.trim().toLowerCase())) {
      toast.error('A persona with this name already exists')
      return
    }
    const created = { name: newPersonaName.trim(), instructions: newPersonaInst.trim() }
    setPersonas(prev => [...prev, created])
    setChatbotPersona(created.instructions)
    setNewPersonaName('')
    setNewPersonaInst('')
    toast.success(`Custom persona "${created.name}" created!`)
  }

  const handleRemovePersona = (nameToRemove: string) => {
    setPersonas(prev => prev.filter(p => p.name !== nameToRemove))
    toast.success(`Removed persona "${nameToRemove}"`)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const toastId = toast.loading('Saving settings…')
    try {
      // Save global Gemini key first
      const saveSettingsRes = await fetch('/api/meta/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: {
            GEMINI_API_KEY: geminiKey.trim()
          }
        })
      })
      if (!saveSettingsRes.ok) {
        throw new Error('Failed to save Gemini API key')
      }

      let res
      if (threadId) {
        res = await fetch('/api/meta/instagram/thread-config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            senderId: threadId,
            enabled: chatbotEnabled,
            firstReplyDelay,
            conversationDelay,
            persona: chatbotPersona.trim(),
            staticReply: staticReply.trim(),
            staticReplyEnabled,
            responseLength,
          }),
        })
      } else {
        res = await fetch('/api/meta/instagram/auto-reply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rules,
            chatbotEnabled,
            chatbotPersona: chatbotPersona.trim(),
            personas,
            firstReplyDelay,
            conversationDelay,
            staticReply: staticReply.trim(),
            staticReplyEnabled,
            responseLength,
            firstTurnInstruction: firstTurnInst.trim(),
            ongoingTurnInstruction: ongoingTurnInst.trim(),
            subscriptionLink: subscriptionLink.trim(),
            maxDurationMins,
            maxTurns,
            inactivityHours,
            endingTalkInstruction: endingTalkInstruction.trim(),
          }),
        })
      }
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(threadId ? 'Thread-specific settings saved!' : 'Auto-reply configurations saved!', { id: toastId })
        onClose()
      } else {
        throw new Error(data.error || 'Failed to save settings')
      }
    } catch (err: any) {
      toast.error(err.message, { id: toastId })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white dark:bg-[#0E0E10] border border-gray-200 dark:border-[#2D2D30] rounded-2xl shadow-2xl w-full max-w-2xl mx-4 p-6 space-y-4 max-h-[90vh] overflow-y-auto text-slate-800 dark:text-white"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-[#2D2D30] pb-3">
          <div>
            <h2 className="text-slate-900 dark:text-white font-black text-lg">
              {threadId ? `🤖 Chat Settings: @${threadName}` : '🤖 AI Chatbot & Auto-Reply Settings'}
            </h2>
            <p className="text-[10px] text-slate-500 dark:text-gray-500 mt-0.5">
              {threadId
                ? `Configure custom AI persona and delay times for this specific conversation`
                : 'Automate replies to direct messages based on keywords or custom Gemini AI personas'}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 dark:text-gray-500 hover:text-slate-800 dark:hover:text-white text-xl transition-colors">✕</button>
        </div>

        {loading ? (
          <div className="py-8 text-center text-slate-400 dark:text-gray-500 animate-pulse text-xs">Loading configuration…</div>
        ) : (
          <form onSubmit={handleSave} className="space-y-5">
            {/* Gemini API Key Section */}
            <div className="p-4 rounded-xl border border-gray-200 dark:border-[#2D2D30] bg-gray-50 dark:bg-[#141416] space-y-3">
              <div>
                <h3 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                  🔑 Gemini API Key Settings
                </h3>
                <p className="text-[10px] text-slate-500 dark:text-gray-500 mt-0.5">
                  Verify and save your Google Gemini API Key used for outreach drafts and automated autopilot replies.
                </p>
              </div>

              <div className="flex gap-2">
                <input
                  type="password"
                  value={geminiKey}
                  onChange={e => setGeminiKey(e.target.value)}
                  placeholder="Enter Gemini API Key..."
                  className="flex-1 bg-white dark:bg-[#0E0E10] border border-gray-200 dark:border-[#2D2D30] rounded-xl px-3.5 py-2 text-xs text-slate-850 dark:text-white placeholder-gray-405 dark:placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={handleTestKey}
                  disabled={testingKey || !geminiKey.trim()}
                  className="px-4 py-2 rounded-xl bg-purple-100 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/30 text-purple-700 dark:text-purple-300 text-xs font-bold hover:bg-purple-200 dark:hover:bg-purple-900/40 transition-colors disabled:opacity-40 flex items-center gap-1.5 whitespace-nowrap"
                >
                  {testingKey ? (
                    <><Loader2 className="w-3 h-3 animate-spin" /> Testing…</>
                  ) : (
                    'Test Key'
                  )}
                </button>
              </div>

              {keyStatus.status !== 'idle' && (
                <div className={`text-[10px] font-bold p-2.5 rounded-lg border flex items-center gap-1.5 ${
                  keyStatus.status === 'active'
                    ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900/30 text-green-700 dark:text-green-400'
                    : keyStatus.status === 'limit_reached'
                    ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/30 text-amber-700 dark:text-amber-400'
                    : 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/30 text-red-700 dark:text-red-400'
                }`}>
                  {keyStatus.status === 'active' ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <X className="w-3.5 h-3.5" />
                  )}
                  <span>{keyStatus.message}</span>
                </div>
              )}

              {keyStatus.status === 'active' && availableModels.length > 0 && (
                <div className="pt-3 border-t border-gray-250 dark:border-[#2D2D30]/40 space-y-2.5">
                  <span className="text-[9px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider block">📋 Available Models (Click to test generation):</span>
                  <div className="flex flex-wrap gap-1.5">
                    {availableModels.map(m => {
                      const isWorking = m === 'gemini-3.1-flash-lite' || m === 'gemma-4-31b-it';
                      const status = modelTestStatus[m] || 'idle';
                      
                      return (
                        <button
                          key={m}
                          type="button"
                          onClick={() => handleTestModel(m)}
                          disabled={status === 'testing'}
                          className={`text-[9px] font-semibold px-2 py-1 rounded-lg border transition-all flex items-center gap-1.5 focus:outline-none active:scale-95 ${
                            status === 'testing'
                              ? 'bg-purple-50 dark:bg-purple-950/20 border-purple-250 text-purple-600 animate-pulse'
                              : status === 'active'
                              ? 'bg-green-50 dark:bg-green-950/20 border-green-200 text-green-700 font-bold'
                              : status === 'limit_reached'
                              ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-250 text-amber-700'
                              : status === 'invalid'
                              ? 'bg-red-50 dark:bg-red-950/20 border-red-250 text-red-700'
                              : isWorking
                              ? 'bg-purple-100 dark:bg-purple-900/40 border-purple-200 text-purple-700 font-bold hover:bg-purple-200'
                              : 'bg-white dark:bg-[#0E0E10] border-gray-200 dark:border-[#2D2D30] text-slate-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#1a1a1c]'
                          }`}
                        >
                          <span>{m}</span>
                          {status === 'testing' && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
                          {status === 'active' && <Check className="w-2.5 h-2.5" />}
                          {status === 'limit_reached' && <span className="text-[7px] uppercase font-bold text-amber-500">(429)</span>}
                          {status === 'invalid' && <span className="text-[7px] uppercase font-bold text-red-500">(Error)</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Static Test Reply Override Section */}
            <div className="p-4 rounded-xl border border-gray-200 dark:border-[#2D2D30] bg-gray-50 dark:bg-[#141416] space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                    ⚡ Instant Response Override (Test Mode)
                  </h3>
                  <p className="text-[10px] text-slate-500 dark:text-gray-500 mt-0.5">
                    If enabled, this exact text will be sent immediately in response to ANY incoming message.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={staticReplyEnabled}
                    onChange={e => {
                      const val = e.target.checked
                      setStaticReplyEnabled(val)
                      if (val) setChatbotEnabled(false)
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-300 dark:bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>

              {staticReplyEnabled && (
                <div className="space-y-1 pt-2 border-t border-gray-200 dark:border-[#2D2D30]/40">
                  <input
                    type="text"
                    value={staticReply}
                    onChange={e => setStaticReply(e.target.value)}
                    placeholder="e.g. System is active! Replying instantly."
                    className="w-full bg-white dark:bg-[#0E0E10] border border-gray-200 dark:border-[#2D2D30] rounded-xl px-3.5 py-2 text-xs text-slate-850 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-colors"
                  />
                </div>
              )}
            </div>

            {/* AI Chatbot Section */}
            <div className="p-4 rounded-xl border border-gray-200 dark:border-[#2D2D30] bg-gray-50 dark:bg-[#141416] space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">
                    {threadId ? 'Thread Auto-Pilot Override' : 'Gemini AI Auto-Pilot'}
                  </h3>
                  <p className="text-[10px] text-slate-500 dark:text-gray-500 mt-0.5">
                    {threadId
                      ? 'Toggle whether Gemini AI auto-replies to this specific chat'
                      : 'Enable human-like conversations using Gemini AI when keyword rules do not match'}
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={chatbotEnabled}
                    onChange={e => {
                      const val = e.target.checked
                      setChatbotEnabled(val)
                      if (val) setStaticReplyEnabled(false)
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-300 dark:bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>

              {chatbotEnabled && (
                <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-[#2D2D30]/40">
                  {/* Reply Delays */}
                  <div className="grid gap-3 sm:grid-cols-2 bg-white dark:bg-[#0E0E10] border border-gray-200 dark:border-[#2D2D30] rounded-xl p-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider block">⏱️ First Reply Delay (seconds)</label>
                      <input
                        type="number"
                        min="0"
                        max="300"
                        value={firstReplyDelay}
                        onChange={e => setFirstReplyDelay(Number(e.target.value))}
                        className="w-full bg-gray-50 dark:bg-[#141416] border border-gray-200 dark:border-[#2D2D30] rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-white focus:outline-none focus:border-purple-500"
                      />
                      <p className="text-[8px] text-slate-400 dark:text-gray-500">Delay for the first message in this conversation</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider block">🔁 Conversation Delay (seconds)</label>
                      <input
                        type="number"
                        min="0"
                        max="300"
                        value={conversationDelay}
                        onChange={e => setConversationDelay(Number(e.target.value))}
                        className="w-full bg-gray-50 dark:bg-[#141416] border border-gray-200 dark:border-[#2D2D30] rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-white focus:outline-none focus:border-purple-500"
                      />
                      <p className="text-[8px] text-slate-400 dark:text-gray-500">Delay for subsequent messages after the first reply</p>
                    </div>

                    <div className="space-y-1 pt-1 border-t border-gray-200 dark:border-[#2D2D30]/40">
                      <label className="text-[9px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider block">⏳ Max Session Duration (Minutes)</label>
                      <input
                        type="number"
                        min="1"
                        max="60"
                        value={maxDurationMins}
                        onChange={e => setMaxDurationMins(Number(e.target.value))}
                        className="w-full bg-gray-50 dark:bg-[#141416] border border-gray-200 dark:border-[#2D2D30] rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-white focus:outline-none focus:border-purple-500"
                      />
                      <p className="text-[8px] text-slate-400 dark:text-gray-500">Max active chat duration (default: 3 mins)</p>
                    </div>

                    <div className="space-y-1 pt-1 border-t border-gray-200 dark:border-[#2D2D30]/40">
                      <label className="text-[9px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider block">💬 Max Bot Turns Per Session</label>
                      <input
                        type="number"
                        min="1"
                        max="30"
                        value={maxTurns}
                        onChange={e => setMaxTurns(Number(e.target.value))}
                        className="w-full bg-gray-50 dark:bg-[#141416] border border-gray-200 dark:border-[#2D2D30] rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-white focus:outline-none focus:border-purple-500"
                      />
                      <p className="text-[8px] text-slate-400 dark:text-gray-500">Max bot replies per active chat (default: 6 replies)</p>
                    </div>

                    <div className="space-y-1 sm:col-span-2 pt-1 border-t border-gray-200 dark:border-[#2D2D30]/40">
                      <label className="text-[9px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider block">⏸️ Session Reset Inactivity Window (Hours)</label>
                      <input
                        type="number"
                        min="1"
                        max="24"
                        value={inactivityHours}
                        onChange={e => setInactivityHours(Number(e.target.value))}
                        className="w-full bg-gray-50 dark:bg-[#141416] border border-gray-200 dark:border-[#2D2D30] rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-white focus:outline-none focus:border-purple-500"
                      />
                      <p className="text-[8px] text-slate-400 dark:text-gray-500">Inactivity gap (default: 1 hour) before session & duration counters reset for fresh chatting.</p>
                    </div>
                  </div>

                  {/* Conversation Closing / Ending Directive */}
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider block">
                      👋 Conversation Closing / Ending Directive
                    </label>
                    <textarea
                      value={endingTalkInstruction}
                      onChange={e => setEndingTalkInstruction(e.target.value)}
                      className="w-full bg-white dark:bg-[#0E0E10] border border-gray-200 dark:border-[#2D2D30] rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-colors resize-none leading-relaxed"
                      rows={2}
                      placeholder="How should the bot wrap up the talk when max duration is reached..."
                    />
                  </div>

                  {/* Response Length */}
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider block">📏 Response Length</label>
                    <div className="flex gap-2">
                      {(['extra_small', 'short', 'medium', 'long'] as const).map(len => (
                        <button
                          key={len}
                          type="button"
                          onClick={() => setResponseLength(len)}
                          className={`flex-1 py-1.5 rounded-lg border text-[9px] font-bold uppercase tracking-wider transition-all ${
                            responseLength === len
                              ? 'bg-purple-100 dark:bg-purple-950/50 border-purple-400 dark:border-purple-600 text-purple-700 dark:text-purple-300'
                              : 'bg-white dark:bg-[#0E0E10] border-gray-200 dark:border-[#2D2D30] text-slate-500 dark:text-gray-500 hover:border-purple-300 hover:text-purple-600'
                          }`}
                        >
                          {len === 'extra_small' ? '⚡ X-Small' : len === 'short' ? '💬 Small' : len === 'medium' ? '📝 Medium' : '📚 Large'}
                        </button>
                      ))}
                    </div>
                    <p className="text-[8px] text-slate-400 dark:text-gray-500">
                      {responseLength === 'extra_small' ? 'MAXIMUM 5-8 words — extremely short and punchy reply' : responseLength === 'short' ? '1 sentence max — very quick, punchy reply' : responseLength === 'medium' ? '2-3 sentences — balanced and natural' : '4-5 sentences — detailed and expressive'}
                    </p>
                  </div>

                  {/* Select Predefined Persona */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider block">Load Predefined Persona</label>
                    <div className="flex flex-wrap gap-1.5">
                      {personas.map(p => (
                        <div key={p.name} className="flex items-center bg-white dark:bg-[#0E0E10] border border-gray-200 dark:border-[#2D2D30] rounded-xl pl-2.5 pr-1.5 py-1">
                          <button
                            type="button"
                            onClick={() => setChatbotPersona(p.instructions)}
                            className={`text-[9px] font-bold uppercase transition-colors mr-2 ${
                              chatbotPersona === p.instructions ? 'text-[#E3B859]' : 'text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-white'
                            }`}
                          >
                            👤 {p.name}
                          </button>
                          {!DEFAULT_PERSONAS.some(d => d.name === p.name) && (
                            <button
                              type="button"
                              onClick={() => handleRemovePersona(p.name)}
                              className="text-[9px] text-slate-400 hover:text-red-500 dark:text-gray-600 dark:hover:text-red-400 font-mono"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Active instructions text area */}
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider block">Active AI Chatbot Persona & Tone</label>
                    <textarea
                      value={chatbotPersona}
                      onChange={e => setChatbotPersona(e.target.value)}
                      className="w-full bg-white dark:bg-[#0E0E10] border border-gray-200 dark:border-[#2D2D30] rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-colors resize-none leading-relaxed"
                      rows={3}
                      placeholder="Write active prompt instructions..."
                    />
                  </div>

                  {/* First Turn Stranger Directive */}
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider block">
                      👋 First-Time Stranger DM Greeting Directive
                    </label>
                    <textarea
                      value={firstTurnInst}
                      onChange={e => setFirstTurnInst(e.target.value)}
                      className="w-full bg-white dark:bg-[#0E0E10] border border-gray-200 dark:border-[#2D2D30] rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-colors resize-none leading-relaxed"
                      rows={2}
                      placeholder="Instruction for welcoming new first-time strangers..."
                    />
                  </div>

                  {/* Ongoing Turn Directive */}
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider block">
                      💬 Ongoing Conversation Directive
                    </label>
                    <textarea
                      value={ongoingTurnInst}
                      onChange={e => setOngoingTurnInst(e.target.value)}
                      className="w-full bg-white dark:bg-[#0E0E10] border border-gray-200 dark:border-[#2D2D30] rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-colors resize-none leading-relaxed"
                      rows={2}
                      placeholder="Instruction for ongoing dialogue..."
                    />
                  </div>

                  {/* Business / Subscription Link */}
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider block">
                      🔗 Business / Offer / Call-To-Action Link
                    </label>
                    <input
                      type="url"
                      value={subscriptionLink}
                      onChange={e => setSubscriptionLink(e.target.value)}
                      className="w-full bg-white dark:bg-[#0E0E10] border border-gray-200 dark:border-[#2D2D30] rounded-xl px-3.5 py-2 text-xs text-slate-800 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-colors"
                      placeholder="e.g. https://yourbusiness.com/link"
                    />
                  </div>

                  {/* Add custom persona fields */}
                  <div className="p-3 bg-white dark:bg-[#0E0E10] border border-gray-200 dark:border-[#2D2D30] rounded-xl space-y-2">
                    <span className="text-[9px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider block">➕ Save Custom Persona Template</span>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <input
                        value={newPersonaName}
                        onChange={e => setNewPersonaName(e.target.value)}
                        placeholder="Persona Name (e.g. Sales Expert)"
                        className="sm:col-span-1 bg-gray-50 dark:bg-[#141416] border border-gray-200 dark:border-[#2D2D30] rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-white focus:outline-none focus:border-purple-500"
                      />
                      <input
                        value={newPersonaInst}
                        onChange={e => setNewPersonaInst(e.target.value)}
                        placeholder="AI instructions / business goal..."
                        className="sm:col-span-2 bg-gray-50 dark:bg-[#141416] border border-gray-200 dark:border-[#2D2D30] rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-white focus:outline-none focus:border-purple-500"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleAddCustomPersona}
                      disabled={!newPersonaName.trim() || !newPersonaInst.trim()}
                      className="w-full py-1.5 rounded-lg bg-purple-100 dark:bg-purple-900/40 border border-purple-200 dark:border-purple-800/30 text-purple-700 dark:text-purple-300 text-[9px] font-bold uppercase hover:bg-purple-200 dark:hover:bg-purple-800/30 transition-colors disabled:opacity-40"
                    >
                      Save Persona Template
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Keyword Rules Section */}
            {!threadId && (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">Keyword-based Rules</h3>
                  <button
                    type="button"
                    onClick={handleAddRule}
                    className="px-2.5 py-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/30 text-purple-700 dark:text-purple-300 text-[10px] font-bold uppercase transition-colors"
                  >
                    + Add Rule
                  </button>
                </div>

                {rules.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-gray-200 dark:border-[#2D2D30] p-6 text-center text-slate-400 dark:text-gray-600 text-xs">
                    No keyword rules created.
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-[35vh] overflow-y-auto pr-1">
                    {rules.map((rule, index) => (
                      <div key={index} className="p-3.5 rounded-xl border border-gray-200 dark:border-[#2D2D30] bg-gray-50 dark:bg-[#141416] space-y-2.5 relative">
                        <button
                          type="button"
                          onClick={() => handleRemoveRule(index)}
                          className="absolute right-3 top-3 text-slate-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 text-xs transition-colors"
                        >
                          ✕
                        </button>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider block">When message contains keywords</label>
                            <input
                              value={rule.keywords}
                              onChange={e => handleRuleChange(index, 'keywords', e.target.value)}
                              placeholder="price, cost, pricing (comma separated)"
                              className="w-full bg-white dark:bg-[#0E0E10] border border-gray-200 dark:border-[#2D2D30] rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-purple-500"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider block">Reply with message</label>
                            <input
                              value={rule.reply}
                              onChange={e => handleRuleChange(index, 'reply', e.target.value)}
                              placeholder="Our custom automation solutions start at $99..."
                              className="w-full bg-white dark:bg-[#0E0E10] border border-gray-200 dark:border-[#2D2D30] rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-purple-500"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Live Webhook Execution Logs */}
            <div className="p-4 rounded-xl border border-gray-200 dark:border-[#2D2D30] bg-gray-50 dark:bg-[#141416] space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                    📜 Live Auto-Reply Execution Logs
                  </h3>
                  <p className="text-[10px] text-slate-500 dark:text-gray-500 mt-0.5">
                    View real-time decision logs showing exactly why the bot replied or skipped a message.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={fetchLogs}
                  className="px-2.5 py-1 rounded-lg bg-white dark:bg-[#0E0E10] border border-gray-200 dark:border-[#2D2D30] hover:bg-gray-100 dark:hover:bg-[#1a1a1c] text-[10px] font-bold text-slate-700 dark:text-white transition-all active:scale-95 flex items-center gap-1"
                >
                  Refresh Logs
                </button>
              </div>

              {loadingLogs ? (
                <div className="text-center py-4 text-slate-400 text-xs animate-pulse">Loading execution logs...</div>
              ) : logs.length === 0 ? (
                <div className="text-center py-4 text-slate-400 text-xs border border-dashed border-gray-200 dark:border-[#2D2D30] rounded-xl">
                  No auto-reply events logged yet.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {logs.map((log: any, idx: number) => (
                    <div key={idx} className="p-2.5 rounded-lg border border-gray-100 dark:border-[#1E1E22] bg-white dark:bg-[#0E0E10] text-[10px] space-y-1 font-mono">
                      <div className="flex items-center justify-between text-[8px] text-slate-400">
                        <span>{new Date(log.timestamp).toLocaleString()}</span>
                        <span className={`px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                          log.status === 'sent' ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400' :
                          log.status === 'skipped' ? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' :
                          'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400'
                        }`}>
                          {log.status}
                        </span>
                      </div>
                      <div className="text-slate-700 dark:text-gray-300">
                        <span className="font-semibold text-purple-600 dark:text-purple-400">User:</span> {log.message}
                      </div>
                      <div className="text-slate-700 dark:text-gray-300">
                        <span className="font-semibold text-[#E3B859]">Match:</span> <span className="underline">{log.matchedType}</span>
                        {log.modelUsed && <span className="text-[8px] text-slate-400 ml-1.5">({log.modelUsed})</span>}
                      </div>
                      {log.replyContent && (
                        <div className="text-slate-600 dark:text-gray-400 whitespace-pre-line bg-gray-50 dark:bg-[#141416] p-1.5 rounded-md mt-1 border border-gray-100 dark:border-[#1c1c1f]">
                          <span className="font-semibold text-green-600">Reply:</span> {log.replyContent}
                        </div>
                      )}
                      {log.error && (
                        <div className="text-red-500 bg-red-50 dark:bg-red-950/20 p-1.5 rounded-md mt-1 border border-red-100">
                          <span className="font-semibold">Error:</span> {log.error}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-3 border-t border-gray-200 dark:border-[#2D2D30]">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl bg-gray-50 dark:bg-[#141416] border border-gray-200 dark:border-[#2D2D30] text-slate-500 dark:text-gray-400 text-xs font-bold hover:text-slate-800 dark:hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-[#E3B859] hover:bg-[#d4ac50] text-slate-950 text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-40"
              >
                {saving ? 'Saving…' : 'Save Rules'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
