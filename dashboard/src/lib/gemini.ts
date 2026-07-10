// src/lib/gemini.ts
import { supabaseAdmin } from './supabase'

export interface GeminiPayload {
  system_instruction?: { parts: Array<{ text: string }> }
  contents: Array<{ role: string; parts: Array<{ text: string }> }>
  generationConfig?: Record<string, unknown>
}

export async function generateWithGemini(
  payload: GeminiPayload,
  apiKey: string
): Promise<{ text: string; model: string }> {
  // Try models in sequence from newest/premium down to standard fallbacks
  const models = [
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.0-flash-lite',
  ]

  // Hydrate rotation keys from meta_config table
  let rotationKeys: string[] = []
  try {
    const { data } = await supabaseAdmin
      .from('meta_config')
      .select('value')
      .eq('key', 'SAVED_GEMINI_API_KEYS')
      .single()
    if (data?.value) {
      rotationKeys = JSON.parse(data.value)
    }
  } catch (dbErr: any) {
    console.warn('[Gemini SDK] Failed to load rotation keys from DB:', dbErr.message)
  }

  // Deduplicate and filter out empty keys
  const keysToTry = Array.from(new Set([
    apiKey,
    ...rotationKeys,
    process.env.GEMINI_API_KEY,
    process.env.GOOGLE_AI_KEY
  ])).filter(Boolean) as string[]

  if (keysToTry.length === 0) {
    throw new Error('All Gemini API models failed. Last error (status 400): No Gemini API keys configured in environment or database.')
  }

  let lastError = 'Unknown error'
  let lastStatus = 500

  for (const activeKey of keysToTry) {
    const keyAbbr = activeKey.slice(0, 8) + '...'
    console.log(`[Gemini SDK] Attempting text generation with key: ${keyAbbr}`)

    for (const modelName of models) {
      try {
        console.log(`[Gemini SDK] Trying model: ${modelName}`)
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${activeKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }
        )

        if (res.ok) {
          const data = await res.json()
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
          if (text) {
            console.log(`[Gemini SDK] Successful generation using model: ${modelName} with key: ${keyAbbr}`)
            return { text, model: modelName }
          }
        }

        const errText = await res.text()
        console.warn(`[Gemini SDK] Model ${modelName} failed with key ${keyAbbr} (status ${res.status}): ${errText}`)
        lastError = errText
        lastStatus = res.status

        // If the key has hit a quota limit (429) or is invalid (400/401), rotate to the next key immediately
        if (res.status === 429 || res.status === 400 || res.status === 401) {
          console.warn(`[Gemini SDK] Key ${keyAbbr} hit status limit (${res.status}). Rotating key...`)
          break // Break model loop to advance to next key in keysToTry
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`[Gemini SDK] Network error with ${modelName}:`, msg)
        lastError = msg
      }
    }
  }

  throw new Error(`All Gemini API models failed. Last error (status ${lastStatus}): ${lastError}`)
}
