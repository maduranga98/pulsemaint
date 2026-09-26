import { useMemo } from 'react';
import { Building2, Clock, Users } from 'lucide-react';
import DashboardWidget from '../shared/DashboardWidget';
import EmptyState from '../shared/EmptyState';
import { useLiveShiftStatus } from '../../../hooks/useLiveShiftStatus';
import { useDepartmentScope } from '../../../hooks/useDepartmentScope';
import { usePlants } from '../../../hooks/usePlants';
import { groupWorkingByDepartment } from '../../../lib/liveShiftGroups';
import { useTranslation } from 'react-i18next';

interface Props {
  companyId: string;
}

function formatSince(date: Date | null, t: (key: string, opts?: Record<string, unknown>) => string): string {
  if (!date) return '';
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();
  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (isToday) return t('common.widgets.liveShiftStatusWidget.sinceTime', { time });
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const dayLabel =
    date.toDateString() === yesterday.toDateString()
      ? t('common.widgets.liveShiftStatusWidget.yesterday')
      : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  return t('common.widgets.liveShiftStatusWidget.sinceDayTime', { day: dayLabel, time });
}

// Manager-dashboard companion to the full ShiftStatusPanel on the Shift
// Handovers page — only the people clocked in right now, grouped by their
// department (people with no department last), each tagged with the shift
// they're on. Follows the plant tab by each person's own plant (see
// groupWorkingByDepartment); on "All Plants" each row also names the plant.
export default function LiveShiftStatusWidget({ companyId }: Props) {
  const { t } = useTranslation();
  const { rows, loading } = useLiveShiftStatus(companyId);
  const { plantId } = useDepartmentScope();
  const { plants } = usePlants(companyId);
  const plantName = useMemo(() => new Map(plants.map((p) => [p.id, p.name])), [plants]);

  const groups = useMemo(() => groupWorkingByDepartment(rows, plantId), [rows, plantId]);
  const totalWorking = groups.reduce((sum, g) => sum + g.people.length, 0);

  return (
    <DashboardWidget
      title={t('common.widgets.liveShiftStatusWidget.title')}
      loading={loading}
      live
      action={<span className="text-xs text-[#8BA3BF]">{t('common.widgets.liveShiftStatusWidget.workingNow', { count: totalWorking })}</span>}
    >
      {groups.length === 0 ? (
        <EmptyState message={t('common.widgets.liveShiftStatusWidget.empty')} />
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <div key={g.department ?? '__none__'}>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#8BA3BF]">
                  <Building2 className="h-3.5 w-3.5" />
                  {g.department ?? t('common.widgets.liveShiftStatusWidget.noDepartment')}
                </h4>
                <span className="text-[10px] text-[#8BA3BF]">
                  {t('common.widgets.liveShiftStatusWidget.workingNow', { count: g.people.length })}
                </span>
              </div>
              <div className="space-y-1.5">
                {g.people.map((m) => (
                  <div
                    key={m.id}
                    className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg border border-[#10B981]/30 bg-[#10B981]/10 px-3 py-2"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="h-2 w-2 shrink-0 rounded-full bg-[#10B981]" />
                      <span className="truncate text-sm font-medium text-[#F0F4F8]">{m.name}</span>
                      {m.role && (
                        <span className="shrink-0 whitespace-nowrap text-xs capitalize text-[#8BA3BF]">
                          {m.role.replace(/_/g, ' ')}
                        </span>
                      )}
                      {!plantId && m.plantId && plantName.get(m.plantId) && (
                        <span className="shrink-0 whitespace-nowrap rounded bg-[#142849] px-1.5 py-0.5 text-[10px] text-[#B8C7DB]">
                          {plantName.get(m.plantId)}
                        </span>
                      )}
                    </span>
                    <span className="flex shrink-0 items-center gap-2 text-[11px]">
                      <span className="flex items-center gap-1 whitespace-nowrap text-[#8BA3BF]">
                        <Clock className="h-3 w-3" style={{ color: m.shiftColor || '#1A56DB' }} />
                        {m.shiftName}
                      </span>
                      <span className="font-medium text-[#10B981]">{formatSince(m.workingSince, t)}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className="flex items-center gap-1.5 border-t border-[#1E3A5F] pt-3 text-[11px] text-[#8BA3BF]">
            <Users className="h-3 w-3" />
            {t('common.widgets.liveShiftStatusWidget.footerDepartments', { departments: groups.length, people: totalWorking })}
          </div>
        </div>
      )}
    </DashboardWidget>
  );
}
