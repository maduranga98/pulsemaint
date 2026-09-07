import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { PMSchedule } from '../../types/pm.types';
import { PMOperationalStatusBadge } from './PMStatusBadge';
import { PMPriorityBadge } from './PMPriorityBadge';
import { WOStatusBadge } from '../workorders/WOStatusBadge';
import { PMTypeBadge } from './PMTypeBadge';
import { getPMOperationalStatus, getDaysUntilDue, calculateComplianceRate } from '../../utils/pm.utils';
import type { PMWorkOrderLookupEntry } from '../../hooks/pm/usePMWorkOrderLookup';

interface PMScheduleCardProps {
  schedule: PMSchedule;
  selected?: boolean;
  onSelect?: (id: string, selected: boolean) => void;
  woLookup?: Map<string, PMWorkOrderLookupEntry>;
}

export function PMScheduleCard({ schedule, selected, onSelect, woLookup }: PMScheduleCardProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const opStatus = getPMOperationalStatus(schedule);
  const daysUntilDue = getDaysUntilDue(schedule.nextDueDate);
  const linkedWoId = schedule.activeWoId ?? schedule.lastWoId ?? null;
  const linkedWo = linkedWoId ? woLookup?.get(linkedWoId) : undefined;
  const pmType = linkedWo?.pmType ?? schedule.pmType;
  const complianceRate = calculateComplianceRate(
    schedule.completedOnTime,
    schedule.completedLate,
    schedule.missed,
  );
  const isTerminal = linkedWo
    ? ['COMPLETED', 'SIGNED_OFF', 'CLOSED', 'CANCELLED'].includes(linkedWo.status)
    : false;

  const supervisorName = linkedWo?.supervisorInChargeName ?? schedule.supervisorInChargeName;
  const technicianNames = linkedWo?.assignedTechnicianNames ?? schedule.assignedTechnicianNames ?? [];
  const contractorName = linkedWo?.contractorCompanyName ?? schedule.contractorCompanyName;
  const contractorTechNames = linkedWo?.contractorTechnicianNames ?? schedule.contractorTechnicianNames ?? [];
  const assignedNames = [
    ...(supervisorName ? [t('common.pmSchedules.card.roleSupervisor', { name: supervisorName })] : []),
    ...technicianNames.map((n) => t('common.pmSchedules.card.roleTechnician', { name: n })),
    ...(contractorName ? [t('common.pmSchedules.card.roleContractor', { name: contractorName })] : []),
    ...contractorTechNames.map((n) => t('common.pmSchedules.card.roleContractorTechnician', { name: n })),
  ];

  const handleClick = () => {
    navigate(linkedWoId ? `/app/work-orders?woId=${linkedWoId}` : `/app/pm-schedules/${schedule.id}`);
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

      {linkedWo?.woNumber && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/app/work-orders?woId=${linkedWoId}`);
          }}
          className="mb-2 text-xs font-semibold text-blue-600 hover:underline"
        >
          {linkedWo.woNumber}
        </button>
      )}

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <PMTypeBadge pmType={pmType} size="sm" />
        <span className="text-gray-300">|</span>
        <span className="text-xs text-gray-500">{schedule.machineName}</span>
      </div>

      <div className="flex items-center justify-between">
        {linkedWo ? (
          <WOStatusBadge status={linkedWo.status} size="sm" />
        ) : (
          <PMOperationalStatusBadge status={opStatus} size="sm" />
        )}
        <div className="text-xs text-gray-500">
          {schedule.triggerType === 'calendar' ? (
            <>
              {isTerminal ? null : daysUntilDue < 0 ? (
                <span className="text-red-600 font-medium">{t('common.pmSchedules.card.daysOverdue', { count: Math.abs(daysUntilDue) })}</span>
              ) : daysUntilDue === 0 ? (
                <span className="text-amber-600 font-medium">{t('common.pmSchedules.card.dueToday')}</span>
              ) : (
                <span>{t('common.pmSchedules.card.daysUntilDue', { count: daysUntilDue })}</span>
              )}
              {!isTerminal && ' • '}
              {t(`common.pmSchedules.recurrence.${schedule.recurrenceType}`)}
            </>
          ) : (
            <span>{t('common.pmSchedules.card.triggerAfter', { count: schedule.triggerAfterValue, unit: t(`common.pmSchedules.triggerUnits.${schedule.triggerUnit}`, { defaultValue: schedule.triggerUnit?.replace('_', ' ') }) })}</span>
          )}
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between">
        <div className="text-xs text-gray-400">
          {assignedNames.join(', ') || t('common.pmSchedules.card.unassigned')}
        </div>
        <span
          className={`text-xs font-semibold ${
            complianceRate >= 90
              ? 'text-emerald-600'
              : complianceRate >= 70
              ? 'text-amber-600'
              : 'text-red-600'
          }`}
        >
          {complianceRate}%
        </span>
      </div>
    </div>
  );
}
