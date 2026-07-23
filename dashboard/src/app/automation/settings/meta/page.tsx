'use client'

import React, { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Sparkles, Key, CheckCircle2, ShieldCheck, RefreshCw, Eye, EyeOff, Copy, Bot, Globe, AlertCircle, Loader2 } from 'lucide-react'

const SECRET_FIELDS = new Set([
  'META_APP_SECRET', 'META_PAGE_ACCESS_TOKEN', 'META_VERIFY_TOKEN',
  'META_WEBHOOK_SECRET', 'META_LONG_LIVED_USER_TOKEN', 'META_SYSTEM_USER_TOKEN', 'WHATSAPP_PERMANENT_TOKEN',
])

interface FieldConfig {
  key: string
  label: string
  description: string
  required?: boolean
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
    ]
  },
  {
    title: 'Instagram', icon: '📸',
    fields: [
      { key: 'INSTAGRAM_APP_ID',       label: 'Instagram App ID',    description: 'Instagram-specific App ID', required: true },
      { key: 'INSTAGRAM_USERNAME',     label: 'Username',            description: 'Instagram business username' },
      { key: 'INSTAGRAM_BUSINESS_ID',  label: 'Business Account ID', description: 'IG Business Account numeric ID', required: true },
    ]
  },
  {
    title: 'Webhook', icon: '🔗',
    fields: [
      { key: 'META_VERIFY_TOKEN',         label: 'Verify Token',    description: 'Token for Meta webhook verification challenge', required: true },
      { key: 'META_WEBHOOK_CALLBACK_URL', label: 'Callback URL',    description: 'Webhook endpoint URL registered in Meta Dashboard', required: true },
    ]
  },
  {
    title: 'Gemini Keys', icon: '✨',
    fields: []
  },
]

function getUserGroup(name: string) {
  if (!name) return 'Other'
  const lower = name.toLowerCase()
  if (lower.includes('smriti')) return 'Smriti'
  if (lower.includes('kashi')) return 'Kashi Singh'
  return name.split(' ')[0]
}

export default function MetaSettingsPage() {
  const [settings, setSettings]       = useState<Record<string, string>>({})
  const [setFlags, setSetFlags]       = useState<Record<string, boolean>>({})
  const [loading, setLoading]         = useState(true)
  const [saving, setSaving]           = useState(false)
  const [activeSection, setActiveSection] = useState('AI Chatbot & Rules')
  const [configured, setConfigured]   = useState(false)
  const [missing, setMissing]         = useState<string[]>([])

  // Custom multiple Gemini Keys states
  const [geminiKeys, setGeminiKeys] = useState<string[]>([''])
  const [keyStatuses, setKeyStatuses] = useState<Record<number, { loading: boolean; status?: string; error?: string; models?: string[] }>>({})

  // Connected Accounts state
  const [accounts, setAccounts] = useState<any[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState<string>('')

  // Account-specific Settings states
  const [chatbotEnabled, setChatbotEnabled] = useState(false)
  const [chatbotPersona, setChatbotPersona] = useState('')
  const [isActive, setIsActive] = useState(false)

  const fetchAccounts = useCallback(async (selectId?: string) => {
    try {
      const res = await fetch('/api/automation/accounts')
      const data = await res.json()
      if (data.accounts) {
        setAccounts(data.accounts)
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

  useEffect(() => {
    if (!selectedAccountId) return
    const acc = accounts.find(a => a.id === selectedAccountId)
    if (acc) {
      setChatbotEnabled(acc.chatbot_enabled ?? false)
      setChatbotPersona(acc.chatbot_persona || 'You are a helpful representative.')
      setIsActive(acc.is_active ?? false)
    }
  }, [selectedAccountId, accounts])

  function handleChange(key: string, val: string) {
    setSettings(prev => ({ ...prev, [key]: val }))
  }

  async function handleSaveGlobal() {
    setSaving(true)
    const toastId = toast.loading('Saving global configurations…')
    try {
      const payload: Record<string, string> = { ...settings }
      payload.SAVED_GEMINI_API_KEYS = JSON.stringify(geminiKeys.filter(k => k.trim()))

      const res = await fetch('/api/meta/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: payload }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success('Configuration saved successfully!', { id: toastId })
        loadSettings()
      } else {
        throw new Error(data.error || 'Save failed.')
      }
    } catch (err: any) {
      toast.error(err.message, { id: toastId })
    }
    setSaving(false)
  }

  async function handleActivateAccount() {
    if (!selectedAccountId) return
    const toastId = toast.loading('Activating account profile...')
    try {
      const acc = accounts.find((a: any) => a.id === selectedAccountId)
      if (!acc) throw new Error('Account not found.')

      const targetGroup = getUserGroup(acc.account_name)
      const sameNameAccounts = accounts.filter((a: any) => getUserGroup(a.account_name) === targetGroup)
      const otherAccounts = accounts.filter((a: any) => getUserGroup(a.account_name) !== targetGroup)

      await Promise.all(sameNameAccounts.map(async (a: any) => {
        await fetch('/api/automation/accounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: a.id, platform: a.platform, account_name: a.account_name, is_active: true })
        })
      }))

      await Promise.all(otherAccounts.map(async (a: any) => {
        await fetch('/api/automation/accounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: a.id, platform: a.platform, account_name: a.account_name, is_active: false })
        })
      }))

      toast.success(`Profile "${targetGroup}" activated!`, { id: toastId })
      await fetchAccounts(selectedAccountId)
    } catch (err: any) {
      toast.error(err.message, { id: toastId })
    }
  }

  async function handleTestGeminiKey(index: number) {
    const keyToTest = geminiKeys[index]
    if (!keyToTest) {
      toast.error('Enter an API key to test')
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
        toast.success(`Key #${index + 1} verified!`)
      } else {
        toast.error(`Key #${index + 1} error: ${data.error || 'inactive'}`)
      }
    } catch (err: any) {
      setKeyStatuses(prev => ({
        ...prev,
        [index]: { loading: false, status: 'error', error: err.message }
      }))
      toast.error(err.message)
    }
  }

  const currentSection = SECTIONS.find(s => s.title === activeSection) ?? SECTIONS[0]
  const accountGroups = Array.from(new Set(accounts.map(a => getUserGroup(a.account_name))))

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl border border-border bg-card">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
            <Key className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">Meta App & API Configuration</h1>
            <p className="text-xs text-muted-foreground">Manage credentials, active connected profiles, Gemini keys, and webhooks.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {configured ? (
            <Badge variant="success" className="gap-1 px-3 py-1 text-xs">
              <ShieldCheck className="w-3.5 h-3.5" /> Configured
            </Badge>
          ) : (
            <Badge variant="warning" className="gap-1 px-3 py-1 text-xs">
              <AlertCircle className="w-3.5 h-3.5" /> Needs Credentials
            </Badge>
          )}
          <Button size="sm" onClick={handleSaveGlobal} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            <span>Save Configuration</span>
          </Button>
        </div>
      </div>

      {/* Account Profile Switcher Card */}
      <Card>
        <CardHeader className="p-4 border-b border-border">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Globe className="w-4 h-4 text-primary" />
            Active Meta Connected Account Profile
          </CardTitle>
          <CardDescription>Select which Facebook Page & Instagram account is currently active for automation.</CardDescription>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {accountGroups.map(groupName => {
              const groupAccounts = accounts.filter(a => getUserGroup(a.account_name) === groupName)
              const isGroupActive = groupAccounts.some(a => a.is_active)
              const firstAccId = groupAccounts[0]?.id

              return (
                <div
                  key={groupName}
                  onClick={() => firstAccId && setSelectedAccountId(firstAccId)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    isGroupActive
                      ? 'border-emerald-500/50 bg-emerald-500/10 shadow-xs'
                      : selectedAccountId && groupAccounts.some(a => a.id === selectedAccountId)
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-card hover:bg-accent'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-foreground">{groupName} Profile</span>
                    {isGroupActive ? (
                      <Badge variant="success" className="text-[10px]">ACTIVE</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">Inactive</Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mb-3">{groupAccounts.length} connected accounts (FB + IG)</p>
                  <Button
                    size="sm"
                    variant={isGroupActive ? "outline" : "default"}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (firstAccId) {
                        setSelectedAccountId(firstAccId)
                        handleActivateAccount()
                      }
                    }}
                    className="w-full text-xs h-7"
                  >
                    {isGroupActive ? 'Currently Active' : 'Activate Profile'}
                  </Button>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Main Settings Section Tabs */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Navigation Tabs (3 cols) */}
        <Card className="md:col-span-3 p-2 h-fit">
          <div className="space-y-1">
            {SECTIONS.map(s => (
              <button
                key={s.title}
                onClick={() => setActiveSection(s.title)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors text-left ${
                  activeSection === s.title
                    ? 'bg-secondary text-primary font-semibold'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                <span>{s.icon}</span>
                <span>{s.title}</span>
              </button>
            ))}
          </div>
        </Card>

        {/* Section Content Pane (9 cols) */}
        <Card className="md:col-span-9">
          <CardHeader className="border-b border-border p-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <span>{currentSection.icon}</span>
              <span>{currentSection.title} Settings</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            {/* AI Chatbot & Rules section */}
            {activeSection === 'AI Chatbot & Rules' && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl border border-border bg-muted/30 space-y-2">
                  <label className="text-xs font-semibold text-foreground block">AI Persona System Prompt</label>
                  <textarea
                    rows={4}
                    value={chatbotPersona}
                    onChange={e => setChatbotPersona(e.target.value)}
                    placeholder="e.g. You are a friendly, professional representative for Stratnent..."
                    className="w-full rounded-md border border-input bg-background p-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring font-sans"
                  />
                  <p className="text-[11px] text-muted-foreground">Instructions used by Gemini AI when drafting responses to Instagram & Messenger leads.</p>
                </div>
              </div>
            )}

            {/* Gemini Keys section */}
            {activeSection === 'Gemini Keys' && (
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground">Manage and test your backup Gemini API key pool for AI lead enrichment and auto-replies.</p>
                {geminiKeys.map((keyVal, idx) => {
                  const status = keyStatuses[idx]
                  return (
                    <div key={idx} className="p-4 rounded-xl border border-border bg-muted/20 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-foreground">Gemini API Key #{idx + 1}</span>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={status?.loading || !keyVal}
                            onClick={() => handleTestGeminiKey(idx)}
                            className="h-7 text-[11px]"
                          >
                            {status?.loading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : 'Test Key'}
                          </Button>
                          {geminiKeys.length > 1 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const updated = geminiKeys.filter((_, i) => i !== idx)
                                setGeminiKeys(updated)
                              }}
                              className="h-7 px-2 text-rose-400 hover:text-rose-300"
                            >
                              Remove
                            </Button>
                          )}
                        </div>
                      </div>

                      <Input
                        type="password"
                        value={keyVal}
                        onChange={e => {
                          const updated = [...geminiKeys]
                          updated[idx] = e.target.value
                          setGeminiKeys(updated)
                        }}
                        placeholder="AIzaSy..."
                        className="font-mono text-xs"
                      />

                      {status && !status.loading && (
                        <div className={`p-2.5 rounded-md text-xs border ${
                          status.status === 'active' 
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                            : 'bg-destructive/10 border-destructive/20 text-destructive-foreground'
                        }`}>
                          {status.status === 'active' ? 'Key verified & active' : `Error: ${status.error || 'Check failed'}`}
                        </div>
                      )}
                    </div>
                  )
                })}
                <Button variant="outline" size="sm" onClick={() => setGeminiKeys([...geminiKeys, ''])}>
                  + Add Backup Gemini Key
                </Button>
              </div>
            )}

            {/* Standard Key-Value field lists for Meta App, FB Page, IG, Webhooks */}
            {currentSection.fields.length > 0 && (
              <div className="space-y-4">
                {currentSection.fields.map(field => {
                  const isSecret = SECRET_FIELDS.has(field.key)
                  const isSet = setFlags[field.key]
                  const val = settings[field.key] || ''
                  return (
                    <div key={field.key} className="p-4 rounded-xl border border-border bg-muted/20 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-foreground">
                          {field.label} {field.required && <span className="text-rose-400">*</span>}
                          {isSet && <span className="ml-2 text-[10px] text-emerald-400 font-mono">✓ stored</span>}
                        </label>
                      </div>
                      <Input
                        type={isSecret ? 'password' : 'text'}
                        value={val}
                        onChange={e => handleChange(field.key, e.target.value)}
                        placeholder={`Enter ${field.label}...`}
                        className="font-mono text-xs"
                      />
                      <p className="text-[11px] text-muted-foreground">{field.description}</p>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
