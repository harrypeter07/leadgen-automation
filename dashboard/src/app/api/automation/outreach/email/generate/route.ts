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

    const { leadIds, senderName: bodySenderName } = await req.json()
    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return NextResponse.json({ error: 'leadIds array required' }, { status: 400 })
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY || ''

    // Resolve senderName from request or config settings
    let senderName = bodySenderName || ''
    if (!senderName) {
      const { data: configRow } = await supabaseAdmin
        .from('meta_config')
        .select('value')
        .eq('key', 'SMTP_FROM_NAME')
        .maybeSingle()
      senderName = configRow?.value || 'the Partnership Team'
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

Sender Details:
- Sender Name: ${senderName}

Recipient Business Details:
- Name: ${lead.name}
- Category: ${lead.category || 'local business'}
- City: ${lead.city || 'unknown city'}
- Website: ${lead.website || 'no website listed'}
- Rating: ${lead.rating ? `${lead.rating}/5 (${lead.review_count} reviews)` : 'not available'}
${enrichment?.business_description ? `- Description: ${enrichment.business_description}` : ''}
${enrichment?.contact_person ? `- Contact Person: ${enrichment.contact_person} (${enrichment.contact_position || ''})` : ''}

CRITICAL INSTRUCTIONS:
1. DO NOT use generic bracket placeholders (like "[Company Name]", "[Name]", "[Your Name]", "[Your Phone Number]", or "<Company Name>") under any circumstances.
2. Replace the recipient company name placeholder with "${lead.name}".
3. Replace the recipient contact name placeholder with "${enrichment?.contact_person || 'Business Owner'}".
4. Replace the signature placeholder (like "[Your Name]") with "${senderName}".
5. If any details (like phone number) are missing or unspecified, DO NOT output placeholder text like "[Your Phone Number]"; instead, write a natural closing statement (e.g., "Best regards,\n${senderName}") or omit the missing detail entirely.

Write the email in two parts separated by "|||":
1. Email subject line (max 8 words, compelling)
2. Email body (3-4 short paragraphs, personalized, professional, 150-200 words)

Format: SUBJECT|||BODY`

        const { generateWithGemini } = await import('@/lib/gemini')
        const { text: raw } = await generateWithGemini(
          {
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 1500, temperature: 0.7 },
          },
          apiKey
        )
        const parts = raw.split('|||')

        let subject = parts[0]?.trim().replace(/^subject[:\s]*/i, '') || `Following up — ${lead.name}`
        let body = parts[1]?.trim() || raw.trim()

        // Post-processing safety sweep to catch and replace any accidental bracket placeholders
        const cleanPlaceholders = (text: string) => {
          const contactName = (enrichment && typeof enrichment.contact_person === 'string') 
            ? enrichment.contact_person 
            : 'Business Owner'
          return text
            .replace(/\[Company\s*Name\]/gi, lead.name)
            .replace(/\[Your\s*Name\]/gi, senderName)
            .replace(/\[Your\s*Phone\s*Number\]/gi, '')
            .replace(/\[Name\]/gi, contactName)
            .replace(/\[Your\s*Company\]/gi, senderName)
            .replace(/\[Contact\s*Person\]/gi, contactName)
        }

        subject = cleanPlaceholders(subject)
        body = cleanPlaceholders(body)

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
