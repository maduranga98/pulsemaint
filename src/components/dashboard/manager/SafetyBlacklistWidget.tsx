import { useMemo } from 'react';
import { Ban } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import DashboardWidget from '../shared/DashboardWidget';
import EmptyState from '../shared/EmptyState';
import { useSafetyBlacklist } from '@/hooks/safety/useSafety';
import { BLACKLIST_THRESHOLD, type BlacklistEntityType } from '@/lib/safety/blacklist';

/** Admin/Plant Manager Analytics → Safety tab: who/what is currently blacklisted from WO assignment. */
export default function SafetyBlacklistWidget({ companyId }: { companyId: string }) {
  const { t } = useTranslation();
  const { entries, loading } = useSafetyBlacklist(companyId);
  const blacklisted = useMemo(() => entries.filter((e) => e.isBlacklisted), [entries]);

  const ENTITY_LABEL: Record<BlacklistEntityType, string> = {
    technician: t('common.widgets.safetyBlacklistWidget.entityTypes.technician'),
    contractor: t('common.widgets.safetyBlacklistWidget.entityTypes.contractor'),
    operator: t('common.widgets.safetyBlacklistWidget.entityTypes.operator'),
    machine: t('common.widgets.safetyBlacklistWidget.entityTypes.machine'),
  };

  return (
    <DashboardWidget
      title={t('common.widgets.safetyBlacklistWidget.title', { threshold: BLACKLIST_THRESHOLD })}
      loading={loading}
    >
      {blacklisted.length === 0 ? (
        <EmptyState message={t('common.widgets.safetyBlacklistWidget.empty')} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs uppercase text-gray-400">
                <th className="py-2 pr-3 font-medium">{t('common.widgets.safetyBlacklistWidget.columns.name')}</th>
                <th className="py-2 pr-3 font-medium">{t('common.widgets.safetyBlacklistWidget.columns.type')}</th>
                <th className="py-2 pr-3 font-medium">{t('common.widgets.safetyBlacklistWidget.columns.points')}</th>
                <th className="py-2 pr-3 font-medium">{t('common.widgets.safetyBlacklistWidget.columns.cases')}</th>
              </tr>
            </thead>
            <tbody>
              {blacklisted.map((e) => (
                <tr key={`${e.entityType}:${e.entityId}`} className="border-b border-gray-50 last:border-0">
                  <td className="py-2.5 pr-3 font-medium text-gray-800">{e.entityName}</td>
                  <td className="py-2.5 pr-3 text-gray-600">{ENTITY_LABEL[e.entityType]}</td>
                  <td className="py-2.5 pr-3 font-semibold text-red-600">
                    <span className="inline-flex items-center gap-1"><Ban className="h-3.5 w-3.5" /> {e.points}</span>
                  </td>
                  <td className="py-2.5 pr-3 text-gray-600">{e.caseCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashboardWidget>
  );
}
