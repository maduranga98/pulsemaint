import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePMSchedules } from '../../hooks/pm/usePMSchedules';
import { useMachines } from '../../hooks/useMachines';
import { useAuthStore } from '../../store/authStore';
import { usePMStore } from '../../store/pm.store';
import { PMScheduleList } from '../../components/pm/PMScheduleList';
import { PMScheduleCard } from '../../components/pm/PMScheduleCard';
import { PMFilterBar } from '../../components/pm/PMFilterBar';
import { useToast } from '../../hooks/useToast';

export default function PMSchedulesPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const company = useAuthStore((s) => s.company);
  const isSupervisor = useAuthStore((s) => s.isSupervisor || s.isAdmin);

  const filters = usePMStore((s) => s.filters);
  const setFilters = usePMStore((s) => s.setFilters);

  const { schedules, loading, bulkUpdateStatus, bulkDelete } =
    usePMSchedules({ companyId: company?.id || '', filters });
  const { machines } = useMachines({ siteId: company?.id || '' });

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  const technicianOptions = useMemo(() => {
    const techMap = new Map<string, string>();
    schedules.forEach((s) => {
      s.assignedTechnicianIds.forEach((id, idx) => {
        techMap.set(id, s.assignedTechnicianNames[idx] || id);
      });
    });
    return Array.from(techMap.entries()).map(([id, name]) => ({ id, name }));
  }, [schedules]);

  const handleSelect = (id: string, selected: boolean) => {
    setSelectedIds((prev) => (selected ? [...prev, id] : prev.filter((sid) => sid !== id)));
  };

  const handleSelectAll = (selected: boolean) => {
    setSelectedIds(selected ? schedules.map((s) => s.id) : []);
  };

  const handleBulkAction = async (action: 'pause' | 'activate' | 'archive' | 'delete') => {
    if (selectedIds.length === 0) return;
    try {
      switch (action) {
        case 'pause':
          await bulkUpdateStatus(selectedIds, 'paused');
          toast.success(`${selectedIds.length} schedules paused`);
          break;
        case 'activate':
          await bulkUpdateStatus(selectedIds, 'active');
          toast.success(`${selectedIds.length} schedules activated`);
          break;
        case 'archive':
          await bulkUpdateStatus(selectedIds, 'archived');
          toast.success(`${selectedIds.length} schedules archived`);
          break;
        case 'delete':
          if (confirm('Are you sure? This cannot be undone.')) {
            await bulkDelete(selectedIds);
            toast.success(`${selectedIds.length} schedules deleted`);
          }
          break;
      }
      setSelectedIds([]);
    } catch (err) {
      toast.error('Bulk action failed');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">PM Schedules</h1>
          <p className="text-sm text-gray-500">{schedules.length} schedules</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                viewMode === 'table' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
              }`}
            >
              Table
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                viewMode === 'cards' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
              }`}
            >
              Cards
            </button>
          </div>
          {isSupervisor && (
            <button
              onClick={() => navigate('/app/pm-schedules/create')}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              + New PM Schedule
            </button>
          )}
        </div>
      </div>

      <PMFilterBar
        filters={filters}
        onChange={setFilters}
        machines={machines.map((m) => ({ id: m.id, name: m.name }))}
        technicians={technicianOptions}
      />

      {selectedIds.length > 0 && (
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
          <span className="text-sm text-blue-800">{selectedIds.length} selected</span>
          <div className="flex-1" />
          <button onClick={() => handleBulkAction('pause')} className="text-xs text-blue-700 hover:text-blue-900 font-medium">
            Pause
          </button>
          <button onClick={() => handleBulkAction('activate')} className="text-xs text-blue-700 hover:text-blue-900 font-medium">
            Activate
          </button>
          <button onClick={() => handleBulkAction('archive')} className="text-xs text-blue-700 hover:text-blue-900 font-medium">
            Archive
          </button>
          <button onClick={() => handleBulkAction('delete')} className="text-xs text-red-600 hover:text-red-800 font-medium">
            Delete
          </button>
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-gray-400">Loading schedules...</div>
      ) : viewMode === 'table' ? (
        <div className="hidden sm:block">
          <PMScheduleList
            schedules={schedules}
            selectedIds={selectedIds}
            onSelect={handleSelect}
            onSelectAll={handleSelectAll}
          />
        </div>
      ) : null}

      {(viewMode === 'cards' || (viewMode === 'table' && typeof window !== 'undefined' && window.innerWidth < 640)) && (
        <div className="grid grid-cols-1 gap-3 sm:hidden">
          {schedules.map((s) => (
            <PMScheduleCard
              key={s.id}
              schedule={s}
              selected={selectedIds.includes(s.id)}
              onSelect={handleSelect}
            />
          ))}
        </div>
      )}

      {/* Mobile fallback when viewMode=table but on small screen */}
      {viewMode === 'table' && schedules.length > 0 && (
        <div className="sm:hidden grid grid-cols-1 gap-3">
          {schedules.map((s) => (
            <PMScheduleCard
              key={s.id}
              schedule={s}
              selected={selectedIds.includes(s.id)}
              onSelect={handleSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}
