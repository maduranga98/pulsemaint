import DashboardWidget from '../shared/DashboardWidget';
import EmptyState from '../shared/EmptyState';
import { usePartsRequests } from '../../../hooks/inventory/usePartsRequests';
import type { RequestStatus } from '../../../types/inventory';
import { useTranslation } from 'react-i18next';

// Every one of my own requests that hasn't reached a terminal state yet
// (issued/completed = fulfilled, rejected/cancelled = closed out).
const FULFILLED_OR_CLOSED: RequestStatus[] = ['issued', 'completed', 'rejected', 'cancelled'];

const STATUS_KEY: Partial<Record<RequestStatus, { key: string; className: string }>> = {
  pending_storekeeper: { key: 'requested', className: 'bg-amber-500/15 text-amber-300' },
  pending_supervisor: { key: 'inApprovalOfSupervisor', className: 'bg-blue-500/15 text-blue-300' },
  approved: { key: 'needToCollect', className: 'bg-indigo-500/15 text-indigo-300' },
  partially_approved: { key: 'needToCollect', className: 'bg-indigo-500/15 text-indigo-300' },
  parts_reserved: { key: 'needToCollect', className: 'bg-indigo-500/15 text-indigo-300' },
};

interface RequestedPartsWidgetProps {
  onRequestParts: () => void;
}

export default function RequestedPartsWidget({ onRequestParts }: RequestedPartsWidgetProps) {
  const { t } = useTranslation();
  const { requests, loading, error } = usePartsRequests({ ownOnly: true });
  const pending = requests.filter((r) => !FULFILLED_OR_CLOSED.includes(r.status));

  return (
    <DashboardWidget
      title={t('common.widgets.requestedPartsWidget.title')}
      loading={loading}
      error={error}
      action={
        <button
          type="button"
          onClick={onRequestParts}
          className="px-2.5 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-xs font-medium"
        >
          + {t('common.widgets.requestedPartsWidget.requestParts')}
        </button>
      }
    >
      {pending.length === 0 ? (
        <EmptyState message={t('common.widgets.requestedPartsWidget.empty')} />
      ) : (
        <div className="space-y-2">
          {pending.map((r) => {
            const badge = STATUS_KEY[r.status]
              ? { label: t(`common.widgets.requestedPartsWidget.status.${STATUS_KEY[r.status]!.key}`), className: STATUS_KEY[r.status]!.className }
              : { label: r.status, className: 'bg-[#1E3A5F] text-[#8BA3BF]' };
            const itemsLabel = r.items.map((i) => `${i.partName} ×${i.quantityRequested}`).join(', ');
            return (
              <div
                key={r.id}
                className="flex items-center justify-between gap-3 px-3 py-2.5 bg-[#0A1628] rounded-lg border border-[#1E3A5F]"
              >
                <div className="min-w-0">
                  <p className="text-sm text-[#F0F4F8] truncate">{itemsLabel || r.requestNumber}</p>
                  <p className="text-[11px] text-[#8BA3BF]">{r.machineName ? r.machineName : r.purpose || t('common.widgets.requestedPartsWidget.generalRequest')}</p>
                </div>
                <span className={`shrink-0 px-2 py-0.5 rounded text-[11px] font-medium ${badge.className}`}>
                  {badge.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </DashboardWidget>
  );
}
