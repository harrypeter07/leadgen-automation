import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { ensureMetaConfig } from '@/lib/meta/runtime-config'

// POST /api/automation/outreach/email/generate
// body: { leadIds: string[] }
// Generates personalized AI email drafts for each lead using Gemini,
// then saves them to Supabase leads table (ai_message_email_subject + ai_message_email_body)

export async function POST(req: NextRequest) {
  try {
    await ensureMetaConfig()

    const { leadIds } = await req.json()
    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return NextResponse.json({ error: 'leadIds array required' }, { status: 400 })
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY || ''
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 503 })
    }

    // Fetch lead details from Supabase
    const { data: leads, error: fetchErr } = await supabaseAdmin
      .from('leads')
      .select('id,name,email,category,city,website,rating,review_count,enrichment_fields')
      .in('id', leadIds)

    if (fetchErr || !leads) {
      return NextResponse.json({ error: fetchErr?.message || 'Failed to fetch leads' }, { status: 500 })
    }

    const results: { id: string; success: boolean; error?: string }[] = []

    for (const lead of leads) {
      try {
        const enrichment = lead.enrichment_fields as Record<string, unknown> | null
        const prompt = `Write a professional, personalized cold outreach email for a business.

Business Details:
- Name: ${lead.name}
- Category: ${lead.category || 'local business'}
- City: ${lead.city || 'unknown city'}
- Website: ${lead.website || 'no website listed'}
- Rating: ${lead.rating ? `${lead.rating}/5 (${lead.review_count} reviews)` : 'not available'}
${enrichment?.business_description ? `- Description: ${enrichment.business_description}` : ''}
${enrichment?.contact_person ? `- Contact: ${enrichment.contact_person} (${enrichment.contact_position || ''})` : ''}

Write the email in two parts separated by "|||":
1. Email subject line (max 8 words, compelling)
2. Email body (3-4 short paragraphs, personalized, professional, 150-200 words)

Format: SUBJECT|||BODY`

        const { generateWithGemini } = await import('@/lib/gemini')
        const { text: raw } = await generateWithGemini(
          {
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 400, temperature: 0.7 },
          },
          apiKey
        )
        const parts = raw.split('|||')

        const subject = parts[0]?.trim().replace(/^subject[:\s]*/i, '') || `Following up — ${lead.name}`
        const body = parts[1]?.trim() || raw.trim()

        // Save to Supabase
        await supabaseAdmin
          .from('leads')
          .update({
            ai_message_email_subject: subject,
            ai_message_email_body: body,
          })
          .eq('id', lead.id)

        results.push({ id: lead.id, success: true })
      } catch (err) {
        results.push({ id: lead.id, success: false, error: err instanceof Error ? err.message : 'Unknown error' })
      }
    }

    const succeeded = results.filter(r => r.success).length
    return NextResponse.json({
      success: succeeded > 0,
      generated: succeeded,
      failed: results.length - succeeded,
      results,
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Generation failed' }, { status: 500 })
  }
}
