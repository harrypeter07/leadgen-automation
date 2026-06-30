'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { FormEvent, useState } from 'react'
import { LEAD_STATUSES } from '@/types/lead'

export default function LeadFilters() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [status, setStatus] = useState(searchParams.get('status') ?? '')
  const [city, setCity] = useState(searchParams.get('city') ?? '')
  const [search, setSearch] = useState(searchParams.get('search') ?? '')

  function applyFilters(e?: FormEvent) {
    e?.preventDefault()

    const params = new URLSearchParams()
    if (status) params.set('status', status)
    if (city.trim()) params.set('city', city.trim())
    if (search.trim()) params.set('search', search.trim())

    const query = params.toString()
    router.push(query ? `/leads?${query}` : '/leads')
  }

  function clearFilters() {
    setStatus('')
    setCity('')
    setSearch('')
    router.push('/leads')
  }

  return (
    <form
      onSubmit={applyFilters}
      className="mb-6 flex flex-wrap items-end gap-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
    >
      <div>
        <label htmlFor="status" className="mb-1 block text-sm font-medium text-gray-700">
          Status
        </label>
        <select
          id="status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">All</option>
          {LEAD_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="city" className="mb-1 block text-sm font-medium text-gray-700">
          City
        </label>
        <input
          id="city"
          type="text"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="e.g. Pune"
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="min-w-[200px] flex-1">
        <label htmlFor="search" className="mb-1 block text-sm font-medium text-gray-700">
          Search
        </label>
        <input
          id="search"
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Name or phone"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <button
        type="submit"
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        Apply
      </button>

      <button
        type="button"
        onClick={clearFilters}
        className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        Clear filters
      </button>
    </form>
  )
}
