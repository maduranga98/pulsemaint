import { useTranslation } from 'react-i18next';
import type { OngoingBreakdownSnapshot } from '@/types/handover.types';
import BreakdownSnapshotRow from '../BreakdownSnapshotRow';

interface Section4OngoingBreakdownsProps {
  items: OngoingBreakdownSnapshot[];
  onChange: (items: OngoingBreakdownSnapshot[]) => void;
}

export function Section4OngoingBreakdowns({ items, onChange }: Section4OngoingBreakdownsProps) {
  const { t } = useTranslation();
  return (
    <section className="space-y-3">
      <div className="rounded-lg bg-[#0A1628] px-4 py-3 text-white">
        <h2 className=" font-bold">{t('common.shiftHandovers.createForm.section4OngoingBreakdowns.title')}</h2>
        <p className="text-sm text-slate-300">{t('common.shiftHandovers.createForm.section4OngoingBreakdowns.subtitle')}</p>
      </div>
      {items.length ? items.map((breakdown, index) => (
        <BreakdownSnapshotRow
          key={breakdown.ticketId}
          breakdown={breakdown}
          onChange={(updates) => onChange(items.map((item, itemIndex) => itemIndex === index ? { ...item, ...updates } : item))}
        />
      )) : <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-slate-500">{t('common.shiftHandovers.createForm.section4OngoingBreakdowns.empty')}</div>}
    </section>
  );
}

export default Section4OngoingBreakdowns;
