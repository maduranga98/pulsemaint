import { useMemo } from 'react';
import DashboardWidget from '../shared/DashboardWidget';
import EmptyState from '../shared/EmptyState';
import { useAssignedTasks } from '../../../hooks/dashboard/useAssignedTasks';
import { useTranslation } from 'react-i18next';

// Store keeper's safety picture on the dashboard, replacing the standalone
// Safety nav tab — just the safety trainings assigned to them (not their
// general training assignments) and the safety cases that have actually
// been reported to them, never the whole company's feed.
export default function SafetyForYouWidget() {
  const { t } = useTranslation();
  const { trainings, safetyCases, loading } = useAssignedTasks();

  const safetyTrainings = useMemo(
    () => trainings.filter((tr) => tr.trainingType === 'safety_training'),
    [trainings],
  );

  const total = safetyTrainings.length + safetyCases.length;

  return (
    <DashboardWidget title={t('common.widgets.safetyForYouWidget.title')} loading={loading} action={<span className="text-xs text-[#8BA3BF]">{t('common.widgets.safetyForYouWidget.open', { count: total })}</span>}>
      {total === 0 ? (
        <EmptyState message={t('common.widgets.safetyForYouWidget.empty')} subMessage={t('common.widgets.safetyForYouWidget.emptySub')} />
      ) : (
        <div className="space-y-4">
          {safetyCases.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8BA3BF] mb-1.5">
                {t('common.widgets.assignedTasksWidget.safetyCases', { count: safetyCases.length })}
              </p>
              <div className="space-y-1">
                {safetyCases.slice(0, 4).map((c) => (
                  <div
                    key={c.id}
                    className="w-full text-left px-3 py-2 rounded-md bg-[#0A1628] text-sm text-[#F0F4F8] truncate"
                  >
                    {c.title} · {c.severity}
                  </div>
                ))}
              </div>
            </div>
          )}

          {safetyTrainings.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8BA3BF] mb-1.5">
                {t('common.widgets.safetyForYouWidget.safetyTrainings', { count: safetyTrainings.length })}
              </p>
              <div className="space-y-1">
                {safetyTrainings.slice(0, 4).map((tr) => (
                  <div
                    key={tr.id}
                    className="w-full text-left px-3 py-2 rounded-md bg-[#0A1628] text-sm text-[#F0F4F8] truncate"
                  >
                    {tr.moduleName ?? t('common.widgets.assignedTasksWidget.trainingModule')}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </DashboardWidget>
  );
}
