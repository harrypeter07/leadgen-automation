import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  try {
    const subpath = params.path.join('/')
    const searchParams = req.nextUrl.searchParams.toString()
    const queryStr = searchParams ? `?${searchParams}` : ''

    // Resolve URL
    const { data: config } = await supabaseAdmin
      .from('meta_config')
      .select('value')
      .eq('key', 'AGENT_BRAIN_URL')
      .single()

    const brainUrl = (config?.value || 'https://agent-brain.up.railway.app').replace(/\/$/, '')
    const targetUrl = `${brainUrl}/api/${subpath}${queryStr}`

    const res = await fetch(targetUrl, {
      method: 'GET',
      next: { revalidate: 0 },
    })

    if (!res.ok) {
      const err = await res.text()
      return NextResponse.json({ error: err }, { status: res.status })
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: { path: string[] } }) {
  try {
    const subpath = params.path.join('/')
    const body = await req.json().catch(() => ({}))

    // Resolve URL
    const { data: config } = await supabaseAdmin
      .from('meta_config')
      .select('value')
      .eq('key', 'AGENT_BRAIN_URL')
      .single()

    const brainUrl = (config?.value || 'https://agent-brain.up.railway.app').replace(/\/$/, '')
    const targetUrl = `${brainUrl}/api/${subpath}`

    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const err = await res.text()
      return NextResponse.json({ error: err }, { status: res.status })
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
