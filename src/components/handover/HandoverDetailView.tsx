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

export function HandoverDetailView({ handover }: HandoverDetailViewProps) {
  return (
    <div className="space-y-5">
      <header className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="font-[Sora] text-2xl font-bold text-slate-950">{handover.shiftName} Handover</h1>
            <p className="mt-1 text-sm text-slate-500">{handover.shiftDate} - {handover.outgoingSupervisorName} to {handover.incomingSupervisorName ?? 'Pending'}</p>
          </div>
          <HandoverStatusBadge status={handover.status} />
        </div>
      </header>
      <ShiftStatsGrid stats={handover.stats} />
      <HandoverTimeline handover={handover} />
      <section className="space-y-3">
        <h2 className="font-[Sora] font-bold text-slate-950">Watch Machine Flags</h2>
        {handover.watchFlags.map((flag) => <WatchFlagCard key={flag.id} flag={flag} />)}
      </section>
      <section className="space-y-3">
        <h2 className="font-[Sora] font-bold text-slate-950">Pending Work Orders</h2>
        {handover.pendingWOs.map((wo) => <PendingWORow key={wo.woId} wo={wo} readOnly />)}
      </section>
      <section className="space-y-3">
        <h2 className="font-[Sora] font-bold text-slate-950">Ongoing Breakdowns</h2>
        {handover.ongoingBreakdowns.map((breakdown) => <BreakdownSnapshotRow key={breakdown.ticketId} breakdown={breakdown} readOnly />)}
      </section>
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-[Sora] font-bold text-slate-950">Parts, Safety & Notes</h2>
        <dl className="mt-3 grid gap-3 text-sm">
          <div><dt className="font-semibold text-slate-500">Parts notes</dt><dd className="whitespace-pre-wrap text-slate-800">{handover.partsNotes || '-'}</dd></div>
          <div><dt className="font-semibold text-slate-500">Safety incident</dt><dd className="whitespace-pre-wrap text-slate-800">{handover.safetyIncidentOccurred ? handover.safetyIncidentDescription : 'No'}</dd></div>
          <div><dt className="font-semibold text-slate-500">Restricted areas</dt><dd className="whitespace-pre-wrap text-slate-800">{handover.restrictedAreas || '-'}</dd></div>
          <div><dt className="font-semibold text-slate-500">Temporary repairs</dt><dd className="whitespace-pre-wrap text-slate-800">{handover.temporaryRepairs || '-'}</dd></div>
          <div><dt className="font-semibold text-slate-500">General notes</dt><dd className="whitespace-pre-wrap text-slate-800">{handover.generalNotes || '-'}</dd></div>
        </dl>
      </section>
    </div>
  );
}

export default HandoverDetailView;
