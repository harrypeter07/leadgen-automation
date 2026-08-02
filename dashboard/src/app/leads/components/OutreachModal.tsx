// dashboard/src/app/leads/components/OutreachModal.tsx
'use client'

import React from 'react'
import type { Lead } from '@/types/lead'
import ConversationTimeline from './ConversationTimeline'
import { X, Send, Sparkles, MessageSquare, Mail, Calendar } from 'lucide-react'

interface OutreachModalProps {
  lead: Lead
  modalTab: 'whatsapp' | 'email' | 'timeline'
  onClose: () => void
  onSetTab: (tab: 'whatsapp' | 'email' | 'timeline') => void
  onSendWhatsapp: (lead: Lead) => void
  onSendEmail: (lead: Lead) => void
}

export default function OutreachModal({
  lead,
  modalTab,
  onClose,
  onSetTab,
  onSendWhatsapp,
  onSendEmail
}: OutreachModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />
      
      <div className="relative w-full max-w-lg rounded-2xl glass glow-border bg-[#0b1324] shadow-2xl overflow-hidden animate-fade-in text-foreground border border-blue-500/30">
        {/* Modal Header */}
        <div className="border-b border-blue-500/20 px-6 py-4 flex items-center justify-between bg-blue-950/30">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-400" /> AI Outreach Editor
            </h3>
            <p className="text-xs text-blue-300 font-mono mt-0.5">{lead.name}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Tabs */}
        <div className="flex border-b border-blue-500/20 text-xs font-mono">
          <button
            onClick={() => onSetTab('whatsapp')}
            className={`flex-1 text-center py-3 border-b-2 transition-all flex items-center justify-center gap-1.5 ${
              modalTab === 'whatsapp'
                ? 'border-blue-400 text-blue-300 bg-blue-500/10 font-bold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" /> WhatsApp
          </button>
          <button
            onClick={() => onSetTab('email')}
            className={`flex-1 text-center py-3 border-b-2 transition-all flex items-center justify-center gap-1.5 ${
              modalTab === 'email'
                ? 'border-blue-400 text-blue-300 bg-blue-500/10 font-bold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Mail className="w-3.5 h-3.5" /> Email Copy
          </button>
          <button
            onClick={() => onSetTab('timeline')}
            className={`flex-1 text-center py-3 border-b-2 transition-all flex items-center justify-center gap-1.5 ${
              modalTab === 'timeline'
                ? 'border-blue-400 text-blue-300 bg-blue-500/10 font-bold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" /> Timeline
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 space-y-4">
          {modalTab === 'whatsapp' && (
            <div className="space-y-3">
              <label className="text-xs font-semibold text-zinc-300 block">WhatsApp Personalized Copy</label>
              <textarea
                readOnly
                value={lead.ai_message_whatsapp || 'No WhatsApp message generated yet.'}
                className="w-full h-36 rounded-xl border border-white/10 bg-black/50 p-3 text-xs text-zinc-200 font-mono focus:outline-none resize-none"
              />
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs text-zinc-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={() => onSendWhatsapp(lead)}
                  disabled={!lead.phone || !lead.ai_message_whatsapp}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-xs font-bold text-white shadow-md shadow-blue-500/20 disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" /> Send WhatsApp
                </button>
              </div>
            </div>
          )}

          {modalTab === 'email' && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1">Subject</label>
                <input
                  readOnly
                  value={lead.ai_message_email_subject || 'No Subject'}
                  className="w-full rounded-xl border border-white/10 bg-black/50 p-2.5 text-xs text-zinc-200 font-mono focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1">Body</label>
                <textarea
                  readOnly
                  value={lead.ai_message_email_body || 'No Email body generated yet.'}
                  className="w-full h-32 rounded-xl border border-white/10 bg-black/50 p-3 text-xs text-zinc-200 font-mono focus:outline-none resize-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs text-zinc-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={() => onSendEmail(lead)}
                  disabled={!lead.email || !lead.ai_message_email_body}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-xs font-bold text-white shadow-md shadow-blue-500/20 disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" /> Send Email
                </button>
              </div>
            </div>
          )}

          {modalTab === 'timeline' && (
            <ConversationTimeline leadId={lead.id} />
          )}
        </div>
      </div>
    </div>
  )
}
