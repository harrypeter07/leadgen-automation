'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import StatusBadge from './StatusBadge'
import type { Lead, LeadStatus } from '@/types/lead'

interface LeadTableRowProps {
  lead: Lead
}

export default function LeadTableRow({ lead }: LeadTableRowProps) {
  const router = useRouter()
  const [status, setStatus] = useState<LeadStatus>(lead.status)
  const [loading, setLoading] = useState<string | null>(null)

  async function updateStatus(newStatus: LeadStatus) {
    setLoading(newStatus)
    try {
      const res = await fetch(`/api/leads/${lead.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Update failed')
      }

      setStatus(newStatus)
      router.refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update status')
    } finally {
      setLoading(null)
    }
  }

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-3 font-medium text-gray-900">{lead.name}</td>
      <td className="px-4 py-3 text-gray-600">{lead.phone ?? '—'}</td>
      <td className="px-4 py-3 text-gray-600">{lead.email ?? '—'}</td>
      <td className="px-4 py-3 text-gray-600">{lead.city ?? '—'}</td>
      <td className="px-4 py-3 text-gray-600">{lead.category ?? '—'}</td>
      <td className="px-4 py-3">
        <StatusBadge status={status} />
      </td>
      <td className="px-4 py-3 text-gray-500">
        {new Date(lead.created_at).toLocaleDateString()}
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-1">
          <button
            type="button"
            disabled={loading !== null || status === 'replied'}
            onClick={() => updateStatus('replied')}
            title="Mark Replied"
            className="rounded p-1.5 text-yellow-600 hover:bg-yellow-50 disabled:opacity-40"
            aria-label="Mark Replied"
          >
            {loading === 'replied' ? '…' : '↩'}
          </button>
          <button
            type="button"
            disabled={loading !== null || status === 'converted'}
            onClick={() => updateStatus('converted')}
            title="Mark Converted"
            className="rounded p-1.5 text-green-600 hover:bg-green-50 disabled:opacity-40"
            aria-label="Mark Converted"
          >
            {loading === 'converted' ? '…' : '✓'}
          </button>
        </div>
      </td>
    </tr>
  )
}
