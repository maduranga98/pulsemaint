import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useWorkOrders } from '../../../hooks/useWorkOrders';
import DashboardWidget from '../shared/DashboardWidget';
import EmptyState from '../shared/EmptyState';
import { useRecordPlantMatcher } from '../../../hooks/useRecordPlantMatcher';

/**
 * "Hold · Approval" requests raised by technicians/trainees that are still
 * waiting on a supervisor/plant manager/admin. Display-only — dashboards just
 * indicate; requests are approved/rejected from the work order's detail
 * panel on the Work Orders page (WOApprovalRequests).
 */
export default function PendingApprovalsWidget() {
  const { t } = useTranslation();
  const { workOrders, loading, error, refetch } = useWorkOrders();
  const inScopedPlant = useRecordPlantMatcher();

  const rows = useMemo(
    () =>
      workOrders
        .filter((wo) => inScopedPlant(wo))
        .flatMap((wo) =>
          (wo.approvalRequests ?? [])
            .filter((r) => r.status === 'pending')
            .map((r) => ({ wo, request: r })),
        ),
    [workOrders, inScopedPlant],
  );

  return (
    <DashboardWidget
      title={t('common.widgets.pendingApprovalsWidget.title')}
      live
      loading={loading}
      error={error}
      onRetry={refetch}
      action={
        rows.length > 0 ? (
          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-orange-500/10 text-orange-400 ring-1 ring-orange-500/30">
            {t('common.widgets.pendingApprovalsWidget.pending', { count: rows.length })}
          </span>
        ) : undefined
      }
    >
      {rows.length === 0 ? (
        <EmptyState message={t('common.widgets.pendingApprovalsWidget.empty')} subMessage={t('common.widgets.pendingApprovalsWidget.emptySub')} />
      ) : (
        <div className="space-y-3">
          {rows.slice(0, 4).map(({ wo, request }) => (
            <div key={`${wo.id}:${request.id}`} className="bg-[#0A1628] rounded-lg border border-[#1E3A5F] p-3 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#F0F4F8] truncate">{wo.woNumber || wo.id}</p>
                  <p className="text-xs text-[#8BA3BF] truncate">{wo.machineName}</p>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-orange-500/10 text-orange-400 ring-1 ring-orange-500/30 whitespace-nowrap">
                  {t('common.widgets.pendingApprovalsWidget.pendingBadge')}
                </span>
              </div>
              <p className="text-xs text-[#8BA3BF]">
                <span className="font-medium text-[#F0F4F8]">{request.technicianName}</span> {t('common.widgets.pendingApprovalsWidget.requested')}: {request.note}
              </p>
            </div>
          ))}
          {rows.length > 4 && (
            <p className="text-center text-xs text-[#8BA3BF] py-1">
              {t('common.widgets.pendingRequestsTable.more', { count: rows.length - 4 })}
            </p>
          )}
        </div>
      )}
    </DashboardWidget>
  );
}
