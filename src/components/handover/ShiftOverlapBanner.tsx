import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { ShiftHandover } from '@/types/handover.types';

interface ShiftOverlapBannerProps {
  handover: ShiftHandover | null;
  outgoingView?: boolean;
}

export function ShiftOverlapBanner({ handover, outgoingView = false }: ShiftOverlapBannerProps) {
  const { t } = useTranslation();
  if (!handover) return null;
  if (handover.status === 'accepted' && outgoingView) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        {t('common.shiftHandovers.overlapBanner.handedOver', {
          name: handover.incomingSupervisorName,
          time: handover.handoverAcceptedAt?.toLocaleTimeString(),
        })}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
      <span>{t('common.shiftHandovers.overlapBanner.overlapInProgress', { name: handover.outgoingSupervisorName, shiftName: handover.shiftName })}</span>
      <Link to="/app/shift/handover/briefing" className="font-bold underline">{t('common.shiftHandovers.overlapBanner.reviewBriefing')}</Link>
    </div>
  );
}

export default ShiftOverlapBanner;
