'use client'

import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { supabaseBrowser } from '@/lib/supabase'
import { 
  Button, 
  Badge, 
  Card, 
  HeroCard, 
  Input 
} from '@/components'
import { CheckCircle2, Copy, HardDrive, RefreshCw, Server, ShieldCheck, Terminal } from 'lucide-react'

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
  const [companyName, setCompanyName] = useState('Stratnent')
  const [icpDescription, setIcpDescription] = useState('')
  const [offeringPitch, setOfferingPitch] = useState('')
  const [systemInstructions, setSystemInstructions] = useState('')
  const [whatsappDelayMs, setWhatsappDelayMs] = useState(5000)
  const [followupCooldownHours, setFollowupCooldownHours] = useState(24)
  const [rateLimitMessagesPerMinute, setRateLimitMessagesPerMinute] = useState(5)
  const [savingSettings, setSavingSettings] = useState(false)
  const [loadingSettings, setLoadingSettings] = useState(true)

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

  async function fetchOutreachSettings() {
    setLoadingSettings(true)
    try {
      const res = await fetch('/api/backend-v3/outreach/settings')
      if (res.ok) {
        const json = await res.json()
        if (json.success && json.data) {
          const s = json.data
          setCompanyName(s.company_name || 'Stratnent')
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
        toast.success('Campaign settings updated!', { id: toastId })
        fetchOutreachSettings()
      } else {
        throw new Error('Server error')
      }
    } catch {
      toast.error('Failed to update settings.', { id: toastId })
    } finally {
      setSavingSettings(false)
    }
  }

  useEffect(() => {
    fetchDbStats()
    fetchConfigStatus()
    fetchOutreachSettings()
  }, [])

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
        setSupabaseHealth({ status: 'disconnected', error: 'Server error' })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error'
      setSupabaseHealth({ status: 'disconnected', error: msg })
      toast.error(`Database offline: ${msg}`)
    }
  }

  async function handleClearTestLeads() {
    if (!confirm('Permanently delete all leads starting with "Test"?')) return
    setClearingLeads(true)
    const toastId = toast.loading('Purging test data...')
    try {
      const { data, error } = await supabaseBrowser
        .from('leads')
        .delete()
        .like('name', 'Test%')
        .select()
      if (error) throw error
      toast.success(`Purged ${data?.length ?? 0} test leads!`, { id: toastId })
      fetchDbStats()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error purging'
      toast.error(msg, { id: toastId })
    } finally {
      setClearingLeads(false)
    }
  }

  return (
    <div className="space-y-10 max-w-7xl mx-auto">
      {/* Hero Header */}
      <HeroCard
        eyebrow="SETTINGS & CONFIG"
        title="System Parameters & Target Control"
        description="Verify service health, configure ideal customer profiles (ICP), system prompts, and delay throttles."
        variant="sage"
      />

      {/* Campaign ICP & Targeting Settings */}
      <Card variant="page-alt" className="p-8 space-y-6">
        <div className="flex items-center justify-between border-b border-border-subtle pb-4">
          <h3 className="font-bold text-xl text-ink font-display">Targeting & ICP Controls</h3>
          <Badge variant="dark">CONFIG</Badge>
        </div>

        {loadingSettings ? (
          <p className="text-center text-text-muted py-8 font-medium">Loading settings...</p>
        ) : (
          <form onSubmit={handleSaveOutreachSettings} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-eyebrow text-text-muted mb-2">
                    Company Name
                  </label>
                  <Input
                    type="text"
                    value={companyName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCompanyName(e.target.value)}
                    className="w-full h-12 rounded-md bg-page border border-border-subtle px-4 text-sm text-ink focus:ring-2 focus:ring-lime"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-eyebrow text-text-muted mb-2">
                    Ideal Customer Profile (ICP)
                  </label>
                  <textarea
                    rows={4}
                    value={icpDescription}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setIcpDescription(e.target.value)}
                    className="w-full rounded-md bg-page border border-border-subtle p-4 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-lime font-medium"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-eyebrow text-text-muted mb-2">
                    Gemini System Instructions
                  </label>
                  <textarea
                    rows={7}
                    value={systemInstructions}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setSystemInstructions(e.target.value)}
                    className="w-full rounded-md bg-page border border-border-subtle p-4 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-lime font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-border-subtle">
              <Button
                type="submit"
                loading={savingSettings}
                variant="primary"
                iconType="arrow-right"
              >
                Save Settings
              </Button>
            </div>
          </form>
        )}
      </Card>

      {/* Database Maintenance Card */}
      <Card variant="page-alt" className="p-8 space-y-6">
        <div className="flex items-center justify-between border-b border-border-subtle pb-4">
          <h3 className="font-bold text-xl text-ink font-display">Database Maintenance</h3>
          <Badge variant="lime">OPERATIONS</Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-page p-6 rounded-lg space-y-4 flex flex-col justify-between">
            <div>
              <h4 className="font-bold text-base text-ink">Database Health Check</h4>
              <p className="text-xs text-text-body mt-1">Verify real-time connection latency to Supabase PostgreSQL.</p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={testSupabase}
              className="w-full"
            >
              Test Supabase Connection
            </Button>
          </div>

          <div className="bg-page p-6 rounded-lg space-y-4 flex flex-col justify-between">
            <div>
              <h4 className="font-bold text-base text-ink">Purge Test Leads</h4>
              <p className="text-xs text-text-body mt-1">Permanently delete leads matching test pattern.</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearTestLeads}
              loading={clearingLeads}
              className="w-full text-[#B5583F] hover:text-[#B5583F]"
            >
              Clear Test Data
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
