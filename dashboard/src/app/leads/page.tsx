import Link from 'next/link'
import { Suspense } from 'react'
import { supabaseAdmin } from '@/lib/supabase'
import type { Lead } from '@/types/lead'
import LeadFilters from './components/LeadFilters'
import LeadTableRow from './components/LeadTableRow'

export const dynamic = 'force-dynamic'

const PER_PAGE = 50

interface LeadsPageProps {
  searchParams: {
    status?: string
    city?: string
    search?: string
    page?: string
  }
}

export default async function LeadsPage({ searchParams }: LeadsPageProps) {
  const page = Math.max(1, parseInt(searchParams.page || '1', 10) || 1)
  const offset = (page - 1) * PER_PAGE

  let query = supabaseAdmin
    .from('leads')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + PER_PAGE - 1)

  if (searchParams.status) {
    query = query.eq('status', searchParams.status)
  }

  if (searchParams.city) {
    query = query.ilike('city', `%${searchParams.city}%`)
  }

  if (searchParams.search) {
    const term = searchParams.search.trim()
    query = query.or(`name.ilike.%${term}%,phone.ilike.%${term}%`)
  }

  const { data, count, error } = await query

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <p className="text-red-600">Failed to load leads: {error.message}</p>
      </div>
    )
  }

  const leads = (data ?? []) as Lead[]
  const total = count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE))

  function pageUrl(nextPage: number) {
    const params = new URLSearchParams()
    if (searchParams.status) params.set('status', searchParams.status)
    if (searchParams.city) params.set('city', searchParams.city)
    if (searchParams.search) params.set('search', searchParams.search)
    params.set('page', String(nextPage))
    return `/leads?${params.toString()}`
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <h1 className="text-xl font-bold text-gray-900">All Leads</h1>
          <Link href="/" className="text-sm text-blue-600 hover:underline">
            ← Dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <Suspense fallback={<div className="mb-6 h-20 animate-pulse rounded-lg bg-gray-200" />}>
          <LeadFilters />
        </Suspense>

        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Name</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Phone</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Email</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">City</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Category</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Created</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {leads.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    No leads found.
                  </td>
                </tr>
              ) : (
                leads.map((lead) => <LeadTableRow key={lead.id} lead={lead} />)
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
          <span>
            Page {page} of {totalPages} ({total} total)
          </span>
          <div className="flex gap-2">
            {page > 1 ? (
              <Link
                href={pageUrl(page - 1)}
                className="rounded-md border border-gray-300 px-3 py-1 hover:bg-white"
              >
                Previous
              </Link>
            ) : (
              <span className="rounded-md border border-gray-200 px-3 py-1 text-gray-300">
                Previous
              </span>
            )}
            {page < totalPages ? (
              <Link
                href={pageUrl(page + 1)}
                className="rounded-md border border-gray-300 px-3 py-1 hover:bg-white"
              >
                Next
              </Link>
            ) : (
              <span className="rounded-md border border-gray-200 px-3 py-1 text-gray-300">
                Next
              </span>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
