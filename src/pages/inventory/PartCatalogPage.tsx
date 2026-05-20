import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Plus, FileSpreadsheet, LayoutList, Grid3X3 } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useInventoryParts } from '@/hooks/inventory/useInventoryParts';
import { PartFilterBar, type PartFilters } from '@/components/inventory/catalog/PartFilterBar';
import { PartCatalogTable } from '@/components/inventory/catalog/PartCatalogTable';
import { PartCatalogCard } from '@/components/inventory/catalog/PartCatalogCard';
import type { PartCategory, PartStatus, PartCriticality } from '@/types/inventory';

export function PartCatalogPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const canManage = useAuthStore((s) =>
    s.canAccess(['store_keeper', 'supervisor', 'plant_manager', 'admin'])
  );

  const [viewMode, setViewMode] = useState<'table' | 'grid'>(() =>
    window.innerWidth < 768 ? 'grid' : 'table'
  );

  const [filters, setFilters] = useState<PartFilters>({
    category: (searchParams.get('category') ?? '') as PartCategory | '',
    status: (searchParams.get('status') ?? '') as PartStatus | '',
    stockStatus: (searchParams.get('stockStatus') ?? '') as 'in_stock' | 'low_stock' | 'out_of_stock' | '',
    criticality: (searchParams.get('criticality') ?? '') as PartCriticality | '',
    search: searchParams.get('search') ?? '',
  });

  const PAGE_SIZE = 25;

  const { parts, loading, error, totalCount, hasMore, loadMore } = useInventoryParts({
    category: filters.category || undefined,
    status: filters.status || undefined,
    stockStatus: filters.stockStatus || undefined,
    criticality: filters.criticality || undefined,
    searchQuery: filters.search || undefined,
    pageSize: PAGE_SIZE,
  });

  // Stat summary
  const activeCount = parts.filter((p) => p.status === 'active').length;
  const lowStockCount = parts.filter((p) => p.isLowStock).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-[Sora]">Parts Catalog</h1>
          {!loading && (
            <p className="text-gray-500 text-sm mt-0.5">
              {totalCount} parts · {activeCount} active · {lowStockCount} low stock
            </p>
          )}
        </div>
        {canManage && (
          <div className="flex items-center gap-3">
            <Link
              to="/app/inventory/import"
              className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-xl transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Import from Excel
            </Link>
            <Link
              to="/app/inventory/catalog/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Part
            </Link>
          </div>
        )}
      </div>

      {/* Filter bar */}
      <PartFilterBar
        filters={filters}
        onChange={setFilters}
      />

      {/* View toggle */}
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={() => setViewMode('table')}
          className={`p-2 rounded-lg transition-colors ${viewMode === 'table' ? 'bg-blue-100 text-blue-700' : 'text-gray-400 hover:bg-gray-100'}`}
          aria-label="Table view"
        >
          <LayoutList className="w-4 h-4" />
        </button>
        <button
          onClick={() => setViewMode('grid')}
          className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-blue-100 text-blue-700' : 'text-gray-400 hover:bg-gray-100'}`}
          aria-label="Grid view"
        >
          <Grid3X3 className="w-4 h-4" />
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((k) => (
            <div key={k} className="h-14 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {/* Content */}
      {!loading && (
        <>
          {viewMode === 'table' ? (
            <div className="hidden md:block">
              <PartCatalogTable
                parts={parts}
                onViewPart={(id) => navigate(`/app/inventory/catalog/${id}`)}
              />
            </div>
          ) : null}

          {/* Mobile always shows grid; desktop shows grid when toggled */}
          <div className={viewMode === 'grid' ? 'block' : 'block md:hidden'}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {parts.map((part) => (
                <PartCatalogCard
                  key={part.id}
                  part={part}
                  onClick={() => navigate(`/app/inventory/catalog/${part.id}`)}
                />
              ))}
            </div>
          </div>

          {/* When table view on desktop, also show table */}
          {viewMode === 'table' && (
            <div className="block md:hidden">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {parts.map((part) => (
                  <PartCatalogCard
                    key={part.id}
                    part={part}
                    onClick={() => navigate(`/app/inventory/catalog/${part.id}`)}
                  />
                ))}
              </div>
            </div>
          )}

          {parts.length === 0 && !loading && (
            <div className="text-center py-16 text-gray-400">
              <p className="text-lg font-medium">No parts found</p>
              <p className="text-sm mt-1">Try adjusting your filters or add a new part.</p>
            </div>
          )}

          {hasMore && (
            <div className="flex justify-center pt-4">
              <button
                onClick={loadMore}
                className="px-6 py-2.5 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-xl text-sm font-medium transition-colors"
              >
                Load More
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
export default PartCatalogPage;
