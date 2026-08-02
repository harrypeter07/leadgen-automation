// dashboard/src/components/tables/data-table.tsx
import React, { useState } from 'react';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { Input } from '../core/inputs/input';
import { Badge } from '../core/feedback/badge';

export interface Column<T> {
  header: string;
  accessorKey: keyof T | ((row: T) => React.ReactNode);
  cell?: (row: T) => React.ReactNode;
}

export interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  pageSize?: number;
  searchPlaceholder?: string;
  keyExtractor: (row: T) => string;
}

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  pageSize = 10,
  searchPlaceholder = 'Search records...',
  keyExtractor,
}: DataTableProps<T>) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const filtered = data.filter((row) =>
    Object.values(row).some((val) => String(val || '').toLowerCase().includes(search.toLowerCase()))
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-4">
      {/* Table Top Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="w-full sm:w-72">
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder={searchPlaceholder}
            leftIcon={<Search className="w-4 h-4" />}
          />
        </div>
        <div className="text-xs font-mono text-zinc-400">
          Showing {paginated.length} of {filtered.length} entries
        </div>
      </div>

      {/* Main Data Table */}
      <div className="rounded-lg glass glow-border overflow-hidden border border-blue-500/20 shadow-xl">
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs text-left">
            <thead className="bg-blue-950/40 border-b border-blue-500/20 text-zinc-400 font-mono uppercase tracking-wider sticky top-0 z-10">
              <tr>
                {columns.map((col, idx) => (
                  <th key={idx} className="px-6 py-4 font-semibold">
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-blue-500/10">
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-6 py-8 text-center text-zinc-500 font-medium">
                    No matching records found.
                  </td>
                </tr>
              ) : (
                paginated.map((row) => (
                  <tr key={keyExtractor(row)} className="h-[56px] hover:bg-blue-500/10 transition-colors">
                    {columns.map((col, idx) => {
                      let content: React.ReactNode = null;
                      if (col.cell) {
                        content = col.cell(row);
                      } else if (typeof col.accessorKey === 'function') {
                        content = col.accessorKey(row);
                      } else {
                        content = String(row[col.accessorKey] ?? '—');
                      }
                      return (
                        <td key={idx} className="px-6 py-4 text-zinc-200 font-medium">
                          {content}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-blue-500/30 text-xs font-semibold text-blue-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-600/20 transition-all"
          >
            <ChevronLeft className="w-4 h-4" /> Previous
          </button>
          <span className="text-xs font-mono text-blue-300">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-blue-500/30 text-xs font-semibold text-blue-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-600/20 transition-all"
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
