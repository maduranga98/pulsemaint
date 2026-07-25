import { useNavigate } from 'react-router-dom';
import type { PMSchedule } from '../../types/pm.types';
import { PMOperationalStatusBadge } from './PMStatusBadge';
import { PMPriorityBadge } from './PMPriorityBadge';
import { WOStatusBadge } from '../workorders/WOStatusBadge';
import { PMTypeBadge } from './PMTypeBadge';
import { getPMOperationalStatus, getDaysUntilDue, calculateComplianceRate } from '../../utils/pm.utils';
import type { PMWorkOrderLookupEntry } from '../../hooks/pm/usePMWorkOrderLookup';

interface PMScheduleListProps {
  schedules: PMSchedule[];
  selectedIds: string[];
  onSelect: (id: string, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
  woLookup?: Map<string, PMWorkOrderLookupEntry>;
}

export function PMScheduleList({ schedules, selectedIds, onSelect, onSelectAll, woLookup }: PMScheduleListProps) {
  const navigate = useNavigate();
  const allSelected = schedules.length > 0 && schedules.every((s) => selectedIds.includes(s.id));

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) => onSelectAll(e.target.checked)}
                  className="rounded border-gray-300"
                />
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">Schedule</th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">Machine</th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">Type</th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">Due Date</th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">Assigned</th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">Status</th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">Compliance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {schedules.map((schedule) => {
              const opStatus = getPMOperationalStatus(schedule);
              const daysUntilDue = getDaysUntilDue(schedule.nextDueDate);
              const dueDateLabel = (
                schedule.nextDueDate instanceof Date
                  ? schedule.nextDueDate
                  : schedule.nextDueDate?.toDate?.()
              )?.toLocaleDateString() ?? '—';

              const linkedWoId = schedule.activeWoId ?? schedule.lastWoId ?? null;
              const linkedWo = linkedWoId ? woLookup?.get(linkedWoId) : undefined;
              const pmType = linkedWo?.pmType ?? schedule.pmType;
              const complianceRate = calculateComplianceRate(
                schedule.completedOnTime,
                schedule.completedLate,
                schedule.missed,
              );

              // Prefer the linked WO's live team — the schedule's own copy is
              // only set at creation and can go stale as assignments change.
              const supervisorName = linkedWo?.supervisorInChargeName ?? schedule.supervisorInChargeName;
              const technicianNames = linkedWo?.assignedTechnicianNames ?? schedule.assignedTechnicianNames ?? [];
              const contractorName = linkedWo?.contractorCompanyName ?? schedule.contractorCompanyName;
              const contractorTechNames = linkedWo?.contractorTechnicianNames ?? schedule.contractorTechnicianNames ?? [];
              const assignedNames = [
                ...(supervisorName ? [`${supervisorName} (Supervisor)`] : []),
                ...technicianNames.map((n) => `${n} (Technician)`),
                ...(contractorName ? [`${contractorName} (Contractor)`] : []),
                ...contractorTechNames.map((n) => `${n} (Contractor Technician)`),
              ];

              const isTerminal = linkedWo
                ? ['COMPLETED', 'SIGNED_OFF', 'CLOSED', 'CANCELLED'].includes(linkedWo.status)
                : false;

              return (
                <tr
                  key={schedule.id}
                  onClick={() =>
                    navigate(
                      linkedWoId
                        ? `/app/work-orders?woId=${linkedWoId}`
                        : `/app/pm-schedules/${schedule.id}`,
                    )
                  }
                  className="hover:bg-gray-50 cursor-pointer"
                >
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(schedule.id)}
                      onChange={(e) => onSelect(schedule.id, e.target.checked)}
                      className="rounded border-gray-300"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{schedule.name}</div>
                    {linkedWo?.woNumber && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/app/work-orders?woId=${linkedWoId}`);
                        }}
                        className="text-xs font-semibold text-blue-600 hover:underline"
                      >
                        {linkedWo.woNumber}
                      </button>
                    )}
                    <div className="mt-1">
                      <PMPriorityBadge priority={schedule.priority} size="sm" />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{schedule.machineName}</td>
                  <td className="px-4 py-3">
                    <PMTypeBadge pmType={pmType} size="sm" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-gray-900">{dueDateLabel}</div>
                    <div className="text-gray-500 text-xs">
                      {isTerminal ? null : daysUntilDue < 0 ? (
                        <span className="text-red-600 font-medium">{Math.abs(daysUntilDue)}d overdue</span>
                      ) : daysUntilDue === 0 ? (
                        <span className="text-amber-600 font-medium">Due today</span>
                      ) : (
                        <span>in {daysUntilDue}d</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {assignedNames.join(', ') || '—'}
                  </td>
                  <td className="px-4 py-3">
                    {linkedWo ? (
                      <WOStatusBadge status={linkedWo.status} size="sm" />
                    ) : (
                      <PMOperationalStatusBadge status={opStatus} size="sm" />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`font-semibold ${
                        complianceRate >= 90
                          ? 'text-emerald-600'
                          : complianceRate >= 70
                          ? 'text-amber-600'
                          : 'text-red-600'
                      }`}
                    >
                      {complianceRate}%
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {schedules.length === 0 && (
        <div className="p-8 text-center text-gray-400 text-sm">
          No PM schedules found.
        </div>
      )}
    </div>
  );
}
