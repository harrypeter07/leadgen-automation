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
  new: 'bg-gray-100 text-gray-800',
  whatsapp_sent: 'bg-blue-100 text-blue-800',
  email_sent: 'bg-purple-100 text-purple-800',
  replied: 'bg-yellow-100 text-yellow-800',
  converted: 'bg-green-100 text-green-800',
  skip: 'bg-red-100 text-red-800',
}
