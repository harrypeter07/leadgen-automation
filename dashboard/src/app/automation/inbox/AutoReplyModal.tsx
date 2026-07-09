'use client'

import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'

interface Rule {
  keywords: string
  reply: string
}

interface Persona {
  name: string
  instructions: string
}

interface AutoReplyModalProps {
  onClose: () => void
}

export default function AutoReplyModal({ onClose }: AutoReplyModalProps) {
  const [rules, setRules] = useState<Rule[]>([])
  const [chatbotEnabled, setChatbotEnabled] = useState(false)
  const [chatbotPersona, setChatbotPersona] = useState('')
  const [personas, setPersonas] = useState<Persona[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Custom persona creator inputs
  const [newPersonaName, setNewPersonaName] = useState('')
  const [newPersonaInst, setNewPersonaInst] = useState('')

  // Seeded default personas if none exist
  const DEFAULT_PERSONAS: Persona[] = [
    { name: 'Friendly Assistant', instructions: 'You are a warm, helpful, and concise customer support agent. Answer questions simply and invite them to leave their contact details.' },
    { name: 'Direct Sales Rep', instructions: 'You are a results-oriented sales representative. Highlight the benefits of our smart automation solutions starting at $99, and push for a scheduled demo or email address.' },
    { name: 'Technical Support', instructions: 'You are a clear, technical agent. Assist with troubleshooting API configurations, SMTP server checks, and Google Scraper parameters in a helpful tone.' },
  ]

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
          setPersonas(data.personas && data.personas.length > 0 ? data.personas : DEFAULT_PERSONAS)
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

  const handleAddCustomPersona = () => {
    if (!newPersonaName.trim() || !newPersonaInst.trim()) {
      toast.error('Enter both name and instructions for the persona')
      return
    }
    // Check for duplicate names
    if (personas.some(p => p.name.toLowerCase() === newPersonaName.trim().toLowerCase())) {
      toast.error('A persona with this name already exists')
      return
    }
    const created = { name: newPersonaName.trim(), instructions: newPersonaInst.trim() }
    setPersonas(prev => [...prev, created])
    setChatbotPersona(created.instructions)
    setNewPersonaName('')
    setNewPersonaInst('')
    toast.success(`Custom persona "${created.name}" created!`)
  }

  const handleRemovePersona = (nameToRemove: string) => {
    setPersonas(prev => prev.filter(p => p.name !== nameToRemove))
    toast.success(`Removed persona "${nameToRemove}"`)
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
          personas,
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
            <h2 className="text-white font-black text-lg">🤖 AI Chatbot & Auto-Reply Settings</h2>
            <p className="text-[10px] text-gray-500 mt-0.5">Automate replies to direct messages based on keywords or custom Gemini AI personas</p>
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
                <div className="space-y-3 pt-2 border-t border-[#2D2D30]/40">
                  {/* Select Predefined Persona */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-gray-500 uppercase tracking-wider block">Load Predefined Persona</label>
                    <div className="flex flex-wrap gap-1.5">
                      {personas.map(p => (
                        <div key={p.name} className="flex items-center bg-[#0E0E10] border border-[#2D2D30] rounded-xl pl-2.5 pr-1.5 py-1">
                          <button
                            type="button"
                            onClick={() => setChatbotPersona(p.instructions)}
                            className={`text-[9px] font-bold uppercase transition-colors mr-2 ${
                              chatbotPersona === p.instructions ? 'text-[#E3B859]' : 'text-gray-400 hover:text-white'
                            }`}
                          >
                            👤 {p.name}
                          </button>
                          {!DEFAULT_PERSONAS.some(d => d.name === p.name) && (
                            <button
                              type="button"
                              onClick={() => handleRemovePersona(p.name)}
                              className="text-[9px] text-gray-600 hover:text-red-400 font-mono"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Active instructions text area */}
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold text-gray-500 uppercase tracking-wider block">Active AI Chatbot Instructions</label>
                    <textarea
                      value={chatbotPersona}
                      onChange={e => setChatbotPersona(e.target.value)}
                      className="w-full bg-[#0E0E10] border border-[#2D2D30] rounded-xl px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-gray-500 transition-colors resize-none leading-relaxed"
                      rows={3}
                      placeholder="Write active prompt instructions..."
                    />
                  </div>

                  {/* Add custom persona fields */}
                  <div className="p-3 bg-[#0E0E10] border border-[#2D2D30] rounded-xl space-y-2">
                    <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider block">➕ Save Custom Persona Template</span>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <input
                        value={newPersonaName}
                        onChange={e => setNewPersonaName(e.target.value)}
                        placeholder="Persona Name (e.g. Sales Expert)"
                        className="sm:col-span-1 bg-[#141416] border border-[#2D2D30] rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                      />
                      <input
                        value={newPersonaInst}
                        onChange={e => setNewPersonaInst(e.target.value)}
                        placeholder="AI instructions / business goal..."
                        className="sm:col-span-2 bg-[#141416] border border-[#2D2D30] rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleAddCustomPersona}
                      disabled={!newPersonaName.trim() || !newPersonaInst.trim()}
                      className="w-full py-1.5 rounded-lg bg-purple-900/40 border border-purple-800/30 text-purple-300 text-[9px] font-bold uppercase hover:bg-purple-800/30 transition-colors disabled:opacity-40"
                    >
                      Save Persona Template
                    </button>
                  </div>
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
