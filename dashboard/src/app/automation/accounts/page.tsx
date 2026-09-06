'use client'

import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { 
  Button, 
  Badge, 
  Card, 
  HeroCard, 
  GalleryCard, 
  Input 
} from '@/components'
import { ShieldCheck, Plus, ExternalLink, Activity, RefreshCw } from 'lucide-react'

interface ConnectedAccount {
  id: string
  platform: 'facebook' | 'instagram' | 'messenger' | 'whatsapp'
  account_name: string
  app_id: string | null
  oauth_status: 'connected' | 'expired' | 'needs_reauth' | 'not_connected' | 'error'
  token_expires_at: string | null
  webhook_verification_status: 'verified' | 'unconfigured' | 'failed'
  permissions: string[]
  health_status: 'healthy' | 'degraded' | 'down'
  last_tested_at: string | null
  credentials_summary: Record<string, string>
  is_active?: boolean
}

export default function ConnectedAccountsPage() {
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([])
  const [loading, setLoading] = useState(true)

  const [showConfigModal, setShowConfigModal] = useState(false)
  const [platform, setPlatform] = useState<'facebook' | 'instagram' | 'messenger' | 'whatsapp'>('facebook')
  const [accountId, setAccountId] = useState('')
  const [accountName, setAccountName] = useState('')
  const [appId, setAppId] = useState('')
  const [accessToken, setAccessToken] = useState('')
  const [appSecret, setAppSecret] = useState('')
  const [pageId, setPageId] = useState('')
  const [wabaId, setWabaId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [testingId, setTestingId] = useState<string | null>(null)

  async function fetchAccounts() {
    try {
      const res = await fetch('/api/automation/accounts')
      const data = await res.json()
      if (res.ok && data.accounts) {
        setAccounts(data.accounts)
      } else {
        toast.error(data.error || 'Failed to load connected accounts.')
      }
    } catch (err) {
      console.error('Failed fetching accounts:', err)
      toast.error('Network error loading connected accounts.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAccounts()
  }, [])

  async function handleSaveAccount(e: React.FormEvent) {
    e.preventDefault()
    if (!accountName.trim() || !accessToken.trim()) {
      toast.error('Account Name and Access Token are required.')
      return
    }

    setSubmitting(true)
    const toastId = toast.loading('Saving account credentials...')
    try {
      const credentials: Record<string, string> = { access_token: accessToken.trim() }
      if (appSecret.trim()) credentials.app_secret = appSecret.trim()
      if (pageId.trim()) credentials.page_id = pageId.trim()
      if (wabaId.trim()) credentials.waba_id = wabaId.trim()

      const res = await fetch('/api/automation/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: accountId || undefined,
          platform,
          account_name: accountName.trim(),
          app_id: appId.trim() || null,
          credentials
        })
      })

      const data = await res.json()
      if (res.ok) {
        toast.success(accountId ? 'Settings updated!' : 'Account connected!', { id: toastId })
        setShowConfigModal(false)
        resetForm()
        fetchAccounts()
      } else {
        throw new Error(data.error || 'Failed to save account.')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error saving account'
      toast.error(msg, { id: toastId })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeleteAccount(id: string) {
    if (!confirm('Are you sure you want to disconnect this account?')) return
    const toastId = toast.loading('Disconnecting account...')
    try {
      const res = await fetch(`/api/automation/accounts/${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Account disconnected.', { id: toastId })
        fetchAccounts()
      } else {
        throw new Error('Failed to disconnect')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error disconnecting'
      toast.error(msg, { id: toastId })
    }
  }

  async function handleTestConnection(id: string) {
    setTestingId(id)
    const toastId = toast.loading('Testing API token verification...')
    try {
      const res = await fetch(`/api/automation/accounts/${id}/test`, { method: 'POST' })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success('Connection active and healthy!', { id: toastId })
        fetchAccounts()
      } else {
        toast.error(`Verification Failed: ${data.errorDetail || 'Invalid Access Token'}`, { id: toastId })
        fetchAccounts()
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Test failed'
      toast.error(`Verification Failed: ${msg}`, { id: toastId })
    } finally {
      setTestingId(null)
    }
  }

  function resetForm() {
    setAccountId('')
    setAccountName('')
    setAppId('')
    setAccessToken('')
    setAppSecret('')
    setPageId('')
    setWabaId('')
  }

  const getPlatformDetails = (platKey: string) => {
    switch (platKey) {
      case 'facebook': return { label: 'Facebook Pages', icon: '📘' }
      case 'instagram': return { label: 'Instagram Business', icon: '📸' }
      case 'messenger': return { label: 'Messenger Platform', icon: '💬' }
      case 'whatsapp': return { label: 'WhatsApp Cloud API', icon: '🟢' }
      default: return { label: platKey, icon: '🔗' }
    }
  }

  return (
    <div className="space-y-10 max-w-7xl mx-auto">
      {/* Hero Header */}
      <HeroCard
        eyebrow="SYSTEM CONNECTIONS"
        title="Connected Social Channels & Meta API"
        description="Link Meta Graph API endpoints, manage OAuth credentials, and monitor webhook health."
        variant="ink"
      />

      {/* Main Grid View */}
      {loading ? (
        <p className="text-center text-text-muted py-12 font-medium">Loading connected channels...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {['facebook', 'instagram', 'messenger', 'whatsapp'].map((platKey) => {
            const platDetails = getPlatformDetails(platKey)
            const linkedAccounts = accounts.filter(a => a.platform === platKey)

            return (
              <Card key={platKey} variant="page-alt" className="p-6 space-y-6 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-border-subtle pb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{platDetails.icon}</span>
                      <h3 className="font-bold text-lg text-ink font-display">{platDetails.label}</h3>
                    </div>
                    <Badge variant="dark">{linkedAccounts.length} Connected</Badge>
                  </div>
                </div>

                <div className="space-y-3">
                  {linkedAccounts.length === 0 ? (
                    <p className="text-xs text-text-muted italic py-4">No active connection saved for this channel.</p>
                  ) : (
                    linkedAccounts.map((acc) => (
                      <div key={acc.id} className="bg-page p-4 rounded-lg space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-sm text-ink">{acc.account_name}</h4>
                          <Badge variant={acc.health_status === 'healthy' ? 'lime' : 'warning'}>
                            {acc.health_status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleTestConnection(acc.id)}
                            disabled={testingId === acc.id}
                          >
                            {testingId === acc.id ? 'Testing...' : 'Test'}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteAccount(acc.id)}
                            className="text-[#B5583F] hover:text-[#B5583F]"
                          >
                            Disconnect
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    resetForm()
                    setPlatform(platKey as any)
                    setShowConfigModal(true)
                  }}
                  className="w-full mt-2"
                >
                  + Link New Account
                </Button>
              </Card>
            )
          })}
        </div>
      )}

      {/* Modal Slide-In */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-ink/60 backdrop-blur-sm flex items-center justify-center p-6 z-50">
          <Card variant="page-alt" className="w-full max-w-md p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-border-subtle pb-4">
              <h3 className="font-bold text-xl text-ink font-display">
                {accountId ? 'Edit Connection' : `Connect ${getPlatformDetails(platform).label}`}
              </h3>
              <Badge variant="dark">CREDENTIALS</Badge>
            </div>

            <form onSubmit={handleSaveAccount} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-eyebrow text-text-muted mb-1">
                  Connection Name *
                </label>
                <Input
                  type="text"
                  required
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="e.g. Primary Page"
                  className="w-full h-11 rounded-pill bg-page px-4 text-xs font-medium border-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-eyebrow text-text-muted mb-1">
                  Access Token *
                </label>
                <Input
                  type="password"
                  required
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  placeholder="Graph API System Token"
                  className="w-full h-11 rounded-pill bg-page px-4 text-xs font-mono border-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowConfigModal(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  loading={submitting}
                  variant="primary"
                  className="flex-1"
                >
                  Save Settings
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  )
}
