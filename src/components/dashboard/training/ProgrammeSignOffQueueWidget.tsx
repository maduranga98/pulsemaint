import DashboardWidget from '../shared/DashboardWidget';
import EmptyState from '../shared/EmptyState';
import { useProgrammeSignOffQueue } from '../../../hooks/traineeProgram/useProgrammeSignOffQueue';
import { useProgramAssignments } from '../../../hooks/training/useProgramAssignments';
import { isProgramAssignmentReady } from '../../../lib/training/programmeProgress';
import { useNavigate } from 'react-router-dom';
import { usePlantUserIds } from '../../../hooks/usePlantUserIds';
import { useTranslation } from 'react-i18next';

interface ProgrammeSignOffQueueWidgetProps {
  companyId: string;
}

function formatDate(ts: { toDate?: () => Date } | null | undefined): string {
  if (!ts?.toDate) return '';
  return ts.toDate().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Trainees who have completed every module in their programme and are
// waiting on a recommendation + signature. Two sources feed it: programmes
// built in Trainee Management → Programs (`traineeProgrammes`) and programs
// assigned from the library (`programAssignments`, Trainee Management →
// Assigned). Both used to be tracked, but only the first was listed here.
export default function ProgrammeSignOffQueueWidget({ companyId }: ProgrammeSignOffQueueWidgetProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { programmes: allProgrammes, loading, error } = useProgrammeSignOffQueue(companyId);
  const { programAssignments, moduleAssignmentsById, loading: paLoading } = useProgramAssignments();
  const plantUserIds = usePlantUserIds(companyId);
  const programmes = plantUserIds ? allProgrammes.filter((p) => plantUserIds.has(p.traineeId)) : allProgrammes;
  const assigned = programAssignments.filter((pa) => isProgramAssignmentReady(pa, moduleAssignmentsById));
  const total = programmes.length + assigned.length;

  return (
    <DashboardWidget
      title={t('common.widgets.programmeSignOffQueueWidget.title')}
      loading={loading || paLoading}
      error={error}
      action={<span className="text-xs text-[#8BA3BF]">{t('common.widgets.programmeSignOffQueueWidget.ready', { count: total })}</span>}
    >
      {total === 0 ? (
        <EmptyState message={t('common.widgets.programmeSignOffQueueWidget.empty')} subMessage={t('common.widgets.programmeSignOffQueueWidget.emptySub')} />
      ) : (
        <div className="space-y-2">
          {assigned.map((pa) => (
            <button
              type="button"
              key={`pa-${pa.id}`}
              onClick={() => navigate('/app/training/manage/assignments')}
              className="w-full flex items-center justify-between gap-3 px-3 py-2.5 bg-[#0A1628] rounded-lg border border-[#1E3A5F] text-left hover:border-[#2E5A8F]"
            >
              <div className="min-w-0">
                <p className="text-sm text-[#F0F4F8] truncate">{pa.traineeName}</p>
                <p className="text-[11px] text-[#8BA3BF] truncate">
                  {t('common.widgets.programmeSignOffQueueWidget.programSummary', {
                    program: pa.programName,
                    count: (pa.moduleAssignmentIds ?? []).length,
                    date: formatDate(pa.dueDate),
                  })}
                </p>
              </div>
              <span className="shrink-0 px-2 py-0.5 rounded text-[11px] font-medium bg-[#10B981]/15 text-[#10B981]">
                {t('common.widgets.programmeSignOffQueueWidget.readyToSignOff')}
              </span>
            </button>
          ))}
          {programmes.map((p) => {
            const totalModules = (p.months ?? []).reduce((n, m) => n + (m.moduleIds ?? []).length, 0);
            return (
              <div
                key={p.id}
                className="w-full flex items-center justify-between gap-3 px-3 py-2.5 bg-[#0A1628] rounded-lg border border-[#1E3A5F] text-left"
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
              </div>
            );
          })}
        </div>
      )}
    </DashboardWidget>
  );
}
