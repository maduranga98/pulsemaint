import type { ShiftHandover } from '@/types/handover.types';
import { formatDuration } from '@/utils/handover.utils';
import BreakdownSnapshotRow from './BreakdownSnapshotRow';
import HandoverSafetyCasesSection from './HandoverSafetyCasesSection';
import HandoverStatusBadge from './HandoverStatusBadge';
import HandoverTimeline from './HandoverTimeline';
import PendingWORow from './PendingWORow';
import WatchFlagCard from './WatchFlagCard';

interface HandoverDetailViewProps {
  handover: ShiftHandover;
}

function formatDateTime(value: Date | null | undefined): string {
  if (!value) return '';
  try {
    return value.toLocaleString();
  } catch {
    return '';
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
            <dt className="font-semibold text-slate-500">Assigned shift</dt>
            <dd className="text-slate-900">
              {handover.shiftName} ({handover.shiftDate})
              {handover.scheduledStart && handover.scheduledEnd && (
                <span className="ml-1 text-xs text-slate-500">
                  scheduled {handover.scheduledStart}–{handover.scheduledEnd}
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-500">Shift taken from</dt>
            <dd className="text-slate-900">
              {handover.outgoingSupervisorName || ''}
              {handover.outgoingSupervisorDesignation && (
                <span className="ml-1 text-xs text-slate-500">({handover.outgoingSupervisorDesignation})</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-500">Shift handed over to</dt>
            <dd className="text-slate-900">
              {handover.incomingSupervisorName ?? 'Pending acceptance'}
              {handover.incomingSupervisorDesignation && (
                <span className="ml-1 text-xs text-slate-500">({handover.incomingSupervisorDesignation})</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-500">Shift start time</dt>
            <dd className="text-slate-900">{formatDateTime(handover.shiftActualStart)}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-500">Shift end time</dt>
            <dd className="text-slate-900">{formatDateTime(handover.shiftActualEnd)}</dd>
          </div>
          {/* SUP-020: OT = actual worked minutes beyond the scheduled shift length. */}
          <div>
            <dt className="font-semibold text-slate-500">Overtime (OT)</dt>
            <dd className="text-slate-900">
              {handover.otMinutes != null ? formatDuration(handover.otMinutes * 60000) : ''}
              {handover.scheduledMinutes != null && handover.totalMinutes != null && (
                <span className="ml-1 text-xs text-slate-500">
                  (worked {formatDuration(handover.totalMinutes * 60000)} vs scheduled {formatDuration(handover.scheduledMinutes * 60000)})
                </span>
              )}
            </dd>
          </div>
        </dl>
      </header>

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

      <HandoverSafetyCasesSection />

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-[Sora] font-bold text-slate-950">General Notes &amp; Safety Considerations</h2>
        <dl className="mt-3 grid gap-3 text-sm">
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
            <dd className="whitespace-pre-wrap text-slate-800">{handover.restrictedAreas || ''}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-500">Temporary repairs</dt>
            <dd className="whitespace-pre-wrap text-slate-800">{handover.temporaryRepairs || ''}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-500">General notes</dt>
            <dd className="whitespace-pre-wrap text-slate-800">{handover.generalNotes || ''}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}

export default HandoverDetailView;
