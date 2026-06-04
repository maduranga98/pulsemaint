import type { ShiftHandover } from '@/types/handover.types';
import BreakdownSnapshotRow from './BreakdownSnapshotRow';
import HandoverStatusBadge from './HandoverStatusBadge';
import HandoverTimeline from './HandoverTimeline';
import PendingWORow from './PendingWORow';
import ShiftStatsGrid from './ShiftStatsGrid';
import WatchFlagCard from './WatchFlagCard';

interface HandoverDetailViewProps {
  handover: ShiftHandover;
}

function formatDateTime(value: Date | null | undefined): string {
  if (!value) return '—';
  try {
    return value.toLocaleString();
  } catch {
    return '—';
  }
}

export function HandoverDetailView({ handover }: HandoverDetailViewProps) {
  return (
    <div className="space-y-5">
      <header className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="font-[Sora] text-2xl font-bold text-slate-950">{handover.shiftName} Handover</h1>
            <p className="mt-1 text-sm text-slate-500">{handover.shiftDate}</p>
          </div>
          <HandoverStatusBadge status={handover.status} />
        </div>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-semibold text-slate-500">Shift taken from</dt>
            <dd className="text-slate-900">{handover.outgoingSupervisorName || '—'}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-500">Shift handed over to</dt>
            <dd className="text-slate-900">{handover.incomingSupervisorName ?? 'Pending acceptance'}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-500">Shift start time</dt>
            <dd className="text-slate-900">{formatDateTime(handover.shiftActualStart)}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-500">Handover submitted at</dt>
            <dd className="text-slate-900">{formatDateTime(handover.handoverSubmittedAt)}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-500">Handover accepted at</dt>
            <dd className="text-slate-900">{formatDateTime(handover.handoverAcceptedAt)}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-500">Overlap (minutes)</dt>
            <dd className="text-slate-900">{handover.overlapMinutes ?? '—'}</dd>
          </div>
        </dl>
      </header>

      <ShiftStatsGrid stats={handover.stats} />
      <HandoverTimeline handover={handover} />

      <section className="space-y-3">
        <h2 className="font-[Sora] font-bold text-slate-950">Watch Machine Flags</h2>
        {handover.watchFlags.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-500">No watch flags raised.</p>
        ) : (
          handover.watchFlags.map((flag) => <WatchFlagCard key={flag.id} flag={flag} />)
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-[Sora] font-bold text-slate-950">Pending Work Orders</h2>
        {handover.pendingWOs.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-500">No pending work orders.</p>
        ) : (
          handover.pendingWOs.map((wo) => <PendingWORow key={wo.woId} wo={wo} readOnly />)
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-[Sora] font-bold text-slate-950">Ongoing Breakdowns</h2>
        {handover.ongoingBreakdowns.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-500">No ongoing breakdowns.</p>
        ) : (
          handover.ongoingBreakdowns.map((breakdown) => <BreakdownSnapshotRow key={breakdown.ticketId} breakdown={breakdown} readOnly />)
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-[Sora] font-bold text-slate-950">Parts, Safety &amp; Notes</h2>
        <dl className="mt-3 grid gap-3 text-sm">
          <div>
            <dt className="font-semibold text-slate-500">Parts notes</dt>
            <dd className="whitespace-pre-wrap text-slate-800">{handover.partsNotes || '—'}</dd>
          </div>
          {handover.lowStockAlerts && handover.lowStockAlerts.length > 0 && (
            <div>
              <dt className="font-semibold text-slate-500">Low stock alerts</dt>
              <dd className="text-slate-800">
                <ul className="list-disc pl-5">
                  {handover.lowStockAlerts.map((alert, i) => (
                    <li key={i}>
                      {(alert as { partName?: string; currentStock?: number; minStockLevel?: number }).partName ?? 'Part'}
                      {' — '}
                      {(alert as { currentStock?: number }).currentStock ?? '?'} on hand
                      {' / min '}
                      {(alert as { minStockLevel?: number }).minStockLevel ?? '?'}
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          )}
          <div>
            <dt className="font-semibold text-slate-500">Safety incident</dt>
            <dd className="whitespace-pre-wrap text-slate-800">
              {handover.safetyIncidentOccurred
                ? handover.safetyIncidentDescription || 'Incident reported (no description provided).'
                : 'No safety incidents reported.'}
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-500">Restricted areas</dt>
            <dd className="whitespace-pre-wrap text-slate-800">{handover.restrictedAreas || '—'}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-500">Temporary repairs</dt>
            <dd className="whitespace-pre-wrap text-slate-800">{handover.temporaryRepairs || '—'}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-500">General notes</dt>
            <dd className="whitespace-pre-wrap text-slate-800">{handover.generalNotes || '—'}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}

export default HandoverDetailView;
