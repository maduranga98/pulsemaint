import DashboardWidget from '../shared/DashboardWidget';
import EmptyState from '../shared/EmptyState';
import { useOngoingEvaluationsAndAudits } from '../../../hooks/dashboard/useOngoingEvaluationsAndAudits';
import { useTranslation } from 'react-i18next';

interface OngoingEvaluationsAuditsWidgetProps {
  companyId: string;
}

// Replaces the lifetime "Evaluations, Audit & Triage Activity by Role" chart
// with what's actually in flight right now — draft Evaluations and draft
// Audits that haven't been submitted yet.
export default function OngoingEvaluationsAuditsWidget({ companyId }: OngoingEvaluationsAuditsWidgetProps) {
  const { t } = useTranslation();
  const { evaluations, audits, loading, error, refetch } = useOngoingEvaluationsAndAudits(companyId);
  const total = evaluations.length + audits.length;

  return (
    <DashboardWidget
      title={t('common.widgets.ongoingEvaluationsAuditsWidget.title')}
      loading={loading}
      error={error}
      onRetry={refetch}
      action={<span className="text-xs text-[#8BA3BF]">{t('common.widgets.ongoingEvaluationsAuditsWidget.running', { count: total })}</span>}
    >
      {total === 0 ? (
        <EmptyState message={t('common.widgets.ongoingEvaluationsAuditsWidget.empty')} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <h4 className="text-xs font-medium text-[#8BA3BF] uppercase tracking-wider mb-2">
              {t('common.widgets.ongoingEvaluationsAuditsWidget.evaluations', { count: evaluations.length })}
            </h4>
            {evaluations.length === 0 ? (
              <p className="text-xs text-[#8BA3BF]">{t('common.widgets.ongoingEvaluationsAuditsWidget.noneInProgress')}</p>
            ) : (
              <ul className="space-y-1.5">
                {evaluations.map((row) => (
                  <li key={row.id} className="flex items-center justify-between text-xs">
                    <span className="text-[#F0F4F8] font-medium">{row.name}</span>
                    <span className="text-[#8BA3BF] capitalize">{row.role.replace(/_/g, ' ')}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h4 className="text-xs font-medium text-[#8BA3BF] uppercase tracking-wider mb-2">
              {t('common.widgets.ongoingEvaluationsAuditsWidget.audits', { count: audits.length })}
            </h4>
            {audits.length === 0 ? (
              <p className="text-xs text-[#8BA3BF]">{t('common.widgets.ongoingEvaluationsAuditsWidget.noneInProgress')}</p>
            ) : (
              <ul className="space-y-1.5">
                {audits.map((row) => (
                  <li key={row.id} className="flex items-center justify-between text-xs">
                    <span className="text-[#F0F4F8] font-medium">{row.name}</span>
                    <span className="text-[#8BA3BF] capitalize">{row.role.replace(/_/g, ' ')}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </DashboardWidget>
  );
}
