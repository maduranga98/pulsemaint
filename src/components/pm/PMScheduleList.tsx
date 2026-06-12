import { useNavigate } from 'react-router-dom';
import type { PMSchedule } from '../../types/pm.types';
import { PMOperationalStatusBadge } from './PMStatusBadge';
import { PMPriorityBadge } from './PMPriorityBadge';
import { PM_TYPE_CONFIG, RECURRENCE_TYPE_LABELS } from '../../constants/pmConfig';
import { getPMOperationalStatus, getDaysUntilDue } from '../../utils/pm.utils';

interface PMScheduleListProps {
  schedules: PMSchedule[];
  selectedIds: string[];
  onSelect: (id: string, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
}

export function PMScheduleList({ schedules, selectedIds, onSelect, onSelectAll }: PMScheduleListProps) {
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
              <th className="px-4 py-3 text-left font-medium text-gray-700">Trigger</th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">Next Due</th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">Technician</th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">Status</th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">Compliance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {schedules.map((schedule) => {
              const opStatus = getPMOperationalStatus(schedule);
              const daysUntilDue = getDaysUntilDue(schedule.nextDueDate);

              return (
                <tr
                  key={schedule.id}
                  onClick={() => navigate(`/app/pm-schedules/${schedule.id}`)}
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
                    <PMPriorityBadge priority={schedule.priority} size="sm" />
                  </td>
                  <td className="px-4 py-3 text-gray-600">{schedule.machineName}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1">
                      <span>{PM_TYPE_CONFIG[schedule.pmType].icon}</span>
                      <span className="text-gray-600">{PM_TYPE_CONFIG[schedule.pmType].label}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {schedule.triggerType === 'calendar'
                      ? RECURRENCE_TYPE_LABELS[schedule.recurrenceType]
                      : `${schedule.triggerAfterValue} ${schedule.triggerUnit?.replace('_', ' ')}`}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-gray-600">
                      {daysUntilDue < 0 ? (
                        <span className="text-red-600 font-medium">{Math.abs(daysUntilDue)}d overdue</span>
                      ) : daysUntilDue === 0 ? (
                        <span className="text-amber-600 font-medium">Due today</span>
                      ) : (
                        <span>{daysUntilDue}d</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {(schedule.assignedTechnicianNames ?? []).join(', ') || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <PMOperationalStatusBadge status={opStatus} size="sm" />
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`font-semibold ${
                        schedule.complianceRate >= 90
                          ? 'text-emerald-600'
                          : schedule.complianceRate >= 70
                          ? 'text-amber-600'
                          : 'text-red-600'
                      }`}
                    >
                      {schedule.complianceRate}%
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
