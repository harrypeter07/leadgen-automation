'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'

interface ConnectedAccount {
  id: string
  platform: 'facebook' | 'instagram' | 'messenger' | 'whatsapp'
  account_name: string
  oauth_status: string
  webhook_verification_status: string
  health_status: string
  permissions: string[]
  last_tested_at: string | null
}

interface AuditLog {
  id: string
  action: string
  details: string
  user_identifier: string
  created_at: string
}

interface WorkflowStatus {
  name: string
  active: boolean
  last_run: string | null
  execution_time: string | null
  status: string
}

interface QueueItem {
  id: string
  platform: string
  account_name: string
  content: string
  media_url: string | null
  scheduled_at: string
  status: 'scheduled' | 'published' | 'failed'
  published_id: string | null
}

export default function AutomationDashboardPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'channels' | 'inbox' | 'publishing' | 'logs'>('overview')
  
  // Dynamic API state hooks
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [workflows, setWorkflows] = useState<WorkflowStatus[]>([])
  const [publishingQueue, setPublishingQueue] = useState<QueueItem[]>([])
  const [loading, setLoading] = useState(true)

  // Dynamic Inbox state hooks
  const [inboxMessages, setInboxMessages] = useState<any[]>([])
  const [selectedMsg, setSelectedMsg] = useState<any | null>(null)
  const [replyText, setReplyText] = useState('')
  const [sendingReply, setSendingReply] = useState(false)

  // Scheduling Form Inputs
  const [composePlatform, setComposePlatform] = useState('facebook')
  const [composeAccount, setComposeAccount] = useState('')
  const [composeContent, setComposeContent] = useState('')
  const [composeMedia, setComposeMedia] = useState('')
  const [composeDate, setComposeDate] = useState('')
  const [submittingPost, setSubmittingPost] = useState(false)

  // Fetch all live dashboard statistics and logs
  async function fetchDashboardData() {
    try {
      const accRes = await fetch('/api/automation/accounts')
      const accData = await accRes.json()
      if (accRes.ok && accData.accounts) {
        setAccounts(accData.accounts)
      }

      const logRes = await fetch('/api/automation/accounts/logs')
      const logData = await logRes.json()
      if (logRes.ok && logData.logs) {
        setAuditLogs(logData.logs)
      }

      const wfRes = await fetch('/api/automation/workflows')
      const wfData = await wfRes.json()
      if (wfRes.ok && wfData.workflows) {
        setWorkflows(wfData.workflows)
      }

      const qRes = await fetch('/api/automation/workflows/publish/queue')
      const qData = await qRes.json().catch(() => ({}))
      // Fallback load from standard path if sub-path requires resolution
      const resolvedQueueRes = await fetch('/api/automation/workflows/publish/queue')
      const resolvedQueueData = await resolvedQueueRes.json()
      if (resolvedQueueRes.ok && resolvedQueueData.queue) {
        setPublishingQueue(resolvedQueueData.queue)
      }

      // Fetch dynamic messages from Connected Facebook / Instagram APIs
      const fetchedMsgs: any[] = []
      try {
        const fbRes = await fetch('/api/meta/facebook/messages?limit=10')
        const fbData = await fbRes.json()
        if (fbData.data && Array.isArray(fbData.data)) {
          fbData.data.forEach((conv: any) => {
            const msgs = conv.messages?.data || []
            const last = msgs[0]
            fetchedMsgs.push({
              id: conv.id,
              sender: conv.participants?.data?.[0]?.name || 'Messenger User',
              text: last?.message || '(no message)',
              platform: 'messenger',
              time: last?.created_time ? new Date(last.created_time).toLocaleTimeString() : 'Unknown',
              participantId: conv.participants?.data?.[0]?.id,
            })
          })
        }
      } catch (e) {
        console.warn('Error fetching FB messages:', e)
      }

      try {
        const igRes = await fetch('/api/meta/instagram/messages?limit=10')
        const igData = await igRes.json()
        if (igData.data && Array.isArray(igData.data)) {
          igData.data.forEach((conv: any) => {
            const msgs = conv.messages?.data || []
            const last = msgs[0]
            fetchedMsgs.push({
              id: `ig_${conv.id}`,
              sender: conv.participants?.data?.[0]?.name || 'Instagram User',
              text: last?.message || '(no message)',
              platform: 'instagram',
              time: last?.created_time ? new Date(last.created_time).toLocaleTimeString() : 'Unknown',
              participantId: conv.participants?.data?.[0]?.id,
            })
          })
        }
      } catch (e) {
        console.warn('Error fetching IG messages:', e)
      }

      setInboxMessages(fetchedMsgs)
    } catch (err) {
      console.error('Error fetching dashboard stats:', err)
    } finally {
      setLoading(false)
    }
  }

  // Reply submit handler
  async function handleSendReply(e: React.FormEvent) {
    e.preventDefault()
    if (!replyText.trim() || !selectedMsg) return
    setSendingReply(true)
    const toastId = toast.loading('Sending message...')
    try {
      const recipientId = selectedMsg.participantId || selectedMsg.id.replace('ig_', '')
      const endpoint = selectedMsg.platform === 'instagram'
        ? '/api/meta/instagram/messages'
        : '/api/meta/facebook/messages'

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient_id: recipientId, text: replyText })
      })
      const data = await res.json()

      if (res.ok && data.success) {
        toast.success('Message sent!', { id: toastId })
        setReplyText('')
        // Local state update for rendering
        setSelectedMsg((prev: any) => ({
          ...prev,
          replied: true,
          replyText: replyText
        }))
        fetchDashboardData()
      } else {
        throw new Error(data.error?.message || data.error || 'Send failed')
      }
    } catch (err: any) {
      toast.error(err.message, { id: toastId })
    } finally {
      setSendingReply(false)
    }
  }

  useEffect(() => {
    fetchDashboardData()
    const interval = setInterval(fetchDashboardData, 7000)
    return () => clearInterval(interval)
  }, [])

  // Toggle workflow active status
  async function handleToggleWorkflow(name: string, currentActive: boolean) {
    const toastId = toast.loading(`${currentActive ? 'Disabling' : 'Enabling'} workflow...`)
    try {
      const res = await fetch('/api/automation/workflows/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, active: !currentActive })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(`Workflow '${name}' updated successfully.`, { id: toastId })
        fetchDashboardData()
      } else {
        throw new Error(data.error || 'Failed to toggle status.')
      }
    } catch (err: any) {
      toast.error(err.message, { id: toastId })
    }
  }

  // Handle post composition scheduling
  async function handleSchedulePost(e: React.FormEvent) {
    e.preventDefault()
    if (!composeAccount.trim() || !composeContent.trim() || !composeDate) {
      toast.error('Account name, Content message, and Target Date are required.')
      return
    }

    setSubmittingPost(true)
    const toastId = toast.loading('Scheduling composed post...')
    try {
      const res = await fetch('/api/automation/workflows/publish/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: composePlatform,
          account_name: composeAccount.trim(),
          content: composeContent.trim(),
          media_url: composeMedia.trim() || null,
          scheduled_at: new Date(composeDate).toISOString()
        })
      })

      const data = await res.json()
      if (res.ok && data.success) {
        toast.success('Campaign post scheduled successfully!', { id: toastId })
        setComposeContent('')
        setComposeMedia('')
        setComposeDate('')
        fetchDashboardData()
      } else {
        throw new Error(data.error || 'Failed to queue post.')
      }
    } catch (err: any) {
      toast.error(err.message, { id: toastId })
    } finally {
      setSubmittingPost(false)
    }
  }

  // Trigger retry for failed outbox jobs
  async function handleRetryJob(id: string) {
    const toastId = toast.loading('Retrying failed publishing job...')
    try {
      const res = await fetch('/api/automation/workflows/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success('Job reset back to scheduled!', { id: toastId })
        fetchDashboardData()
      } else {
        throw new Error(data.error || 'Failed to retry job.')
      }
    } catch (err: any) {
      toast.error(err.message, { id: toastId })
    }
  }

  // Static stats
  const stats = [
    { label: 'Connected Channels', count: `${accounts.length}/4`, change: 'Facebook, Insta, WA active', color: 'bg-gradient-to-tr from-green-500/20 to-[#E3B859]/20 border border-green-500/30' },
    { label: 'Publishing Queue', count: `${publishingQueue.filter(q => q.status === 'scheduled').length}`, change: 'Scheduled outbox count', color: 'bg-gradient-to-tr from-blue-500/20 to-purple-500/20 border border-blue-500/30' },
    { label: 'Unresolved Inbound', count: `${inboxMessages.length}`, change: 'IG DMs, Messenger incoming', color: 'bg-gradient-to-tr from-amber-500/20 to-red-500/20 border border-amber-500/30' },
    { label: 'Failed Jobs / Retries', count: `${publishingQueue.filter(q => q.status === 'failed').length}`, change: 'Failed posting retries', color: 'bg-gradient-to-tr from-pink-500/20 to-red-950/20 border border-red-500/30' },
  ]

  return (
    <div className="space-y-8 select-none text-white">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Social Automation Suite</h1>
          <p className="mt-1 text-sm text-gray-500 font-medium">Orchestrate cross-channel publishing, unified AI response engines, and visual content pipelines.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-[#2D2D30] pb-px">
        {[
          { key: 'overview', label: '📊 Overview & Queues' },
          { key: 'channels', label: '🔌 Channels & OAuth' },
          { key: 'inbox', label: '📨 Unified Inbox' },
          { key: 'publishing', label: '📅 Publishing Calendar' },
          { key: 'logs', label: '📋 Webhook & Audit Logs' }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 ${
              activeTab === tab.key 
                ? 'border-purple-500 text-white font-black' 
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <div className="space-y-8 animate-fadeIn">
          {/* Stats grid */}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((item) => (
              <div key={item.label} className={`rounded-2xl p-6 flex flex-col justify-between min-h-[140px] shadow-sm ${item.color}`}>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">{item.label}</span>
                <div className="space-y-1">
                  <h3 className="text-3xl font-black text-white tracking-tight">{item.count}</h3>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{item.change}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {/* Left Column: n8n workflow list */}
            <div className="md:col-span-2 space-y-6">
              <div className="rounded-2xl border border-[#2D2D30] bg-[#18181A] p-6 space-y-4">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-[#2D2D30] pb-2 flex items-center justify-between">
                  <span>🧠 Workflow Execution Pipeline</span>
                  <span className="text-[10px] bg-purple-950/40 text-purple-400 border border-purple-900/30 px-2 py-0.5 rounded font-black uppercase tracking-wider">n8n Connected</span>
                </h3>
                <div className="space-y-3">
                  {workflows.map(wf => (
                    <div key={wf.name} className="p-4 bg-[#141416] border border-[#2D2D30]/60 rounded-xl flex justify-between items-center text-xs">
                      <div className="space-y-0.5">
                        <span className="font-bold text-white block text-sm">{wf.name}</span>
                        <span className="text-[10px] text-gray-500 font-medium">
                          Last run: {wf.last_run ? new Date(wf.last_run).toLocaleString() : 'Never'} • Duration: {wf.execution_time || 'N/A'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                          wf.status === 'success' 
                            ? 'bg-green-950/40 text-green-400 border border-green-900/30' 
                            : 'bg-red-950/40 text-red-400 border border-red-900/30'
                        }`}>
                          {wf.status}
                        </span>
                        <button
                          onClick={() => handleToggleWorkflow(wf.name, wf.active)}
                          className={`px-3 py-1.5 rounded-lg font-bold uppercase tracking-wider text-[10px] transition-colors ${
                            wf.active 
                              ? 'bg-purple-650 text-white hover:bg-purple-750' 
                              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                          }`}
                        >
                          {wf.active ? 'Enabled' : 'Disabled'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Job Queues */}
              <div className="rounded-2xl border border-[#2D2D30] bg-[#18181A] p-6 space-y-4">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-[#2D2D30] pb-2">📦 System Job & Worker Queue</h3>
                <div className="grid gap-4 sm:grid-cols-3 text-xs text-gray-400 font-medium">
                  <div className="p-4 bg-[#141416] rounded-xl border border-[#2D2D30] text-center">
                    <span className="text-gray-500 text-[10px] font-bold uppercase tracking-wider block mb-1">Active Job Queue</span>
                    <strong className="text-2xl font-black text-white">
                      {publishingQueue.filter(q => q.status === 'scheduled').length}
                    </strong>
                    <span className="text-[9px] text-green-400 block mt-1">Status: Running</span>
                  </div>
                  <div className="p-4 bg-[#141416] rounded-xl border border-[#2D2D30] text-center">
                    <span className="text-gray-500 text-[10px] font-bold uppercase tracking-wider block mb-1">Failed Queue</span>
                    <strong className="text-2xl font-black text-red-400">
                      {publishingQueue.filter(q => q.status === 'failed').length}
                    </strong>
                    <span className="text-[9px] text-red-500 block mt-1">Failed publications</span>
                  </div>
                  <div className="p-4 bg-[#141416] rounded-xl border border-[#2D2D30] text-center flex flex-col justify-between items-center">
                    <span className="text-gray-500 text-[10px] font-bold uppercase tracking-wider block mb-1">Failed Retry</span>
                    {publishingQueue.filter(q => q.status === 'failed').length > 0 ? (
                      <button
                        onClick={() => handleRetryJob(publishingQueue.find(q => q.status === 'failed')!.id)}
                        className="px-3 py-1 rounded bg-amber-950/40 text-amber-400 border border-amber-900/30 font-bold uppercase tracking-wider text-[9px] mt-1 hover:bg-amber-900/30"
                      >
                        🔄 Retry Failures
                      </button>
                    ) : (
                      <span className="text-[9px] text-gray-500 font-bold mt-2">No failures</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Approvals */}
            <div className="space-y-6">
              <div className="rounded-2xl border border-[#2D2D30] bg-[#18181A] p-6 space-y-4">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-[#2D2D30] pb-2">⏳ Approvals Queue</h3>
                <div className="text-center py-6 text-gray-500">
                  <span className="text-2xl mb-1 block">✅</span>
                  <span className="text-xs italic font-semibold">No pending posts in approvals queue.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CHANNELS & OAUTH STATUS TAB */}
      {activeTab === 'channels' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="flex justify-between items-center pb-2 border-b border-[#2D2D30]">
            <h3 className="text-md font-bold text-white">Platform Credentials & OAuth Scope</h3>
            <Link href="/automation/accounts" className="text-xs bg-purple-600 hover:bg-purple-750 text-white font-bold uppercase tracking-wider px-4 py-2 rounded-xl">
              🔌 Manage Credentials
            </Link>
          </div>

          {accounts.length === 0 ? (
            <div className="text-center py-12 bg-[#18181A] border border-[#2D2D30] rounded-2xl">
              <p className="text-xs text-gray-500 font-semibold italic">No connected platform settings configured yet.</p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {accounts.map(acc => (
                <div key={acc.id} className="rounded-2xl border border-[#2D2D30] bg-[#18181A] p-6 space-y-4 text-xs font-semibold">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <span className="font-bold text-white block text-sm">{acc.account_name}</span>
                      <span className="text-[9px] text-gray-500 font-mono block">Platform: {acc.platform.toUpperCase()}</span>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                      acc.oauth_status === 'connected' 
                        ? 'bg-green-950/40 text-green-400 border border-green-900/30' 
                        : 'bg-red-950/40 text-red-400 border border-red-900/30'
                    }`}>
                      {acc.oauth_status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 border-t border-b border-[#2D2D30]/60 py-3 text-[10px] text-gray-400">
                    <div>
                      <span className="text-[8px] uppercase text-gray-500 block mb-0.5">Webhook Delivery</span>
                      <span className={acc.webhook_verification_status === 'verified' ? 'text-green-400' : 'text-red-400'}>
                        {acc.webhook_verification_status === 'verified' ? '✓ Verified / Active' : '✗ Failed Verification'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[8px] uppercase text-gray-500 block mb-0.5">Provider Health</span>
                      <span className={acc.health_status === 'healthy' ? 'text-green-400' : 'text-amber-400'}>
                        ● {acc.health_status.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  {acc.permissions && acc.permissions.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[8px] uppercase text-gray-500 block">Granted Graph API Scope:</span>
                      <div className="flex flex-wrap gap-1">
                        {acc.permissions.map((p, idx) => (
                          <span key={idx} className="bg-[#141416] border border-[#2D2D30] text-[8px] font-mono px-1.5 py-0.5 rounded text-gray-400">
                            {p}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* UNIFIED INBOX TAB */}
      {activeTab === 'inbox' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="flex justify-between items-center pb-2 border-b border-[#2D2D30]">
            <h3 className="text-md font-bold text-white">Unified Conversational Inbox</h3>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <div className="md:col-span-1 rounded-2xl border border-[#2D2D30] bg-[#18181A] p-4 space-y-3 h-fit">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Inbound Messages</span>
              <div className="space-y-2.5 max-h-[400px] overflow-y-auto pr-1">
                {inboxMessages.length === 0 ? (
                  <p className="text-xs text-gray-500 italic py-4 text-center">No inbound messages.</p>
                ) : (
                  inboxMessages.map(msg => (
                    <div
                      key={msg.id}
                      onClick={() => setSelectedMsg(msg)}
                      className={`p-3 border rounded-xl space-y-1.5 cursor-pointer transition-colors text-xs ${
                        selectedMsg?.id === msg.id 
                          ? 'bg-purple-950/20 border-purple-500/50' 
                          : 'bg-[#141416] border-[#2D2D30]/60 hover:border-gray-600'
                      }`}
                    >
                      <div className="flex justify-between items-center font-bold">
                        <span className="text-white">{msg.sender}</span>
                        <span className="text-[9px] text-gray-500">{msg.time}</span>
                      </div>
                      <p className="text-gray-400 truncate">{msg.text}</p>
                      <span className="text-[8px] px-1.5 py-0.5 rounded bg-purple-950/40 text-purple-400 border border-purple-900/30 uppercase tracking-wider font-mono">
                        {msg.platform}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {selectedMsg ? (
              <div className="md:col-span-2 rounded-2xl border border-[#2D2D30] bg-[#18181A] p-6 flex flex-col justify-between min-h-[400px]">
                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b border-[#2D2D30] pb-3">
                    <div>
                      <h4 className="font-bold text-white">{selectedMsg.sender}</h4>
                      <span className="text-[9px] text-green-400">● Active on {selectedMsg.platform}</span>
                    </div>
                  </div>

                  <div className="space-y-4 py-4 text-xs font-semibold">
                    <div className="flex gap-3 justify-start">
                      <div className="bg-[#141416] border border-[#2D2D30] p-3 rounded-2xl max-w-[70%]">
                        <p className="text-gray-300">{selectedMsg.text}</p>
                        <span className="text-[8px] text-gray-500 block mt-1">Inbound ({selectedMsg.platform}) • {selectedMsg.time}</span>
                      </div>
                    </div>

                    {selectedMsg.replied && (
                      <div className="flex gap-3 justify-end animate-fadeIn">
                        <div className="bg-purple-650/30 border border-purple-900/30 p-3 rounded-2xl max-w-[70%]">
                          <p className="text-white">{selectedMsg.replyText}</p>
                          <span className="text-[8px] text-purple-400 block mt-1 text-right">Outbound Agent • Sent</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <form onSubmit={handleSendReply} className="border-t border-[#2D2D30] pt-4 space-y-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      value={replyText}
                      onChange={e => setReplyText(e.target.value)}
                      placeholder={`Reply via ${selectedMsg.platform}...`}
                      className="flex-1 rounded-xl bg-[#141416] border border-[#2D2D30] px-4 py-2.5 text-xs text-white focus:outline-none focus:border-gray-500"
                    />
                    <button
                      type="submit"
                      disabled={sendingReply || !replyText.trim()}
                      className="bg-purple-650 hover:bg-purple-700 disabled:opacity-40 text-white font-bold uppercase tracking-wider text-xs px-5 py-2.5 rounded-xl transition-colors"
                    >
                      {sendingReply ? 'Sending...' : 'Send Reply'}
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="md:col-span-2 rounded-2xl border border-[#2D2D30] bg-[#18181A] p-6 flex flex-col justify-center items-center min-h-[400px] text-gray-500">
                <span className="text-5xl mb-4">📨</span>
                <p className="text-xs font-bold uppercase tracking-wider">No conversation selected</p>
                <p className="text-[11px] text-gray-500 mt-1">Select a message from the left list to view or reply.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PUBLISHING CALENDAR TAB */}
      {activeTab === 'publishing' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="flex justify-between items-center pb-2 border-b border-[#2D2D30]">
            <h3 className="text-md font-bold text-white">Platform Content Publishing Calendar</h3>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {/* Form */}
            <div className="rounded-2xl border border-[#2D2D30] bg-[#18181A] p-6 space-y-4 h-fit">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-[#2D2D30] pb-2">📝 Compose Campaign Post</h3>
              <form onSubmit={handleSchedulePost} className="space-y-3 text-xs">
                <div>
                  <label className="block text-[9px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Target Platform</label>
                  <select
                    value={composePlatform}
                    onChange={(e) => setComposePlatform(e.target.value)}
                    className="w-full bg-[#141416] border border-[#2D2D30] text-xs font-bold text-white px-3 py-2.5 rounded-xl focus:outline-none focus:border-gray-500 cursor-pointer"
                  >
                    <option value="facebook">Facebook Feed</option>
                    <option value="instagram">Instagram business</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Account Connection Name</label>
                  <input
                    type="text"
                    required
                    value={composeAccount}
                    onChange={(e) => setComposeAccount(e.target.value)}
                    placeholder="e.g. Singapore Clinic Page"
                    className="w-full rounded-xl bg-[#141416] border border-[#2D2D30] px-3.5 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Post Message</label>
                  <textarea
                    required
                    rows={4}
                    value={composeContent}
                    onChange={(e) => setComposeContent(e.target.value)}
                    placeholder="What would you like to post?"
                    className="w-full rounded-xl bg-[#141416] border border-[#2D2D30] px-3.5 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Media URL (Optional)</label>
                  <input
                    type="url"
                    value={composeMedia}
                    onChange={(e) => setComposeMedia(e.target.value)}
                    placeholder="Image or video asset link"
                    className="w-full rounded-xl bg-[#141416] border border-[#2D2D30] px-3.5 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Publish Target Date</label>
                  <input
                    type="datetime-local"
                    required
                    value={composeDate}
                    onChange={(e) => setComposeDate(e.target.value)}
                    className="w-full rounded-xl bg-[#141416] border border-[#2D2D30] px-3.5 py-2.5 text-xs text-white focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submittingPost}
                  className="w-full rounded-xl bg-purple-650 hover:bg-purple-755 disabled:opacity-40 text-xs font-bold uppercase tracking-wider text-white py-3.5 transition-colors"
                >
                  {submittingPost ? 'Scheduling...' : 'Schedule Post'}
                </button>
              </form>
            </div>

            {/* Outbound queue list */}
            <div className="md:col-span-2 rounded-2xl border border-[#2D2D30] bg-[#18181A] p-6 space-y-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-[#2D2D30] pb-2">📅 Outbound Posts Awaiting Dispatch</h3>
              {publishingQueue.length === 0 ? (
                <p className="text-xs text-gray-500 italic py-4">No content scheduled in the queue.</p>
              ) : (
                <div className="space-y-3.5">
                  {publishingQueue.map(post => (
                    <div key={post.id} className="p-4 bg-[#141416] border border-[#2D2D30] rounded-xl flex justify-between items-center text-xs font-semibold">
                      <div className="space-y-1">
                        <span className="text-white font-bold block">{post.content}</span>
                        <span className="text-[10px] text-gray-500 font-medium">
                          Platform: {post.platform.toUpperCase()} • Account: {post.account_name} • Date: {new Date(post.scheduled_at).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                          post.status === 'published' ? 'bg-green-950/40 text-green-400 border border-green-900/30' :
                          post.status === 'failed' ? 'bg-red-950/40 text-red-400 border border-red-900/30' : 'bg-blue-950/40 text-blue-400 border border-blue-900/30'
                        }`}>
                          {post.status}
                        </span>
                        {post.status === 'failed' && (
                          <button
                            onClick={() => handleRetryJob(post.id)}
                            className="px-2 py-1 rounded bg-amber-950/40 border border-amber-900/30 text-amber-400 hover:bg-amber-900/30 text-[9px] font-bold uppercase tracking-wider"
                          >
                            Retry
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* WEBHOOKS & SYSTEM AUDIT LOGS TAB */}
      {activeTab === 'logs' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="flex justify-between items-center pb-2 border-b border-[#2D2D30]">
            <h3 className="text-md font-bold text-white">System Webhook & API Audit Logs</h3>
            <button 
              onClick={fetchDashboardData}
              className="text-xs bg-[#222225] border border-[#2D2D30] hover:bg-[#2A2A2E] text-white font-bold uppercase tracking-wider px-4 py-2 rounded-xl transition-colors"
            >
              🔄 Refresh Logs
            </button>
          </div>

          <div className="rounded-2xl border border-[#2D2D30] bg-[#18181A] p-6 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-[#2D2D30] pb-2">📋 Live DB-persisted Action logs</h3>
            {auditLogs.length === 0 ? (
              <p className="text-xs text-gray-500 italic py-4 text-center">No audit logs found.</p>
            ) : (
              <div className="divide-y divide-[#2D2D30]/60 space-y-3.5 max-h-[500px] overflow-y-auto pr-2">
                {auditLogs.map((log) => (
                  <div key={log.id} className="pt-3.5 flex gap-4 items-start text-xs font-semibold">
                    <span className={`w-2 h-2 mt-1.5 rounded-full flex-shrink-0 ${
                      log.action.includes('FAILED') || log.action.includes('ERROR') ? 'bg-red-500' : 'bg-green-500'
                    }`} />
                    <div className="flex-1 space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-white">{log.action}</span>
                        <span className="text-[9px] text-gray-500 font-medium">{new Date(log.created_at).toLocaleString()}</span>
                      </div>
                      <p className="text-gray-400 font-medium leading-relaxed">{log.details}</p>
                      <span className="text-[9px] text-gray-650 block mt-0.5 font-bold uppercase tracking-wider">Executor: {log.user_identifier}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
