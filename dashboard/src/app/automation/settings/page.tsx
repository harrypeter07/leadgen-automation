'use client'

import React, { useState } from 'react'
import toast from 'react-hot-toast'

export default function AutomationSettingsPage() {
  const [webhookUrl, setWebhookUrl] = useState('https://n8n-production.up.railway.app/webhook/leads')
  const [metaClientSecret, setMetaClientSecret] = useState('••••••••••••••••••••••••••••••••')
  const [waSecret, setWaSecret] = useState('••••••••••••••••••••')
  const [saving, setSaving] = useState(false)

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const toastId = toast.loading('Updating Workspace integrations...')
    setTimeout(() => {
      setSaving(false)
      toast.success('Workspace credentials saved successfully!', { id: toastId })
    }, 1500)
  }

  return (
    <div className="space-y-8 select-none">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-white tracking-tight">Automation Settings</h1>
        <p className="mt-1 text-sm text-gray-500 font-medium">Configure Meta Graph App credentials, self-hosted webhooks, team roles, and message routing parameters.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Left columns: settings form */}
        <form onSubmit={handleSaveSettings} className="md:col-span-2 rounded-2xl border border-[#2D2D30] bg-[#18181A] p-6 space-y-6">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-[#2D2D30] pb-2">🔑 Workspace API Keys & Endpoints</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-gray-500 text-[10px] font-bold uppercase tracking-wider mb-2">n8n Ingestion Webhook Url</label>
              <input
                type="text"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                className="w-full px-4 py-3 bg-[#141416] border border-[#2D2D30] focus:border-[#E3B859] rounded-xl text-xs text-white focus:outline-none transition-colors"
                placeholder="Enter webhook endpoint url"
              />
            </div>

            <div className="grid gap-4 grid-cols-2">
              <div>
                <label className="block text-gray-500 text-[10px] font-bold uppercase tracking-wider mb-2">Meta Graph Client ID</label>
                <input
                  type="text"
                  value="8924018249018"
                  disabled
                  className="w-full px-4 py-3 bg-[#141416] border border-[#2D2D30] rounded-xl text-xs text-gray-500 focus:outline-none cursor-not-allowed font-mono"
                />
              </div>

              <div>
                <label className="block text-gray-500 text-[10px] font-bold uppercase tracking-wider mb-2">Meta App Client Secret</label>
                <input
                  type="password"
                  value={metaClientSecret}
                  onChange={(e) => setMetaClientSecret(e.target.value)}
                  className="w-full px-4 py-3 bg-[#141416] border border-[#2D2D30] focus:border-[#E3B859] rounded-xl text-xs text-white focus:outline-none transition-colors font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-gray-500 text-[10px] font-bold uppercase tracking-wider mb-2">WhatsApp Webhook Secret Token</label>
              <input
                type="password"
                value={waSecret}
                onChange={(e) => setWaSecret(e.target.value)}
                className="w-full px-4 py-3 bg-[#141416] border border-[#2D2D30] focus:border-[#E3B859] rounded-xl text-xs text-white focus:outline-none transition-colors font-mono"
                placeholder="Enter WABA verification token"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t border-[#2D2D30]/60">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-[#E3B859] hover:bg-[#d4ac50] text-[#141416] text-xs font-bold uppercase tracking-wider px-6 py-3 transition-colors shadow-md disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Workspace Settings'}
            </button>
          </div>
        </form>

        {/* Right column: Info details */}
        <div className="rounded-2xl border border-[#2D2D30] bg-[#18181A] p-6 space-y-4 h-fit text-xs leading-relaxed text-gray-400">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-[#2D2D30] pb-2">💡 Quick Setup Guide</h3>
          <p className="font-semibold text-gray-300">Meta Webhook Verification:</p>
          <p className="text-[11px] leading-relaxed">
            Copy your verify token and configure the webhook callback URL inside your Meta Developer Console. Subscribe to fields <code className="bg-[#141416] px-1 py-0.5 rounded font-mono text-[#E3B859]">messages</code>, <code className="bg-[#141416] px-1 py-0.5 rounded font-mono text-[#E3B859]">comments</code>, and <code className="bg-[#141416] px-1 py-0.5 rounded font-mono text-[#E3B859]">feed</code> to power live events.
          </p>
        </div>
      </div>
    </div>
  )
}
