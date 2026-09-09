import { useTranslation } from 'react-i18next';
import type { NextShiftPriority, OngoingBreakdownSnapshot } from '@/types/handover.types';
import { severityClass } from '@/utils/handover.utils';

interface BreakdownSnapshotRowProps {
  breakdown: OngoingBreakdownSnapshot;
  onChange?: (updates: Partial<OngoingBreakdownSnapshot>) => void;
  readOnly?: boolean;
}

export function BreakdownSnapshotRow({ breakdown, onChange, readOnly = false }: BreakdownSnapshotRowProps) {
  const { t } = useTranslation();
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-semibold text-slate-950">{breakdown.ticketNumber}</p>
          <p className="text-sm text-slate-600">{breakdown.machineName}</p>
          <p className={`text-xs font-semibold ${severityClass(breakdown.severity)}`}>{breakdown.severity} - {breakdown.currentState}</p>
        </div>
        <span className="text-xs font-semibold text-cyan-700">{t('common.shiftHandovers.breakdownSnapshotRow.minutesElapsed', { count: breakdown.timeElapsedMinutes })}</span>
      </div>
      {readOnly ? (
        <p className="mt-3 text-sm text-slate-600">{breakdown.supervisorNote || t('common.shiftHandovers.breakdownSnapshotRow.noNote')} - {breakdown.nextShiftPriority}</p>
      ) : (
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_190px]">
          <input
            value={breakdown.supervisorNote}
            onChange={(event) => onChange?.({ supervisorNote: event.target.value })}
            placeholder={t('common.shiftHandovers.breakdownSnapshotRow.notePlaceholder')}
            className="min-h-12 rounded-md border border-slate-200 px-3 text-sm"
          />
          <select
            value={breakdown.nextShiftPriority}
            onChange={(event) => onChange?.({ nextShiftPriority: event.target.value as NextShiftPriority })}
            className="min-h-12 rounded-md border border-slate-200 px-3 text-sm"
          >
            <option value="urgent">{t('common.shiftHandovers.breakdownSnapshotRow.nextShiftPriority.urgent')}</option>
            <option value="continue">{t('common.shiftHandovers.breakdownSnapshotRow.nextShiftPriority.continue')}</option>
            <option value="monitor">{t('common.shiftHandovers.breakdownSnapshotRow.nextShiftPriority.monitor')}</option>
          </select>
        </div>
      )}
    </div>
  );
}

export default BreakdownSnapshotRow;
