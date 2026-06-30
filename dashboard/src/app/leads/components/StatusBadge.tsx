import { LEAD_STATUSES, STATUS_COLORS, type LeadStatus } from '@/types/lead'

interface StatusBadgeProps {
  status: string
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const key = status as LeadStatus
  const colors = STATUS_COLORS[key] ?? 'bg-gray-100 text-gray-800'

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors}`}
    >
      {status.replace(/_/g, ' ')}
    </span>
  )
}

export { LEAD_STATUSES }
