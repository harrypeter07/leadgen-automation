'use client'

import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'

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
}

export default function ConnectedAccountsPage() {
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([])
  const [loading, setLoading] = useState(true)

  // Form states for creating/editing connection settings
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

  // Fetch connected accounts list
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

  // Save/Update account settings
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
        toast.success(accountId ? 'Connection settings updated!' : 'Social account connected successfully!', { id: toastId })
        setShowConfigModal(false)
        resetForm()
        fetchAccounts()
      } else {
        throw new Error(data.error || 'Failed to save account.')
      }
    } catch (err: any) {
      toast.error(err.message, { id: toastId })
    } finally {
      setSubmitting(false)
    }
  }

  // Disconnect/Delete account
  async function handleDeleteAccount(id: string) {
    if (!confirm('Are you sure you want to disconnect this account? All associated automation webhooks and credentials will be removed.')) return
    
    const toastId = toast.loading('Disconnecting account...')
    try {
      const res = await fetch(`/api/automation/accounts/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (res.ok) {
        toast.success('Account disconnected.', { id: toastId })
        fetchAccounts()
      } else {
        throw new Error(data.error || 'Failed to disconnect account.')
      }
    } catch (err: any) {
      toast.error(err.message, { id: toastId })
    }
  }

  // Test credentials connection via Meta Graph API simulation
  async function handleTestConnection(id: string) {
    setTestingId(id)
    const toastId = toast.loading('Testing API token verification...')
    try {
      const res = await fetch(`/api/automation/accounts/${id}/test`, { method: 'POST' })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success('Verification Succeeded! Connection is active and healthy.', { id: toastId })
        fetchAccounts()
      } else {
        toast.error(`Verification Failed: ${data.errorDetail || 'Invalid Access Token'}`, { id: toastId, duration: 6000 })
        fetchAccounts()
      }
    } catch (err: any) {
      toast.error(`Verification Failed: ${err.message}`, { id: toastId })
    } finally {
      setTestingId(null)
    }
  }

  // Trigger reconnect / update credentials flow
  function handleReconnect(acc: ConnectedAccount) {
    setAccountId(acc.id)
    setPlatform(acc.platform)
    setAccountName(acc.account_name)
    setAppId(acc.app_id || '')
    setAccessToken('') // clear token to force new input
    setAppSecret('')
    setPageId(acc.credentials_summary.page_id || '')
    setWabaId(acc.credentials_summary.waba_id || '')
    setShowConfigModal(true)
  }

  // Reset form states
  function resetForm() {
    setAccountId('')
    setAccountName('')
    setAppId('')
    setAccessToken('')
    setAppSecret('')
    setPageId('')
    setWabaId('')
  }

  function handleAddNewClick(plat: 'facebook' | 'instagram' | 'messenger' | 'whatsapp') {
    resetForm()
    setPlatform(plat)
    setShowConfigModal(true)
  }

  const getPlatformLabel = (platKey: string) => {
    switch (platKey) {
      case 'facebook': return { label: 'Facebook Pages', icon: '📘' }
      case 'instagram': return { label: 'Instagram Business', icon: '📸' }
      case 'messenger': return { label: 'Messenger Platform', icon: '💬' }
      case 'whatsapp': return { label: 'WhatsApp Cloud API', icon: '🟢' }
      default: return { label: platKey, icon: '🔗' }
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'connected':
        return <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-green-950/45 text-green-400 border border-green-900/40">Connected</span>
      case 'needs_reauth':
        return <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-950/45 text-amber-400 border border-amber-900/40">Needs Reauth</span>
      case 'expired':
        return <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-red-950/45 text-red-400 border border-red-900/40">Expired</span>
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-gray-800 text-gray-400 border border-gray-700">Not Connected</span>
    }
  }

  const getHealthBadge = (health: string) => {
    switch (health) {
      case 'healthy':
        return <span className="text-green-500 font-bold">● Healthy</span>
      case 'degraded':
        return <span className="text-amber-500 font-bold">▲ Degraded</span>
      default:
        return <span className="text-red-500 font-bold">■ Outage</span>
    }
  }

  return (
    <div className="space-y-8 select-none text-white">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black tracking-tight">Connected Accounts & Channels</h1>
        <p className="mt-1 text-sm text-gray-500 font-medium">Link Meta endpoints, secure Graph API Access Tokens, and monitor real-time Webhook verification status.</p>
      </div>

      {/* Main Grid View */}
      {loading ? (
        <div className="text-center py-12 text-gray-400 text-xs font-semibold">Loading connected social profiles...</div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Card list of platforms */}
          {['facebook', 'instagram', 'messenger', 'whatsapp'].map((platKey) => {
            const platDetails = getPlatformLabel(platKey)
            const linkedAccounts = accounts.filter(a => a.platform === platKey)
            const desc = platKey === 'facebook' ? 'Publish posts, sync comments, and run page automation pipelines.'
                      : platKey === 'instagram' ? 'Schedule visual posts, publish reels, and manage unified direct messages.'
                      : platKey === 'messenger' ? 'Power ManyChat-style flow triggers and direct conversation responder bots.'
                      : 'Dispatch structured campaign templates and interactive menu options.'

            return (
              <div key={platKey} className="rounded-2xl border border-[#2D2D30] bg-[#18181A] p-6 flex flex-col justify-between space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{platDetails.icon}</span>
                    <h3 className="text-lg font-bold text-white tracking-tight">{platDetails.label}</h3>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed font-medium">{desc}</p>
                </div>

                {/* Linked Accounts details */}
                <div className="space-y-3.5 pt-4 border-t border-[#2D2D30]/60">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Linked Connections ({linkedAccounts.length})</span>
                  {linkedAccounts.length === 0 ? (
                    <p className="text-[10px] text-gray-500 italic font-semibold py-2">No active connection configuration saved.</p>
                  ) : (
                    <div className="space-y-3">
                      {linkedAccounts.map((acc) => (
                        <div key={acc.id} className="p-4 bg-[#141416] border border-[#2D2D30]/60 rounded-xl space-y-3 text-xs">
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="font-bold text-white block">{acc.account_name}</span>
                              <span className="text-[9px] text-gray-500 font-mono mt-0.5 block">ID: {acc.id}</span>
                            </div>
                            <div className="flex gap-2">
                              {getStatusBadge(acc.oauth_status)}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-[10px] text-gray-400 border-t border-[#2D2D30]/30 pt-2.5 font-medium">
                            <div>
                              <span className="text-[8px] uppercase text-gray-500 block">Health</span>
                              {getHealthBadge(acc.health_status)}
                            </div>
                            <div>
                              <span className="text-[8px] uppercase text-gray-500 block">Webhooks</span>
                              <span className={acc.webhook_verification_status === 'verified' ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>
                                {acc.webhook_verification_status === 'verified' ? '✓ Verified' : '✗ Unconfigured'}
                              </span>
                            </div>
                          </div>

                          {acc.permissions && acc.permissions.length > 0 && (
                            <div className="text-[9px] text-gray-500 leading-relaxed pt-1.5 border-t border-[#2D2D30]/30">
                              <span className="uppercase text-[8px] font-bold text-gray-600 block">Granted Scope:</span>
                              <span className="font-mono">{acc.permissions.slice(0, 5).join(', ')}{acc.permissions.length > 5 ? '...' : ''}</span>
                            </div>
                          )}

                          {/* Connection management buttons */}
                          <div className="flex gap-2 pt-2 border-t border-[#2D2D30]/30">
                            <button
                              onClick={() => handleTestConnection(acc.id)}
                              disabled={testingId === acc.id}
                              className="flex-1 py-1.5 rounded bg-[#222225] border border-[#2D2D30] hover:bg-[#2A2A2E] text-[10px] font-bold uppercase tracking-wider text-white transition-colors"
                            >
                              {testingId === acc.id ? 'Testing...' : '🩺 Test'}
                            </button>
                            <button
                              onClick={() => handleReconnect(acc)}
                              className="flex-1 py-1.5 rounded bg-amber-900/20 border border-amber-900/35 hover:bg-amber-900/35 text-[10px] font-bold uppercase tracking-wider text-amber-400 transition-colors"
                            >
                              🔄 Reconnect
                            </button>
                            <button
                              onClick={() => handleDeleteAccount(acc.id)}
                              className="flex-1 py-1.5 rounded bg-red-900/20 border border-red-900/35 hover:bg-red-900/35 text-[10px] font-bold uppercase tracking-wider text-red-400 transition-colors"
                            >
                              ⏹️ Disconnect
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => handleAddNewClick(platKey as any)}
                    className="w-full rounded-xl bg-[#222225] border border-[#2D2D30] hover:bg-[#2A2A2E] text-xs font-bold uppercase tracking-wider text-white py-3 transition-colors shadow-sm"
                  >
                    + Link New {platDetails.label.split(' ')[0]} Account
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Configuration modal/form panel */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#18181A] border border-[#2D2D30] rounded-2xl p-6 w-full max-w-md space-y-4 shadow-xl">
            <div>
              <h3 className="text-lg font-bold tracking-tight">
                {accountId ? '✏️ Edit Connection Settings' : `🔌 Connect ${getPlatformLabel(platform).label}`}
              </h3>
              <p className="text-[10px] text-gray-500 font-medium">Save configuration credentials securely in database (encrypted)</p>
            </div>

            <form onSubmit={handleSaveAccount} className="space-y-3 text-xs">
              <div>
                <label className="block text-[9px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Connection Name *</label>
                <input
                  type="text"
                  required
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="e.g. Singapore Clinic Page"
                  className="w-full rounded-xl bg-[#141416] border border-[#2D2D30] px-3.5 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-gray-500"
                />
              </div>

              <div>
                <label className="block text-[9px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Access Token / WABA Token *</label>
                <input
                  type="password"
                  required
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  placeholder="Graph API System Token or Cloud API Secret"
                  className="w-full rounded-xl bg-[#141416] border border-[#2D2D30] px-3.5 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-gray-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-bold text-gray-500 mb-1 uppercase tracking-wider">App ID (Optional)</label>
                  <input
                    type="text"
                    value={appId}
                    onChange={(e) => setAppId(e.target.value)}
                    placeholder="Meta App ID"
                    className="w-full rounded-xl bg-[#141416] border border-[#2D2D30] px-3.5 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-gray-500 mb-1 uppercase tracking-wider">App Secret (Optional)</label>
                  <input
                    type="password"
                    value={appSecret}
                    onChange={(e) => setAppSecret(e.target.value)}
                    placeholder="Meta App Secret"
                    className="w-full rounded-xl bg-[#141416] border border-[#2D2D30] px-3.5 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-gray-500"
                  />
                </div>
              </div>

              {(platform === 'facebook' || platform === 'messenger' || platform === 'instagram') && (
                <div>
                  <label className="block text-[9px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Page ID / Business Page Link</label>
                  <input
                    type="text"
                    value={pageId}
                    onChange={(e) => setPageId(e.target.value)}
                    placeholder="e.g. 1029481928"
                    className="w-full rounded-xl bg-[#141416] border border-[#2D2D30] px-3.5 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-gray-500"
                  />
                </div>
              )}

              {platform === 'whatsapp' && (
                <div>
                  <label className="block text-[9px] font-bold text-gray-500 mb-1 uppercase tracking-wider">WhatsApp Business Account ID (WABA)</label>
                  <input
                    type="text"
                    value={wabaId}
                    onChange={(e) => setWabaId(e.target.value)}
                    placeholder="WABA Account ID"
                    className="w-full rounded-xl bg-[#141416] border border-[#2D2D30] px-3.5 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-gray-500"
                  />
                </div>
              )}

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="flex-1 rounded-xl bg-[#222225] border border-[#2D2D30] hover:bg-[#2A2A2E] text-xs font-bold uppercase tracking-wider text-white py-3.5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-xs font-bold uppercase tracking-wider text-white py-3.5 transition-colors shadow-md"
                >
                  {submitting ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
