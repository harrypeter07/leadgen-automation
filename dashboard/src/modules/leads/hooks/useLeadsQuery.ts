// dashboard/src/modules/leads/hooks/useLeadsQuery.ts
import { useState, useEffect, useCallback } from 'react';
import type { Lead } from '@/types/lead';

export interface UseLeadsQueryOptions {
  initialPage?: number;
  initialLimit?: number;
  initialStatus?: string;
}

export function useLeadsQuery(options: UseLeadsQueryOptions = {}) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [totalLeads, setTotalLeads] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(options.initialPage || 1);
  const [status, setStatus] = useState(options.initialStatus || '');
  const [search, setSearch] = useState('');
  const [city, setCity] = useState('');
  const [category, setCategory] = useState('');

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      if (status) params.set('status', status);
      if (search) params.set('search', search);
      if (city) params.set('city', city);
      if (category) params.set('category', category);

      const res = await fetch(`/api/leads?${params.toString()}`);
      if (res.ok) {
        const result = await res.json();
        if (result.success && result.data) {
          setLeads(result.data.leads || []);
          setTotalLeads(result.data.total || 0);
        } else if (result.leads) {
          setLeads(result.leads);
          setTotalLeads(result.total || 0);
        }
      }
    } catch (err) {
      console.error('[useLeadsQuery] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [page, status, search, city, category]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  return {
    leads,
    totalLeads,
    loading,
    page,
    setPage,
    status,
    setStatus,
    search,
    setSearch,
    city,
    setCity,
    category,
    setCategory,
    refreshLeads: fetchLeads,
  };
}
