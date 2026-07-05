import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, phone, email, city, category, website, source } = body

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    let finalPhone = phone ? phone.trim() : null
    let warning = null

    if (finalPhone) {
      // Check for duplicate phone number
      const { data: existingLeads, error: checkError } = await supabaseAdmin
        .from('leads')
        .select('id, name')
        .eq('phone', finalPhone)

      if (checkError) throw checkError

      if (existingLeads && existingLeads.length > 0) {
        warning = `Warning: A lead with phone number ${finalPhone} already exists (${existingLeads[0].name}). Saved anyway.`
        finalPhone = `${finalPhone} - Duplicate`
      }
    }

    const toTitleCase = (str: string) => {
      if (!str) return ''
      return str.toLowerCase().replace(/(?:^|\s|-)\S/g, match => match.toUpperCase()).trim()
    }

    // Insert into database directly
    const { data: newLead, error: insertError } = await supabaseAdmin
      .from('leads')
      .insert([
        {
          name: name.trim(),
          phone: finalPhone,
          email: email ? email.trim() : null,
          city: city ? toTitleCase(city) : null,
          category: category ? category.trim() : null,
          website: website ? website.trim() : null,
          source: source || 'manual_entry',
          status: 'new',
          notes: warning ? `[System Warning] Duplicate phone detected on save. Originally: ${phone}` : null
        }
      ])
      .select()
      .single()

    if (insertError) throw insertError

    return NextResponse.json({
      success: true,
      lead: newLead,
      warning: warning
    })

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to save lead to database'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
