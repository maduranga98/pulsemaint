import { useTranslation } from 'react-i18next';
import type { ShiftHandover } from '@/types/handover.types';

interface HandoverTimelineProps {
  handover: ShiftHandover;
}

export function HandoverTimeline({ handover }: HandoverTimelineProps) {
  const { t } = useTranslation();
  const items = [
    [t('common.shiftHandovers.timeline.shiftStart'), handover.shiftActualStart],
    [t('common.shiftHandovers.timeline.handoverSubmitted'), handover.handoverSubmittedAt],
    [t('common.shiftHandovers.timeline.handoverAccepted'), handover.handoverAcceptedAt],
  ] as const;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className=" font-bold text-slate-950">{t('common.shiftHandovers.timeline.title')}</h2>
      <div className="mt-4 space-y-3">
        {items.map(([label, date]) => (
          <div key={label} className="flex gap-3">
            <span className="mt-1 h-2 w-2 rounded-full bg-cyan-500" />
            <div>
              <p className="text-sm font-semibold text-slate-900">{label}</p>
              <p className="text-xs text-slate-500">{date ? date.toLocaleString() : '-'}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default HandoverTimeline;
