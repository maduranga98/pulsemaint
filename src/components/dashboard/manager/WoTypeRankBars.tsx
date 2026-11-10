import { useTranslation } from 'react-i18next';
import DashboardWidget from '../shared/DashboardWidget';
import EmptyState from '../shared/EmptyState';
import { useWoTypeDistribution } from '../../../hooks/dashboard/useWoTypeDistribution';

const LABELS: Record<string, string> = {
  BREAKDOWN: 'Breakdown (CM)', CORRECTIVE: 'Corrective', PREVENTIVE: 'Preventive (PM)', INSTALLATION: 'Installation',
  MODIFICATION: 'Modification', INSPECTION: 'Inspection', CONTRACTOR: 'Contractor', OTHER: 'Other',
};

/** Work order types ranked, each as a bar that fills from the left with its count on the right. */
export default function WoTypeRankBars({ companyId, months }: { companyId: string; months?: string[] }) {
  const { t } = useTranslation();
  const { data, loading } = useWoTypeDistribution(companyId, months);
  const rows = data.slice().sort((a, b) => b.count - a.count);
  const top = Math.max(1, ...rows.map((r) => r.count));

  return (
    <DashboardWidget title={t('common.analytics.charts.rankTitle', { defaultValue: 'Work orders by type' })} loading={loading}>
      {rows.length === 0 ? (
        <EmptyState message={t('common.widgets.woTypeDistributionChart.empty')} />
      ) : (
        <ul className="rank-bars">
          {rows.map((r, i) => (
            <li key={r.type} style={{ ['--i' as string]: i }}>
              <span className="rank-name">{LABELS[r.type] ?? r.type}</span>
              <span className="rank-track"><i style={{ width: `${(r.count / top) * 100}%` }} /></span>
              <b className="rank-value">{r.count}</b>
            </li>
          ))}
        </ul>
      )}
    </DashboardWidget>
  );
}
