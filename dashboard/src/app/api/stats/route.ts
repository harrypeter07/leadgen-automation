// dashboard/src/app/api/stats/route.ts
import { withApiHandler } from '@/server/api/handler';
import { ok, fail } from '@/server/api/response';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export const GET = withApiHandler(async () => {
  const { data: leads, error } = await supabaseAdmin
    .from('leads')
    .select('status, city, category, created_at, source');

  if (error) return fail(error.message, 'DATABASE_ERROR', 500);

  const totalCount = leads?.length ?? 0;
  const statusCounts: Record<string, number> = {
    new: 0,
    whatsapp_sent: 0,
    email_sent: 0,
    replied: 0,
    converted: 0,
    skip: 0,
  };

  const cityMap = new Map<string, number>();
  const categoryMap = new Map<string, number>();
  const providerMap = new Map<string, number>();
  const dailyMap = new Map<string, number>();
  
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  let addedLast7Days = 0;

  for (const lead of (leads || [])) {
    if (lead.status && lead.status in statusCounts) {
      statusCounts[lead.status]++;
    }

    if (lead.created_at) {
      const createdAtDate = new Date(lead.created_at);
      if (createdAtDate >= sevenDaysAgo) addedLast7Days++;
      const dateStr = createdAtDate.toISOString().split('T')[0];
      dailyMap.set(dateStr, (dailyMap.get(dateStr) ?? 0) + 1);
    }

    if (lead.city) {
      const toTitleCase = (str: string) => str.toLowerCase().replace(/(?:^|\s|-)\S/g, m => m.toUpperCase()).trim();
      const cleanedCity = toTitleCase(lead.city);
      cityMap.set(cleanedCity, (cityMap.get(cleanedCity) ?? 0) + 1);
    }

    if (lead.category) {
      const cleanedCategory = lead.category.trim();
      categoryMap.set(cleanedCategory, (categoryMap.get(cleanedCategory) ?? 0) + 1);
    }

    const source = lead.source || 'unknown';
    providerMap.set(source, (providerMap.get(source) ?? 0) + 1);
  }

  const topCities = Array.from(cityMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const topCategories = Array.from(categoryMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const providerComparison = Array.from(providerMap.entries())
    .map(([source, count]) => ({ source, count }));

  const dailyDistribution = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().split('T')[0];
    const label = d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
    dailyDistribution.push({
      date: label,
      count: dailyMap.get(key) ?? 0,
    });
  }

  const sent = statusCounts.whatsapp_sent + statusCounts.email_sent;
  const positive = statusCounts.replied + statusCounts.converted;
  const totalContacted = sent + positive;
  const rate = totalContacted > 0 ? Math.round((positive / totalContacted) * 100) : 0;

  return ok({
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
      converted: statusCounts.converted,
    },
  });
});
