import { Link } from 'react-router-dom';
import type { ShiftHandover } from '@/types/handover.types';

interface ShiftOverlapBannerProps {
  handover: ShiftHandover | null;
  outgoingView?: boolean;
}

export function ShiftOverlapBanner({ handover, outgoingView = false }: ShiftOverlapBannerProps) {
  if (!handover) return null;
  if (handover.status === 'accepted' && outgoingView) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        Shift handed over to {handover.incomingSupervisorName} at {handover.handoverAcceptedAt?.toLocaleTimeString()}.
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
      <span>Overlap in progress - {handover.outgoingSupervisorName} is handing over {handover.shiftName}.</span>
      <Link to="/app/shift/handover/briefing" className="font-bold underline">Review Briefing</Link>
    </div>
  );
}

export default ShiftOverlapBanner;
