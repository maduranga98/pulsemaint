import { useTranslation } from 'react-i18next';
import type { ShiftStatsAuto } from '@/types/handover.types';
import ShiftStatsGrid from '../ShiftStatsGrid';

interface Section1AutoStatsProps {
  stats: ShiftStatsAuto | null;
}

export function Section1AutoStats({ stats }: Section1AutoStatsProps) {
  const { t } = useTranslation();
  return (
    <section className="space-y-3">
      <div className="rounded-lg bg-[#0A1628] px-4 py-3 text-white">
        <h2 className=" font-bold">{t('common.shiftHandovers.createForm.section1AutoStats.title')}</h2>
        <p className="text-sm text-slate-300">{t('common.shiftHandovers.createForm.section1AutoStats.subtitle')}</p>
      </div>
      {stats ? <ShiftStatsGrid stats={stats} /> : <div className="rounded-lg border border-slate-200 bg-white p-6 text-slate-500">{t('common.shiftHandovers.createForm.section1AutoStats.emptyState')}</div>}
    </section>
  );
}

export default Section1AutoStats;
