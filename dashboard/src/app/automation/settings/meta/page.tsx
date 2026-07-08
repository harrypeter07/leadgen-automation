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
  const [activeSection, setActiveSection] = useState('Meta App')
  const [configured, setConfigured]   = useState(false)
  const [missing, setMissing]         = useState<string[]>([])
  const [lastSaved, setLastSaved]     = useState<string | null>(null)

  // ── Load settings from DB on mount ─────────────────────────────────────────
  const loadSettings = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/meta/settings')
      const data = await res.json()
      if (data.settings) {
        // Separate masked values from set-flags
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
      }
    } catch {
      toast.error('Failed to load config from DB.')
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadSettings() }, [loadSettings])

  // ── Auto-seed from env if DB is empty ────────────────────────────────────────
  useEffect(() => {
    if (!loading && Object.values(settings).every(v => !v)) {
      // DB is empty — trigger seed
      fetch('/api/meta/config/seed', { method: 'POST' })
        .then(r => r.json())
        .then(d => { if (d.seeded) { toast.success('Config seeded from environment!'); loadSettings() } })
        .catch(() => {})
    }
  }, [loading, settings, loadSettings])

  function handleChange(key: string, val: string) {
    setSettings(prev => ({ ...prev, [key]: val }))
  }

  async function handleSave() {
    setSaving(true)
    const toastId = toast.loading('Saving Meta configuration…')
    try {
      // Only send non-empty, non-masked values
      const toSave: Record<string, string> = {}
      for (const [k, v] of Object.entries(settings)) {
        if (v && !v.includes('•')) toSave[k] = v
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

  async function handleSeedFromEnv() {
    setSeeding(true)
    const toastId = toast.loading('Seeding from environment…')
    try {
      const res  = await fetch('/api/meta/config/seed', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        toast.success(data.message || 'Seeded!', { id: toastId })
        loadSettings()
      } else {
        throw new Error(data.error || data.hint || 'Seed failed')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Seed failed', { id: toastId })
    }
    setSeeding(false)
  }

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

  return (
    <div className="space-y-6 text-white select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#2D2D30] pb-6">
        <div>
          <h1 className="text-3xl font-black tracking-tight">⚙️ Meta Configuration</h1>
          <p className="mt-1 text-sm text-gray-500">
            Credentials stored encrypted in Supabase.
            {lastSaved && <span className="ml-2 text-green-400 text-[11px]">✓ Saved at {lastSaved}</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Config status */}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[10px] font-bold uppercase tracking-wider ${configured ? 'bg-green-900/30 border-green-800/30 text-green-300' : 'bg-red-900/30 border-red-800/30 text-red-300'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${configured ? 'bg-green-400' : 'bg-red-400 animate-pulse'}`}></span>
            {configured ? 'Configured' : `Missing ${missing.length}`}
          </div>
          <button onClick={handleSeedFromEnv} disabled={seeding} className="px-3 py-2 rounded-xl bg-[#222225] border border-[#2D2D30] text-xs font-bold text-gray-300 hover:text-white transition-colors disabled:opacity-40">
            {seeding ? '⏳ Seeding…' : '🌱 Seed from Env'}
          </button>
          <Link href="/automation/testing" className="px-3 py-2 rounded-xl bg-[#222225] border border-[#2D2D30] text-xs font-bold text-gray-300 hover:text-white transition-colors">
            🧪 Test Console
          </Link>
          <button onClick={handleSave} disabled={saving || loading} className="px-5 py-2 rounded-xl bg-[#E3B859] hover:bg-[#d4ac50] disabled:opacity-40 text-[#141416] text-xs font-bold uppercase tracking-wider transition-colors">
            {saving ? 'Saving…' : '💾 Save All'}
          </button>
        </div>
      </div>

      {/* Missing fields warning */}
      {missing.length > 0 && (
        <div className="p-4 rounded-xl bg-red-950/30 border border-red-800/30 text-red-300 text-xs">
          ⚠️ Missing required fields: <span className="font-mono font-bold">{missing.join(', ')}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40 text-gray-500 animate-pulse text-sm">Loading configuration…</div>
      ) : (
        <div className="flex gap-6">
          {/* Left nav */}
          <aside className="w-44 flex-shrink-0 space-y-1">
            {SECTIONS.map(s => {
              const hasValue = s.fields.some(f => settings[f.key] || setFlags[f.key])
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

          {/* Right panel */}
          <div className="flex-1 space-y-4">
            {/* Section header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#2D2D30]">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <span className="text-lg">{currentSection.icon}</span>
                {currentSection.title} Settings
              </h2>
              <button
                onClick={() => handleTest(currentSection.title, `/api/meta/test?target=${currentSection.title.toLowerCase().replace(/\s+/g, '_')}`)}
                disabled={testing === currentSection.title}
                className="px-3 py-1.5 rounded-xl bg-purple-950/40 border border-purple-900/30 text-purple-400 hover:bg-purple-900/30 text-[10px] font-bold uppercase tracking-wider transition-colors disabled:opacity-40"
              >{testing === currentSection.title ? 'Testing…' : '⚡ Test Section'}</button>
            </div>

            {/* Test result */}
            {testResults[currentSection.title] && (
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

            {/* Fields */}
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
