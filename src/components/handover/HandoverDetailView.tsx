import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  return (
    <div className="space-y-5">
      <header className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className=" text-2xl font-bold text-slate-950">{handover.shiftName} {t('common.shiftHandovers.detailView.titleSuffix')}</h1>
            <p className="mt-1 text-sm text-slate-500">{handover.shiftDate}</p>
          </div>
          <HandoverStatusBadge status={handover.status} />
        </div>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-semibold text-slate-500">{t('common.shiftHandovers.detailView.assignedShift')}</dt>
            <dd className="text-slate-900">
              {handover.shiftName} ({handover.shiftDate})
              {handover.scheduledStart && handover.scheduledEnd && (
                <span className="ml-1 text-xs text-slate-500">
                  {t('common.shiftHandovers.detailView.scheduledRange', { start: handover.scheduledStart, end: handover.scheduledEnd })}
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-500">{t('common.shiftHandovers.detailView.shiftTakenFrom')}</dt>
            <dd className="text-slate-900">
              {handover.outgoingSupervisorName || ''}
              {handover.outgoingSupervisorDesignation && (
                <span className="ml-1 text-xs text-slate-500">({handover.outgoingSupervisorDesignation})</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-500">{t('common.shiftHandovers.detailView.shiftHandedOverTo')}</dt>
            <dd className="text-slate-900">
              {handover.incomingSupervisorName ?? t('common.shiftHandovers.detailView.pendingAcceptance')}
              {handover.incomingSupervisorDesignation && (
                <span className="ml-1 text-xs text-slate-500">({handover.incomingSupervisorDesignation})</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-500">{t('common.shiftHandovers.detailView.shiftStartTime')}</dt>
            <dd className="text-slate-900">{formatDateTime(handover.shiftActualStart)}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-500">{t('common.shiftHandovers.detailView.shiftEndTime')}</dt>
            <dd className="text-slate-900">{formatDateTime(handover.shiftActualEnd)}</dd>
          </div>
          {/* SUP-020: OT = actual worked minutes beyond the scheduled shift length. */}
          <div>
            <dt className="font-semibold text-slate-500">{t('common.shiftHandovers.detailView.overtime')}</dt>
            <dd className="text-slate-900">
              {handover.otMinutes != null ? formatDuration(handover.otMinutes * 60000) : ''}
              {handover.scheduledMinutes != null && handover.totalMinutes != null && (
                <span className="ml-1 text-xs text-slate-500">
                  {t('common.shiftHandovers.detailView.workedVsScheduled', { worked: formatDuration(handover.totalMinutes * 60000), scheduled: formatDuration(handover.scheduledMinutes * 60000) })}
                </span>
              )}
            </dd>
          </div>
        </dl>
      </header>

      <HandoverTimeline handover={handover} />

      <section className="space-y-3">
        <h2 className=" font-bold text-slate-950">{t('common.shiftHandovers.detailView.watchMachineFlags')}</h2>
        {handover.watchFlags.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-500">{t('common.shiftHandovers.detailView.noWatchFlags')}</p>
        ) : (
          handover.watchFlags.map((flag) => <WatchFlagCard key={flag.id} flag={flag} />)
        )}
      </section>

      <section className="space-y-3">
        <h2 className=" font-bold text-slate-950">{t('common.shiftHandovers.detailView.pendingWorkOrders')}</h2>
        {handover.pendingWOs.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-500">{t('common.shiftHandovers.detailView.noPendingWOs')}</p>
        ) : (
          handover.pendingWOs.map((wo) => <PendingWORow key={wo.woId} wo={wo} readOnly />)
        )}
      </section>

      <section className="space-y-3">
        <h2 className=" font-bold text-slate-950">{t('common.shiftHandovers.detailView.ongoingBreakdowns')}</h2>
        {handover.ongoingBreakdowns.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-500">{t('common.shiftHandovers.detailView.noOngoingBreakdowns')}</p>
        ) : (
          handover.ongoingBreakdowns.map((breakdown) => <BreakdownSnapshotRow key={breakdown.ticketId} breakdown={breakdown} readOnly />)
        )}
      </section>

      <HandoverSafetyCasesSection />

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className=" font-bold text-slate-950">{t('common.shiftHandovers.detailView.generalNotesSafety')}</h2>
        <dl className="mt-3 grid gap-3 text-sm">
          <div>
            <dt className="font-semibold text-slate-500">{t('common.shiftHandovers.detailView.safetyIncident')}</dt>
            <dd className="whitespace-pre-wrap text-slate-800">
              {handover.safetyIncidentOccurred
                ? handover.safetyIncidentDescription || t('common.shiftHandovers.detailView.safetyIncidentReportedNoDescription')
                : t('common.shiftHandovers.detailView.noSafetyIncidents')}
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-500">{t('common.shiftHandovers.detailView.restrictedAreas')}</dt>
            <dd className="whitespace-pre-wrap text-slate-800">{handover.restrictedAreas || ''}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-500">{t('common.shiftHandovers.detailView.temporaryRepairs')}</dt>
            <dd className="whitespace-pre-wrap text-slate-800">{handover.temporaryRepairs || ''}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-500">{t('common.shiftHandovers.detailView.generalNotes')}</dt>
            <dd className="whitespace-pre-wrap text-slate-800">{handover.generalNotes || ''}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}

export default HandoverDetailView;
