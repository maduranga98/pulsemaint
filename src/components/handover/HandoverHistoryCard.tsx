import { Link } from 'react-router-dom';
import type { ShiftHandover } from '@/types/handover.types';
import { formatDuration } from '@/utils/handover.utils';
import { exportHandoverPdf } from '@/utils/reports/pdf/handoverPdf';
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
        <div>OT: {handover.otMinutes != null ? formatDuration(handover.otMinutes * 60000) : '-'}</div>
      </dl>
      <div className="mt-4 flex gap-2">
        <Link to={`/app/shift/handover/${handover.id}`} className="inline-flex min-h-12 flex-1 items-center justify-center rounded-md bg-blue-600 px-4 text-sm font-bold text-white">View Archive</Link>
        <button
          type="button"
          onClick={() => exportHandoverPdf(handover)}
          className="inline-flex min-h-12 items-center justify-center rounded-md border border-slate-300 px-4 text-sm font-bold text-slate-700"
        >
          Export
        </button>
      </div>
    </article>
  );
}

export default HandoverHistoryCard;
