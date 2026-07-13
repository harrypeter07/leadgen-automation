'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import toast, { Toaster } from 'react-hot-toast'
import { Shield, ArrowLeft, RefreshCw, Key, CheckCircle, Database, Check } from 'lucide-react'

// Internal component that accesses search params
function OAuthTestContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const code = searchParams.get('code')

  const [appId, setAppId] = useState('')
  const [loadingConfig, setLoadingConfig] = useState(true)
  const [logs, setLogs] = useState<string[]>([])
  const [pages, setPages] = useState<any[]>([])
  const [exchanging, setExchanging] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)

  function addLog(msg: string) {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`])
  }

  // Get App ID
  async function fetchConfig() {
    addLog('Fetching Meta App Configuration from DB...')
    try {
      const res = await fetch('/api/automation/accounts/oauth/config')
      const data = await res.json()
      if (res.ok && data.appId) {
        setAppId(data.appId)
        addLog(`Successfully loaded Meta App ID: ${data.appId}`)
      } else {
        addLog('⚠️ Meta App ID not configured in meta_config table.')
      }
    } catch (err: any) {
      addLog(`❌ Error loading config: ${err.message}`)
    } finally {
      setLoadingConfig(false)
    }
  }

  useEffect(() => {
    fetchConfig()
  }, [])

  // Auto exchange code if present
  useEffect(() => {
    if (code && appId && !exchanging && pages.length === 0) {
      handleExchangeCode(code)
    }
  }, [code, appId])

  // Exchange Code
  async function handleExchangeCode(authCode: string) {
    setExchanging(true)
    addLog('🔑 Authorization code detected in URL query params.')
    addLog('🔄 Exchanging Authorization Code for Page & Instagram details...')
    
    // Clear code from query params for clean state
    router.replace('/automation/accounts/oauth-test')

    try {
      const redirectUri = `${window.location.origin}/automation/accounts/oauth-test`
      const res = await fetch('/api/automation/accounts/oauth/exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: authCode, redirect_uri: redirectUri })
      })
      const data = await res.json()
      
      if (res.ok && data.success) {
        setPages(data.pages || [])
        addLog(`✅ Exchange completed successfully! Found ${data.pages?.length || 0} Facebook Pages.`)
        data.pages?.forEach((p: any) => {
          if (p.instagram) {
            addLog(`   👉 Linked Instagram account found: @${p.instagram.username} (${p.instagram.name})`)
          } else {
            addLog(`   ℹ️ Facebook page "${p.name}" has no linked Instagram Business profile.`)
          }
        })
      } else {
        throw new Error(data.error || 'Failed to exchange token')
      }
    } catch (err: any) {
      addLog(`❌ Code exchange failed: ${err.message}`)
      toast.error(`Exchange failed: ${err.message}`)
    } finally {
      setExchanging(false)
    }
  }

  // Trigger Facebook Login
  function handleInitiateLogin() {
    if (!appId) {
      toast.error('Meta App ID is not loaded. Ensure it is configured in database.')
      return
    }

    const redirectUri = `${window.location.origin}/automation/accounts/oauth-test`
    const scopes = [
      'pages_show_list',
      'instagram_basic',
      'instagram_manage_comments',
      'instagram_manage_messages',
      'pages_read_engagement',
      'pages_manage_metadata'
    ].join(',')

    const oauthUrl = `https://www.facebook.com/v20.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&response_type=code`
    
    addLog(`Initiating Meta OAuth login dialog...`)
    addLog(`Scope permissions: ${scopes.replace(/,/g, ', ')}`)
    
    // Redirect to login
    window.location.href = oauthUrl
  }

  // Save selected Instagram Account
  async function handleSaveAccount(page: any) {
    if (!page.instagram) {
      toast.error('This page does not have a linked Instagram account.')
      return
    }

    setSavingId(page.id)
    const toastId = toast.loading(`Saving Instagram account @${page.instagram.username}...`)
    addLog(`Saving Instagram connection for @${page.instagram.username} in database...`)

    try {
      // Structure target credentials object
      const credentials = {
        access_token: page.page_access_token,
        page_id: page.id,
        instagram_business_id: page.instagram.id,
        instagram_access_token: page.page_access_token
      }

      const res = await fetch('/api/automation/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: 'instagram',
          account_name: page.instagram.username,
          app_id: appId,
          credentials
        })
      })

      const data = await res.json()
      if (res.ok && data.success) {
        addLog(`✅ Successfully saved @${page.instagram.username} into connected_accounts!`)
        toast.success(`Connected @${page.instagram.username}!`, { id: toastId })
        // Delay redirect slightly
        setTimeout(() => {
          router.push('/automation/accounts')
        }, 1500)
      } else {
        throw new Error(data.error || 'Failed to save account connection')
      }
    } catch (err: any) {
      addLog(`❌ Failed to save account: ${err.message}`)
      toast.error(`Save failed: ${err.message}`, { id: toastId })
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/automation/accounts')}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
                <Shield className="w-5 h-5 text-rose-500" /> Meta OAuth Integration Tester
              </h1>
              <p className="text-xs text-slate-400">Securely link multiple Instagram Business accounts via official Graph API</p>
            </div>
          </div>
          <button
            onClick={() => {
              setLogs([])
              fetchConfig()
            }}
            className="px-3.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold text-slate-300 hover:bg-slate-850 flex items-center gap-1.5 transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Clear logs
          </button>
        </div>

        {/* Configuration Check */}
        <div className="bg-slate-900/60 border border-slate-800/80 p-5 rounded-2xl space-y-3.5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Key className="w-4 h-4 text-rose-400" /> Meta Developer App Setup
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Detecting credentials mapped in database config table</p>
            </div>
            {appId ? (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-green-950 text-green-400 border border-green-900">
                Ready
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-950 text-red-400 border border-red-900">
                Unconfigured
              </span>
            )}
          </div>

          {loadingConfig ? (
            <div className="text-xs text-slate-500 animate-pulse">Scanning DB configuration keys...</div>
          ) : appId ? (
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300 space-y-1">
              <div><span className="text-slate-500">META_APP_ID:</span> {appId}</div>
              <div><span className="text-slate-500">OAUTH_REDIRECT_URI:</span> {typeof window !== 'undefined' ? `${window.location.origin}/automation/accounts/oauth-test` : ''}</div>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-red-950/20 border border-red-900/40 text-xs text-red-300 leading-relaxed">
              ⚠️ <strong>Configuration Missing:</strong> Please ensure that <code>META_APP_ID</code> and <code>META_APP_SECRET</code> keys are added inside the database <code>meta_config</code> table.
            </div>
          )}

          {appId && (
            <button
              onClick={handleInitiateLogin}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 text-white text-xs font-bold hover:from-rose-500 hover:to-pink-500 active:scale-[0.98] transition-all shadow-md shadow-rose-900/20 flex items-center justify-center gap-2"
            >
              🔐 Start Meta OAuth Login Flow
            </button>
          )}
        </div>

        {/* Exchange Results (Instagram Accounts List) */}
        {exchanging && (
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-8 text-center space-y-3.5 animate-pulse">
            <RefreshCw className="w-8 h-8 text-rose-500 animate-spin mx-auto" />
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-white">Exchanging Authorization Code</h4>
              <p className="text-xs text-slate-400">Connecting to Meta Graph API to verify pages and linked Instagram accounts...</p>
            </div>
          </div>
        )}

        {pages.length > 0 && (
          <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl space-y-4">
            <div>
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Database className="w-4 h-4 text-rose-400" /> Authorized Instagram Channels
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Select which Instagram profiles you want to store in your dashboard</p>
            </div>

            <div className="space-y-3">
              {pages.map((p: any) => {
                if (!p.instagram) return null

                return (
                  <div key={p.id} className="p-4 bg-slate-950 border border-slate-850 rounded-xl flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      {p.instagram.profile_picture_url ? (
                        <img src={p.instagram.profile_picture_url} alt="Profile" className="w-10 h-10 rounded-full border border-slate-800" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-rose-900/30 border border-rose-800 flex items-center justify-center font-bold text-rose-400 text-sm">
                          {p.instagram.username[0].toUpperCase()}
                        </div>
                      )}
                      <div>
                        <h4 className="text-sm font-black text-white flex items-center gap-1.5">
                          {p.instagram.name || p.instagram.username}
                          <span className="text-[10px] font-mono text-slate-500">(@{p.instagram.username})</span>
                        </h4>
                        <p className="text-[10px] text-slate-400 mt-0.5">Linked Facebook Page: {p.name}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleSaveAccount(p)}
                      disabled={savingId !== null}
                      className="px-4 py-2 rounded-xl bg-green-600 hover:bg-green-500 text-white text-xs font-black transition-colors disabled:opacity-40 flex items-center gap-1.5 shadow-sm shadow-green-900/10"
                    >
                      {savingId === p.id ? 'Saving...' : 'Save Connection'}
                    </button>
                  </div>
                )
              })}

              {pages.filter(p => p.instagram).length === 0 && (
                <div className="p-6 text-center text-xs text-slate-400 border border-dashed border-slate-800 rounded-xl">
                  ℹ️ No authorized Facebook pages have linked Instagram Business accounts. Ensure you link your Instagram Profile to a Facebook Page in Page Settings.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Logs Terminal */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
          <div className="px-4 py-3 bg-slate-850 border-b border-slate-800 flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" /> Live Execution Logger
            </span>
            <span className="text-[10px] font-mono text-slate-500">v3_oauth_debugger</span>
          </div>
          <div className="p-4 bg-slate-950 font-mono text-[10px] leading-relaxed space-y-1.5 h-64 overflow-y-auto">
            {logs.map((log, i) => (
              <div key={i} className="text-slate-350">{log}</div>
            ))}
            {logs.length === 0 && (
              <div className="text-slate-600 italic">No operations recorded yet. Start OAuth flow to capture details.</div>
            )}
          </div>
        </div>

      </div>
      <Toaster position="bottom-right" />
    </div>
  )
}

// Wrapper component to handle Suspense boundary
export default function OAuthTestPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="text-xs text-slate-400 animate-pulse">Loading Content...</div>
      </div>
    }>
      <OAuthTestContent />
    </Suspense>
  )
}
