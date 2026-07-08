import { NextRequest, NextResponse } from 'next/server'
import { MetaSettingsService } from '@/lib/meta/meta-settings-service'

export const dynamic = 'force-dynamic'

// POST /api/meta/config/seed — seeds meta_config from process.env (idempotent)
export async function POST(_req: NextRequest) {
  try {
    const envSettings = MetaSettingsService.getFromEnv()

    // Check if DB already has values
    const existing = await MetaSettingsService.getFromDB()
    const existingKeys = Object.keys(existing).filter(k => (existing as Record<string, unknown>)[k])

    if (existingKeys.length > 0) {
      return NextResponse.json({
        success: true,
        message: `DB already has ${existingKeys.length} config entries — skipping seed.`,
        existingCount: existingKeys.length,
        seeded: false,
      })
    }

    const result = await MetaSettingsService.saveToDB(envSettings)
    if (result.ok) {
      try {
        const { invalidateMetaConfig } = require('@/lib/meta/runtime-config')
        invalidateMetaConfig()
      } catch {}
    }
    if (!result.ok) {
      return NextResponse.json({
        success: false,
        error: result.error,
        hint: 'Run the SQL migration at scripts/meta/create_meta_tables.sql in Supabase SQL Editor first.',
      }, { status: 500 })
    }

    const seededCount = Object.values(envSettings).filter(v => v).length
    return NextResponse.json({
      success: true,
      message: `Seeded ${seededCount} env variables into meta_config.`,
      seeded: true,
      seededCount,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
