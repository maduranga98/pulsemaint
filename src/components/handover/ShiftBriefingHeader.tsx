import type { ShiftHandover } from '@/types/handover.types';

interface ShiftBriefingHeaderProps {
  handover: ShiftHandover;
}

export function ShiftBriefingHeader({ handover }: ShiftBriefingHeaderProps) {
  return (
    <header className="rounded-lg border border-cyan-400/30 bg-white/10 p-4 text-white">
      <p className="text-sm font-semibold text-cyan-200">Incoming Shift Briefing</p>
      <h1 className="mt-1 font-[Sora] text-2xl font-bold">{handover.shiftName}</h1>
      <p className="mt-2 text-sm text-slate-200">
        Handover from {handover.outgoingSupervisorName} at {handover.handoverSubmittedAt.toLocaleString()}
      </p>
    </header>
  );
}

export default ShiftBriefingHeader;
