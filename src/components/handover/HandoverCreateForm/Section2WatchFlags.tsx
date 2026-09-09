import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DraftWatchFlag, WatchFlag } from '@/types/handover.types';
import WatchFlagAddModal from '../WatchFlagAddModal';
import WatchFlagCard from '../WatchFlagCard';

interface Section2WatchFlagsProps {
  flags: DraftWatchFlag[];
  onChange: (flags: DraftWatchFlag[]) => void;
}

function toWatchFlag(flag: DraftWatchFlag, index: number): WatchFlag {
  return {
    ...flag,
    id: `${flag.machineId}-${index}`,
    status: 'active',
    resolvedAt: null,
    resolvedBy: null,
    carriedFromHandoverId: null,
  };
}

export function Section2WatchFlags({ flags, onChange }: Section2WatchFlagsProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-3 rounded-lg bg-[#0A1628] px-4 py-3 text-white sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className=" font-bold">{t('common.shiftHandovers.createForm.section2WatchFlags.title')}</h2>
          <p className="text-sm text-slate-300">{t('common.shiftHandovers.createForm.section2WatchFlags.subtitle')}</p>
        </div>
        <button type="button" onClick={() => setOpen(true)} className="min-h-12 rounded-md bg-blue-600 px-4 py-2 text-sm font-bold text-white">{t('common.shiftHandovers.createForm.section2WatchFlags.addWatchFlag')}</button>
      </div>
      <div className="grid gap-3">
        {flags.length ? flags.map((flag, index) => (
          <WatchFlagCard key={`${flag.machineId}-${index}`} flag={toWatchFlag(flag, index)} />
        )) : <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-slate-500">{t('common.shiftHandovers.createForm.section2WatchFlags.empty')}</div>}
      </div>
      <WatchFlagAddModal open={open} onClose={() => setOpen(false)} onAdd={(flag) => onChange([...flags, flag])} />
    </section>
  );
}

export default Section2WatchFlags;
