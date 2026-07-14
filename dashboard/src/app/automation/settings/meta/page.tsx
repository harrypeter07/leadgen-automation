'use client'

import React, { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import Link from 'next/link'

// ─── Field configuration ───────────────────────────────────────────────────────
const SECRET_FIELDS = new Set([
  'META_APP_SECRET', 'META_PAGE_ACCESS_TOKEN', 'META_VERIFY_TOKEN',
  'META_WEBHOOK_SECRET', 'META_LONG_LIVED_USER_TOKEN', 'META_SYSTEM_USER_TOKEN', 'WHATSAPP_PERMANENT_TOKEN',
])

interface FieldConfig {
  key: string
  label: string
  description: string
  required?: boolean
  readOnly?: boolean
}

const SECTIONS: Array<{ title: string; icon: string; fields: FieldConfig[] }> = [
  {
    title: 'AI Chatbot & Rules', icon: '🤖',
    fields: []
  },
  {
    title: 'Meta App', icon: '🔵',
    fields: [
      { key: 'META_APP_ID',      label: 'App ID',      description: 'Your Meta Developer App ID', required: true },
      { key: 'META_APP_SECRET',  label: 'App Secret',  description: 'Secret key for signing API requests', required: true },
      { key: 'META_APP_MODE',    label: 'App Mode',    description: 'development or live' },
    ]
  },
  {
    title: 'Facebook Page', icon: '📘',
    fields: [
      { key: 'META_PAGE_ID',            label: 'Page ID',            description: 'Numeric Facebook Page ID', required: true },
      { key: 'META_PAGE_NAME',          label: 'Page Name',          description: 'Display name of your page' },
      { key: 'META_PAGE_ACCESS_TOKEN',  label: 'Page Access Token',  description: 'Page-scoped access token for Graph API calls', required: true },
      { key: 'META_PAGE_SUBSCRIPTION_ID', label: 'Page Subscription ID', description: 'Webhook subscription ID' },
    ]
  },
  {
    title: 'Instagram', icon: '📸',
    fields: [
      { key: 'INSTAGRAM_APP_ID',       label: 'Instagram App ID',    description: 'Instagram-specific App ID', required: true },
      { key: 'INSTAGRAM_USERNAME',     label: 'Username',            description: 'Instagram business username (no @)' },
      { key: 'INSTAGRAM_BUSINESS_ID',  label: 'Business Account ID', description: 'IG Business Account numeric ID', required: true },
    ]
  },
  {
    title: 'Business Portfolio', icon: '💼',
    fields: [
      { key: 'BUSINESS_PORTFOLIO_ID',  label: 'Portfolio ID',     description: 'Meta Business Portfolio / Manager ID' },
      { key: 'META_SYSTEM_USER_ID',    label: 'System User ID',   description: 'System User numeric ID for permanent tokens' },
      { key: 'META_SYSTEM_USER_TOKEN', label: 'System User Token',description: 'Permanent access token from System User' },
    ]
  },
  {
    title: 'Webhook', icon: '🔗',
    fields: [
      { key: 'META_VERIFY_TOKEN',         label: 'Verify Token',    description: 'Token for Meta webhook verification challenge', required: true },
      { key: 'META_WEBHOOK_CALLBACK_URL', label: 'Callback URL',    description: 'Webhook endpoint URL registered in Meta Dashboard', required: true },
      { key: 'META_WEBHOOK_SECRET',       label: 'Webhook Secret',  description: 'App secret for HMAC payload signature verification' },
    ]
  },
  {
    title: 'OAuth', icon: '🔑',
    fields: [
      { key: 'META_OAUTH_REDIRECT_URI',    label: 'OAuth Redirect URI',    description: 'Authorized callback URL for OAuth code exchange', required: true },
      { key: 'META_LONG_LIVED_USER_TOKEN', label: 'Long-Lived User Token', description: '60-day token from OAuth code exchange' },
    ]
  },
  {
    title: 'Graph API', icon: '⚡',
    fields: [
      { key: 'META_GRAPH_API_VERSION', label: 'API Version', description: 'e.g. v23.0', required: true },
      { key: 'META_GRAPH_BASE_URL',    label: 'Base URL',    description: 'e.g. https://graph.facebook.com', required: true },
    ]
  },
  {
    title: 'WhatsApp Cloud API', icon: '💬',
    fields: [
      { key: 'WHATSAPP_PHONE_NUMBER_ID',     label: 'Phone Number ID',           description: 'WA Cloud API Phone Number ID' },
      { key: 'WHATSAPP_BUSINESS_ACCOUNT_ID', label: 'Business Account ID (WABA)', description: 'WhatsApp Business Account ID' },
      { key: 'WHATSAPP_PERMANENT_TOKEN',     label: 'Permanent Token',            description: 'Permanent system-user access token for WA Cloud API' },
    ]
  },
  {
    title: 'Gemini Keys', icon: '✨',
    fields: []
  },
]

// ─── FieldRow component ───────────────────────────────────────────────────────
function FieldRow({ field, value, isSet, onChange }: {
  field: FieldConfig
  value: string
  isSet?: boolean
  onChange: (key: string, val: string) => void
}) {
  const [visible, setVisible]   = useState(false)
  const [copying, setCopying]   = useState(false)
  const isSecret = SECRET_FIELDS.has(field.key)

  function handleCopy() {
    if (!value || value.includes('•')) { toast.error('Cannot copy a masked value.'); return }
    navigator.clipboard.writeText(value)
    setCopying(true); setTimeout(() => setCopying(false), 1200)
    toast.success('Copied!')
  }

  const isMasked = value.includes('•')

  return (
    <div className="p-4 bg-[#141416] border border-[#2D2D30]/80 rounded-xl space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest block">{field.key}</span>
          <span className="text-xs font-bold text-white">
            {field.label}
            {field.required && <span className="text-red-400 ml-1">*</span>}
            {isSet && <span className="ml-2 text-[10px] text-green-400 font-mono">✓ set</span>}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isSecret && (
            <button
              onClick={() => setVisible(v => !v)}
              className="p-1.5 rounded-lg bg-[#222225] border border-[#2D2D30] text-gray-400 hover:text-white transition-colors text-xs"
              title={visible ? 'Hide' : 'Reveal'}
            >{visible ? '🙈' : '👁️'}</button>
          )}
          <button
            onClick={handleCopy}
            className="p-1.5 rounded-lg bg-[#222225] border border-[#2D2D30] text-gray-400 hover:text-white transition-colors text-xs"
            title="Copy"
          >{copying ? '✓' : '📋'}</button>
        </div>
      </div>
      <input
        type={isSecret && !visible ? 'password' : 'text'}
        value={isMasked && !visible ? '' : value}
        onChange={e => onChange(field.key, e.target.value)}
        placeholder={isMasked ? '(stored — type to update)' : `Enter ${field.label}…`}
        className="w-full bg-[#0E0E10] border border-[#2D2D30] rounded-xl px-3.5 py-2.5 text-xs text-white font-mono placeholder-gray-600 focus:outline-none focus:border-gray-500 transition-colors"
      />
      <p className="text-[10px] text-gray-500">{field.description}</p>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function MetaSettingsPage() {
  const [settings, setSettings]       = useState<Record<string, string>>({})
  const [setFlags, setSetFlags]       = useState<Record<string, boolean>>({})
  const [loading, setLoading]         = useState(true)
  const [saving, setSaving]           = useState(false)
  const [seeding, setSeeding]         = useState(false)
  const [testResults, setTestResults] = useState<Record<string, { status: string; ms: number; detail: string }>>({})
  const [testing, setTesting]         = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState('AI Chatbot & Rules')
  const [configured, setConfigured]   = useState(false)
  const [missing, setMissing]         = useState<string[]>([])
  const [lastSaved, setLastSaved]     = useState<string | null>(null)

  // Custom multiple Gemini Keys states
  const [geminiKeys, setGeminiKeys] = useState<string[]>([''])
  const [keyStatuses, setKeyStatuses] = useState<Record<number, { loading: boolean; status?: string; error?: string; models?: string[] }>>({})

  // Connected Accounts state
  const [accounts, setAccounts] = useState<any[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState<string>('')

  // Account-specific Settings states
  const [chatbotEnabled, setChatbotEnabled] = useState(false)
  const [chatbotPersona, setChatbotPersona] = useState('')
  const [autoReplyRules, setAutoReplyRules] = useState<any[]>([])
  const [firstReplyDelay, setFirstReplyDelay] = useState(8)
  const [conversationDelay, setConversationDelay] = useState(4)
  const [staticReplyEnabled, setStaticReplyEnabled] = useState(false)
  const [staticReplyOverride, setStaticReplyOverride] = useState('')
  const [isActive, setIsActive] = useState(false)

  // ── Load connected accounts ───────────────────────────────────────────────
  const fetchAccounts = useCallback(async (selectId?: string) => {
    try {
      const res = await fetch('/api/automation/accounts')
      const data = await res.json()
      if (data.accounts) {
        setAccounts(data.accounts)
        // Auto-select active account or requested id
        const active = data.accounts.find((a: any) => a.is_active)
        if (selectId) {
          setSelectedAccountId(selectId)
        } else if (active) {
          setSelectedAccountId(active.id)
        } else if (data.accounts.length > 0 && !selectedAccountId) {
          setSelectedAccountId(data.accounts[0].id)
        }
      }
    } catch (err) {
      console.error('Failed to load accounts:', err)
    }
  }, [selectedAccountId])

  // ── Load settings from DB on mount ─────────────────────────────────────────
  const loadSettings = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/meta/settings')
      const data = await res.json()
      if (data.settings) {
        const vals: Record<string, string>  = {}
        const flags: Record<string, boolean> = {}
        for (const [k, v] of Object.entries(data.settings)) {
          if (k.endsWith('__set')) {
            flags[k.replace('__set', '')] = v as boolean
          } else {
            vals[k] = v as string
          }
        }
        setSettings(vals)
        setSetFlags(flags)
        setConfigured(data.configured ?? false)
        setMissing(data.missing ?? [])

        // Load Gemini Keys state
        try {
          const keysVal = vals.SAVED_GEMINI_API_KEYS
          const parsed = keysVal ? JSON.parse(keysVal) : []
          setGeminiKeys(parsed.length > 0 ? parsed : [''])
        } catch {
          setGeminiKeys([''])
        }
      }
      await fetchAccounts()
    } catch {
      toast.error('Failed to load config from DB.')
    }
    setLoading(false)
  }, [fetchAccounts])

  useEffect(() => { loadSettings() }, [])

  // Sync settings with selected account settings when it changes
  useEffect(() => {
    if (!selectedAccountId) return
    const acc = accounts.find(a => a.id === selectedAccountId)
    if (acc) {
      setChatbotEnabled(acc.chatbot_enabled ?? false)
      setChatbotPersona(acc.chatbot_persona || 'You are a helpful, professional assistant.')
      setAutoReplyRules(Array.isArray(acc.auto_reply_rules) ? acc.auto_reply_rules : [])
      setFirstReplyDelay(acc.first_reply_delay ?? 8)
      setConversationDelay(acc.conversation_delay ?? 4)
      setStaticReplyEnabled(acc.static_reply_enabled ?? false)
      setStaticReplyOverride(acc.static_reply_override || '')
      setIsActive(acc.is_active ?? false)

      // Also set the specific settings values so the test sections can query them
      if (acc.credentials) {
        setSettings(prev => ({
          ...prev,
          META_PAGE_ID: acc.credentials.page_id || '',
          INSTAGRAM_BUSINESS_ID: acc.platform === 'instagram' ? acc.credentials.page_id : '',
          META_PAGE_ACCESS_TOKEN: acc.credentials.access_token || '',
          INSTAGRAM_USERNAME: acc.credentials.ig_username || acc.account_name || ''
        }))
      }
    }
  }, [selectedAccountId, accounts])

  // ── Auto-seed from env if DB is empty ────────────────────────────────────────
  useEffect(() => {
    if (!loading && Object.values(settings).every(v => !v)) {
      fetch('/api/meta/config/seed', { method: 'POST' })
        .then(r => r.json())
        .then(d => { if (d.seeded) { toast.success('Config seeded from environment!'); loadSettings() } })
        .catch(() => {})
    }
  }, [loading, settings, loadSettings])

  function handleChange(key: string, val: string) {
    setSettings(prev => ({ ...prev, [key]: val }))
  }

  // Save global configurations
  async function handleSaveGlobal() {
    setSaving(true)
    const toastId = toast.loading('Saving global configurations…')
    try {
      const toSave: Record<string, string> = {}
      for (const [k, v] of Object.entries(settings)) {
        if (v && !v.includes('•')) toSave[k] = v
      }

      const cleanKeys = geminiKeys.filter(Boolean)
      toSave.SAVED_GEMINI_API_KEYS = JSON.stringify(cleanKeys)

      const activeKeys = cleanKeys.filter(k => k && !k.includes('•'))
      if (activeKeys.length > 0) {
        toSave.GEMINI_API_KEY = activeKeys[0]
      }

      const res  = await fetch('/api/meta/settings', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ settings: toSave }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(data.message || 'Saved!', { id: toastId })
        setLastSaved(new Date().toLocaleTimeString())
        loadSettings()
      } else {
        throw new Error(data.error || 'Save failed')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed', { id: toastId })
    }
    setSaving(false)
  }

  // Save account-specific chatbot / reply settings
  async function handleSaveAccountSettings() {
    if (!selectedAccountId) {
      toast.error('No account selected.')
      return
    }
    setSaving(true)
    const toastId = toast.loading('Saving account configuration...')
    try {
      const acc = accounts.find(a => a.id === selectedAccountId)
      if (!acc) throw new Error('Account record not found.')

      const payload = {
        id: selectedAccountId,
        platform: acc.platform,
        account_name: acc.account_name,
        app_id: acc.app_id,
        credentials: acc.credentials,
        chatbot_enabled: chatbotEnabled,
        chatbot_persona: chatbotPersona,
        auto_reply_rules: autoReplyRules,
        first_reply_delay: firstReplyDelay,
        conversation_delay: conversationDelay,
        static_reply_enabled: staticReplyEnabled,
        static_reply_override: staticReplyOverride,
        is_active: isActive
      }

      const res = await fetch('/api/automation/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      if (res.ok && data.success) {
        toast.success('Account configuration saved successfully!', { id: toastId })
        setLastSaved(new Date().toLocaleTimeString())
        await fetchAccounts(selectedAccountId)
      } else {
        throw new Error(data.error || 'Save failed.')
      }
    } catch (err: any) {
      toast.error(err.message, { id: toastId })
    }
    setSaving(false)
  }

  // Make selected account the active platform connection
  async function handleActivateAccount() {
    if (!selectedAccountId) return
    const toastId = toast.loading('Activating account...')
    try {
      const acc = accounts.find(a => a.id === selectedAccountId)
      if (!acc) throw new Error('Account not found.')

      const payload = {
        id: selectedAccountId,
        platform: acc.platform,
        account_name: acc.account_name,
        app_id: acc.app_id,
        credentials: acc.credentials,
        is_active: true
      }

      const res = await fetch('/api/automation/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(`${acc.account_name} is now active!`, { id: toastId })
        await fetchAccounts(selectedAccountId)
      } else {
        throw new Error(data.error || 'Activation failed.')
      }
    } catch (err: any) {
      toast.error(err.message, { id: toastId })
    }
  }

  // Gemini keys list handlers
  function updateGeminiKey(index: number, val: string) {
    const updated = [...geminiKeys]
    updated[index] = val
    setGeminiKeys(updated)
  }

  function addGeminiKey() {
    setGeminiKeys([...geminiKeys, ''])
  }

  function removeGeminiKey(index: number) {
    const updated = geminiKeys.filter((_, i) => i !== index)
    setGeminiKeys(updated.length > 0 ? updated : [''])
  }

  async function testGeminiKey(index: number, keyStr: string) {
    let keyToTest = keyStr.trim()
    if (!keyToTest) {
      toast.error('Please enter an API key to check.')
      return
    }
    if (keyToTest.includes('•')) {
      toast.error('Masked keys cannot be tested. Enter a new key to check status.')
      return
    }

    setKeyStatuses(prev => ({ ...prev, [index]: { loading: true } }))
    try {
      const res = await fetch('/api/meta/gemini-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: keyToTest }),
      })
      const data = await res.json()
      if (res.ok) {
        setKeyStatuses(prev => ({
          ...prev,
          [index]: {
            loading: false,
            status: data.status,
            error: data.error,
            models: data.models,
          }
        }))
        if (data.status === 'active') {
          toast.success(`Key #${index + 1} is Active!`)
        } else {
          toast.error(`Key #${index + 1} status: ${data.error || 'inactive'}`)
        }
      } else {
        throw new Error(data.error || 'API verification request failed.')
      }
    } catch (err: any) {
      setKeyStatuses(prev => ({
        ...prev,
        [index]: { loading: false, status: 'error', error: err.message }
      }))
      toast.error(err.message)
    }
  }

  // Connection testing helper
  async function handleTest(target: string, endpoint: string) {
    setTesting(target)
    const start = Date.now()
    try {
      const res  = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ settings }) })
      const data = await res.json()
      const ms   = Date.now() - start
      setTestResults(prev => ({
        ...prev,
        [target]: { status: res.ok ? 'success' : 'error', ms, detail: data.message || data.error || JSON.stringify(data).slice(0, 120) }
      }))
      if (res.ok) toast.success(`${target} test passed!`)
      else toast.error(`${target} test failed.`)
    } catch {
      setTestResults(prev => ({ ...prev, [target]: { status: 'error', ms: Date.now() - start, detail: 'Network error.' } }))
      toast.error(`${target} test errored.`)
    }
    setTesting(null)
  }

  const currentSection = SECTIONS.find(s => s.title === activeSection) ?? SECTIONS[0]

  // Add a new auto reply keyword rule
  function addRule() {
    setAutoReplyRules([...autoReplyRules, { keywords: '', reply: '' }])
  }

  // Update rule keywords or reply content
  function updateRule(index: number, fieldName: 'keywords' | 'reply', value: string) {
    const updated = [...autoReplyRules]
    updated[index] = { ...updated[index], [fieldName]: value }
    setAutoReplyRules(updated)
  }

  // Remove rule
  function removeRule(index: number) {
    const updated = autoReplyRules.filter((_, i) => i !== index)
    setAutoReplyRules(updated)
  }

  return (
    <div className="space-y-6 text-white select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#2D2D30] pb-6">
        <div>
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
            ⚙️ Meta & Chatbot Config
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Configure Meta Developers, Rotate Gemini Keys, and manage separate chatbot profiles.
            {lastSaved && <span className="ml-2 text-green-400 text-[11px]">✓ Saved at {lastSaved}</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Config status */}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[10px] font-bold uppercase tracking-wider ${configured ? 'bg-green-900/30 border-green-800/30 text-green-300' : 'bg-red-900/30 border-red-800/30 text-red-300'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${configured ? 'bg-green-400' : 'bg-red-400 animate-pulse'}`}></span>
            {configured ? 'Configured' : `Missing ${missing.length}`}
          </div>
          <Link href="/automation/testing" className="px-3 py-2 rounded-xl bg-[#222225] border border-[#2D2D30] text-xs font-bold text-gray-300 hover:text-white transition-colors">
            🧪 Test Console
          </Link>
          
          {activeSection === 'AI Chatbot & Rules' ? (
            <button 
              onClick={handleSaveAccountSettings} 
              disabled={saving || loading || !selectedAccountId} 
              className="px-5 py-2 rounded-xl bg-[#E3B859] hover:bg-[#d4ac50] disabled:opacity-40 text-[#141416] text-xs font-bold uppercase tracking-wider transition-colors"
            >
              {saving ? 'Saving…' : '💾 Save Account Settings'}
            </button>
          ) : (
            <button 
              onClick={handleSaveGlobal} 
              disabled={saving || loading} 
              className="px-5 py-2 rounded-xl bg-[#E3B859] hover:bg-[#d4ac50] disabled:opacity-40 text-[#141416] text-xs font-bold uppercase tracking-wider transition-colors"
            >
              {saving ? 'Saving…' : '💾 Save Global Settings'}
            </button>
          )}
        </div>
      </div>

      {/* Persistent Account Switcher Section */}
      <div className="p-5 bg-[#141416] border border-[#2D2D30]/80 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1 flex-1">
          <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest block font-bold">Active Connected Account Switcher</span>
          <div className="flex items-center gap-3">
            <select
              value={selectedAccountId}
              onChange={e => setSelectedAccountId(e.target.value)}
              className="bg-[#0E0E10] border border-[#2D2D30] rounded-xl px-4 py-2.5 text-sm text-white font-medium focus:outline-none focus:border-gray-500 transition-colors min-w-[280px]"
            >
              {accounts.length === 0 ? (
                <option value="">No Accounts Connected</option>
              ) : (
                accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.platform === 'instagram' ? '📸' : acc.platform === 'messenger' ? '💬' : '📘'} {acc.account_name} {acc.is_active ? '(ACTIVE)' : ''}
                  </option>
                ))
              )}
            </select>
            <button
              onClick={handleActivateAccount}
              disabled={!selectedAccountId || isActive}
              className="px-4 py-2.5 rounded-xl bg-purple-950/40 border border-purple-900/30 hover:bg-purple-900/40 text-purple-300 text-xs font-bold disabled:opacity-40 transition-colors whitespace-nowrap"
            >
              {isActive ? '✓ Selected Account Active' : '⚡ Set Selected Account as Active'}
            </button>
          </div>
        </div>
        
        {/* Selected Account Info Summary */}
        {selectedAccountId && (() => {
          const acc = accounts.find(a => a.id === selectedAccountId)
          if (!acc) return null
          return (
            <div className="px-4 py-3 bg-[#0E0E10] border border-[#2D2D30] rounded-xl text-xs space-y-1 font-mono min-w-[280px]">
              <div><span className="text-gray-500 uppercase tracking-wider text-[9px]">Account ID:</span> {acc.id.slice(0, 8)}...</div>
              <div><span className="text-gray-500 uppercase tracking-wider text-[9px]">Page / Biz ID:</span> {acc.credentials?.page_id || 'Not configured'}</div>
              <div>
                <span className="text-gray-500 uppercase tracking-wider text-[9px]">Platform:</span> 
                <span className="text-purple-400 font-bold ml-1 uppercase">{acc.platform}</span>
              </div>
            </div>
          )
        })()}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-gray-500 animate-pulse text-sm">Loading configuration…</div>
      ) : (
        <div className="flex gap-6">
          {/* Left Navigation Menu */}
          <aside className="w-52 flex-shrink-0 space-y-1">
            {SECTIONS.map(s => {
              const hasValue = s.title === 'Gemini Keys'
                ? geminiKeys.some(k => k && !k.includes('•'))
                : s.title === 'AI Chatbot & Rules'
                ? chatbotEnabled
                : s.fields.some(f => settings[f.key] || setFlags[f.key])
              return (
                <button
                  key={s.title}
                  onClick={() => setActiveSection(s.title)}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors text-left ${
                    activeSection === s.title
                      ? 'bg-[#222225] text-white border border-[#2D2D30]'
                      : 'text-gray-500 hover:text-white hover:bg-[#1A1A1C]'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span>{s.icon}</span>
                    <span>{s.title}</span>
                  </span>
                  {hasValue && <span className="text-[8px] text-green-400">●</span>}
                </button>
              )
            })}
          </aside>

          {/* Right Content Panel */}
          <div className="flex-1 space-y-4">
            {/* Section Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#2D2D30]">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <span className="text-lg">{currentSection.icon}</span>
                {currentSection.title} Settings
              </h2>
              {currentSection.title !== 'Gemini Keys' && currentSection.title !== 'AI Chatbot & Rules' && (
                <button
                  onClick={() => handleTest(currentSection.title, `/api/meta/test?target=${currentSection.title.toLowerCase().replace(/\s+/g, '_')}`)}
                  disabled={testing === currentSection.title}
                  className="px-3 py-1.5 rounded-xl bg-purple-950/40 border border-purple-900/30 text-purple-400 hover:bg-purple-900/30 text-[10px] font-bold uppercase tracking-wider transition-colors disabled:opacity-40"
                >{testing === currentSection.title ? 'Testing…' : '⚡ Test Section'}</button>
              )}
            </div>

            {/* Test result log summary */}
            {currentSection.title !== 'Gemini Keys' && currentSection.title !== 'AI Chatbot & Rules' && testResults[currentSection.title] && (
              <div className={`p-3 rounded-xl border text-xs font-mono flex items-center gap-3 ${
                testResults[currentSection.title].status === 'success'
                  ? 'bg-green-950/30 border-green-900/40 text-green-400'
                  : 'bg-red-950/30 border-red-900/40 text-red-400'
              }`}>
                <span>{testResults[currentSection.title].status === 'success' ? '✓' : '✗'}</span>
                <span>{testResults[currentSection.title].detail}</span>
                <span className="ml-auto text-gray-500">{testResults[currentSection.title].ms}ms</span>
              </div>
            )}

            {/* AI Chatbot & Rules custom section rendering */}
            {activeSection === 'AI Chatbot & Rules' ? (
              <div className="space-y-5">
                {!selectedAccountId ? (
                  <div className="p-8 text-center bg-[#141416]/40 border border-[#2D2D30]/60 rounded-xl text-gray-500 text-xs">
                    Please select a connected account above to configure chatbot rules.
                  </div>
                ) : (
                  <>
                    {/* Chatbot General Config Card */}
                    <div className="p-5 bg-[#141416] border border-[#2D2D30]/80 rounded-xl space-y-4">
                      <div className="flex items-center justify-between border-b border-[#2D2D30]/60 pb-3">
                        <div>
                          <h4 className="text-xs font-bold text-white uppercase tracking-wider">🤖 AI Autopilot Chatbot</h4>
                          <p className="text-[10px] text-gray-500 mt-0.5">Toggle and customize AI automated responses for this account.</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={chatbotEnabled}
                            onChange={e => setChatbotEnabled(e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#E3B859]"></div>
                          <span className="ml-2 text-xs font-medium text-gray-300 select-none">
                            {chatbotEnabled ? 'Enabled' : 'Disabled'}
                          </span>
                        </label>
                      </div>

                      {/* Chatbot Persona Prompt */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-mono text-gray-500 uppercase tracking-widest block font-bold">AI Chatbot Persona Prompt</label>
                        <textarea
                          value={chatbotPersona}
                          onChange={e => setChatbotPersona(e.target.value)}
                          placeholder="Configure how the AI agent acts, behaves, and describes your business..."
                          rows={4}
                          className="w-full bg-[#0E0E10] border border-[#2D2D30] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-gray-500 transition-colors leading-relaxed font-sans"
                        />
                        <p className="text-[10px] text-gray-500 leading-normal">
                          Define your chatbot's core role, services, pricing structure, and conversation rules. This prompt will be passed directly to Gemini for automated auto-replies.
                        </p>
                      </div>

                      {/* Response Delays */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-mono text-gray-500 uppercase tracking-widest block font-bold">First Reply Delay (Seconds)</label>
                          <input
                            type="number"
                            value={firstReplyDelay}
                            onChange={e => setFirstReplyDelay(parseInt(e.target.value, 10) || 0)}
                            className="w-full bg-[#0E0E10] border border-[#2D2D30] rounded-xl px-3.5 py-2.5 text-xs text-white font-mono placeholder-gray-600 focus:outline-none focus:border-gray-500 transition-colors"
                          />
                          <p className="text-[9px] text-gray-500">Wait time before replying to the first message in a thread.</p>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-mono text-gray-500 uppercase tracking-widest block font-bold">Conversation Delay (Seconds)</label>
                          <input
                            type="number"
                            value={conversationDelay}
                            onChange={e => setConversationDelay(parseInt(e.target.value, 10) || 0)}
                            className="w-full bg-[#0E0E10] border border-[#2D2D30] rounded-xl px-3.5 py-2.5 text-xs text-white font-mono placeholder-gray-600 focus:outline-none focus:border-gray-500 transition-colors"
                          />
                          <p className="text-[9px] text-gray-500">Wait time before replying to subsequent messages in an active conversation.</p>
                        </div>
                      </div>
                    </div>

                    {/* Static Reply Override Card */}
                    <div className="p-5 bg-[#141416] border border-[#2D2D30]/80 rounded-xl space-y-4">
                      <div className="flex items-center justify-between border-b border-[#2D2D30]/60 pb-3">
                        <div>
                          <h4 className="text-xs font-bold text-white uppercase tracking-wider">🔕 Static Response Override</h4>
                          <p className="text-[10px] text-gray-500 mt-0.5">Overrides AI responses with a fixed static reply for testing or out-of-office rules.</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={staticReplyEnabled}
                            onChange={e => setStaticReplyEnabled(e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#E3B859]"></div>
                          <span className="ml-2 text-xs font-medium text-gray-300 select-none">
                            {staticReplyEnabled ? 'Enabled' : 'Disabled'}
                          </span>
                        </label>
                      </div>

                      {staticReplyEnabled && (
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-mono text-gray-500 uppercase tracking-widest block font-bold">Static Response Text</label>
                          <input
                            type="text"
                            value={staticReplyOverride}
                            onChange={e => setStaticReplyOverride(e.target.value)}
                            placeholder="Enter the static message..."
                            className="w-full bg-[#0E0E10] border border-[#2D2D30] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-gray-500 transition-colors"
                          />
                        </div>
                      )}
                    </div>

                    {/* Auto-Reply Keyword Rules Card */}
                    <div className="p-5 bg-[#141416] border border-[#2D2D30]/80 rounded-xl space-y-4">
                      <div>
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider">📝 Keyword Auto-Reply Rules</h4>
                        <p className="text-[10px] text-gray-500 mt-0.5">Match specific keywords in incoming messages to instantly send fixed responses (takes priority over AI).</p>
                      </div>

                      <div className="space-y-3">
                        {autoReplyRules.map((rule, idx) => (
                          <div key={idx} className="p-4 bg-[#0E0E10] border border-[#2D2D30] rounded-xl flex flex-col md:flex-row gap-3 items-end md:items-center">
                            <div className="flex-1 space-y-1.5 w-full">
                              <label className="text-[9px] font-mono text-gray-500 uppercase tracking-widest block font-bold">Trigger Keywords (comma separated)</label>
                              <input
                                type="text"
                                value={rule.keywords}
                                onChange={e => updateRule(idx, 'keywords', e.target.value)}
                                placeholder="hello, hi, price, contact"
                                className="w-full bg-[#141416] border border-[#2D2D30] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-gray-500 transition-colors"
                              />
                            </div>
                            <div className="flex-[2] space-y-1.5 w-full">
                              <label className="text-[9px] font-mono text-gray-500 uppercase tracking-widest block font-bold">Auto-Reply Content</label>
                              <input
                                type="text"
                                value={rule.reply}
                                onChange={e => updateRule(idx, 'reply', e.target.value)}
                                placeholder="Hi there! Thanks for reaching out. We will get back to you shortly."
                                className="w-full bg-[#141416] border border-[#2D2D30] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-gray-500 transition-colors"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => removeRule(idx)}
                              className="px-3 py-2 bg-red-950/40 border border-red-900/30 hover:bg-red-900/40 text-red-400 text-xs rounded-xl font-bold uppercase transition-colors whitespace-nowrap mb-0.5"
                            >
                              Remove
                            </button>
                          </div>
                        ))}

                        <button
                          type="button"
                          onClick={addRule}
                          className="w-full py-2 border border-dashed border-[#2D2D30] hover:border-gray-500 rounded-xl text-xs font-bold text-gray-400 hover:text-white transition-all bg-[#0E0E10]/40"
                        >
                          ➕ Add Keyword Rule
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : activeSection === 'Gemini Keys' ? (
              <div className="space-y-4">
                <div className="p-4 bg-purple-950/10 border border-purple-900/20 rounded-xl text-xs text-purple-300">
                  <p className="font-bold flex items-center gap-1.5">⚡ Gemini API Key Rotation & Fault-Tolerance</p>
                  <p className="mt-1 leading-relaxed text-[10px] text-gray-400">
                    Add multiple Gemini API keys here. In case of quota exhaustion (<code className="text-[#E3B859]">429</code>) or validation failures, the background reply scheduler automatically cascades to the next working key dynamically without interruption.
                  </p>
                </div>

                <div className="space-y-3">
                  {geminiKeys.map((key, idx) => {
                    const statusInfo = keyStatuses[idx]
                    const isMasked = key.includes('•') || (key.length > 20 && !key.startsWith('AQ.'))
                    return (
                      <div key={idx} className="p-4 bg-[#141416] border border-[#2D2D30]/80 rounded-xl space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest block font-bold">Key Slot #{idx + 1}</span>
                          {geminiKeys.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeGeminiKey(idx)}
                              className="text-gray-500 hover:text-red-400 text-[10px] font-bold uppercase transition-colors"
                              title="Delete Key Slot"
                            >
                              ✕ Remove Key
                            </button>
                          )}
                        </div>

                        <div className="flex gap-2">
                          <input
                            type="password"
                            value={key}
                            onChange={e => updateGeminiKey(idx, e.target.value)}
                            placeholder={isMasked ? '(stored API key — enter new key to overwrite)' : 'Enter Gemini API key (AQ.Ab8...)'}
                            className="flex-1 bg-[#0E0E10] border border-[#2D2D30] rounded-xl px-3.5 py-2.5 text-xs text-white font-mono placeholder-gray-600 focus:outline-none focus:border-gray-500 transition-colors"
                          />
                          <button
                            type="button"
                            disabled={statusInfo?.loading || !key}
                            onClick={() => testGeminiKey(idx, key)}
                            className="px-4 py-2 rounded-xl bg-purple-950/40 border border-purple-900/30 hover:bg-purple-900/40 text-purple-300 text-xs font-bold transition-all disabled:opacity-40 whitespace-nowrap"
                          >
                            {statusInfo?.loading ? '⏳ Checking…' : '🔍 Check Status'}
                          </button>
                        </div>

                        {statusInfo && !statusInfo.loading && (
                          <div className={`p-2.5 rounded-lg border text-[10px] font-mono leading-relaxed ${
                            statusInfo.status === 'active'
                              ? 'dark:bg-green-950/30 bg-green-50 dark:border-green-900/40 border-green-200 dark:text-green-400 text-green-800'
                              : statusInfo.status === 'limit_reached'
                              ? 'dark:bg-amber-950/30 bg-amber-50 dark:border-amber-900/40 border-amber-200 dark:text-amber-400 text-amber-800'
                              : 'dark:bg-red-950/30 bg-red-50 dark:border-red-900/40 border-red-200 dark:text-red-400 text-red-800'
                          }`}>
                            {statusInfo.status === 'active' ? (
                              <div>
                                <span className="font-bold uppercase mr-1">✓ Active:</span> Key validation passed!
                                {statusInfo.models && statusInfo.models.length > 0 && (
                                  <div className="mt-1 text-[9px] dark:text-green-500/80 text-green-700 uppercase tracking-wider">
                                    Available Models: {statusInfo.models.join(', ')}
                                  </div>
                                )}
                              </div>
                            ) : statusInfo.status === 'limit_reached' ? (
                              <div>
                                <span className="font-bold uppercase mr-1">⚠️ Quota Exhausted:</span> Request limit exceeded (status 429). The system will automatically rotate to the next slot.
                              </div>
                            ) : (
                              <div>
                                <span className="font-bold uppercase mr-1">✗ Verification Failed:</span> {statusInfo.error || 'Invalid API Credentials.'}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                <button
                  type="button"
                  onClick={addGeminiKey}
                  className="w-full py-2.5 border border-dashed border-[#2D2D30] hover:border-gray-500 rounded-xl text-xs font-bold text-gray-400 hover:text-white transition-all bg-[#141416]/40"
                >
                  ➕ Add Gemini API Key Slot
                </button>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {currentSection.fields.map(field => (
                  <FieldRow
                    key={field.key}
                    field={field}
                    value={settings[field.key] || ''}
                    isSet={setFlags[field.key]}
                    onChange={handleChange}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quick Connection Tests */}
      <div className="border-t border-[#2D2D30] pt-6">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">🧪 Quick Connection Tests</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Test Meta App',     target: 'meta_app',  icon: '🔵' },
            { label: 'Test Facebook Page',target: 'facebook',  icon: '📘' },
            { label: 'Test Instagram',    target: 'instagram', icon: '📸' },
            { label: 'Test Webhook',      target: 'webhook',   icon: '🔗' },
          ].map(btn => (
            <button
              key={btn.target}
              onClick={() => handleTest(btn.target, `/api/meta/test?target=${btn.target}`)}
              disabled={testing === btn.target}
              className="p-4 rounded-xl bg-[#18181A] border border-[#2D2D30] hover:border-gray-500 text-xs font-bold uppercase tracking-wider text-gray-300 hover:text-white transition-colors flex items-center gap-2 disabled:opacity-40"
            >
              <span>{btn.icon}</span>
              {testing === btn.target ? 'Testing…' : btn.label}
              {testResults[btn.target] && (
                <span className={`ml-auto ${testResults[btn.target].status === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                  {testResults[btn.target].status === 'success' ? '✓' : '✗'}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Test result log */}
        {Object.keys(testResults).length > 0 && (
          <div className="mt-4 rounded-xl bg-[#0E0E10] border border-[#2D2D30] p-4 space-y-2 max-h-48 overflow-y-auto">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block">Test Logs</span>
            {Object.entries(testResults).map(([key, r]) => (
              <div key={key} className={`flex items-center gap-3 text-xs font-mono ${r.status === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                <span>{r.status === 'success' ? '✓' : '✗'}</span>
                <span className="text-gray-400">[{key}]</span>
                <span className="flex-1 truncate">{r.detail}</span>
                <span className="text-gray-500 flex-shrink-0">{r.ms}ms</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
