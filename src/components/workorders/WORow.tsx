import { HardHat } from 'lucide-react';
import type { WorkOrder } from '../../types/workOrder';
import { WO_PRIORITY_CONFIG } from '../../constants/woConfig';
import { WOStatusBadge } from './WOStatusBadge';
import { SLACountdownTimer } from './SLACountdownTimer';

interface WORowProps {
  workOrder: WorkOrder;
  onClick: (wo: WorkOrder) => void;
}

export function WORow({ workOrder, onClick }: WORowProps) {
  const priorityConfig = WO_PRIORITY_CONFIG[workOrder.priority];
  const maxAvatars = 3;
  const extraTechs = workOrder.assignedTechnicianNames.length - maxAvatars;

  return (
    <button
      type="button"
      onClick={() => onClick(workOrder)}
      className={`w-full text-left flex items-center gap-4 px-4 py-3 border-l-4 ${priorityConfig.borderClass} hover:bg-gray-50 transition-colors focus-visible:ring-2 focus-visible:ring-blue-500`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-gray-900 text-sm truncate">{workOrder.woNumber || ''}</p>
          {workOrder.woType === 'CONTRACTOR' && (
            <span className="inline-flex items-center gap-1 text-xs text-indigo-600 font-medium">
              <HardHat className="w-3 h-3" /> Contractor
            </span>
          )}
        </div>
        <p className="text-sm text-gray-700 truncate">{workOrder.machineName}</p>
      </div>

      <p className="hidden sm:block text-xs text-gray-400 truncate w-40 shrink-0">
        {workOrder.machineLocation}
      </p>

      <div className="shrink-0">
        <SLACountdownTimer slaDeadline={workOrder.slaDeadline} status={workOrder.status} />
      </div>

      <div className="flex -space-x-1.5 shrink-0">
        {workOrder.assignedTechnicianNames.slice(0, maxAvatars).map((name, i) => (
          <span
            key={i}
            title={name}
            className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 ring-2 ring-white text-white text-xs font-bold"
          >
            {name[0]?.toUpperCase()}
          </span>
        ))}
        {extraTechs > 0 && (
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 ring-2 ring-white text-gray-600 text-xs font-bold">
            +{extraTechs}
          </span>
        )}
      </div>

      <div className="shrink-0">
        <WOStatusBadge status={workOrder.status} size="sm" />
      </div>
    </button>
  );
}
