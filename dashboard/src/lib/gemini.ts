// src/lib/gemini.ts

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
  // NOTE: gemini-1.5-* models are deprecated and return 404 on v1beta API
  const models = [
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.0-flash-lite',
  ]

  let lastError = 'Unknown error'
  let lastStatus = 500

  for (const modelName of models) {
    try {
      console.log(`[Gemini SDK] Attempting text generation with: ${modelName}`)
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
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
          console.log(`[Gemini SDK] Successful generation using: ${modelName}`)
          return { text, model: modelName }
        }
      }

      const errText = await res.text()
      console.warn(`[Gemini SDK] Model ${modelName} failed (status ${res.status}): ${errText}`)
      lastError = errText
      lastStatus = res.status
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[Gemini SDK] Network error with ${modelName}:`, msg)
      lastError = msg
    }
  }

  throw new Error(`All Gemini API models failed. Last error (status ${lastStatus}): ${lastError}`)
}
