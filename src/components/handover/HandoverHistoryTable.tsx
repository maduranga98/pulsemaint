import { Link } from 'react-router-dom';
import type { ShiftHandover } from '@/types/handover.types';
import { calculateOverlapMinutes } from '@/utils/handover.utils';
import HandoverStatusBadge from './HandoverStatusBadge';

interface HandoverHistoryTableProps {
  handovers: ShiftHandover[];
}

function fmtTime(d: Date | null | undefined): string {
  if (!d) return '-';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function HandoverHistoryTable({ handovers }: HandoverHistoryTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-sm min-w-[1100px]">
        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            {/* PM-072 */}
            <th className="px-4 py-3">Shift Name</th>
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3">Shift Started</th>
            <th className="px-4 py-3">Shift Ended</th>
            {/* PM-074 / PM-075 */}
            <th className="px-4 py-3">Handover From</th>
            <th className="px-4 py-3">Handover Taken By</th>
            <th className="px-4 py-3">Accepted At</th>
            {/* PM-073 */}
            <th className="px-4 py-3">Time Overlap</th>
            {/* PM-076 */}
            <th className="px-4 py-3">Breakdowns during Shift</th>
            {/* PM-077 */}
            <th className="px-4 py-3">WOs during Shift</th>
            {/* PM-078 */}
            <th className="px-4 py-3">Watch Flags</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {handovers.map((handover) => {
            const overlap = handover.overlapMinutes
              ?? calculateOverlapMinutes(handover.handoverSubmittedAt, handover.handoverAcceptedAt);
            return (
              <tr key={handover.id} className="hover:bg-slate-50 align-top">
                <td className="px-4 py-3 font-semibold">{handover.shiftName}</td>
                <td className="px-4 py-3 whitespace-nowrap">{handover.shiftDate}</td>
                <td className="px-4 py-3 whitespace-nowrap">{fmtTime(handover.shiftActualStart)}</td>
                <td className="px-4 py-3 whitespace-nowrap">{fmtTime(handover.handoverSubmittedAt)}</td>
                <td className="px-4 py-3">
                  <div className="font-medium">{handover.outgoingSupervisorName}</div>
                  {handover.outgoingSupervisorDesignation && (
                    <div className="text-xs capitalize text-slate-500">{handover.outgoingSupervisorDesignation.replace(/_/g, ' ')}</div>
                  )}
                </td>
                <td className="px-4 py-3">
                  {handover.incomingSupervisorName ? (
                    <>
                      <div className="font-medium">{handover.incomingSupervisorName}</div>
                      {handover.incomingSupervisorDesignation && (
                        <div className="text-xs capitalize text-slate-500">{handover.incomingSupervisorDesignation.replace(/_/g, ' ')}</div>
                      )}
                    </>
                  ) : '-'}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">{fmtTime(handover.handoverAcceptedAt)}</td>
                <td className="px-4 py-3 whitespace-nowrap">{overlap != null ? `${overlap} min` : '-'}</td>
                <td className="px-4 py-3">
                  {handover.ongoingBreakdowns.length === 0 ? (
                    <span className="text-slate-400">None</span>
                  ) : (
                    <ul className="space-y-0.5">
                      {handover.ongoingBreakdowns.map((b) => (
                        <li key={b.ticketId} className="text-xs">
                          <span className="font-mono font-semibold text-rose-700">{b.ticketNumber}</span>
                          <span className="text-slate-500"> · {b.machineName} ({b.currentState})</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
                <td className="px-4 py-3">
                  {handover.pendingWOs.length === 0 ? (
                    <span className="text-slate-400">None</span>
                  ) : (
                    <ul className="space-y-0.5">
                      {handover.pendingWOs.map((w) => (
                        <li key={w.woId} className="text-xs">
                          <span className="font-mono font-semibold text-blue-700">{w.woNumber}</span>
                          <span className="text-slate-500"> · {w.machineName} ({w.currentStatus})</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
                <td className="px-4 py-3">
                  {handover.watchFlags.length === 0 ? (
                    <span className="text-slate-400">None</span>
                  ) : (
                    <ul className="space-y-0.5">
                      {handover.watchFlags.map((f) => (
                        <li key={f.id} className="text-xs">
                          <span className="font-semibold text-amber-700">{f.machineName}</span>
                          <span className="text-slate-500"> · {f.watchLevel.replace(/_/g, ' ')}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
                <td className="px-4 py-3"><HandoverStatusBadge status={handover.status} /></td>
                <td className="px-4 py-3"><Link to={`/app/shift/handover/${handover.id}`} className="text-xs font-bold text-blue-700">View</Link></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default HandoverHistoryTable;
