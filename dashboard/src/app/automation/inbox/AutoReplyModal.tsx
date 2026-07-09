'use client'

import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'

interface Rule {
  keywords: string
  reply: string
}

interface AutoReplyModalProps {
  onClose: () => void
}

export default function AutoReplyModal({ onClose }: AutoReplyModalProps) {
  const [rules, setRules] = useState<Rule[]>([])
  const [chatbotEnabled, setChatbotEnabled] = useState(false)
  const [chatbotPersona, setChatbotPersona] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Load settings on mount
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/meta/instagram/auto-reply')
        const data = await res.json()
        if (res.ok) {
          setRules(data.rules || [])
          setChatbotEnabled(data.chatbotEnabled)
          setChatbotPersona(data.chatbotPersona || '')
        }
      } catch (err) {
        console.error('Failed to load auto-reply settings:', err)
        toast.error('Failed to load auto-reply settings')
      } finally {
        setLoading(false)
      }
    }
    fetchSettings()
  }, [])

  const handleAddRule = () => {
    setRules(prev => [...prev, { keywords: '', reply: '' }])
  }

  const handleRemoveRule = (index: number) => {
    setRules(prev => prev.filter((_, i) => i !== index))
  }

  const handleRuleChange = (index: number, field: keyof Rule, val: string) => {
    setRules(prev =>
      prev.map((r, i) => (i === index ? { ...r, [field]: val } : r))
    )
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const toastId = toast.loading('Saving settings…')
    try {
      const res = await fetch('/api/meta/instagram/auto-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rules,
          chatbotEnabled,
          chatbotPersona: chatbotPersona.trim(),
        }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success('Auto-reply configurations saved!', { id: toastId })
        onClose()
      } else {
        throw new Error(data.error || 'Failed to save settings')
      }
    } catch (err: any) {
      toast.error(err.message, { id: toastId })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-[#0E0E10] border border-[#2D2D30] rounded-2xl shadow-2xl w-full max-w-2xl mx-4 p-6 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#2D2D30] pb-3">
          <div>
            <h2 className="text-white font-black text-lg">🤖 AI & Auto-Reply Settings</h2>
            <p className="text-[10px] text-gray-500 mt-0.5">Automate replies to direct messages based on keywords or Gemini AI chatbot</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl transition-colors">✕</button>
        </div>

        {loading ? (
          <div className="py-8 text-center text-gray-500 animate-pulse text-xs">Loading configuration…</div>
        ) : (
          <form onSubmit={handleSave} className="space-y-5">
            {/* AI Chatbot Section */}
            <div className="p-4 rounded-xl border border-[#2D2D30] bg-[#141416] space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">Gemini AI Auto-Pilot</h3>
                  <p className="text-[10px] text-gray-500 mt-0.5">Enable human-like conversations using Gemini AI when keyword rules do not match</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={chatbotEnabled}
                    onChange={e => setChatbotEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>

              {chatbotEnabled && (
                <div className="space-y-1.5 pt-2">
                  <label className="text-[9px] font-bold text-gray-500 uppercase tracking-wider block">AI Business Persona / Instructions</label>
                  <textarea
                    value={chatbotPersona}
                    onChange={e => setChatbotPersona(e.target.value)}
                    className="w-full bg-[#0E0E10] border border-[#2D2D30] rounded-xl px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-gray-500 transition-colors resize-none leading-relaxed"                    rows={4}
                    placeholder="E.g., You are a customer support agent for WHSoftec. We offer smart web dev and AI automation systems starting at $99. Be helpful, professional, and invite them to leave their email."
                  />
                </div>
              )}
            </div>

            {/* Keyword Rules Section */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Keyword-based Rules</h3>
                <button
                  type="button"
                  onClick={handleAddRule}
                  className="px-2.5 py-1.5 rounded-lg bg-purple-950/40 border border-purple-900/30 text-purple-300 text-[10px] font-bold uppercase transition-colors"
                >
                  + Add Rule
                </button>
              </div>

              {rules.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#2D2D30] p-6 text-center text-gray-600 text-xs">
                  No keyword rules created.
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[35vh] overflow-y-auto pr-1">
                  {rules.map((rule, index) => (
                    <div key={index} className="p-3.5 rounded-xl border border-[#2D2D30] bg-[#141416] space-y-2.5 relative">
                      <button
                        type="button"
                        onClick={() => handleRemoveRule(index)}
                        className="absolute right-3 top-3 text-gray-500 hover:text-red-400 text-xs transition-colors"
                      >
                        ✕
                      </button>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-gray-500 uppercase tracking-wider block">When message contains keywords</label>
                          <input
                            value={rule.keywords}
                            onChange={e => handleRuleChange(index, 'keywords', e.target.value)}
                            placeholder="price, cost, pricing (comma separated)"
                            className="w-full bg-[#0E0E10] border border-[#2D2D30] rounded-xl px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-gray-500 uppercase tracking-wider block">Reply with message</label>
                          <input
                            value={rule.reply}
                            onChange={e => handleRuleChange(index, 'reply', e.target.value)}
                            placeholder="Our custom automation solutions start at $99..."
                            className="w-full bg-[#0E0E10] border border-[#2D2D30] rounded-xl px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-3 border-t border-[#2D2D30]">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl bg-[#141416] border border-[#2D2D30] text-gray-400 text-xs font-bold hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-[#E3B859] hover:bg-[#d4ac50] text-[#141416] text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-40"
              >
                {saving ? 'Saving…' : 'Save Rules'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
