// dashboard/src/app/settings/page.tsx
'use client'

import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { supabaseBrowser } from '@/lib/supabase'

interface HealthState {
  status: 'connected' | 'disconnected' | 'testing' | 'idle'
  responseTime?: number
  error?: string
}

export default function SettingsPage() {
  const [supabaseHealth, setSupabaseHealth] = useState<HealthState>({ status: 'idle' })
  const [n8nHealth, setN8nHealth] = useState<HealthState>({ status: 'idle' })
  const [whatsappHealth, setWhatsappHealth] = useState<HealthState>({ status: 'idle' })

  const [totalLeads, setTotalLeads] = useState<number | null>(null)
  const [clearingLeads, setClearingLeads] = useState(false)
  const [configStatus, setConfigStatus] = useState<Record<string, boolean>>({})

  // Outreach Settings states
  const [companyName, setCompanyName] = useState('Zarss Dev')
  const [icpDescription, setIcpDescription] = useState('')
  const [offeringPitch, setOfferingPitch] = useState('')
  const [systemInstructions, setSystemInstructions] = useState('')
  const [whatsappDelayMs, setWhatsappDelayMs] = useState(5000)
  const [followupCooldownHours, setFollowupCooldownHours] = useState(24)
  const [rateLimitMessagesPerMinute, setRateLimitMessagesPerMinute] = useState(5)
  const [savingSettings, setSavingSettings] = useState(false)
  const [loadingSettings, setLoadingSettings] = useState(true)

  // Cloudinary Settings states
  const [cloudinaryCloudName, setCloudinaryCloudName] = useState('')
  const [cloudinaryApiKey, setCloudinaryApiKey] = useState('')
  const [cloudinaryApiSecret, setCloudinaryApiSecret] = useState('')
  const [cloudinaryUrl, setCloudinaryUrl] = useState('')
  const [savingCloudinary, setSavingCloudinary] = useState(false)

  // 1. Fetch DB stats
  async function fetchDbStats() {
    try {
      const { count, error } = await supabaseBrowser
        .from('leads')
        .select('*', { count: 'exact', head: true })
      if (error) throw error
      setTotalLeads(count ?? 0)
    } catch {
      setTotalLeads(0)
    }
  }

  // Fetch environment variable status
  async function fetchConfigStatus() {
    try {
      const res = await fetch('/api/health/config')
      if (res.ok) {
        const data = await res.json()
        if (data.status) setConfigStatus(data.status)
      }
    } catch (err) {
      console.error('Failed to fetch config status:', err)
    }
  }

  // Fetch Outreach Settings
  async function fetchOutreachSettings() {
    setLoadingSettings(true)
    try {
      const res = await fetch('/api/backend-v3/outreach/settings')
      if (res.ok) {
        const json = await res.json()
        if (json.success && json.data) {
          const s = json.data
          setCompanyName(s.company_name || 'Zarss Dev')
          setIcpDescription(s.icp_description || '')
          setOfferingPitch(s.offering_pitch || '')
          setSystemInstructions(s.system_instructions || '')
          setWhatsappDelayMs(s.whatsapp_delay_ms || 5000)
          setFollowupCooldownHours(s.followup_cooldown_hours || 24)
          setRateLimitMessagesPerMinute(s.rate_limit_messages_per_minute || 5)
        }
      }
    } catch (err) {
      console.error('Failed to load outreach settings:', err)
    } finally {
      setLoadingSettings(false)
    }
  }

  // Update Outreach Settings
  async function handleSaveOutreachSettings(e: React.FormEvent) {
    e.preventDefault()
    setSavingSettings(true)
    const toastId = toast.loading('Saving targeting configurations...')
    try {
      const res = await fetch('/api/backend-v3/outreach/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: companyName,
          icp_description: icpDescription,
          offering_pitch: offeringPitch,
          system_instructions: systemInstructions,
          whatsapp_delay_ms: whatsappDelayMs,
          followup_cooldown_hours: followupCooldownHours,
          rate_limit_messages_per_minute: rateLimitMessagesPerMinute
        })
      })

      if (res.ok) {
        toast.success('Campaign settings updated successfully!', { id: toastId })
        fetchOutreachSettings()
      } else {
        throw new Error('Server error')
      }
    } catch {
      toast.error('Failed to update settings. Verify connection status.', { id: toastId })
    } finally {
      setSavingSettings(false)
    }
  }

  async function fetchCloudinarySettings() {
    try {
      const res = await fetch('/api/meta/settings')
      if (res.ok) {
        const data = await res.json()
        if (data.settings) {
          setCloudinaryCloudName(data.settings.CLOUDINARY_CLOUD_NAME || '')
          setCloudinaryApiKey(data.settings.CLOUDINARY_API_KEY || '')
          setCloudinaryApiSecret(data.settings.CLOUDINARY_API_SECRET || '')
          setCloudinaryUrl(data.settings.CLOUDINARY_URL || '')
        }
      }
    } catch (err) {
      console.error('Failed to load Cloudinary settings:', err)
    }
  }

  async function handleSaveCloudinarySettings(e: React.FormEvent) {
    e.preventDefault()
    setSavingCloudinary(true)
    const toastId = toast.loading('Saving Cloudinary configuration...')
    try {
      const res = await fetch('/api/meta/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: {
            CLOUDINARY_CLOUD_NAME: cloudinaryCloudName.trim(),
            CLOUDINARY_API_KEY: cloudinaryApiKey.trim(),
            CLOUDINARY_API_SECRET: cloudinaryApiSecret.trim(),
            CLOUDINARY_URL: cloudinaryUrl.trim()
          }
        })
      })
      if (res.ok) {
        toast.success('Cloudinary credentials updated!', { id: toastId })
        fetchCloudinarySettings()
      } else {
        throw new Error('Save failed')
      }
    } catch {
      toast.error('Failed to save Cloudinary configuration.', { id: toastId })
    } finally {
      setSavingCloudinary(false)
    }
  }

  useEffect(() => {
    fetchDbStats()
    fetchConfigStatus()
    fetchOutreachSettings()
    fetchCloudinarySettings()
  }, [])

  // 2. Connection testers
  async function testSupabase() {
    setSupabaseHealth({ status: 'testing' })
    const start = Date.now()
    try {
      const res = await fetch('/api/health/supabase')
      const latency = Date.now() - start
      if (res.ok) {
        setSupabaseHealth({ status: 'connected', responseTime: latency })
        toast.success(`Supabase Database connected! (${latency}ms)`)
      } else {
        const data = await res.json()
        setSupabaseHealth({ status: 'disconnected', error: data.error || 'Server error' })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error'
      setSupabaseHealth({ status: 'disconnected', error: msg })
      toast.error(`Database offline: ${msg}`)
    }
  }

  async function testN8n() {
    setN8nHealth({ status: 'testing' })
    const start = Date.now()
    try {
      const res = await fetch('/api/health/n8n')
      const latency = Date.now() - start
      if (res.ok) {
        setN8nHealth({ status: 'connected', responseTime: latency })
        toast.success(`n8n Trigger Webhook active! (${latency}ms)`)
      } else {
        setN8nHealth({ status: 'disconnected', error: 'Webhook inactive / unconfigured' })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error'
      setN8nHealth({ status: 'disconnected', error: msg })
      toast.error(`n8n offline: ${msg}`)
    }
  }

  async function testWhatsapp() {
    setWhatsappHealth({ status: 'testing' })
    const start = Date.now()
    try {
      const res = await fetch('/api/whatsapp/health')
      const latency = Date.now() - start
      if (res.ok) {
        const data = await res.json()
        if (data.ready) {
          setWhatsappHealth({ status: 'connected', responseTime: latency })
          toast.success(`WhatsApp Client linked! (${latency}ms)`)
        } else {
          setWhatsappHealth({ status: 'disconnected', error: 'Service starting or offline' })
          toast('WhatsApp service running but client socket is unauthenticated.', { icon: '⚠️' })
        }
      } else {
        setWhatsappHealth({ status: 'disconnected', error: 'Microservice disconnected' })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error'
      setWhatsappHealth({ status: 'disconnected', error: msg })
      toast.error(`WhatsApp Service offline: ${msg}`)
    }
  }

  // 3. Maintenance Ops
  async function handleClearTestLeads() {
    if (!confirm('This will permanently delete all leads starting with the name "Test" (e.g. Test Cafe). Continue?')) {
      return
    }

    setClearingLeads(true)
    const toastId = toast.loading('Purging testing records...')
    try {
      const { data, error } = await supabaseBrowser
        .from('leads')
        .delete()
        .like('name', 'Test%')
        .select()

      if (error) throw error
      const count = data?.length ?? 0
      toast.success(`Successfully purged ${count} test leads!`, { id: toastId })
      fetchDbStats()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error purging test data'
      toast.error(msg, { id: toastId })
    } finally {
      setClearingLeads(false)
    }
  }

  function handleExportAll() {
    window.location.href = '/api/leads/export'
    toast.success('Initiating full CSV backup download')
  }

  function copyEnvTemplate() {
    const template = `NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
WHATSAPP_SERVICE_URL=http://localhost:3001
WHATSAPP_API_SECRET=your-secret
N8N_WEBHOOK_BASE_URL=https://n8n.yourdomain.app
RESEND_API_KEY=re_your_key`
    navigator.clipboard.writeText(template)
    toast.success('Template copied to clipboard!')
  }

  return (
    <div className="space-y-8 text-[#2D2D2D] select-none">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-[#1C1C1E] tracking-tight">System Settings</h1>
        <p className="mt-1 text-sm text-gray-500 font-medium">Verify socket endpoints, inspect system variables, test database integrations, and manage backups.</p>
      </div>

      {/* Section 1 - Healthchecks */}
      <div className="rounded-2xl border border-[#E4E3DD] bg-white p-6 space-y-5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)]">
        <h3 className="font-bold text-[#1C1C1E] text-xs uppercase tracking-wider text-gray-500 border-b border-[#E4E3DD] pb-2">🌐 Microservice Health Diagnostics</h3>
        
        <div className="grid gap-6 sm:grid-cols-3">
          {/* Supabase Card */}
          <div className="rounded-2xl bg-[#F4F3EF] border border-[#E4E3DD] p-5 flex flex-col justify-between h-40">
            <div>
              <div className="flex justify-between items-center">
                <h4 className="font-bold text-gray-800 text-sm">Supabase Database</h4>
                <span className={`w-2.5 h-2.5 rounded-full ${
                  supabaseHealth.status === 'connected' ? 'bg-green-500' :
                  supabaseHealth.status === 'disconnected' ? 'bg-red-500' : 'bg-gray-400'
                }`} />
              </div>
              <p className="text-[10px] text-gray-500 mt-2.5 leading-relaxed font-semibold">
                {supabaseHealth.status === 'connected'
                  ? `Response: ${supabaseHealth.responseTime}ms`
                  : supabaseHealth.error || 'Click test below'}
              </p>
            </div>
            <button
              onClick={testSupabase}
              disabled={supabaseHealth.status === 'testing'}
              className="w-full rounded-xl bg-white border border-[#E4E3DD] hover:bg-gray-50 text-[10px] font-bold uppercase tracking-wider text-gray-700 py-2.5 transition-colors shadow-sm disabled:opacity-50"
            >
              {supabaseHealth.status === 'testing' ? 'Testing...' : 'Test Connection'}
            </button>
          </div>

          {/* n8n Card */}
          <div className="rounded-2xl bg-[#F4F3EF] border border-[#E4E3DD] p-5 flex flex-col justify-between h-40">
            <div>
              <div className="flex justify-between items-center">
                <h4 className="font-bold text-gray-800 text-sm">n8n Engine Webhook</h4>
                <span className={`w-2.5 h-2.5 rounded-full ${
                  n8nHealth.status === 'connected' ? 'bg-green-500' :
                  n8nHealth.status === 'disconnected' ? 'bg-red-500' : 'bg-gray-400'
                }`} />
              </div>
              <p className="text-[10px] text-gray-500 mt-2.5 leading-relaxed font-semibold">
                {n8nHealth.status === 'connected'
                  ? `Response: ${n8nHealth.responseTime}ms`
                  : n8nHealth.error || 'Click test below'}
              </p>
            </div>
            <button
              onClick={testN8n}
              disabled={n8nHealth.status === 'testing'}
              className="w-full rounded-xl bg-white border border-[#E4E3DD] hover:bg-gray-50 text-[10px] font-bold uppercase tracking-wider text-gray-700 py-2.5 transition-colors shadow-sm disabled:opacity-50"
            >
              {n8nHealth.status === 'testing' ? 'Testing...' : 'Test Connection'}
            </button>
          </div>

          {/* WhatsApp Card */}
          <div className="rounded-2xl bg-[#F4F3EF] border border-[#E4E3DD] p-5 flex flex-col justify-between h-40">
            <div>
              <div className="flex justify-between items-center">
                <h4 className="font-bold text-gray-800 text-sm">WhatsApp Socket</h4>
                <span className={`w-2.5 h-2.5 rounded-full ${
                  whatsappHealth.status === 'connected' ? 'bg-green-500' :
                  whatsappHealth.status === 'disconnected' ? 'bg-red-500' : 'bg-gray-400'
                }`} />
              </div>
              <p className="text-[10px] text-gray-500 mt-2.5 leading-relaxed font-semibold">
                {whatsappHealth.status === 'connected'
                  ? `Response: ${whatsappHealth.responseTime}ms`
                  : whatsappHealth.error || 'Click test below'}
              </p>
            </div>
            <button
              onClick={testWhatsapp}
              disabled={whatsappHealth.status === 'testing'}
              className="w-full rounded-xl bg-white border border-[#E4E3DD] hover:bg-gray-50 text-[10px] font-bold uppercase tracking-wider text-gray-700 py-2.5 transition-colors shadow-sm disabled:opacity-50"
            >
              {whatsappHealth.status === 'testing' ? 'Testing...' : 'Test Connection'}
            </button>
          </div>
        </div>
      </div>

      {/* Section 2 - Environment Variables Check */}
      <div className="rounded-2xl border border-[#E4E3DD] bg-white p-6 space-y-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-[#1C1C1E] text-md uppercase tracking-wider text-gray-500">🔑 Environment Configuration</h3>
            <p className="text-xs text-gray-400 mt-1 font-medium">Status of required local and cloud deployment variables.</p>
          </div>
          <button
            onClick={copyEnvTemplate}
            className="rounded-xl bg-white border border-[#E4E3DD] hover:bg-gray-50 text-xs font-bold uppercase tracking-wider text-gray-700 px-4 py-2.5 transition-colors shadow-sm self-start sm:self-auto"
          >
            📋 Copy .env Template
          </button>
        </div>

        <div className="rounded-2xl border border-[#E4E3DD] bg-gray-50 p-5 divide-y divide-[#E4E3DD]/60 text-xs font-medium">
          {[
            { key: 'NEXT_PUBLIC_SUPABASE_URL', desc: 'Supabase Project API URL' },
            { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', desc: 'Supabase Anonymous Key' },
            { key: 'SUPABASE_SERVICE_ROLE_KEY', desc: 'Supabase Bypass Key (Server only)' },
            { key: 'WHATSAPP_SERVICE_URL', desc: 'Microservice host endpoint URL' },
            { key: 'WHATSAPP_API_SECRET', desc: 'Security key for WhatsApp API' },
            { key: 'N8N_WEBHOOK_BASE_URL', desc: 'Self-hosted n8n API base' },
            { key: 'RESEND_API_KEY', desc: 'Outreach Email delivery token' },
            { key: 'N8N_AI_TRIGGER_URL', desc: 'n8n manual trigger for AI content gen' },
            { key: 'N8N_OUTREACH_TRIGGER_URL', desc: 'n8n manual trigger for bulk delivery' },
          ].map((item) => {
            const isConfigured = configStatus[item.key] === true
            return (
              <div key={item.key} className="py-3.5 flex items-center justify-between gap-4">
                <div>
                  <span className="font-mono text-gray-700 font-bold block">{item.key}</span>
                  <span className="text-[10px] text-gray-450 mt-0.5 block font-bold uppercase tracking-wider">{item.desc}</span>
                </div>
                {isConfigured ? (
                  <span className="font-bold px-2 py-0.5 rounded text-[9px] bg-green-50 text-green-700 border border-green-200 uppercase tracking-wider whitespace-nowrap">
                    ✓ Configured
                  </span>
                ) : (
                  <span className="font-bold px-2 py-0.5 rounded text-[9px] bg-red-50 text-red-700 border border-red-200 uppercase tracking-wider whitespace-nowrap">
                    ✗ Missing / Blank
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Section 2.5 - Dynamic Campaign & ICP Targeting Settings */}
      <div className="rounded-2xl border border-[#E4E3DD] bg-white p-6 space-y-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)]">
        <div>
          <h3 className="font-bold text-[#1C1C1E] text-md uppercase tracking-wider text-gray-500">🎯 Campaign ICP & Outreach Controls</h3>
          <p className="text-xs text-gray-400 mt-1 font-medium">Define your Ideal Customer Profile (ICP) and prompt rules. These dynamically format Gemini copy templates and WhatsApp rate throttles.</p>
        </div>

        {loadingSettings ? (
          <div className="py-10 text-center text-xs text-gray-400 animate-pulse font-semibold">Loading campaign variables...</div>
        ) : (
          <form onSubmit={handleSaveOutreachSettings} className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Left Column: Company & Pitch */}
              <div className="space-y-4">
                <div>
                  <label className="block text-gray-600 text-[10px] font-bold uppercase tracking-wider mb-2">Company Name (Sender)</label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full px-4 py-3 bg-[#F4F3EF] border border-[#E4E3DD] focus:border-[#E3B859] rounded-xl text-xs text-[#2D2D2D] focus:outline-none transition-colors"
                    placeholder="e.g. Zarss Marketing"
                  />
                </div>

                <div>
                  <label className="block text-gray-600 text-[10px] font-bold uppercase tracking-wider mb-2">Our Target ICP Description</label>
                  <textarea
                    rows={4}
                    value={icpDescription}
                    onChange={(e) => setIcpDescription(e.target.value)}
                    className="w-full px-4 py-3 bg-[#F4F3EF] border border-[#E4E3DD] focus:border-[#E3B859] rounded-xl text-xs text-[#2D2D2D] focus:outline-none transition-colors resize-none"
                    placeholder="Describe your ideal customers (e.g. cafes, local stores)..."
                  />
                </div>

                <div>
                  <label className="block text-gray-600 text-[10px] font-bold uppercase tracking-wider mb-2">Main Offer / Pitch</label>
                  <textarea
                    rows={3}
                    value={offeringPitch}
                    onChange={(e) => setOfferingPitch(e.target.value)}
                    className="w-full px-4 py-3 bg-[#F4F3EF] border border-[#E4E3DD] focus:border-[#E3B859] rounded-xl text-xs text-[#2D2D2D] focus:outline-none transition-colors resize-none"
                    placeholder="What specific product/service are we pitching? (e.g. Free Speed Mockup)..."
                  />
                </div>
              </div>

              {/* Right Column: AI Prompt & Delays */}
              <div className="space-y-4">
                <div>
                  <label className="block text-gray-600 text-[10px] font-bold uppercase tracking-wider mb-2">Gemini System Instructions</label>
                  <textarea
                    rows={6}
                    value={systemInstructions}
                    onChange={(e) => setSystemInstructions(e.target.value)}
                    className="w-full px-4 py-3 bg-[#F4F3EF] border border-[#E4E3DD] focus:border-[#E3B859] rounded-xl text-xs text-[#2D2D2D] focus:outline-none transition-colors resize-none font-mono"
                    placeholder="System instructions to guide prompt drafting..."
                  />
                </div>

                <div className="grid gap-4 grid-cols-2">
                  <div>
                    <label className="block text-gray-600 text-[10px] font-bold uppercase tracking-wider mb-2">WhatsApp Delay (ms)</label>
                    <input
                      type="number"
                      value={whatsappDelayMs}
                      onChange={(e) => setWhatsappDelayMs(parseInt(e.target.value, 10) || 0)}
                      className="w-full px-4 py-3 bg-[#F4F3EF] border border-[#E4E3DD] focus:border-[#E3B859] rounded-xl text-xs text-[#2D2D2D] focus:outline-none transition-colors font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-600 text-[10px] font-bold uppercase tracking-wider mb-2">Followup Cooldown (h)</label>
                    <input
                      type="number"
                      value={followupCooldownHours}
                      onChange={(e) => setFollowupCooldownHours(parseInt(e.target.value, 10) || 0)}
                      className="w-full px-4 py-3 bg-[#F4F3EF] border border-[#E4E3DD] focus:border-[#E3B859] rounded-xl text-xs text-[#2D2D2D] focus:outline-none transition-colors font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={savingSettings}
                className="rounded-xl bg-[#E3B859] hover:bg-[#d4ac50] text-[#141416] text-xs font-bold uppercase tracking-wider px-6 py-3 transition-colors shadow-md disabled:opacity-50"
              >
                {savingSettings ? 'Saving Changes...' : 'Save Campaign Settings'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Section 2.7 - Cloudinary CDN Integration */}
      <div className="rounded-2xl border border-[#E4E3DD] bg-white p-6 space-y-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)]">
        <div>
          <h3 className="font-bold text-[#1C1C1E] text-md uppercase tracking-wider text-gray-500">☁️ Cloudinary CDN Integration</h3>
          <p className="text-xs text-gray-400 mt-1 font-medium font-bold uppercase tracking-wider">Configure your Cloudinary CDN settings to upload and distribute campaign visual media and video reels.</p>
        </div>

        <form onSubmit={handleSaveCloudinarySettings} className="space-y-4">
          <div className="grid gap-6 md:grid-cols-3">
            <div>
              <label className="block text-gray-600 text-[10px] font-bold uppercase tracking-wider mb-2">Cloudinary Cloud Name</label>
              <input
                type="text"
                value={cloudinaryCloudName}
                onChange={(e) => setCloudinaryCloudName(e.target.value)}
                className="w-full px-4 py-3 bg-[#F4F3EF] border border-[#E4E3DD] focus:border-[#E3B859] rounded-xl text-xs text-[#2D2D2D] focus:outline-none transition-colors"
                placeholder="e.g. qiqvymm6"
              />
            </div>
            <div>
              <label className="block text-gray-600 text-[10px] font-bold uppercase tracking-wider mb-2">Cloudinary API Key</label>
              <input
                type="text"
                value={cloudinaryApiKey}
                onChange={(e) => setCloudinaryApiKey(e.target.value)}
                className="w-full px-4 py-3 bg-[#F4F3EF] border border-[#E4E3DD] focus:border-[#E3B859] rounded-xl text-xs text-[#2D2D2D] focus:outline-none transition-colors"
                placeholder="e.g. 259211276218819"
              />
            </div>
            <div>
              <label className="block text-gray-600 text-[10px] font-bold uppercase tracking-wider mb-2">Cloudinary API Secret</label>
              <input
                type="password"
                value={cloudinaryApiSecret}
                onChange={(e) => setCloudinaryApiSecret(e.target.value)}
                className="w-full px-4 py-3 bg-[#F4F3EF] border border-[#E4E3DD] focus:border-[#E3B859] rounded-xl text-xs text-[#2D2D2D] focus:outline-none transition-colors font-mono"
                placeholder="••••••••••••••••"
              />
            </div>
          </div>
          <div>
            <label className="block text-gray-600 text-[10px] font-bold uppercase tracking-wider mb-2">Cloudinary Connection URL</label>
            <input
              type="text"
              value={cloudinaryUrl}
              onChange={(e) => setCloudinaryUrl(e.target.value)}
              className="w-full px-4 py-3 bg-[#F4F3EF] border border-[#E4E3DD] focus:border-[#E3B859] rounded-xl text-xs text-[#2D2D2D] focus:outline-none transition-colors font-mono"
              placeholder="cloudinary://key:secret@cloudname"
            />
          </div>
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={savingCloudinary}
              className="rounded-xl bg-[#E3B859] hover:bg-[#d4ac50] text-[#141416] text-xs font-bold uppercase tracking-wider px-6 py-3 transition-colors shadow-md disabled:opacity-50"
            >
              {savingCloudinary ? 'Saving...' : 'Save Cloudinary Credentials'}
            </button>
          </div>
        </form>
      </div>

      {/* Section 3 - Database Maintenance */}
      <div className="rounded-2xl border border-[#E4E3DD] bg-white p-6 space-y-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)]">
        <h3 className="font-bold text-[#1C1C1E] text-xs uppercase tracking-wider text-gray-500 border-b border-[#E4E3DD] pb-2">🗄️ Database Operations</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Database maintenance tools */}
          <div className="rounded-2xl bg-[#F4F3EF] border border-[#E4E3DD] p-5 flex flex-col justify-between h-44">
            <div>
              <h4 className="font-bold text-gray-800 text-sm">Clean Testing Data</h4>
              <p className="text-xs text-gray-500 mt-2 leading-relaxed font-semibold">
                Delete all rows where the lead name starts with the prefix <code className="text-[#1C1C1E] bg-[#ECEAE4] px-1 py-0.5 rounded font-mono font-bold">Test%</code>. Used to purge quick-adds during validation.
              </p>
            </div>
            <button
              onClick={handleClearTestLeads}
              disabled={clearingLeads || totalLeads === 0}
              className="w-full rounded-xl bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 disabled:opacity-50 text-xs font-bold uppercase tracking-wider py-3 transition-colors shadow-sm"
            >
              {clearingLeads ? 'Purging leads...' : 'Clear Test Leads'}
            </button>
          </div>

          <div className="rounded-2xl bg-[#F4F3EF] border border-[#E4E3DD] p-5 flex flex-col justify-between h-44">
            <div>
              <h4 className="font-bold text-gray-800 text-sm">Bulk Export Database</h4>
              <p className="text-xs text-gray-500 mt-2 leading-relaxed font-semibold">
                Compile and download the entire lead history database table (all pipeline statuses, dates, ratings, and locations) in a single CSV archive.
              </p>
            </div>
            <button
              onClick={handleExportAll}
              disabled={totalLeads === 0}
              className="w-full rounded-xl bg-[#1C1C1E] hover:bg-[#252528] disabled:opacity-50 text-xs font-bold uppercase tracking-wider py-3 text-white transition-colors shadow-md"
            >
              Export All Leads (CSV)
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
