import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-[#0A1628] p-4 lg:p-6">
      <div className="mx-auto max-w-5xl space-y-4">
        <ShiftBriefingHeader handover={handover} />
        <ShiftBriefingSection title={t('common.shiftHandovers.briefingScreen.watchMachines')} count={handover.watchFlags.length} defaultOpen>
          {handover.watchFlags.length ? handover.watchFlags.map((flag) => <WatchFlagCard key={flag.id} flag={flag} />) : <p className="text-sm text-slate-500">{t('common.shiftHandovers.briefingScreen.noWatchFlags')}</p>}
        </ShiftBriefingSection>
        <ShiftBriefingSection title={t('common.shiftHandovers.briefingScreen.activeBreakdowns')} count={handover.ongoingBreakdowns.length} defaultOpen>
          {handover.ongoingBreakdowns.map((item) => <BreakdownSnapshotRow key={item.ticketId} breakdown={item} readOnly />)}
        </ShiftBriefingSection>
        <ShiftBriefingSection title={t('common.shiftHandovers.briefingScreen.pendingWorkOrders')} count={handover.pendingWOs.length} defaultOpen>
          {handover.pendingWOs.map((item) => <PendingWORow key={item.woId} wo={item} readOnly />)}
        </ShiftBriefingSection>
        <ShiftBriefingSection title={t('common.shiftHandovers.briefingScreen.partsInventoryFlags')} count={handover.lowStockAlerts.length}>
          {handover.lowStockAlerts.map((part) => (
            <div key={part.partId} className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
              {t('common.shiftHandovers.briefingScreen.partQtyLine', { name: part.partName, current: part.currentQty, min: part.minQty })}
            </div>
          ))}
          <p className="text-sm text-slate-700">{handover.partsNotes || t('common.shiftHandovers.briefingScreen.noPartsNotes')}</p>
        </ShiftBriefingSection>
        <ShiftBriefingSection title={t('common.shiftHandovers.briefingScreen.lastShiftStatistics')} defaultOpen>
          <ShiftStatsGrid stats={handover.stats} compact />
        </ShiftBriefingSection>
        <ShiftBriefingSection title={t('common.shiftHandovers.briefingScreen.generalNotes')} defaultOpen>
          <p className="whitespace-pre-wrap text-sm text-slate-700">{handover.generalNotes || t('common.shiftHandovers.briefingScreen.noGeneralNotes')}</p>
        </ShiftBriefingSection>
        <AcceptShiftButton handoverId={handover.id} />
      </div>
    </div>
  );
}

export default ShiftBriefingScreen;
