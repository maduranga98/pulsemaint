import { useTranslation } from 'react-i18next';
import type { CarryForwardStatus, PendingWOSnapshot } from '@/types/handover.types';

interface PendingWORowProps {
  wo: PendingWOSnapshot;
  onChange?: (updates: Partial<PendingWOSnapshot>) => void;
  readOnly?: boolean;
}

export function PendingWORow({ wo, onChange, readOnly = false }: PendingWORowProps) {
  const { t } = useTranslation();
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-semibold text-slate-950">{wo.woNumber}</p>
          <p className="text-sm text-slate-600">{wo.machineName} - {wo.woType}</p>
          <p className="text-xs text-slate-500">{wo.priority} - {wo.currentStatus} - {wo.assignedTechnician}</p>
        </div>
        <span className="text-xs font-semibold text-amber-700">{wo.dueDate && !Number.isNaN(wo.dueDate.getTime()) ? wo.dueDate.toLocaleString() : t('common.shiftHandovers.pendingWoRow.noDueDate')}</span>
      </div>
      {readOnly ? (
        <p className="mt-3 text-sm text-slate-600">{wo.supervisorNote || t('common.shiftHandovers.pendingWoRow.noNote')} - {wo.carryForwardStatus}</p>
      ) : (
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_180px]">
          <input
            value={wo.supervisorNote}
            onChange={(event) => onChange?.({ supervisorNote: event.target.value })}
            placeholder={t('common.shiftHandovers.pendingWoRow.supervisorNotePlaceholder')}
            className="min-h-12 rounded-md border border-slate-200 px-3 text-sm"
          />
          <select
            value={wo.carryForwardStatus}
            onChange={(event) => onChange?.({ carryForwardStatus: event.target.value as CarryForwardStatus })}
            className="min-h-12 rounded-md border border-slate-200 px-3 text-sm"
          >
            <option value="continue">{t('common.shiftHandovers.pendingWoRow.carryForward.continue')}</option>
            <option value="escalate">{t('common.shiftHandovers.pendingWoRow.carryForward.escalate')}</option>
            <option value="on_hold">{t('common.shiftHandovers.pendingWoRow.carryForward.on_hold')}</option>
          </select>
        </div>
      )}
    </div>
  );
}

export default PendingWORow;
