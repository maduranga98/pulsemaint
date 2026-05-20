import { Link } from 'react-router-dom';
import type { ShiftHandover } from '@/types/handover.types';
import { calculateOverlapMinutes } from '@/utils/handover.utils';
import HandoverStatusBadge from './HandoverStatusBadge';

interface HandoverHistoryTableProps {
  handovers: ShiftHandover[];
}

export function HandoverHistoryTable({ handovers }: HandoverHistoryTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">Shift</th>
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3">Outgoing</th>
            <th className="px-4 py-3">Incoming</th>
            <th className="px-4 py-3">Handover</th>
            <th className="px-4 py-3">Accept</th>
            <th className="px-4 py-3">Overlap</th>
            <th className="px-4 py-3">Breakdowns</th>
            <th className="px-4 py-3">Pending WOs</th>
            <th className="px-4 py-3">Watch</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {handovers.map((handover) => (
            <tr key={handover.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-semibold">{handover.shiftName}</td>
              <td className="px-4 py-3">{handover.shiftDate}</td>
              <td className="px-4 py-3">{handover.outgoingSupervisorName}</td>
              <td className="px-4 py-3">{handover.incomingSupervisorName ?? '-'}</td>
              <td className="px-4 py-3">{handover.handoverSubmittedAt.toLocaleTimeString()}</td>
              <td className="px-4 py-3">{handover.handoverAcceptedAt?.toLocaleTimeString() ?? '-'}</td>
              <td className="px-4 py-3">{calculateOverlapMinutes(handover.handoverSubmittedAt, handover.handoverAcceptedAt) ?? '-'} min</td>
              <td className="px-4 py-3">{handover.stats.breakdownsOpened}</td>
              <td className="px-4 py-3">{handover.pendingWOs.length}</td>
              <td className="px-4 py-3">{handover.watchFlags.length}</td>
              <td className="px-4 py-3"><HandoverStatusBadge status={handover.status} /></td>
              <td className="px-4 py-3"><Link to={`/app/shift/handover/${handover.id}`} className="text-xs font-bold text-blue-700">View</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default HandoverHistoryTable;
