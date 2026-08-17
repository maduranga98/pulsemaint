import { useNavigate } from 'react-router-dom';
import { useAssignedTasks } from '../../../hooks/dashboard/useAssignedTasks';
import DashboardWidget from '../shared/DashboardWidget';
import EmptyState from '../shared/EmptyState';
import { useTranslation } from 'react-i18next';

export default function AssignedTasksWidget() {
  const { t } = useTranslation();
  const { trainings, evaluations, audits, workOrders, safetyCases, loading } = useAssignedTasks();
  const navigate = useNavigate();

  const total = trainings.length + evaluations.length + audits.length + workOrders.length + safetyCases.length;

  return (
    <DashboardWidget
      title={t('common.widgets.assignedTasksWidget.title')}
      live
      loading={loading}
      action={<span className="text-xs text-[#8BA3BF]">{t('common.widgets.assignedTasksWidget.pending', { count: total })}</span>}
    >
      {total === 0 ? (
        <EmptyState message={t('common.widgets.assignedTasksWidget.empty')} subMessage={t('common.widgets.assignedTasksWidget.emptySub')} />
      ) : (
        <div className="space-y-4">
          {workOrders.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8BA3BF] mb-1.5">
                {t('common.widgets.assignedTasksWidget.workOrders', { count: workOrders.length })}
              </p>
              <div className="space-y-1">
                {workOrders.slice(0, 5).map((w) => (
                  <button
                    key={w.id}
                    onClick={() => navigate('/app/work-orders')}
                    className="w-full text-left px-3 py-2 rounded-md bg-[#0A1628] hover:bg-[#1E3A5F]/40 text-sm text-[#F0F4F8] truncate"
                  >
                    {w.woNumber} · {w.machineName}{w.woType ? ` · ${w.woType.replace(/_/g, ' ')}` : ''}
                  </button>
                ))}
              </div>
            </div>
          )}

          {audits.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8BA3BF] mb-1.5">
                {t('common.widgets.assignedTasksWidget.audits', { count: audits.length })}
              </p>
              <div className="space-y-1">
                {audits.slice(0, 4).map((a) => (
                  <button
                    key={a.id}
                    onClick={() => navigate('/app/audit')}
                    className="w-full text-left px-3 py-2 rounded-md bg-[#0A1628] hover:bg-[#1E3A5F]/40 text-sm text-[#F0F4F8] truncate"
                  >
                    {a.templateName || t('common.widgets.assignedTasksWidget.audit')} · {a.auditDate}
                  </button>
                ))}
              </div>
            </div>
          )}

          {evaluations.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8BA3BF] mb-1.5">
                {t('common.widgets.assignedTasksWidget.evaluations', { count: evaluations.length })}
              </p>
              <div className="space-y-1">
                {evaluations.slice(0, 4).map((e) => (
                  <button
                    key={e.id}
                    onClick={() => navigate('/app/evaluations')}
                    className="w-full text-left px-3 py-2 rounded-md bg-[#0A1628] hover:bg-[#1E3A5F]/40 text-sm text-[#F0F4F8] truncate"
                  >
                    {e.evaluateeName} · {e.evaluationDate}
                  </button>
                ))}
              </div>
            </div>
          )}

          {safetyCases.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8BA3BF] mb-1.5">
                {t('common.widgets.assignedTasksWidget.safetyCases', { count: safetyCases.length })}
              </p>
              <div className="space-y-1">
                {safetyCases.slice(0, 4).map((c) => (
                  <button
                    key={c.id}
                    onClick={() => navigate('/app/safety/cases')}
                    className="w-full text-left px-3 py-2 rounded-md bg-[#0A1628] hover:bg-[#1E3A5F]/40 text-sm text-[#F0F4F8] truncate"
                  >
                    {c.title} · {c.severity}
                  </button>
                ))}
              </div>
            </div>
          )}

          {trainings.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8BA3BF] mb-1.5">
                {t('common.widgets.assignedTasksWidget.trainings', { count: trainings.length })}
              </p>
              <div className="space-y-1">
                {trainings.slice(0, 4).map((tr) => (
                  <button
                    key={tr.id}
                    onClick={() => navigate('/app/training/my-modules')}
                    className="w-full text-left px-3 py-2 rounded-md bg-[#0A1628] hover:bg-[#1E3A5F]/40 text-sm text-[#F0F4F8] truncate"
                  >
                    {tr.moduleName ?? t('common.widgets.assignedTasksWidget.trainingModule')}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </DashboardWidget>
  );
}
