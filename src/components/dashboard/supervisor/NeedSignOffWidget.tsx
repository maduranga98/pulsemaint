import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useWorkOrders } from '../../../hooks/useWorkOrders';
import { WODetailPanel } from '../../workorders/WODetailPanel';
import DashboardWidget from '../shared/DashboardWidget';
import EmptyState from '../shared/EmptyState';
import type { WorkOrder } from '../../../types/workOrder';

// Breakdown Repair and Preventive Maintenance work orders have their own
// sign-off flows on their own pages — kept off this list the same way the
// Work Orders page's (now-removed) "Need Sign-Off" tab excluded them.
const EXCLUDED_TYPES: WorkOrder['woType'][] = ['BREAKDOWN', 'PREVENTIVE'];

/**
 * Completed work orders still awaiting a supervisor's sign-off decision,
 * surfaced directly on the dashboard — replaces the Work Orders page's
 * "Need Sign-Off" tab (removed; supervisor/plant_manager/admin all see this
 * widget instead). Clicking a row opens the same sign-off panel the Work
 * Orders page used.
 */
export default function NeedSignOffWidget() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { workOrders, loading, error, refetch } = useWorkOrders();
  const [selectedWO, setSelectedWO] = useState<WorkOrder | null>(null);

  const rows = useMemo(
    () => workOrders.filter((wo) => wo.status === 'COMPLETED' && !EXCLUDED_TYPES.includes(wo.woType)),
    [workOrders],
  );

  const liveSelectedWO = selectedWO ? rows.find((w) => w.id === selectedWO.id) ?? null : null;

  return (
    <>
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
          ) : (
            <button
              type="button"
              onClick={() => navigate('/app/work-orders')}
              className="text-xs text-[#8BA3BF] hover:text-[#F0F4F8]"
            >
              {t('common.widgets.common.viewAll')}
            </button>
          )
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
                onClick={() => setSelectedWO(wo)}
                className="w-full flex items-center justify-between gap-3 px-3 py-2.5 bg-[#0A1628] rounded-lg border border-[#1E3A5F] text-left hover:border-[#1A56DB] transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm text-[#F0F4F8] truncate">{wo.woNumber || wo.id}</p>
                  <p className="text-xs text-[#8BA3BF] truncate">{wo.machineName}</p>
                </div>
                <span className="shrink-0 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/30">
                  {t('common.widgets.needSignOffWidget.badge')}
                </span>
              </button>
            ))}
            {rows.length > 5 && (
              <button
                type="button"
                onClick={() => navigate('/app/work-orders')}
                className="w-full text-center text-xs text-[#8BA3BF] hover:text-[#F0F4F8] py-1"
              >
                {t('common.widgets.needSignOffWidget.viewMore', { count: rows.length - 5 })}
              </button>
            )}
          </div>
        )}
      </DashboardWidget>

      {liveSelectedWO && (
        <WODetailPanel workOrder={liveSelectedWO} onClose={() => setSelectedWO(null)} />
      )}
    </>
  );
}
