import KpiCard from '../shared/KpiCard';
import { useHrKpis } from '../../../hooks/dashboard/useHrKpis';
import { useTranslation } from 'react-i18next';

interface HrKpiStripProps {
  companyId: string;
}

/**
 * The HR Officer dashboard's headline strip — people-focused numbers an HR
 * officer acts on day to day (attendance, in-flight training and evaluations,
 * headcount), replacing the machine-certification compliance metrics that
 * previously sat here.
 */
export default function HrKpiStrip({ companyId }: HrKpiStripProps) {
  const { t } = useTranslation();
  const { kpis, loading } = useHrKpis(companyId);

  const cards = [
    { label: t('common.widgets.hrKpiStrip.presentToday'), value: kpis.presentToday, color: (kpis.presentToday > 0 ? 'green' : 'amber') as 'green' | 'amber' },
    { label: t('common.widgets.hrKpiStrip.trainingsInProgress'), value: kpis.trainingsInProgress, color: 'blue' as const },
    { label: t('common.widgets.hrKpiStrip.evaluationsInProgress'), value: kpis.evaluationsInProgress, color: (kpis.evaluationsInProgress > 0 ? 'amber' : 'green') as 'amber' | 'green' },
    { label: t('common.widgets.hrKpiStrip.activeStaff'), value: kpis.activeStaff, color: 'cyan' as const },
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-[#0F1E35] border border-[#1E3A5F] rounded-xl p-5 animate-pulse h-24" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, idx) => (
        <KpiCard key={idx} data={card} />
      ))}
    </div>
  );
}
