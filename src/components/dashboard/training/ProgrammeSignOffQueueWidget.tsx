import { useNavigate } from 'react-router-dom';
import DashboardWidget from '../shared/DashboardWidget';
import EmptyState from '../shared/EmptyState';
import { useProgrammeSignOffQueue } from '../../../hooks/traineeProgram/useProgrammeSignOffQueue';
import { useTranslation } from 'react-i18next';

interface ProgrammeSignOffQueueWidgetProps {
  companyId: string;
}

function formatDate(ts: { toDate?: () => Date } | null | undefined): string {
  if (!ts?.toDate) return '';
  return ts.toDate().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Trainees who have completed every module in their programme and are
// waiting on a recommendation + signature to have their completion
// certificate issued.
export default function ProgrammeSignOffQueueWidget({ companyId }: ProgrammeSignOffQueueWidgetProps) {
  const { t } = useTranslation();
  const { programmes, loading } = useProgrammeSignOffQueue(companyId);
  const navigate = useNavigate();

  return (
    <DashboardWidget
      title={t('common.widgets.programmeSignOffQueueWidget.title')}
      loading={loading}
      action={<span className="text-xs text-[#8BA3BF]">{t('common.widgets.programmeSignOffQueueWidget.ready', { count: programmes.length })}</span>}
    >
      {programmes.length === 0 ? (
        <EmptyState message={t('common.widgets.programmeSignOffQueueWidget.empty')} subMessage={t('common.widgets.programmeSignOffQueueWidget.emptySub')} />
      ) : (
        <div className="space-y-2">
          {programmes.map((p) => {
            const totalModules = p.months.reduce((n, m) => n + m.moduleIds.length, 0);
            return (
              <button
                key={p.id}
                onClick={() => navigate(`/app/training/manage/trainees/${p.traineeId}/programme`)}
                className="w-full flex items-center justify-between gap-3 px-3 py-2.5 bg-[#0A1628] rounded-lg border border-[#1E3A5F] hover:border-[#2E5A8F] transition-colors text-left"
              >
                <div className="min-w-0">
                  <p className="text-sm text-[#F0F4F8] truncate">{p.traineeName}</p>
                  <p className="text-[11px] text-[#8BA3BF]">
                    {t('common.widgets.programmeSignOffQueueWidget.summary', { months: p.durationMonths, count: totalModules, date: formatDate(p.startDate) })}
                  </p>
                </div>
                <span className="shrink-0 px-2 py-0.5 rounded text-[11px] font-medium bg-[#10B981]/15 text-[#10B981]">
                  {t('common.widgets.programmeSignOffQueueWidget.readyToSignOff')}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </DashboardWidget>
  );
}
