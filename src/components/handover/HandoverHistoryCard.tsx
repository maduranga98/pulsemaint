import { Link } from 'react-router-dom';
import type { ShiftHandover } from '@/types/handover.types';
import HandoverStatusBadge from './HandoverStatusBadge';

interface HandoverHistoryCardProps {
  handover: ShiftHandover;
}

export function HandoverHistoryCard({ handover }: HandoverHistoryCardProps) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-[Sora] font-bold text-slate-950">{handover.shiftName}</h3>
          <p className="text-sm text-slate-500">{handover.shiftDate}</p>
        </div>
        <HandoverStatusBadge status={handover.status} />
      </div>
      <dl className="mt-3 grid gap-1 text-sm text-slate-600">
        <div>Outgoing: {handover.outgoingSupervisorName}</div>
        <div>Incoming: {handover.incomingSupervisorName ?? '-'}</div>
        <div>Watch flags: {handover.watchFlags.length}</div>
      </dl>
      <Link to={`/app/shift/handover/${handover.id}`} className="mt-4 inline-flex min-h-12 items-center rounded-md bg-blue-600 px-4 text-sm font-bold text-white">View Archive</Link>
    </article>
  );
}

export default HandoverHistoryCard;
