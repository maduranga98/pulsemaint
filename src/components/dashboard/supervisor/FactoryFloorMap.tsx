import DashboardWidget from '../shared/DashboardWidget';
import MachineHealthCell from './MachineHealthCell';
import { useMachineHealthMap } from '../../../hooks/dashboard/useMachineHealthMap';
import { useDashboardStore } from '../../../store/dashboard.store';
import EmptyState from '../shared/EmptyState';

interface FactoryFloorMapProps {
  companyId: string;
}

export default function FactoryFloorMap({ companyId }: FactoryFloorMapProps) {
  const { machines, loading, error } = useMachineHealthMap(companyId);
  const setSidePanel = useDashboardStore((s) => s.setSidePanel);

  const handleMachineClick = (machineId: string) => {
    setSidePanel({ type: 'machine', id: machineId });
  };

  return (
    <DashboardWidget
      title="Factory Floor Map"
      loading={loading}
      error={error}
      action={
        <span className="text-xs text-[#8BA3BF]">
          {machines.length} machines
        </span>
      }
    >
      {machines.length === 0 ? (
        <EmptyState message="No machine data" subMessage="Machine health records will appear here." />
      ) : (
        <div className="grid grid-cols-6 sm:grid-cols-8 lg:grid-cols-10 gap-2 max-h-[300px] overflow-y-auto p-1">
          {machines.map((m) => (
            <MachineHealthCell
              key={m.machineId}
              machine={m}
              onClick={handleMachineClick}
            />
          ))}
        </div>
      )}
    </DashboardWidget>
  );
}
