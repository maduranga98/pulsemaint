import { useTranslation } from 'react-i18next';
import type { LowStockAlert } from '@/types/handover.types';

interface Section5PartsNotesProps {
  lowStockAlerts: LowStockAlert[];
  partsNotes: string;
  onChange: (partsNotes: string) => void;
}

export function Section5PartsNotes({ lowStockAlerts, partsNotes, onChange }: Section5PartsNotesProps) {
  const { t } = useTranslation();
  return (
    <section className="space-y-3">
      <div className="rounded-lg bg-[#0A1628] px-4 py-3 text-white">
        <h2 className=" font-bold">{t('common.shiftHandovers.createForm.section5PartsNotes.title')}</h2>
        <p className="text-sm text-slate-300">{t('common.shiftHandovers.createForm.section5PartsNotes.subtitle')}</p>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="font-semibold text-slate-950">{t('common.shiftHandovers.createForm.section5PartsNotes.lowStockAlerts')}</h3>
          <div className="mt-3 space-y-2">
            {lowStockAlerts.length ? lowStockAlerts.map((part) => (
              <div key={part.partId} className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
                {t('common.shiftHandovers.createForm.section5PartsNotes.alertLine', { name: part.partName, current: part.currentQty, min: part.minQty })}
              </div>
            )) : <p className="text-sm text-slate-500">{t('common.shiftHandovers.createForm.section5PartsNotes.noAlerts')}</p>}
          </div>
        </div>
        <textarea
          value={partsNotes}
          onChange={(event) => onChange(event.target.value)}
          maxLength={2000}
          placeholder={t('common.shiftHandovers.createForm.section5PartsNotes.notesPlaceholder')}
          className="min-h-48 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
        />
      </div>
    </section>
  );
}

export default Section5PartsNotes;
