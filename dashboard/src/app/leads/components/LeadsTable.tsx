// dashboard/src/app/leads/components/LeadsTable.tsx
'use client'

import React from 'react'
import { formatDistanceToNow } from 'date-fns'
import type { Lead } from '@/types/lead'
import StatusBadge from './StatusBadge'
import { MessageSquare, Mail, RefreshCw, Trash2, CheckCircle, ExternalLink, Sparkles, Phone, Globe, MapPin } from 'lucide-react'

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
    <div className="rounded-2xl glass glow-border overflow-hidden shadow-2xl">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-blue-500/10 text-xs">
          <thead className="bg-blue-950/40">
            <tr className="text-left text-zinc-400 uppercase tracking-wider font-mono text-[10px]">
              <th className="px-5 py-4 text-left w-12">
                <input
                  type="checkbox"
                  checked={leads.length > 0 && selectedIds.length === leads.length}
                  onChange={onSelectAll}
                  className="rounded border-blue-500/30 bg-black/40 text-blue-500 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                  aria-label="Select all leads"
                />
              </th>
              <th className="px-5 py-4 font-semibold">Name</th>
              <th className="px-5 py-4 font-semibold">Phone</th>
              <th className="px-5 py-4 font-semibold">Email</th>
              <th className="px-5 py-4 font-semibold">Website</th>
              <th className="px-5 py-4 font-semibold">City</th>
              <th className="px-5 py-4 font-semibold">Category</th>
              <th className="px-5 py-4 font-semibold">Status</th>
              <th className="px-5 py-4 font-semibold text-center">AI Message</th>
              <th className="px-5 py-4 font-semibold">Created</th>
              <th className="px-5 py-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-blue-500/10 text-zinc-300">
            {loading ? (
              <tr>
                <td colSpan={11} className="px-5 py-16 text-center text-zinc-500 font-mono">
                  <div className="flex flex-col items-center justify-center gap-3">
                    <span className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    Loading pipeline leads...
                  </div>
                </td>
              </tr>
            ) : leads.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-5 py-12 text-center text-zinc-500 font-medium">
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
                  <tr key={lead.id} className={`hover:bg-blue-500/10 transition-colors duration-150 ${isChecked ? 'bg-blue-600/20' : ''}`}>
                    <td className="px-5 py-3.5">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => onSelectRow(lead.id, e.target.checked)}
                        className="rounded border-blue-500/30 bg-black/40 text-blue-500 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                        aria-label={`Select ${lead.name}`}
                      />
                    </td>
                    <td className="px-5 py-3.5 font-bold text-white max-w-[150px] truncate" title={lead.name}>
                      {lead.name}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-[10px] text-zinc-400">
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
                              className="hover:underline text-emerald-400 font-bold flex items-center gap-1.5"
                              title="Open in WhatsApp"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              {lead.phone}
                            </a>
                          );
                        } else if (isNotWhatsApp) {
                          return (
                            <span className="text-zinc-500 line-through" title="Not registered on WhatsApp">
                              {lead.phone}
                            </span>
                          );
                        } else {
                          return <span>{lead.phone}</span>;
                        }
                      })() : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-zinc-400 max-w-[140px] truncate" title={lead.email || undefined}>
                      {lead.email || <span className="text-zinc-600">—</span>}
                    </td>
                    <td className="px-5 py-3.5 text-zinc-400 max-w-[130px] truncate font-mono text-[10px]">
                      {lead.website ? (
                        <a href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline flex items-center gap-1">
                          <ExternalLink className="w-3 h-3 shrink-0" />
                          <span className="truncate">{lead.website.replace(/^https?:\/\//, '')}</span>
                        </a>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-zinc-300">
                      {lead.city || <span className="text-zinc-600">—</span>}
                    </td>
                    <td className="px-5 py-3.5 text-blue-300 font-mono text-[10px]">
                      {lead.category || <span className="text-zinc-600">—</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={lead.status} />
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      {isAiReady ? (
                        <button
                          onClick={() => onOpenOutreachModal(lead, 'whatsapp')}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-mono hover:bg-emerald-500/25 transition-all shadow-sm"
                        >
                          <Sparkles className="w-3 h-3 text-emerald-400" /> Ready
                        </button>
                      ) : (
                        <button
                          onClick={() => onTriggerMessage(lead)}
                          disabled={isRowActionLoading}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-mono hover:bg-blue-500/20 transition-all disabled:opacity-50"
                        >
                          + Generate
                        </button>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-zinc-400 font-mono text-[10px]">
                      {lead.created_at ? (() => {
                        try {
                          const d = new Date(lead.created_at);
                          return isNaN(d.getTime()) ? '—' : formatDistanceToNow(d, { addSuffix: true });
                        } catch {
                          return '—';
                        }
                      })() : '—'}
                    </td>
                    <td className="px-5 py-3.5 text-right relative">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onOpenOutreachModal(lead, 'whatsapp')}
                          className="p-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 transition-all"
                          title="Open Outreach Modal"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </button>

                        <div className="relative inline-block text-left">
                          <button
                            onClick={() => onToggleMenu(lead.id)}
                            className="p-1.5 rounded-lg bg-zinc-800/80 border border-zinc-700/60 text-zinc-300 hover:bg-zinc-700/80 transition-all"
                            title="More options"
                          >
                            •••
                          </button>

                          {isDropdownActive && (
                            <div className="origin-top-right absolute right-0 mt-2 w-48 rounded-xl glass glow-border shadow-2xl bg-[#0b1324] border border-blue-500/30 py-1.5 z-50 text-xs">
                              <button
                                onClick={() => onTriggerResearch(lead)}
                                disabled={isRowActionLoading}
                                className="w-full text-left px-3.5 py-2 text-zinc-300 hover:bg-blue-500/15 hover:text-white flex items-center gap-2"
                              >
                                <RefreshCw className={`w-3.5 h-3.5 text-blue-400 ${isRowActionLoading ? 'animate-spin' : ''}`} />
                                Re-run AI Research
                              </button>

                              <button
                                onClick={() => onTriggerMessage(lead)}
                                disabled={isRowActionLoading}
                                className="w-full text-left px-3.5 py-2 text-zinc-300 hover:bg-blue-500/15 hover:text-white flex items-center gap-2"
                              >
                                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                                Re-generate AI Copy
                              </button>

                              <button
                                onClick={() => onMarkReplied(lead)}
                                className="w-full text-left px-3.5 py-2 text-zinc-300 hover:bg-emerald-500/15 hover:text-emerald-300 flex items-center gap-2"
                              >
                                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                                Mark as Replied
                              </button>

                              <div className="border-t border-blue-500/10 my-1" />

                              <button
                                onClick={() => onDeleteRow(lead)}
                                className="w-full text-left px-3.5 py-2 text-rose-400 hover:bg-rose-500/15 flex items-center gap-2"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Delete Lead
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
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
