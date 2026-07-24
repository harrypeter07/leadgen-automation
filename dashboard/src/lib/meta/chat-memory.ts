import { supabaseAdmin } from '@/lib/supabase'

export interface MemoryMessage {
  id: string
  role: 'user' | 'model'
  text: string
  time: string
  fromUsername?: string
}

/**
 * Sanitizes Gemini AI responses to strip internal thought process, draft headers, and persona annotations
 */
export function sanitizeAiReply(text: string): string {
  if (!text) return ''
  let cleaned = text.trim()
  
  if (
    cleaned.includes('* User') || 
    cleaned.includes('* Persona') || 
    cleaned.includes('* Draft') || 
    cleaned.includes('* Style') || 
    cleaned.includes('* Tone') || 
    cleaned.includes('* Constraints') ||
    cleaned.includes('Empty message')
  ) {
    const quotes = cleaned.match(/"([^"]+)"/g)
    if (quotes && quotes.length > 0) {
      const last = quotes[quotes.length - 1]
      cleaned = last.replace(/^"|"$/g, '')
    } else {
      cleaned = cleaned.replace(/\*[^*]+\*/g, '').trim()
    }
  }

  cleaned = cleaned.replace(/^["'`]+|["'`]+$/g, '').trim()
  return cleaned
}

/**
 * Retrieves stored chat memory for a specific thread ID from Supabase meta_config
 */
export async function getChatMemory(threadId: string): Promise<MemoryMessage[]> {
  if (!threadId) return []
  const cleanId = threadId.replace('ig_', '').replace('fb_', '')
  const key = `CHAT_MEM_${cleanId}`

  try {
    const { data } = await supabaseAdmin
      .from('meta_config')
      .select('value')
      .eq('key', key)
      .single()

    if (data?.value) {
      return JSON.parse(data.value)
    }
  } catch (err) {
    console.warn(`[ChatMemory] Failed to read memory for ${cleanId}:`, err)
  }
  return []
}

/**
 * Saves/merges chat messages into Supabase meta_config for a specific thread ID
 */
export async function saveChatMemory(threadId: string, newMessages: MemoryMessage[]): Promise<MemoryMessage[]> {
  if (!threadId || !newMessages.length) return []
  const cleanId = threadId.replace('ig_', '').replace('fb_', '')
  const key = `CHAT_MEM_${cleanId}`

  try {
    const existing = await getChatMemory(cleanId)
    const map = new Map<string, MemoryMessage>()

    // Add existing
    existing.forEach(m => {
      if (m.id && m.text) map.set(m.id, m)
    })

    // Merge new messages
    newMessages.forEach(m => {
      if (m.id && m.text) map.set(m.id, m)
    })

    // Sort by time ascending
    const merged = Array.from(map.values()).sort((a, b) => {
      const ta = new Date(a.time).getTime() || 0
      const tb = new Date(b.time).getTime() || 0
      return ta - tb
    })

    // Keep last 40 messages for context
    const trimmed = merged.slice(-40)

    await supabaseAdmin
      .from('meta_config')
      .upsert({
        key,
        value: JSON.stringify(trimmed),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' })

    return trimmed
  } catch (err) {
    console.warn(`[ChatMemory] Failed to save memory for ${cleanId}:`, err)
    return newMessages
  }
}

/**
 * Appends a single message to thread memory in Supabase
 */
export async function appendMessageToMemory(threadId: string, msg: MemoryMessage): Promise<void> {
  if (!threadId || !msg.text) return
  await saveChatMemory(threadId, [msg])
}
