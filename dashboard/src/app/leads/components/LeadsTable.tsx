'use client'

import React from 'react'
import { formatDistanceToNow } from 'date-fns'
import type { Lead } from '@/types/lead'
import { 
  Badge, 
  Table, 
  TableHeader, 
  TableBody, 
  TableHead, 
  TableRow, 
  TableCell 
} from '@/components'
import { MessageSquare, RefreshCw, Trash2, CheckCircle, ExternalLink, Sparkles } from 'lucide-react'

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
    <Table className="bg-page-alt">
      <TableHeader>
        <TableRow>
          <TableHead className="w-12 text-center">
            <input
              type="checkbox"
              checked={leads.length > 0 && selectedIds.length === leads.length}
              onChange={onSelectAll}
              className="rounded border-border-subtle bg-page text-ink focus:ring-lime w-4 h-4 cursor-pointer"
              aria-label="Select all leads"
            />
          </TableHead>
          <TableHead>Lead Name</TableHead>
          <TableHead>Phone</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Website</TableHead>
          <TableHead>City</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-center">AI Message</TableHead>
          <TableHead>Created</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading ? (
          <TableRow>
            <TableCell colSpan={11} className="py-12 text-center text-text-muted font-medium">
              Loading pipeline leads...
            </TableCell>
          </TableRow>
        ) : leads.length === 0 ? (
          <TableRow>
            <TableCell colSpan={11} className="py-12 text-center text-text-muted font-medium">
              No leads match the filter criteria.
            </TableCell>
          </TableRow>
        ) : (
          leads.map((lead) => {
            const isChecked = selectedIds.includes(lead.id)
            const isAiReady = !!lead.ai_message_whatsapp
            const isRowActionLoading = actionLoadingId === lead.id
            const isDropdownActive = activeMenuId === lead.id

            return (
              <TableRow key={lead.id} className={isChecked ? 'bg-lime/10' : undefined}>
                <TableCell className="text-center">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => onSelectRow(lead.id, e.target.checked)}
                    className="rounded border-border-subtle bg-page text-ink focus:ring-lime w-4 h-4 cursor-pointer"
                    aria-label={`Select ${lead.name}`}
                  />
                </TableCell>
                <TableCell className="font-bold text-ink max-w-[160px] truncate" title={lead.name}>
                  {lead.name}
                </TableCell>
                <TableCell className="font-mono text-xs text-text-body">
                  {lead.phone ? (() => {
                    const isWhatsApp = lead.notes?.includes('[WhatsApp: Yes]');
                    const cleanedPhone = lead.phone.replace(/\D/g, '');

                    if (isWhatsApp) {
                      return (
                        <a
                          href={`https://wa.me/${cleanedPhone}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline text-ink font-bold flex items-center gap-1.5"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-lime" />
                          {lead.phone}
                        </a>
                      );
                    }
                    return <span>{lead.phone}</span>;
                  })() : <span className="text-text-muted">—</span>}
                </TableCell>
                <TableCell className="text-text-body max-w-[140px] truncate" title={lead.email || undefined}>
                  {lead.email || <span className="text-text-muted">—</span>}
                </TableCell>
                <TableCell className="text-text-body max-w-[130px] truncate font-mono text-[11px]">
                  {lead.website ? (
                    <a
                      href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-ink font-semibold hover:underline flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3 shrink-0" />
                      <span className="truncate">{lead.website.replace(/^https?:\/\//, '')}</span>
                    </a>
                  ) : <span className="text-text-muted">—</span>}
                </TableCell>
                <TableCell className="text-text-body">
                  {lead.city || <span className="text-text-muted">—</span>}
                </TableCell>
                <TableCell className="text-ink font-semibold">
                  {lead.category || <span className="text-text-muted">—</span>}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      lead.status === 'converted' ? 'lime' :
                      lead.status === 'replied' ? 'sage' :
                      lead.status === 'email_sent' || lead.status === 'whatsapp_sent' ? 'lavender' : 'muted'
                    }
                  >
                    {lead.status.replace(/_/g, ' ')}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  {isAiReady ? (
                    <button
                      onClick={() => onOpenOutreachModal(lead, 'whatsapp')}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-pill bg-lime text-ink text-[11px] font-bold uppercase tracking-button"
                    >
                      <Sparkles className="w-3 h-3" /> Ready
                    </button>
                  ) : (
                    <button
                      onClick={() => onTriggerMessage(lead)}
                      disabled={isRowActionLoading}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-pill bg-page border border-border-subtle text-ink text-[11px] font-semibold hover:bg-lime transition-colors disabled:opacity-50"
                    >
                      + Generate
                    </button>
                  )}
                </TableCell>
                <TableCell className="text-text-muted font-mono text-[11px]">
                  {lead.created_at ? formatDistanceToNow(new Date(lead.created_at), { addSuffix: true }) : '—'}
                </TableCell>
                <TableCell className="text-right relative">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => onOpenOutreachModal(lead, 'whatsapp')}
                      className="p-2 rounded-full bg-page hover:bg-lime text-ink transition-colors"
                      title="Open Outreach Modal"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </button>

                    <div className="relative inline-block text-left">
                      <button
                        onClick={() => onToggleMenu(lead.id)}
                        className="p-2 rounded-full bg-page hover:bg-page-alt text-ink transition-colors font-bold"
                        title="More options"
                      >
                        •••
                      </button>

                      {isDropdownActive && (
                        <div className="origin-top-right absolute right-0 mt-2 w-48 rounded-lg bg-page-alt border border-border-subtle shadow-hover py-2 z-50 text-xs text-ink font-semibold">
                          <button
                            onClick={() => onTriggerResearch(lead)}
                            disabled={isRowActionLoading}
                            className="w-full text-left px-4 py-2 hover:bg-lime hover:text-ink flex items-center gap-2"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${isRowActionLoading ? 'animate-spin' : ''}`} />
                            Re-run AI Research
                          </button>
                          <button
                            onClick={() => onTriggerMessage(lead)}
                            disabled={isRowActionLoading}
                            className="w-full text-left px-4 py-2 hover:bg-lime hover:text-ink flex items-center gap-2"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            Re-generate AI Copy
                          </button>
                          <button
                            onClick={() => onMarkReplied(lead)}
                            className="w-full text-left px-4 py-2 hover:bg-lime hover:text-ink flex items-center gap-2"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            Mark as Replied
                          </button>
                          <div className="border-t border-border-subtle my-1" />
                          <button
                            onClick={() => onDeleteRow(lead)}
                            className="w-full text-left px-4 py-2 text-[#B5583F] hover:bg-[#B5583F]/10 flex items-center gap-2"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete Lead
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            )
          })
        )}
      </TableBody>
    </Table>
  )
}
