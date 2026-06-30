import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase'
import { LEAD_STATUSES, STATUS_COLORS } from '@/types/lead'

export const dynamic = 'force-dynamic'

function aggregateCounts(
  rows: { city?: string | null; category?: string | null }[],
  field: 'city' | 'category'
): { name: string; count: number }[] {
  const map = new Map<string, number>()

  for (const row of rows) {
    const value = row[field]
    if (!value) continue
    map.set(value, (map.get(value) ?? 0) + 1)
  }

  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
}

export default async function HomePage() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const [
    totalResult,
    recentResult,
    cityCategoryResult,
    ...statusResults
  ] = await Promise.all([
    supabaseAdmin.from('leads').select('*', { count: 'exact', head: true }),
    supabaseAdmin
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .gt('created_at', sevenDaysAgo),
    supabaseAdmin.from('leads').select('city, category'),
    ...LEAD_STATUSES.map((status) =>
      supabaseAdmin
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('status', status)
    ),
  ])

  const totalLeads = totalResult.count ?? 0
  const recentLeads = recentResult.count ?? 0
  const statusCounts = LEAD_STATUSES.map((status, i) => ({
    status,
    count: statusResults[i].count ?? 0,
  }))

  const topCities = aggregateCounts(cityCategoryResult.data ?? [], 'city')
  const topCategories = aggregateCounts(cityCategoryResult.data ?? [], 'category')

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Lead Gen Dashboard</h1>
            <p className="mt-1 text-sm text-gray-500">{today}</p>
          </div>
          <Link
            href="/leads"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            View all leads →
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-gray-500">Total leads</p>
            <p className="mt-1 text-3xl font-bold text-gray-900">{totalLeads}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-gray-500">Last 7 days</p>
            <p className="mt-1 text-3xl font-bold text-gray-900">{recentLeads}</p>
          </div>
        </div>

        <h2 className="mb-4 text-lg font-semibold text-gray-900">Leads by status</h2>
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {statusCounts.map(({ status, count }) => (
            <div
              key={status}
              className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
            >
              <span
                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[status]}`}
              >
                {status.replace(/_/g, ' ')}
              </span>
              <p className="mt-2 text-2xl font-bold text-gray-900">{count}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-4 py-3">
              <h3 className="font-semibold text-gray-900">Top Cities</h3>
            </div>
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-gray-500">
                  <th className="px-4 py-2 font-medium">City</th>
                  <th className="px-4 py-2 font-medium">Count</th>
                </tr>
              </thead>
              <tbody>
                {topCities.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="px-4 py-4 text-gray-400">
                      No data yet
                    </td>
                  </tr>
                ) : (
                  topCities.map((row) => (
                    <tr key={row.name} className="border-b border-gray-50">
                      <td className="px-4 py-2 text-gray-900">{row.name}</td>
                      <td className="px-4 py-2 text-gray-600">{row.count}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-4 py-3">
              <h3 className="font-semibold text-gray-900">Top Categories</h3>
            </div>
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-gray-500">
                  <th className="px-4 py-2 font-medium">Category</th>
                  <th className="px-4 py-2 font-medium">Count</th>
                </tr>
              </thead>
              <tbody>
                {topCategories.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="px-4 py-4 text-gray-400">
                      No data yet
                    </td>
                  </tr>
                ) : (
                  topCategories.map((row) => (
                    <tr key={row.name} className="border-b border-gray-50">
                      <td className="px-4 py-2 text-gray-900">{row.name}</td>
                      <td className="px-4 py-2 text-gray-600">{row.count}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}
