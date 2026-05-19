import { Link } from 'react-router-dom';
import type { Machine } from '../../types/machine';
import { MachineStatusBadge } from './MachineStatusBadge';
import { MachineCriticalityBadge } from './MachineCriticalityBadge';
import { MachineHealthScore } from './MachineHealthScore';
import { formatDistanceToNow, formatDate } from '../../lib/dateUtils';

interface MachineCardProps {
  machine: Machine;
}

export function MachineCard({ machine }: MachineCardProps) {
  const lastServiceDate = machine.lastServiceDate
    ? formatDistanceToNow(machine.lastServiceDate.toDate?.() || new Date((machine.lastServiceDate as any).seconds * 1000))
    : 'Never';

  return (
    <Link to={`/machines/${machine.id}`}>
      <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
        {/* Header: Machine name + Status */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900">{machine.name}</h3>
            <p className="text-sm text-gray-600">{machine.model}</p>
          </div>
          <div>
            <MachineStatusBadge status={machine.status} size="sm" />
          </div>
        </div>

        {/* Serial Number */}
        {machine.serialNumber && (
          <p className="text-xs text-gray-500 mb-2">SN: {machine.serialNumber}</p>
        )}

        {/* Location */}
        <div className="text-sm text-gray-600 mb-3">
          {machine.department}
          {machine.floor && ` · Floor ${machine.floor}`}
          {machine.bay && ` · Bay ${machine.bay}`}
        </div>

        {/* Health Score */}
        <div className="mb-4">
          <MachineHealthScore score={machine.healthScore} variant="compact" />
        </div>

        {/* Footer: Metadata badges */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-100 text-xs text-gray-600">
          <MachineCriticalityBadge criticality={machine.criticality} showLabel={true} size="sm" />
          <div>Last service: {lastServiceDate}</div>
        </div>

        {machine.nextPmDue && (
          <div className="text-xs mt-2 text-amber-600">
            Next PM due: {formatDate(machine.nextPmDue.toDate?.() || new Date((machine.nextPmDue as any).seconds * 1000))}
          </div>
        )}
      </div>
    </Link>
  );
}
