'use client'

import React, { useState, useCallback } from 'react'
import toast from 'react-hot-toast'

interface TestResult {
  target: string
  label: string
  status: 'success' | 'error' | 'pending' | 'idle'
  httpCode?: number
  duration?: number
  graphResponse?: Record<string, unknown>
  errorMessage?: string
  logs?: string[]
  endpoint?: string
  timestamp?: string
}

const TEST_SUITES = [
  {
    group: 'Meta Platform',
    icon: '🔵',
    tests: [
      { id: 'meta_app',     label: 'Test Meta App',          desc: 'Validates App ID & Secret via /app endpoint.' },
      { id: 'oauth',        label: 'Test OAuth Token',        desc: 'Debugs and validates the Page Access Token.' },
      { id: 'permissions',  label: 'Test Permissions',        desc: 'Lists all granted Graph API scopes.' },
    ]
  },
  {
    group: 'Facebook',
    icon: '📘',
    tests: [
      { id: 'facebook',     label: 'Test FB Connection',     desc: 'Fetches page info from Graph API.' },
      { id: 'post_facebook',label: 'Test FB Post List',      desc: 'Loads recent posts from Page feed.' },
      { id: 'fb_insights',  label: 'Test FB Insights',       desc: 'Reads page_impressions & engagement metrics.' },
    ]
  },
  {
    group: 'Messenger',
    icon: '💬',
    tests: [
      { id: 'messenger',        label: 'Test Messenger',       desc: 'Checks Messenger subscription on the page.' },
      { id: 'messenger_inbox',  label: 'Test Messenger Inbox', desc: 'Reads first 5 page conversations.' },
    ]
  },
  {
    group: 'Instagram',
    icon: '📸',
    tests: [
      { id: 'instagram',        label: 'Test IG Connection',   desc: 'Fetches IG business profile details.' },
      { id: 'ig_media',         label: 'Test IG Media',        desc: 'Loads recent IG posts and reels.' },
      { id: 'dm_instagram',     label: 'Test IG DM',           desc: 'Reads Instagram DM conversations.' },
      { id: 'ig_insights',      label: 'Test IG Insights',     desc: 'Reads impressions, reach, followers.' },
    ]
  },
  {
    group: 'Publishing',
    icon: '📤',
    tests: [
      { id: 'post_instagram',   label: 'Test IG Post Container', desc: 'Creates test IG media container (no publish).' },
      { id: 'fb_publish_test',  label: 'Test FB Publish',        desc: 'Publishes a test post and immediately deletes it.' },
      { id: 'fb_comments',      label: 'Test FB Comments',       desc: 'Reads comments on the most recent post.' },
    ]
  },
  {
    group: 'Webhooks & Graph API',
    icon: '🔗',
    tests: [
      { id: 'webhook',   label: 'Test Webhook Verify',  desc: 'Fires challenge verification handshake.' },
      { id: 'graph_api', label: 'Test Graph API',       desc: 'Raw /me ping via Graph API v23.0.' },
    ]
  },
  {
    group: 'Infrastructure',
    icon: '⚙️',
    tests: [
      { id: 'n8n_health', label: 'Test n8n Connection', desc: 'Checks if n8n workflow engine is reachable.' },
    ]
  },
]

const ALL_TESTS = TEST_SUITES.flatMap(s => s.tests)

function buildEndpointLabel(target: string): string {
  const map: Record<string, string> = {
    meta_app: '/api/meta/test → Graph /app',
    oauth: '/api/meta/oauth → debug_token',
    permissions: '/api/meta/permissions → /me/permissions',
    facebook: '/api/meta/facebook/page',
    post_facebook: '/api/meta/facebook/post?limit=5',
    fb_insights: '/api/meta/facebook/insights',
    messenger: '/api/meta/test → messenger',
    messenger_inbox: '/api/meta/facebook/messages?limit=5',
    instagram: '/api/meta/instagram/profile',
    ig_media: '/api/meta/instagram/media?limit=5',
    dm_instagram: '/api/meta/instagram/messages?limit=5',
    ig_insights: '/api/meta/instagram/insights',
    post_instagram: '/api/meta/test → post_instagram',
    fb_publish_test: '/api/meta/facebook/post → publish + delete',
    fb_comments: '/api/meta/facebook/comments?post_id=latest',
    n8n_health: '/api/health/n8n',
    webhook: '/api/meta/webhook → challenge',
    graph_api: '/api/meta/test → graph_api',
  }
  return map[target] || `/api/meta/test?target=${target}`
}

function StatusBadge({ status }: { status: TestResult['status'] }) {
  const styles: Record<string, string> = {
    success: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
    error:   'bg-red-500/20 text-red-300 border border-red-500/30',
    pending: 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse',
    idle:    'bg-white/10 text-white/40 border border-white/10',
  }
  const labels: Record<string, string> = { success: '✅ PASS', error: '❌ FAIL', pending: '⏳ Running…', idle: '○ Idle' }
  return (
    <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${styles[status]}`}>
      {labels[status]}
    </span>
  )
}

async function runTest(target: string): Promise<TestResult> {
  const start = Date.now()
  const testItem = ALL_TESTS.find(t => t.id === target)
  const label = testItem?.label || target

  // Route by target
  const routeMap: Record<string, { method: string; url: string; body?: Record<string, unknown> }> = {
    facebook:       { method: 'GET', url: '/api/meta/facebook/page' },
    post_facebook:  { method: 'GET', url: '/api/meta/facebook/post?limit=5' },
    fb_insights:    { method: 'GET', url: '/api/meta/facebook/insights' },
    instagram:      { method: 'GET', url: '/api/meta/instagram/profile' },
    ig_media:       { method: 'GET', url: '/api/meta/instagram/media?limit=5' },
    dm_instagram:   { method: 'GET', url: '/api/meta/instagram/messages?limit=5' },
    ig_insights:    { method: 'GET', url: '/api/meta/instagram/insights' },
    messenger_inbox:{ method: 'GET', url: '/api/meta/facebook/messages?limit=5' },
    oauth:          { method: 'GET', url: '/api/meta/oauth?action=validate' },
    permissions:    { method: 'GET', url: '/api/meta/permissions' },
    n8n_health:     { method: 'GET', url: '/api/health/n8n' },
  }

  let httpCode = 0
  let graphResponse: Record<string, unknown> = {}
  let errorMessage: string | undefined
  const logs: string[] = []

  try {
    const route = routeMap[target]
    let res: Response
    let data: Record<string, unknown> = {}

    // ── Facebook publish+delete test (special flow) ───────────────────────
    if (target === 'fb_publish_test') {
      logs.push('→ POST /api/meta/facebook/post (action: publish)')
      const pubRes = await fetch('/api/meta/facebook/post', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'publish', message: `[FlowFyp Test] Auto-delete in progress — ${new Date().toISOString()}` }),
      })
      const pubData = await pubRes.json().catch(() => ({}))
      httpCode = pubRes.status
      graphResponse = pubData
      logs.push(`← HTTP ${httpCode} — post_id: ${pubData?.data?.id || 'none'}`)

      if (pubData?.data?.id) {
        logs.push('→ DELETE /api/meta/facebook/post (auto-cleanup)')
        const delRes = await fetch('/api/meta/facebook/post', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete', post_id: pubData.data.id }),
        })
        const delData = await delRes.json().catch(() => ({}))
        logs.push(`← DELETE HTTP ${delRes.status} — ${JSON.stringify(delData?.data || delData?.error || '')}`)
        graphResponse = { ...pubData, deleted: delData }
      }
    // ── Facebook comments test (load first post, then read comments) ────────
    } else if (target === 'fb_comments') {
      logs.push('→ GET /api/meta/facebook/post?limit=1')
      const postsRes = await fetch('/api/meta/facebook/post?limit=1')
      const postsData = await postsRes.json().catch(() => ({}))
      const firstPost = (postsData?.data as Array<{ id: string }> | undefined)?.[0]
      if (!firstPost?.id) {
        errorMessage = 'No posts found to read comments from.'
        graphResponse = postsData as Record<string, unknown>
        httpCode = 200
      } else {
        logs.push(`→ GET /api/meta/facebook/comments?post_id=${firstPost.id}`)
        const commRes = await fetch(`/api/meta/facebook/comments?post_id=${firstPost.id}`)
        const commData = await commRes.json().catch(() => ({}))
        httpCode = commRes.status
        graphResponse = commData as Record<string, unknown>
        logs.push(`← HTTP ${httpCode} — ${JSON.stringify(commData).slice(0, 100)}`)
        if (commData?.error) errorMessage = JSON.stringify(commData.error)
      }
    } else if (route) {
      res = await fetch(route.url, {
        method: route.method,
        ...(route.body ? { body: JSON.stringify(route.body), headers: { 'Content-Type': 'application/json' } } : {}),
      })
      data = await res.json().catch(() => ({}))
      httpCode = res.status
    } else {
      // Fallback: use test endpoint
      res = await fetch('/api/meta/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target }),
      })
      data = await res.json().catch(() => ({}))
      httpCode = res.status
    }

    const duration = Date.now() - start
    graphResponse = data as Record<string, unknown>
    logs.push(`→ ${buildEndpointLabel(target)}`)
    logs.push(`← HTTP ${httpCode} (${duration}ms)`)

    const hasError = !!data?.error || !data?.success
    if (data?.error) {
      const err = data.error as Record<string, unknown>
      errorMessage = (err?.message as string) || JSON.stringify(err)
      logs.push(`Graph Error: ${errorMessage}`)
    }

    return {
      target, label,
      status: !hasError ? 'success' : 'error',
      httpCode, duration,
      graphResponse, errorMessage,
      logs,
      endpoint: buildEndpointLabel(target),
      timestamp: new Date().toISOString(),
    }
  } catch (e: unknown) {
    return {
      target, label,
      status: 'error',
      httpCode: 0,
      duration: Date.now() - start,
      graphResponse: {},
      errorMessage: e instanceof Error ? e.message : 'Unknown error',
      logs: [`→ ${buildEndpointLabel(target)}`, `✖ Network error: ${e instanceof Error ? e.message : 'Unknown'}`],
      endpoint: buildEndpointLabel(target),
      timestamp: new Date().toISOString(),
    }
  }
}

export default function TestingPage() {
  const [results, setResults] = useState<Record<string, TestResult>>({})
  const [running, setRunning] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [runningAll, setRunningAll] = useState(false)
  const [progress, setProgress] = useState(0)

  const execute = useCallback(async (target: string) => {
    if (running || runningAll) return
    setRunning(target)
    setSelected(target)
    setResults(prev => ({ ...prev, [target]: { target, label: ALL_TESTS.find(t=>t.id===target)?.label || target, status: 'pending' } }))
    const result = await runTest(target)
    setResults(prev => ({ ...prev, [target]: result }))
    setRunning(null)
    if (result.status === 'success') toast.success(`${result.label} passed`)
    else toast.error(`${result.label} failed`)
  }, [running, runningAll])

  const runAll = useCallback(async () => {
    if (running || runningAll) return
    setRunningAll(true)
    setProgress(0)
    for (let i = 0; i < ALL_TESTS.length; i++) {
      const t = ALL_TESTS[i]
      setRunning(t.id)
      setSelected(t.id)
      setResults(prev => ({ ...prev, [t.id]: { target: t.id, label: t.label, status: 'pending' } }))
      const result = await runTest(t.id)
      setResults(prev => ({ ...prev, [t.id]: result }))
      setProgress(Math.round(((i + 1) / ALL_TESTS.length) * 100))
      await new Promise(r => setTimeout(r, 300))
    }
    setRunning(null)
    setRunningAll(false)
    toast.success('All tests completed!')
  }, [running, runningAll])

  const selectedResult = selected ? results[selected] : null
  const passCount = Object.values(results).filter(r => r.status === 'success').length
  const failCount = Object.values(results).filter(r => r.status === 'error').length
  const totalRan = passCount + failCount

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Header */}
      <div className="border-b border-white/10 px-8 py-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Meta API Test Center</h1>
            <p className="text-sm text-white/50 mt-1">Live diagnostics against Graph API v23.0 — all calls hit real endpoints</p>
          </div>
          <div className="flex items-center gap-4">
            {totalRan > 0 && (
              <div className="flex gap-3 text-sm font-mono">
                <span className="text-emerald-400">✅ {passCount}</span>
                <span className="text-white/20">|</span>
                <span className="text-red-400">❌ {failCount}</span>
                <span className="text-white/20">|</span>
                <span className="text-white/60">{totalRan}/{ALL_TESTS.length}</span>
              </div>
            )}
            <button
              id="run-all-tests"
              onClick={runAll}
              disabled={!!running || runningAll}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 text-white text-sm font-semibold hover:opacity-90 disabled:opacity-40 transition-all"
            >
              {runningAll ? `⏳ Running… ${progress}%` : '▶ Run All Tests'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-8 grid grid-cols-[380px,1fr] gap-8">
        {/* Left: test list */}
        <div className="space-y-6">
          {TEST_SUITES.map(suite => (
            <div key={suite.group}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">{suite.icon}</span>
                <span className="text-xs font-semibold text-white/40 uppercase tracking-widest">{suite.group}</span>
              </div>
              <div className="space-y-2">
                {suite.tests.map(t => {
                  const r = results[t.id]
                  const isRunning = running === t.id
                  const isSelected = selected === t.id
                  return (
                    <div
                      key={t.id}
                      onClick={() => { if (!isRunning) setSelected(t.id) }}
                      className={`group rounded-xl border p-3.5 cursor-pointer transition-all ${
                        isSelected
                          ? 'border-blue-500/50 bg-blue-500/10'
                          : 'border-white/8 bg-white/4 hover:border-white/20 hover:bg-white/8'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-white/90 truncate">{t.label}</span>
                        {r ? <StatusBadge status={r.status} /> : <StatusBadge status="idle" />}
                      </div>
                      <p className="text-xs text-white/35 mt-1 leading-snug">{t.desc}</p>
                      <div className="flex items-center justify-between mt-2.5">
                        <code className="text-[10px] text-white/25 truncate max-w-[180px]">{buildEndpointLabel(t.id)}</code>
                        <button
                          id={`run-${t.id}`}
                          onClick={e => { e.stopPropagation(); execute(t.id) }}
                          disabled={!!running || runningAll}
                          className="text-[11px] font-semibold px-3 py-1 rounded-lg bg-white/8 hover:bg-white/15 disabled:opacity-30 transition-all"
                        >
                          {isRunning ? '⏳' : '▶ Run'}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Right: result panel */}
        <div className="sticky top-8 h-fit">
          {selectedResult ? (
            <div className="rounded-2xl border border-white/10 bg-white/4 overflow-hidden">
              {/* Result header */}
              <div className={`px-6 py-4 border-b border-white/10 flex items-center justify-between ${
                selectedResult.status === 'success' ? 'bg-emerald-500/10' :
                selectedResult.status === 'error' ? 'bg-red-500/10' :
                selectedResult.status === 'pending' ? 'bg-amber-500/10' : ''
              }`}>
                <div>
                  <h2 className="font-bold text-white text-lg">{selectedResult.label}</h2>
                  <p className="text-xs text-white/40 font-mono mt-0.5">{selectedResult.endpoint}</p>
                </div>
                <StatusBadge status={selectedResult.status} />
              </div>

              {/* Metrics row */}
              {selectedResult.status !== 'idle' && selectedResult.status !== 'pending' && (
                <div className="grid grid-cols-3 divide-x divide-white/8 border-b border-white/8">
                  {[
                    { label: 'HTTP Code', value: selectedResult.httpCode ?? '–' },
                    { label: 'Latency',   value: selectedResult.duration ? `${selectedResult.duration}ms` : '–' },
                    { label: 'Status',    value: selectedResult.status === 'success' ? 'Pass' : 'Fail' },
                  ].map(m => (
                    <div key={m.label} className="px-6 py-3 text-center">
                      <div className="text-xs text-white/40 mb-1">{m.label}</div>
                      <div className={`text-lg font-bold font-mono ${
                        m.label === 'HTTP Code' && Number(m.value) >= 400 ? 'text-red-400' :
                        m.label === 'HTTP Code' && Number(m.value) >= 200 ? 'text-emerald-400' :
                        'text-white'
                      }`}>{m.value}</div>
                    </div>
                  ))}
                </div>
              )}

              <div className="p-6 space-y-4">
                {/* Logs */}
                {selectedResult.logs && selectedResult.logs.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-2">Request Log</div>
                    <div className="bg-black/30 rounded-xl p-3 font-mono text-xs space-y-1">
                      {selectedResult.logs.map((log, i) => (
                        <div key={i} className={log.startsWith('→') ? 'text-blue-300' : log.startsWith('←') ? 'text-emerald-300' : 'text-red-300'}>
                          {log}
                        </div>
                      ))}
                      {selectedResult.timestamp && (
                        <div className="text-white/20 pt-1">{selectedResult.timestamp}</div>
                      )}
                    </div>
                  </div>
                )}

                {/* Error */}
                {selectedResult.errorMessage && (
                  <div>
                    <div className="text-xs font-semibold text-red-400/60 uppercase tracking-widest mb-2">Graph Error</div>
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 font-mono text-xs text-red-300">
                      {selectedResult.errorMessage}
                    </div>
                  </div>
                )}

                {/* Response */}
                {selectedResult.graphResponse && Object.keys(selectedResult.graphResponse).length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-2">Graph Response</div>
                    <pre className="bg-black/30 rounded-xl p-3 font-mono text-xs text-white/70 overflow-auto max-h-72">
                      {JSON.stringify(selectedResult.graphResponse, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Pending */}
                {selectedResult.status === 'pending' && (
                  <div className="flex items-center gap-3 text-amber-300">
                    <span className="animate-spin">⏳</span>
                    <span className="text-sm">Calling Graph API…</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/8 bg-white/4 p-8 text-center">
              <div className="text-4xl mb-4">🔬</div>
              <h3 className="text-white/60 font-medium">Select a test to run</h3>
              <p className="text-white/30 text-sm mt-2">Click any test on the left, or use Run All to execute the full suite.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
