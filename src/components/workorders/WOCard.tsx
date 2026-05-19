import type { WorkOrder } from '../../types/workOrder';
import { WO_PRIORITY_CONFIG } from '../../constants/woConfig';
import { WOTypeBadge } from './WOTypeBadge';
import { WOStatusBadge } from './WOStatusBadge';
import { SLACountdownTimer } from './SLACountdownTimer';

interface WOCardProps {
  workOrder: WorkOrder;
  onClick: (wo: WorkOrder) => void;
}

export function WOCard({ workOrder, onClick }: WOCardProps) {
  const priorityConfig = WO_PRIORITY_CONFIG[workOrder.priority];
  const maxAvatars = 3;
  const extraTechs = workOrder.assignedTechnicianNames.length - maxAvatars;

  return (
    <button
      type="button"
      onClick={() => onClick(workOrder)}
      className={`w-full text-left bg-white rounded-lg shadow-sm border border-gray-100 border-l-4 ${priorityConfig.borderClass} p-4 hover:shadow-md transition-shadow focus-visible:ring-2 focus-visible:ring-blue-500`}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <WOTypeBadge woType={workOrder.woType} size="sm" />
          {workOrder.woType === 'CONTRACTOR' && (
            <span className="text-xs text-indigo-600 font-medium">🤝 Contractor</span>
          )}
        </div>
        <WOStatusBadge status={workOrder.status} size="sm" />
      </div>

      {/* WO Number + Machine */}
      <p className="font-semibold text-gray-900 text-sm truncate">
        {workOrder.woNumber || '—'}
      </p>
      <p className="text-sm text-gray-700 truncate">{workOrder.machineName}</p>
      <p className="text-xs text-gray-400 truncate">{workOrder.machineLocation}</p>

      {/* SLA + Technicians */}
      <div className="mt-3 flex items-center justify-between">
        <SLACountdownTimer slaDeadline={workOrder.slaDeadline} status={workOrder.status} />

        <div className="flex -space-x-1.5">
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
      </div>
    </button>
  );
}
