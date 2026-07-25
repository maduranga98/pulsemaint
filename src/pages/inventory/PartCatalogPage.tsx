import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Plus, FileSpreadsheet, LayoutList, Grid3X3, ChevronLeft, Trash2 } from 'lucide-react';
import { writeBatch, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import { useInventoryParts } from '@/hooks/inventory/useInventoryParts';
import { PartFilterBar, type PartFilters } from '@/components/inventory/catalog/PartFilterBar';
import { PartCatalogTable } from '@/components/inventory/catalog/PartCatalogTable';
import { PartCatalogCard } from '@/components/inventory/catalog/PartCatalogCard';
import type { PartCategory, PartStatus, PartCriticality } from '@/types/inventory';

export function PartCatalogPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { addToast } = useToast();
  const canManage = useAuthStore((s) =>
    s.canAccess(['store_keeper', 'supervisor', 'plant_manager', 'admin'])
  );
  // Matches the firestore.rules delete rule for inventoryParts.
  const canDelete = useAuthStore((s) => s.canAccess(['plant_manager', 'admin']));
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);

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

  function handleSelect(id: string, selected: boolean) {
    setSelectedIds((prev) => (selected ? [...prev, id] : prev.filter((pid) => pid !== id)));
  }

  function handleSelectAll(selected: boolean) {
    setSelectedIds(selected ? parts.map((p) => p.id) : []);
  }

  async function handleDeleteSelected() {
    if (selectedIds.length === 0) return;
    if (!confirm(`Delete ${selectedIds.length} selected part${selectedIds.length === 1 ? '' : 's'}? This cannot be undone.`)) {
      return;
    }
    setDeleting(true);
    try {
      // writeBatch caps at 500 ops — chunk in case a very large selection is deleted at once.
      const CHUNK = 450;
      for (let i = 0; i < selectedIds.length; i += CHUNK) {
        const batch = writeBatch(db);
        selectedIds.slice(i, i + CHUNK).forEach((id) => batch.delete(doc(db, 'inventoryParts', id)));
        await batch.commit();
      }
      addToast(`${selectedIds.length} part(s) deleted.`, 'success');
      setSelectedIds([]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      addToast(`Failed to delete parts: ${message}`, 'error');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Link
            to="/app/inventory"
            className="mt-1 text-gray-400 hover:text-gray-700 transition-colors"
            aria-label="Back to inventory"
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
          <h1 className="text-2xl font-bold text-gray-900 font-[Sora]">Parts Catalog</h1>
          {!loading && (
            <p className="text-gray-500 text-sm mt-0.5">
              {totalCount} parts · {activeCount} active · {lowStockCount} low stock
            </p>
          )}
          </div>
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

      {/* View toggle + bulk actions */}
      <div className="flex items-center justify-between gap-2">
        {canDelete && selectedIds.length > 0 ? (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
            <span className="text-xs font-medium text-red-800">{selectedIds.length} selected</span>
            <button
              onClick={handleDeleteSelected}
              disabled={deleting}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 hover:text-red-900 disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {deleting ? 'Deleting…' : 'Delete selected'}
            </button>
            <button
              onClick={() => setSelectedIds([])}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Clear
            </button>
          </div>
        ) : (
          <div />
        )}
        <div className="flex items-center gap-2">
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
                onEditPart={(id) => navigate(`/app/inventory/catalog/${id}/edit`)}
                selectable={canDelete}
                selectedIds={selectedIds}
                onSelect={handleSelect}
                onSelectAll={handleSelectAll}
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
