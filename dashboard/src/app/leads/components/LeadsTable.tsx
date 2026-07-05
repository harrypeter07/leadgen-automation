// dashboard/src/app/leads/components/LeadsTable.tsx
'use client'

import React from 'react'
import { formatDistanceToNow } from 'date-fns'
import type { Lead } from '@/types/lead'
import StatusBadge from './StatusBadge'

interface LeadsTableProps {
  leads: Lead[]
  loading: boolean
  selectedIds: string[]
  actionLoadingId: string | null
  activeMenuId: string | null
  onSelectAll: (e: React.ChangeEvent<HTMLInputElement>) => void
  onSelectRow: (id: string, checked: boolean) => void
  onOpenOutreachModal: (lead: Lead, tab: 'whatsapp' | 'email' | 'timeline') => void
  onCopyText: (text: string, label: string) => void
  onToggleMenu: (id: string) => void
  onTriggerResearch: (lead: Lead) => void
  onTriggerMessage: (lead: Lead) => void
  onMarkReplied: (lead: Lead) => void
  onDeleteRow: (lead: Lead) => void
}

export default function LeadsTable({
  leads,
  loading,
  selectedIds,
  actionLoadingId,
  activeMenuId,
  onSelectAll,
  onSelectRow,
  onOpenOutreachModal,
  onCopyText,
  onToggleMenu,
  onTriggerResearch,
  onTriggerMessage,
  onMarkReplied,
  onDeleteRow
}: LeadsTableProps) {
  return (
    <div className="rounded-2xl border border-[#E4E3DD] bg-white overflow-hidden shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)]">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-[#E4E3DD]/60 text-xs">
          <thead className="bg-gray-50/50">
            <tr className="text-left text-gray-400 uppercase tracking-wider text-[9px] font-bold">
              <th className="px-5 py-4 text-left w-12">
                <input
                  type="checkbox"
                  checked={leads.length > 0 && selectedIds.length === leads.length}
                  onChange={onSelectAll}
                  className="rounded border-[#E4E3DD] bg-gray-50 text-gray-900 focus:ring-gray-400 w-4 h-4 cursor-pointer"
                  aria-label="Select all leads"
                />
              </th>
              <th className="px-5 py-4 font-bold">Name</th>
              <th className="px-5 py-4 font-bold">Phone</th>
              <th className="px-5 py-4 font-bold">Email</th>
              <th className="px-5 py-4 font-bold">Website</th>
              <th className="px-5 py-4 font-bold">City</th>
              <th className="px-5 py-4 font-bold">Category</th>
              <th className="px-5 py-4 font-bold">Status</th>
              <th className="px-5 py-4 font-bold text-center">AI Message</th>
              <th className="px-5 py-4 font-bold">Created</th>
              <th className="px-5 py-4 font-bold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E4E3DD]/50 text-gray-700">
            {loading ? (
              <tr>
                <td colSpan={11} className="px-5 py-16 text-center text-gray-400">
                  <div className="flex flex-col items-center justify-center gap-3">
                    <span className="w-8 h-8 border-4 border-gray-700 border-t-transparent rounded-full animate-spin" />
                    Loading pipeline leads...
                  </div>
                </td>
              </tr>
            ) : leads.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-5 py-12 text-center text-gray-400 font-semibold">
                  No leads match the filter criteria.
                </td>
              </tr>
            ) : (
              leads.map((lead) => {
                const isChecked = selectedIds.includes(lead.id)
                const isAiReady = !!lead.ai_message_whatsapp
                const isRowActionLoading = actionLoadingId === lead.id
                const isDropdownActive = activeMenuId === lead.id

                return (
                  <tr key={lead.id} className={`hover:bg-[#F4F3EF]/30 transition-colors duration-150 ${isChecked ? 'bg-purple-50/20' : ''}`}>
                    <td className="px-5 py-3.5">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => onSelectRow(lead.id, e.target.checked)}
                        className="rounded border-[#E4E3DD] bg-gray-50 text-gray-900 focus:ring-gray-400 w-4 h-4 cursor-pointer"
                        aria-label={`Select ${lead.name}`}
                      />
                    </td>
                    <td className="px-5 py-3.5 font-bold text-gray-900 max-w-[150px] truncate" title={lead.name}>
                      {lead.name}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-[10px] text-gray-500">
                      {lead.phone ? (() => {
                        const isWhatsApp = lead.notes?.includes('[WhatsApp: Yes]');
                        const isNotWhatsApp = lead.notes?.includes('[WhatsApp: No]');
                        const cleanedPhone = lead.phone.replace(/\D/g, '');

                        if (isWhatsApp) {
                          return (
                            <a
                              href={`https://wa.me/${cleanedPhone}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:underline text-green-700 font-bold flex items-center gap-1.5"
                              title="Open in WhatsApp"
                            >
                              <span>{lead.phone}</span>
                              <span className="text-[9px] bg-green-50 text-green-700 px-1 py-0.5 rounded border border-green-200">WA</span>
                            </a>
                          )
                        }

                        if (isNotWhatsApp) {
                          return (
                            <button
                              onClick={() => onCopyText(lead.phone!, 'Phone')}
                              className="hover:underline text-gray-400 flex items-center gap-1.5 text-left"
                              title="Click to copy (Not on WhatsApp)"
                            >
                              <span>{lead.phone}</span>
                              <span className="text-[9px] bg-gray-100 text-gray-400 px-1 py-0.5 rounded border border-gray-200">No-WA</span>
                            </button>
                          )
                        }

                        return (
                          <button
                            onClick={() => onCopyText(lead.phone!, 'Phone')}
                            className="hover:underline hover:text-[#1C1C1E] text-left"
                            title="Click to copy"
                          >
                            {lead.phone}
                          </button>
                        )
                      })() : '—'}
                    </td>
                    <td className="px-5 py-3.5 max-w-[130px] truncate text-gray-500">
                      {lead.email ? (
                        <a
                          href={`https://mail.google.com/mail/?view=cm&fs=1&to=${lead.email}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline text-purple-700 font-semibold"
                          title="Compose in Gmail"
                        >
                          {lead.email}
                        </a>
                      ) : '—'}
                    </td>
                    <td className="px-5 py-3.5 max-w-[120px] truncate font-semibold text-blue-600">
                      {lead.website ? (
                        <a
                          href={lead.website}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:underline"
                          title={lead.website}
                        >
                          {lead.website.replace(/^https?:\/\//i, '')}
                        </a>
                      ) : '—'}
                    </td>
                    <td className="px-5 py-3.5 text-gray-500 font-medium">{lead.city || '—'}</td>
                    <td className="px-5 py-3.5 text-gray-400 font-bold uppercase tracking-wider text-[9px] max-w-[100px] truncate" title={lead.category || undefined}>
                      {lead.category || '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={lead.status} />
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      {isAiReady ? (
                        <button
                          onClick={() => onOpenOutreachModal(lead, 'whatsapp')}
                          className="px-2.5 py-1 rounded bg-green-50 text-green-700 border border-green-200 text-[9px] font-bold uppercase tracking-wider hover:bg-green-100 transition-colors"
                          title="View AI Copy details"
                        >
                          ✓ Ready
                        </button>
                      ) : (
                        <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Empty</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-gray-400 font-medium whitespace-nowrap text-[10px]">
                      {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true })}
                    </td>
                    <td className="px-5 py-3.5 text-right relative">
                      {isRowActionLoading ? (
                        <div className="flex justify-end pr-2">
                          <span className="w-4 h-4 border-2 border-gray-700 border-t-transparent rounded-full animate-spin" />
                        </div>
                      ) : (
                        <div>
                          <button
                            onClick={() => onToggleMenu(lead.id)}
                            className="text-gray-400 hover:text-gray-650 transition-colors px-2 py-1 rounded hover:bg-gray-100"
                            aria-label="Actions dropdown menu"
                          >
                            •••
                          </button>

                          {isDropdownActive && (
                            <div className="absolute right-5 mt-1 bg-white border border-[#E4E3DD] rounded-2xl shadow-xl z-20 py-2 w-[160px] text-left animate-fade-in">
                              <button
                                onClick={() => {
                                  onOpenOutreachModal(lead, 'timeline')
                                  onToggleMenu('')
                                }}
                                className="w-full text-left px-4 py-2 hover:bg-gray-50 text-xs font-bold text-gray-700"
                              >
                                📅 View Timeline
                              </button>
                              <button
                                onClick={() => {
                                  onTriggerResearch(lead)
                                  onToggleMenu('')
                                }}
                                className="w-full text-left px-4 py-2 hover:bg-gray-50 text-xs font-semibold text-gray-600"
                              >
                                🔍 Audit Website
                              </button>
                              <button
                                onClick={() => {
                                  onTriggerMessage(lead)
                                  onToggleMenu('')
                                }}
                                className="w-full text-left px-4 py-2 hover:bg-gray-50 text-xs font-semibold text-gray-650"
                              >
                                💬 Generate Copy
                              </button>
                              <button
                                onClick={() => {
                                  onMarkReplied(lead)
                                  onToggleMenu('')
                                }}
                                className="w-full text-left px-4 py-2 hover:bg-gray-50 text-xs font-semibold text-green-700"
                              >
                                ✅ Mark Replied
                              </button>
                              <hr className="border-[#E4E3DD]/60 my-1" />
                              <button
                                onClick={() => {
                                  onDeleteRow(lead)
                                  onToggleMenu('')
                                }}
                                className="w-full text-left px-4 py-2 hover:bg-red-50 text-xs font-bold text-red-650"
                              >
                                🗑️ Delete Lead
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
