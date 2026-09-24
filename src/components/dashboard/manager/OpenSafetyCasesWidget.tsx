import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import DashboardWidget from '../shared/DashboardWidget';
import EmptyState from '../shared/EmptyState';
import { useSafetyCases } from '../../../hooks/safety/useSafety';
import { useDepartmentScope } from '../../../hooks/useDepartmentScope';

const SEVERITY_COLOR: Record<string, string> = {
  critical: '#EF4444',
  high: '#F59E0B',
  medium: '#EAB308',
  low: '#10B981',
};

const STATUS_LABEL: Record<string, string> = {
  open: 'Open',
  investigating: 'Investigating',
};

export default function OpenSafetyCasesWidget({ companyId }: { companyId: string }) {
  const { t } = useTranslation();
  const { cases, loading } = useSafetyCases(companyId);
  const { plantId } = useDepartmentScope();
  const openCases = useMemo(
    () => cases.filter((c) => c.status !== 'closed' && (!plantId || c.plantId === plantId)),
    [cases, plantId],
  );

  return (
    <DashboardWidget
      title={t('common.dashboard.safetyCases.title')}
      loading={loading}
      live
      action={<span className="text-xs text-[#8BA3BF]">{t('common.dashboard.safetyCases.today', { count: openCases.length })}</span>}
    >
      {openCases.length === 0 ? (
        <EmptyState message={t('common.dashboard.safetyCases.empty')} />
      ) : (
        <div className="space-y-1.5">
          {openCases.map((c) => {
            const color = SEVERITY_COLOR[c.severity] ?? '#8BA3BF';
            return (
              <div
                key={c.id}
                className="flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left"
                style={{ backgroundColor: `${color}12`, borderColor: `${color}40` }}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#F0F4F8]">{c.title}</p>
                  <p className="truncate text-[11px] text-[#8BA3BF] capitalize">{c.type.replace(/_/g, ' ')}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <span className="rounded-full bg-[#1E3A5F] px-2 py-0.5 text-[10px] font-semibold uppercase text-[#8BA3BF]">
                    {STATUS_LABEL[c.status] ?? c.status}
                  </span>
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase" style={{ color, backgroundColor: `${color}20` }}>
                    {c.severity}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </DashboardWidget>
  );
}
