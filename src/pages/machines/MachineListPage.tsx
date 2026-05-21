import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useMachines } from '../../hooks/useMachines';
import {
  MachineStatusBadge,
  MachineFilterBar,
  MachineCard,
  MachineListTable,
} from '../../components/machines';
import type { MachineFilters } from '../../types/machine';

export function MachineListPage() {
  const navigate = useNavigate();
  const userProfile = useAuthStore((state) => state.userProfile);
  const [filters, setFilters] = useState<Partial<MachineFilters>>({});
  const [useTableView, setUseTableView] = useState<boolean | null>(null);

  const siteId = userProfile ? userProfile.siteIds[0] || userProfile.companyId : '';

  const { machines, loading, error, hasMore, loadMore, totalCount } = useMachines({
    siteId,
    filters,
  });

  const filteredMachines = useMemo(() => {
    if (!filters.search) return machines;
    const search = filters.search.toLowerCase();
    return machines.filter(
      (m) =>
        m.name.toLowerCase().includes(search) ||
        m.model.toLowerCase().includes(search) ||
        m.serialNumber.toLowerCase().includes(search) ||
        m.manufacturer.toLowerCase().includes(search)
    );
  }, [machines, filters.search]);

  if (!userProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  const isDesktop = useTableView !== null ? useTableView : typeof window !== 'undefined' && window.innerWidth >= 1024;

  const canCreateMachine =
    userProfile.role === 'supervisor' ||
    userProfile.role === 'plant_manager' ||
    userProfile.role === 'admin';

  const activeMachines = machines.filter((m) => m.status === 'active').length;
  const maintenanceMachines = machines.filter((m) => m.status === 'under_maintenance').length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Page Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Machine Registry</h1>
              <p className="text-gray-600 text-sm mt-1">
                {totalCount || machines.length} machines · {activeMachines} active · {maintenanceMachines} in maintenance
              </p>
            </div>

            <div className="flex gap-3">
              {canCreateMachine && (
                <Link
                  to="/app/machines/new"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm"
                >
                  + Add Machine
                </Link>
              )}
              <button
                disabled
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg opacity-50 cursor-not-allowed font-medium text-sm"
                title="Coming in Phase 2"
              >
                Import
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 space-y-6">
        {/* Filter Bar */}
        <MachineFilterBar
          onFiltersChange={setFilters}
          departments={[...new Set(machines.map((m) => m.department))]}
          isLoading={loading}
        />

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-sm">
            {error}
          </div>
        )}

        {/* Loading State */}
        {loading && machines.length === 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg border border-gray-200 p-4 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                <div className="h-3 bg-gray-100 rounded w-1/2 mb-4" />
                <div className="h-2 bg-gray-100 rounded w-full mb-4" />
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredMachines.length === 0 && !error && (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <p className="text-gray-600 mb-4">
              {machines.length === 0 ? 'No machines registered yet' : 'No machines match your filters'}
            </p>
            {canCreateMachine && machines.length === 0 && (
              <Link
                to="/app/machines/new"
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Add First Machine
              </Link>
            )}
            {machines.length > 0 && filteredMachines.length === 0 && (
              <button
                onClick={() => setFilters({})}
                className="text-blue-600 hover:text-blue-800 font-medium text-sm"
              >
                Clear Filters
              </button>
            )}
          </div>
        )}

        {/* Desktop: Table View */}
        {!loading && filteredMachines.length > 0 && isDesktop && (
          <div className="bg-white rounded-lg border border-gray-200">
            <MachineListTable
              machines={filteredMachines}
              onEdit={(machine) => navigate(`/app/machines/${machine.id}/edit`)}
            />
          </div>
        )}

        {/* Mobile: Card View */}
        {!loading && filteredMachines.length > 0 && !isDesktop && (
          <div className="grid grid-cols-1 gap-4">
            {filteredMachines.map((machine) => (
              <MachineCard key={machine.id} machine={machine} />
            ))}
          </div>
        )}

        {/* Load More Button */}
        {!loading && hasMore && (
          <div className="flex justify-center pt-4">
            <button
              onClick={loadMore}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium text-sm"
            >
              Load More
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
