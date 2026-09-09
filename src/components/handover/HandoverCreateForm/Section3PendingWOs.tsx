import { useTranslation } from 'react-i18next';
import type { PendingWOSnapshot } from '@/types/handover.types';
import PendingWORow from '../PendingWORow';

interface Section3PendingWOsProps {
  items: PendingWOSnapshot[];
  onChange: (items: PendingWOSnapshot[]) => void;
}

export function Section3PendingWOs({ items, onChange }: Section3PendingWOsProps) {
  const { t } = useTranslation();
  return (
    <section className="space-y-3">
      <div className="rounded-lg bg-[#0A1628] px-4 py-3 text-white">
        <h2 className=" font-bold">{t('common.shiftHandovers.createForm.section3PendingWOs.title')}</h2>
        <p className="text-sm text-slate-300">{t('common.shiftHandovers.createForm.section3PendingWOs.subtitle')}</p>
      </div>
      {items.length ? items.map((wo, index) => (
        <PendingWORow
          key={wo.woId}
          wo={wo}
          onChange={(updates) => onChange(items.map((item, itemIndex) => itemIndex === index ? { ...item, ...updates } : item))}
        />
      )) : <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-slate-500">{t('common.shiftHandovers.createForm.section3PendingWOs.empty')}</div>}
    </section>
  );
}

export default Section3PendingWOs;
