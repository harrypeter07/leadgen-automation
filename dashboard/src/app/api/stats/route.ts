import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Fetch only the columns we need to aggregate in memory
    const { data: leads, error } = await supabaseAdmin
      .from('leads')
      .select('status, city, category, created_at, source')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const totalCount = leads?.length ?? 0
    const statusCounts: Record<string, number> = {
      new: 0,
      whatsapp_sent: 0,
      email_sent: 0,
      replied: 0,
      converted: 0,
      skip: 0,
    }

    const cityMap = new Map<string, number>()
    const categoryMap = new Map<string, number>()
    const providerMap = new Map<string, number>()
    const dailyMap = new Map<string, number>()
    
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    let addedLast7Days = 0

    for (const lead of (leads || [])) {
      // 1. Status counts
      if (lead.status && lead.status in statusCounts) {
        statusCounts[lead.status]++
      }

      // 2. Added last 7 days & Daily timeline
      if (lead.created_at) {
        const createdAtDate = new Date(lead.created_at)
        if (createdAtDate >= sevenDaysAgo) {
          addedLast7Days++
        }
        // Format YYYY-MM-DD
        const dateStr = createdAtDate.toISOString().split('T')[0]
        dailyMap.set(dateStr, (dailyMap.get(dateStr) ?? 0) + 1)
      }

      // 3. Top cities
      if (lead.city) {
        const cleanedCity = lead.city.trim()
        cityMap.set(cleanedCity, (cityMap.get(cleanedCity) ?? 0) + 1)
      }

      // 4. Top categories
      if (lead.category) {
        const cleanedCategory = lead.category.trim()
        categoryMap.set(cleanedCategory, (categoryMap.get(cleanedCategory) ?? 0) + 1)
      }

      // 5. Providers (source)
      const source = lead.source || 'unknown'
      providerMap.set(source, (providerMap.get(source) ?? 0) + 1)
    }

    // Sort and slice top 5 cities
    const topCities = Array.from(cityMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    // Sort and slice top 5 categories
    const topCategories = Array.from(categoryMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    // Provider Comparison
    const providerComparison = Array.from(providerMap.entries())
      .map(([source, count]) => ({ source, count }))

    // Daily distribution (last 7 days)
    const dailyDistribution = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
      const key = d.toISOString().split('T')[0]
      const label = d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
      dailyDistribution.push({
        date: label,
        count: dailyMap.get(key) ?? 0
      })
    }

    // Outreach conversion rate
    const sent = statusCounts.whatsapp_sent + statusCounts.email_sent
    const positive = statusCounts.replied + statusCounts.converted
    const totalContacted = sent + positive
    const rate = totalContacted > 0 ? Math.round((positive / totalContacted) * 100) : 0

    return NextResponse.json({
      total: totalCount,
      statusCounts,
      addedLast7Days,
      topCities,
      topCategories,
      providerComparison,
      dailyDistribution,
      conversionStats: {
        rate,
        sent,
        replied: statusCounts.replied,
        converted: statusCounts.converted
      }
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch stats'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
