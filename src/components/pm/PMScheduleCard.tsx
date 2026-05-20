import { useNavigate } from 'react-router-dom';
import type { PMSchedule } from '../../types/pm.types';
import { PMOperationalStatusBadge } from './PMStatusBadge';
import { PMPriorityBadge } from './PMPriorityBadge';
import { PM_TYPE_CONFIG, RECURRENCE_TYPE_LABELS } from '../../constants/pmConfig';
import { getPMOperationalStatus, getDaysUntilDue } from '../../utils/pm.utils';

interface PMScheduleCardProps {
  schedule: PMSchedule;
  selected?: boolean;
  onSelect?: (id: string, selected: boolean) => void;
}

export function PMScheduleCard({ schedule, selected, onSelect }: PMScheduleCardProps) {
  const navigate = useNavigate();
  const opStatus = getPMOperationalStatus(schedule);
  const daysUntilDue = getDaysUntilDue(schedule.nextDueDate);

  const handleClick = () => {
    navigate(`/app/pm-schedules/${schedule.id}`);
  };

  return (
    <div
      onClick={handleClick}
      className={`bg-white rounded-lg border p-4 cursor-pointer hover:shadow-md transition-shadow ${
        selected ? 'border-blue-500 ring-2 ring-blue-100' : 'border-gray-200'
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          {onSelect && (
            <input
              type="checkbox"
              checked={selected}
              onChange={(e) => {
                e.stopPropagation();
                onSelect(schedule.id, e.target.checked);
              }}
              className="rounded border-gray-300"
            />
          )}
          <h3 className="font-semibold text-gray-900 text-sm">{schedule.name}</h3>
        </div>
        <PMPriorityBadge priority={schedule.priority} size="sm" />
      </div>

      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">{PM_TYPE_CONFIG[schedule.pmType].icon}</span>
        <span className="text-xs text-gray-500">{PM_TYPE_CONFIG[schedule.pmType].label}</span>
        <span className="text-gray-300">|</span>
        <span className="text-xs text-gray-500">{schedule.machineName}</span>
      </div>

      <div className="flex items-center justify-between">
        <PMOperationalStatusBadge status={opStatus} size="sm" />
        <div className="text-xs text-gray-500">
          {schedule.triggerType === 'calendar' ? (
            <>
              {daysUntilDue < 0 ? (
                <span className="text-red-600 font-medium">{Math.abs(daysUntilDue)}d overdue</span>
              ) : daysUntilDue === 0 ? (
                <span className="text-amber-600 font-medium">Due today</span>
              ) : (
                <span>{daysUntilDue}d until due</span>
              )}
              {' • '}
              {RECURRENCE_TYPE_LABELS[schedule.recurrenceType]}
            </>
          ) : (
            <span>{schedule.triggerAfterValue} {schedule.triggerUnit?.replace('_', ' ')}</span>
          )}
        </div>
      </div>

      <div className="mt-2 text-xs text-gray-400">
        {schedule.assignedTechnicianNames.join(', ') || 'Unassigned'}
      </div>
    </div>
  );
}
