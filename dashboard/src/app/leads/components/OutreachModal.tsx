// dashboard/src/app/leads/components/OutreachModal.tsx
'use client'

import React from 'react'
import type { Lead } from '@/types/lead'
import ConversationTimeline from './ConversationTimeline'

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
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-lg rounded-2xl border border-[#E4E3DD] bg-white shadow-2xl overflow-hidden animate-fade-in text-[#2D2D2D]">
        {/* Modal Header */}
        <div className="border-b border-[#E4E3DD] px-6 py-4 flex items-center justify-between bg-gray-50/50">
          <div>
            <h3 className="text-lg font-black text-gray-900">AI Outreach Editor</h3>
            <p className="text-xs text-gray-400 mt-0.5 font-bold uppercase tracking-wider">{lead.name}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-650 transition-colors"
            aria-label="Close modal"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Tabs */}
        <div className="flex border-b border-[#E4E3DD] text-xs font-bold uppercase tracking-wider">
          <button
            onClick={() => onSetTab('whatsapp')}
            className={`flex-1 text-center py-3.5 border-b-2 transition-all ${
              modalTab === 'whatsapp'
                ? 'border-[#1C1C1E] text-gray-900 bg-gray-50/30'
                : 'border-transparent text-gray-450 hover:text-gray-700'
            }`}
          >
            💬 WhatsApp
          </button>
          <button
            onClick={() => onSetTab('email')}
            className={`flex-1 text-center py-3.5 border-b-2 transition-all ${
              modalTab === 'email'
                ? 'border-[#1C1C1E] text-gray-900 bg-gray-50/30'
                : 'border-transparent text-gray-450 hover:text-gray-700'
            }`}
          >
            📧 Email Copy
          </button>
          <button
            onClick={() => onSetTab('timeline')}
            className={`flex-1 text-center py-3.5 border-b-2 transition-all ${
              modalTab === 'timeline'
                ? 'border-[#1C1C1E] text-gray-900 bg-gray-50/30'
                : 'border-transparent text-gray-450 hover:text-gray-700'
            }`}
          >
            📅 Timeline
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 max-h-[350px] overflow-y-auto">
          {modalTab === 'whatsapp' ? (
            <div className="space-y-4">
              {/* WhatsApp style preview bubble */}
              <div className="rounded-xl bg-[#E5DDD5] p-4 border border-[#D8CFC7] shadow-inner">
                <div className="max-w-[85%] rounded-xl bg-white p-3 text-xs text-gray-800 relative shadow-sm border border-white">
                  <span className="block whitespace-pre-wrap leading-relaxed">{lead.ai_message_whatsapp || 'No WhatsApp Copy Generated'}</span>
                  <span className="block text-[9px] text-gray-400 text-right mt-1.5 font-bold">just now</span>
                </div>
              </div>
              <button
                onClick={() => {
                  onSendWhatsapp(lead)
                  onClose()
                }}
                disabled={!lead.phone || !lead.ai_message_whatsapp}
                className="w-full rounded-xl bg-[#1C1C1E] hover:bg-[#252528] disabled:opacity-40 text-white font-bold uppercase tracking-wider py-3 text-xs transition-colors shadow-sm"
              >
                🚀 Send WhatsApp Now
              </button>
            </div>
          ) : modalTab === 'email' ? (
            <div className="space-y-4">
              <div className="space-y-3 rounded-xl bg-[#F4F3EF] border border-[#E4E3DD] p-4 text-xs">
                <div>
                  <span className="text-[9px] text-gray-400 block font-bold uppercase tracking-wider">Subject</span>
                  <p className="text-gray-900 font-bold mt-1 text-sm">{lead.ai_message_email_subject || 'No Subject Generated'}</p>
                </div>
                <hr className="border-[#E4E3DD]/60" />
                <div>
                  <span className="text-[9px] text-gray-400 block font-bold uppercase tracking-wider">Body</span>
                  <p className="whitespace-pre-wrap text-gray-700 mt-1 text-xs leading-relaxed">{lead.ai_message_email_body || 'No Email Body Generated'}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  onSendEmail(lead)
                  onClose()
                }}
                disabled={!lead.email || !lead.ai_message_email_subject}
                className="w-full rounded-xl bg-[#1C1C1E] hover:bg-[#252528] disabled:opacity-40 text-white font-bold uppercase tracking-wider py-3 text-xs transition-colors shadow-sm"
              >
                🚀 Send Email Now
              </button>
            </div>
          ) : (
            <ConversationTimeline leadId={lead.id} />
          )}
        </div>
      </div>
    </div>
  )
}
