import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useWorkOrders } from '../../../hooks/useWorkOrders';
import DashboardWidget from '../shared/DashboardWidget';
import EmptyState from '../shared/EmptyState';
import { useRecordPlantMatcher } from '../../../hooks/useRecordPlantMatcher';
import { WODetailPanel } from '../../workorders/WODetailPanel';

/**
 * Completed work orders of every type (Breakdown Repair and PM included)
 * still awaiting a supervisor's sign-off decision.
 * Clicking a row opens the work order's detail panel straight into the
 * sign-off form (same WOSignOffForm as the Work Orders page).
 */
export default function NeedSignOffWidget() {
  const { t } = useTranslation();
  const { workOrders, loading, error, refetch } = useWorkOrders();
  const inScopedPlant = useRecordPlantMatcher();
  const [openWoId, setOpenWoId] = useState<string | null>(null);
  const openWo = openWoId ? workOrders.find((w) => w.id === openWoId) ?? null : null;

  const rows = useMemo(
    () =>
      workOrders.filter(
        (wo) =>
          wo.status === 'COMPLETED' &&
          inScopedPlant(wo),
      ),
    [workOrders, inScopedPlant],
  );

  return (
    <DashboardWidget
      title={t('common.widgets.needSignOffWidget.title')}
      live
      loading={loading}
      error={error}
      onRetry={refetch}
      action={
        rows.length > 0 ? (
          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/30">
            {t('common.widgets.needSignOffWidget.pending', { count: rows.length })}
          </span>
        ) : undefined
      }
    >
      {rows.length === 0 ? (
        <EmptyState message={t('common.widgets.needSignOffWidget.empty')} subMessage={t('common.widgets.needSignOffWidget.emptySub')} />
      ) : (
        <div className="space-y-2">
          {rows.slice(0, 5).map((wo) => (
            <button
              key={wo.id}
              type="button"
              onClick={() => setOpenWoId(wo.id)}
              className="w-full flex items-center justify-between gap-3 px-3 py-2.5 bg-[#0A1628] rounded-lg border border-[#1E3A5F] text-left hover:border-[#1A56DB] transition-colors"
            >
              <div className="min-w-0">
                <p className="text-sm text-[#F0F4F8] truncate">{wo.woNumber || wo.id}</p>
                <p className="text-xs text-[#8BA3BF] truncate">{wo.machineName}</p>
              </div>
              <span className="shrink-0 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-600 text-white">
                {t('common.workOrders.detailPanel.signOffCloseButton')}
              </span>
            </button>
          ))}
          {rows.length > 5 && (
            <p className="text-center text-xs text-[#8BA3BF] py-1">
              {t('common.widgets.pendingRequestsTable.more', { count: rows.length - 5 })}
            </p>
          )}
        </div>
      )}
      {openWo && <WODetailPanel workOrder={openWo} initialSignOff onClose={() => setOpenWoId(null)} />}
    </DashboardWidget>
  );
}
