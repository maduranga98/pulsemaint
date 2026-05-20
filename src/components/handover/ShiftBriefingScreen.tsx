import type { ShiftHandover } from '@/types/handover.types';
import AcceptShiftButton from './AcceptShiftButton';
import BreakdownSnapshotRow from './BreakdownSnapshotRow';
import PendingWORow from './PendingWORow';
import ShiftBriefingHeader from './ShiftBriefingHeader';
import ShiftBriefingSection from './ShiftBriefingSection';
import ShiftStatsGrid from './ShiftStatsGrid';
import WatchFlagCard from './WatchFlagCard';

interface ShiftBriefingScreenProps {
  handover: ShiftHandover;
}

export function ShiftBriefingScreen({ handover }: ShiftBriefingScreenProps) {
  return (
    <div className="min-h-screen bg-[#0A1628] p-4 lg:p-6">
      <div className="mx-auto max-w-5xl space-y-4">
        <ShiftBriefingHeader handover={handover} />
        <ShiftBriefingSection title="Watch Machines" count={handover.watchFlags.length} defaultOpen>
          {handover.watchFlags.length ? handover.watchFlags.map((flag) => <WatchFlagCard key={flag.id} flag={flag} />) : <p className="text-sm text-slate-500">No watch flags.</p>}
        </ShiftBriefingSection>
        <ShiftBriefingSection title="Active Breakdowns" count={handover.ongoingBreakdowns.length} defaultOpen>
          {handover.ongoingBreakdowns.map((item) => <BreakdownSnapshotRow key={item.ticketId} breakdown={item} readOnly />)}
        </ShiftBriefingSection>
        <ShiftBriefingSection title="Pending Work Orders" count={handover.pendingWOs.length} defaultOpen>
          {handover.pendingWOs.map((item) => <PendingWORow key={item.woId} wo={item} readOnly />)}
        </ShiftBriefingSection>
        <ShiftBriefingSection title="Parts & Inventory Flags" count={handover.lowStockAlerts.length}>
          {handover.lowStockAlerts.map((part) => (
            <div key={part.partId} className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">{part.partName}: {part.currentQty} / min {part.minQty}</div>
          ))}
          <p className="text-sm text-slate-700">{handover.partsNotes || 'No parts notes.'}</p>
        </ShiftBriefingSection>
        <ShiftBriefingSection title="Last Shift Statistics" defaultOpen>
          <ShiftStatsGrid stats={handover.stats} compact />
        </ShiftBriefingSection>
        <ShiftBriefingSection title="General Notes" defaultOpen>
          <p className="whitespace-pre-wrap text-sm text-slate-700">{handover.generalNotes || 'No general notes.'}</p>
        </ShiftBriefingSection>
        <AcceptShiftButton handoverId={handover.id} />
      </div>
    </div>
  );
}

export default ShiftBriefingScreen;
