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
import {
  PageHeader,
  SegmentedControl,
  Button,
  SkeletonList,
  EmptyState,
} from '../../components/ui';

export default function PMSchedulesPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const company = useAuthStore((s) => s.company);
  const isSupervisor = useAuthStore((s) => s.isSupervisor || s.isAdmin);

  const filters = usePMStore((s) => s.filters);
  const setFilters = usePMStore((s) => s.setFilters);

  const { schedules, loading, bulkUpdateStatus, bulkDelete } =
    usePMSchedules({ companyId: company?.id || '', filters });
  const { machines } = useMachines({ siteId: company?.id || '', pageSize: 500 });

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
    } catch {
      toast.error('Bulk action failed');
    }
  };

  return (
    <div>
      <PageHeader
        title="PM Schedules"
        description={`${schedules.length} schedule${schedules.length === 1 ? '' : 's'}`}
        actions={
          <>
            <SegmentedControl<'table' | 'cards'>
              value={viewMode}
              onChange={setViewMode}
              ariaLabel="View mode"
              options={[
                { value: 'table', label: 'Table' },
                { value: 'cards', label: 'Cards' },
              ]}
            />
            {isSupervisor && (
              <Button
                variant="primary"
                onClick={() => navigate('/app/pm-schedules/create')}
              >
                New schedule
              </Button>
            )}
          </>
        }
      />

      <div className="space-y-4">
        <PMFilterBar
          filters={filters}
          onChange={setFilters}
          machines={machines.map((m) => ({ id: m.id, name: m.name }))}
          technicians={technicianOptions}
        />

        {selectedIds.length > 0 && (
          <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-md px-3 py-2">
            <span className="text-[12px] font-medium text-indigo-800">
              {selectedIds.length} selected
            </span>
            <div className="flex-1" />
            <Button size="sm" variant="ghost" onClick={() => handleBulkAction('pause')}>
              Pause
            </Button>
            <Button size="sm" variant="ghost" onClick={() => handleBulkAction('activate')}>
              Activate
            </Button>
            <Button size="sm" variant="ghost" onClick={() => handleBulkAction('archive')}>
              Archive
            </Button>
            <Button size="sm" variant="danger" onClick={() => handleBulkAction('delete')}>
              Delete
            </Button>
          </div>
        )}

        {loading ? (
          <SkeletonList rows={6} rowClassName="h-12" />
        ) : schedules.length === 0 ? (
          <EmptyState
            title="No PM schedules yet"
            description="Create your first preventive maintenance schedule to get started."
            action={
              isSupervisor && (
                <Button
                  variant="primary"
                  onClick={() => navigate('/app/pm-schedules/create')}
                >
                  New schedule
                </Button>
              )
            }
          />
        ) : viewMode === 'table' ? (
          <>
            <div className="hidden sm:block">
              <PMScheduleList
                schedules={schedules}
                selectedIds={selectedIds}
                onSelect={handleSelect}
                onSelectAll={handleSelectAll}
              />
            </div>
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
          </>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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
    </div>
  );
}
