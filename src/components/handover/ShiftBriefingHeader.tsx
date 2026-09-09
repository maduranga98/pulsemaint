import { useTranslation } from 'react-i18next';
import type { ShiftHandover } from '@/types/handover.types';

interface ShiftBriefingHeaderProps {
  handover: ShiftHandover;
}

export function ShiftBriefingHeader({ handover }: ShiftBriefingHeaderProps) {
  const { t } = useTranslation();
  return (
    <header className="rounded-lg border border-cyan-400/30 bg-white/10 p-4 text-white">
      <p className="text-sm font-semibold text-cyan-200">{t('common.shiftHandovers.briefingHeader.title')}</p>
      <h1 className="mt-1 text-2xl font-bold">{handover.shiftName}</h1>
      <p className="mt-2 text-sm text-slate-200">
        {t('common.shiftHandovers.briefingHeader.handoverFrom', {
          name: handover.outgoingSupervisorName,
          time: handover.handoverSubmittedAt.toLocaleString(),
        })}
      </p>
    </header>
  );
}

export default ShiftBriefingHeader;
