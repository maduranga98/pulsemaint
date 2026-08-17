import { useNavigate } from 'react-router-dom';
import DashboardWidget from '../shared/DashboardWidget';
import EmptyState from '../shared/EmptyState';
import { useAuthStore } from '../../../store/authStore';
import { useMyAssignments } from '../../../hooks/training/useMyAssignments';
import { useSafetyTrainingModules, isSafetyAssignment } from '../../../hooks/training/useSafetyTrainings';
import { useCompanyModuleIds } from '../../../hooks/training/useModuleIds';
import { formatDate } from '../../../lib/dateUtils';
import { useTranslation } from 'react-i18next';

const STATUS_KEYS: Record<string, string> = {
  not_started: 'notStarted',
  in_progress: 'inProgress',
  quiz_passed: 'quizPassed',
  quiz_failed: 'quizFailed',
  awaiting_practical: 'awaitingPractical',
  expired: 'expired',
  retraining_required: 'retrainingRequired',
};

// My non-safety training assignments, excluding ones I've already been
// certified on (safety trainings get their own widget, see
// MySafetyTrainingsWidget).
export default function MyTrainingsWidget() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const companyId = useAuthStore((s) => s.userProfile?.companyId);
  const { moduleIds: safetyModuleIds, loading: safetyModulesLoading } = useSafetyTrainingModules(companyId);
  const { moduleIds: allModuleIds, loading: allModulesLoading } = useCompanyModuleIds(companyId);
  const { assignments, loading: assignmentsLoading } = useMyAssignments();

  // Excludes assignments whose module has since been deleted — those can
  // never actually open (they dead-end on "Module not found"), so they're
  // left off the dashboard rather than shown as a clickable item that fails.
  const pending = assignments.filter(
    (a) =>
      a.status !== 'certified' &&
      !isSafetyAssignment(a, safetyModuleIds, a.moduleId) &&
      allModuleIds.has(a.moduleId),
  );
  const loading = safetyModulesLoading || allModulesLoading || assignmentsLoading;

  return (
    <DashboardWidget title={t('common.widgets.myTrainingsWidget.title')} loading={loading}>
      {pending.length === 0 ? (
        <EmptyState message={t('common.widgets.myTrainingsWidget.empty')} />
      ) : (
        <div className="space-y-2">
          {pending.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => navigate(`/app/training/my-modules/${a.id}`)}
              className="w-full flex items-center justify-between gap-3 px-3 py-2.5 bg-[#0A1628] rounded-lg border border-[#1E3A5F] text-left hover:border-[#1A56DB] transition-colors"
            >
              <div className="min-w-0">
                <p className="text-sm text-[#F0F4F8] truncate">{a.moduleName}</p>
                {a.dueDate && (
                  <p className={`text-[10px] mt-0.5 ${a.dueDate.toMillis() < Date.now() ? 'text-[#EF4444]' : 'text-[#8BA3BF]'}`}>
                    {t('common.widgets.common.due', { date: formatDate(a.dueDate.toDate()) })}
                  </p>
                )}
              </div>
              <span className="shrink-0 px-2 py-0.5 rounded text-[11px] font-medium bg-[#1E3A5F] text-[#8BA3BF]">
                {a.status === 'not_started' ? t('common.widgets.common.start') : a.status === 'in_progress' ? t('common.widgets.common.resume') : (STATUS_KEYS[a.status] ? t(`common.widgets.common.trainingStatus.${STATUS_KEYS[a.status]}`) : a.status)}
              </span>
            </button>
          ))}
        </div>
      )}
    </DashboardWidget>
  );
}
