import DashboardWidget from '../shared/DashboardWidget';
import { useTechnicianStatuses } from '../../../hooks/dashboard/useTechnicianStatuses';
import { usePlantUserIds } from '../../../hooks/usePlantUserIds';
import { useDepartmentScope } from '../../../hooks/useDepartmentScope';
import TechnicianStatusRow from './TechnicianStatusRow';
import EmptyState from '../shared/EmptyState';
import { useTranslation } from 'react-i18next';

interface TechnicianStatusListProps {
  companyId: string;
}

export default function TechnicianStatusList({ companyId }: TechnicianStatusListProps) {
  const { t } = useTranslation();
  const { technicians: allTechnicians, loading, error } = useTechnicianStatuses(companyId);
  // Team Status: technicians and trainees on shift right now, in the
  // supervisor's own plant and department (plant managers / admins: the
  // whole plant — they aren't department-scoped).
  const { department } = useDepartmentScope();
  const plantUserIds = usePlantUserIds(companyId, { department });
  const technicians = plantUserIds ? allTechnicians.filter((tech) => plantUserIds.has(tech.userId)) : allTechnicians;

  const sorted = [...technicians].sort((a, b) => {
    const order = { on_job: 0, available: 1, on_break: 2, off_shift: 3 };
    return (order[a.currentStatus] ?? 99) - (order[b.currentStatus] ?? 99);
  });

  return (
    <DashboardWidget
      title={t('common.widgets.technicianStatusList.title')}
      live
      loading={loading}
      error={error}
      action={
        <span className="text-xs text-[#8BA3BF]">
          {t('common.widgets.technicianStatusList.active', { count: technicians.filter((tech) => tech.currentStatus !== 'off_shift').length })}
        </span>
      }
    >
      {sorted.length === 0 ? (
        <EmptyState message={t('common.widgets.technicianStatusList.empty')} />
      ) : (
        <div className="max-h-[320px] overflow-y-auto -mx-5 divide-y divide-[#1E3A5F]/50">
          {sorted.map((t) => (
            <TechnicianStatusRow key={t.userId} technician={t} />
          ))}
        </div>
      )}
    </DashboardWidget>
  );
}
