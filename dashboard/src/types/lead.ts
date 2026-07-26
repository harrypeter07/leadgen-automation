export type LeadStatus =
  | 'new'
  | 'whatsapp_sent'
  | 'email_sent'
  | 'replied'
  | 'converted'
  | 'skip'

export interface Lead {
  id: string
  created_at: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  city: string | null
  category: string | null
  website: string | null
  rating: number | null
  review_count: number | null
  source: string
  status: LeadStatus
  whatsapp_sent_at: string | null
  email_sent_at: string | null
  last_contacted_at: string | null
  notes: string | null
  ai_message_whatsapp: string | null
  ai_message_email_subject: string | null
  ai_message_email_body: string | null
}

export const LEAD_STATUSES: LeadStatus[] = [
  'new',
  'whatsapp_sent',
  'email_sent',
  'replied',
  'converted',
  'skip',
]

export const STATUS_COLORS: Record<LeadStatus, string> = {
  new: 'bg-blue-500/15 text-blue-300 border border-blue-500/30 font-mono',
  whatsapp_sent: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-mono',
  email_sent: 'bg-purple-500/15 text-purple-300 border border-purple-500/30 font-mono',
  replied: 'bg-amber-500/15 text-amber-300 border border-amber-500/30 font-mono',
  converted: 'bg-blue-600/25 text-blue-200 border border-blue-400/40 font-mono font-bold shadow-sm shadow-blue-500/20',
  skip: 'bg-zinc-800/60 text-zinc-400 border border-zinc-700/60 font-mono',
}
