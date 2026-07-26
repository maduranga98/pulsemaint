import { Link } from 'react-router-dom';
import type { ShiftHandover } from '@/types/handover.types';
import { calculateLateStartMinutes, formatDuration } from '@/utils/handover.utils';
import { exportHandoverPdf } from '@/utils/reports/pdf/handoverPdf';

// A unified row for the shift table: either a submitted supervisor handover, or
// a completed shift session logged by any other role (technician, store keeper,
// operator…) who ended a shift without filing a handover.
export interface ShiftTableRow {
  id: string;
  kind: 'handover' | 'session';
  shiftName: string;
  personName: string;
  personRole: string | null;
  start: Date | null;
  end: Date | null;
  /** The assigned shift's scheduled start time (HH:MM), used to flag a late start. */
  scheduledStart: string | null;
  otMinutes: number | null;
  ongoingBreakdowns: ShiftHandover['ongoingBreakdowns'];
  pendingWOs: ShiftHandover['pendingWOs'];
  watchFlags: ShiftHandover['watchFlags'];
  handover?: ShiftHandover;
}

interface HandoverHistoryTableProps {
  rows: ShiftTableRow[];
}

function fmtDateTime(d: Date | null | undefined): string {
  if (!d) return '-';
  return d.toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function HandoverHistoryTable({ rows }: HandoverHistoryTableProps) {
  return (
    <div className="overflow-x-auto scrollbar-hide rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-sm min-w-[980px]">
        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">Shift Name</th>
            <th className="px-4 py-3">Person &amp; Role</th>
            <th className="px-4 py-3">Shift Started</th>
            <th className="px-4 py-3">Late By</th>
            <th className="px-4 py-3">Shift Ended</th>
            <th className="px-4 py-3">OT</th>
            <th className="px-4 py-3">Breakdowns during Shift</th>
            <th className="px-4 py-3">WOs during Shift</th>
            <th className="px-4 py-3">Watch Flags</th>
            <th className="px-4 py-3">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => {
            const lateMinutes = row.scheduledStart && row.start
              ? calculateLateStartMinutes(row.scheduledStart, row.start)
              : 0;
            const isLate = lateMinutes > 0;
            return (
              <tr key={row.id} className={`align-top hover:bg-slate-50 ${isLate ? 'bg-red-50' : ''}`}>
                <td className="px-4 py-3 font-semibold">{row.shiftName}</td>
                <td className="px-4 py-3">
                  <div className="font-medium">{row.personName}</div>
                  {row.personRole && (
                    <div className="text-xs capitalize text-slate-500">{row.personRole.replace(/_/g, ' ')}</div>
                  )}
                </td>
                <td className={`px-4 py-3 whitespace-nowrap ${isLate ? 'font-semibold text-red-600' : ''}`}>{fmtDateTime(row.start)}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {isLate ? (
                    <span className="font-semibold text-red-600">{formatDuration(lateMinutes * 60000)} late</span>
                  ) : (
                    <span className="text-slate-400">On time</span>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">{fmtDateTime(row.end)}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {row.otMinutes != null ? formatDuration(row.otMinutes * 60000) : '-'}
                </td>
                <td className="px-4 py-3">
                  {row.ongoingBreakdowns.length === 0 ? (
                    <span className="text-slate-400">None</span>
                  ) : (
                    <ul className="space-y-0.5">
                      {row.ongoingBreakdowns.map((b) => (
                        <li key={b.ticketId} className="text-xs">
                          <span className="font-mono font-semibold text-rose-700">{b.ticketNumber}</span>
                          <span className="text-slate-500"> · {b.machineName} ({b.currentState})</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
                <td className="px-4 py-3">
                  {row.pendingWOs.length === 0 ? (
                    <span className="text-slate-400">None</span>
                  ) : (
                    <ul className="space-y-0.5">
                      {row.pendingWOs.map((w) => (
                        <li key={w.woId} className="text-xs">
                          <span className="font-mono font-semibold text-blue-700">{w.woNumber}</span>
                          <span className="text-slate-500"> · {w.machineName} ({w.currentStatus})</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
                <td className="px-4 py-3">
                  {row.watchFlags.length === 0 ? (
                    <span className="text-slate-400">None</span>
                  ) : (
                    <ul className="space-y-0.5">
                      {row.watchFlags.map((f) => (
                        <li key={f.id} className="text-xs">
                          <span className="font-semibold text-amber-700">{f.machineName}</span>
                          <span className="text-slate-500"> · {f.watchLevel.replace(/_/g, ' ')}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {row.kind === 'handover' && row.handover ? (
                    <div className="flex gap-3">
                      <Link to={`/app/shift/handover/${row.handover.id}`} className="text-xs font-bold text-blue-700">View</Link>
                      <button type="button" onClick={() => exportHandoverPdf(row.handover!)} className="text-xs font-bold text-slate-600 hover:text-slate-900">Export</button>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">Shift log</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default HandoverHistoryTable;
