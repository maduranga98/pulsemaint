import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useWorkOrders } from '../../../hooks/useWorkOrders';
import { usePartsRequests } from '../../../hooks/inventory/usePartsRequests';
import { useAuthStore } from '../../../store/authStore';
import DashboardWidget from '../shared/DashboardWidget';
import EmptyState from '../shared/EmptyState';
import { useRecordPlantMatcher } from '../../../hooks/useRecordPlantMatcher';

/**
 * "Hold · Approval" requests raised by technicians/trainees that are still
 * waiting on a supervisor/plant manager/admin. Display-only — dashboards just
 * indicate; requests are approved/rejected from the work order's detail
 * panel on the Work Orders page (WOApprovalRequests).
 *
 * Also lists parts requests the store keeper escalated for supervisor
 * approval: a supervisor sees only the ones sent to them (the linked WO's
 * supervisor-in-charge, or the supervisor picked at escalation); plant
 * managers / admins see every escalated request in their plant.
 */
export default function PendingApprovalsWidget() {
  const { t } = useTranslation();
  const { workOrders, loading, error, refetch } = useWorkOrders();
  const inScopedPlant = useRecordPlantMatcher();
  const me = useAuthStore((s) => s.userProfile);
  const { requests: escalatedRequests } = usePartsRequests({ status: 'pending_supervisor' });
  const partsRows = useMemo(
    () =>
      escalatedRequests.filter((r) =>
        me?.role === 'supervisor'
          ? // Older escalations have no target — keep those visible to every
            // supervisor in the plant rather than losing them.
            !r.escalatedToSupervisorId || r.escalatedToSupervisorId === me.id
          : true,
      ),
    [escalatedRequests, me?.role, me?.id],
  );

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

  const total = rows.length + partsRows.length;

  return (
    <DashboardWidget
      title={t('common.widgets.pendingApprovalsWidget.title')}
      live
      loading={loading}
      error={error}
      onRetry={refetch}
      action={
        total > 0 ? (
          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-orange-500/10 text-orange-400 ring-1 ring-orange-500/30">
            {t('common.widgets.pendingApprovalsWidget.pending', { count: total })}
          </span>
        ) : undefined
      }
    >
      {total === 0 ? (
        <EmptyState message={t('common.widgets.pendingApprovalsWidget.empty')} subMessage={t('common.widgets.pendingApprovalsWidget.emptySub')} />
      ) : (
        <div className="space-y-4">
          {rows.length > 0 && (
            <div className="space-y-3">
              {partsRows.length > 0 && (
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8BA3BF]">
                  {t('common.widgets.pendingApprovalsWidget.woHolds', 'Work order holds')}
                </p>
              )}
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

          {partsRows.length > 0 && (
            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8BA3BF]">
                {t('common.widgets.pendingApprovalsWidget.partsRequests', 'Parts requests escalated for approval')}
              </p>
              {partsRows.slice(0, 4).map((r) => (
                <div key={r.id} className="bg-[#0A1628] rounded-lg border border-[#1E3A5F] p-3 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#F0F4F8] truncate">
                        {r.requestNumber}
                        {r.workOrderNumber ? ` · ${r.workOrderNumber}` : ''}
                      </p>
                      <p className="text-xs text-[#8BA3BF] truncate">
                        {r.items[0]?.partName ?? ''}
                        {r.items.length > 1 ? ` ${t('common.widgets.pendingRequestsTable.more', { count: r.items.length - 1 })}` : ''}
                        {r.machineName ? ` · ${r.machineName}` : ''}
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-500/10 text-blue-300 ring-1 ring-blue-500/30 whitespace-nowrap">
                      {t('common.widgets.pendingApprovalsWidget.partsBadge', 'Parts')}
                    </span>
                  </div>
                  <p className="text-xs text-[#8BA3BF]">
                    <span className="font-medium text-[#F0F4F8]">{r.requestedByName}</span>
                    {r.storeKeeperReview?.escalationReason ? ` — ${r.storeKeeperReview.escalationReason}` : ''}
                    {r.escalatedToSupervisorName && me?.role !== 'supervisor'
                      ? ` · ${t('common.widgets.pendingApprovalsWidget.sentTo', 'sent to {{name}}', { name: r.escalatedToSupervisorName })}`
                      : ''}
                  </p>
                </div>
              ))}
              {partsRows.length > 4 && (
                <p className="text-center text-xs text-[#8BA3BF] py-1">
                  {t('common.widgets.pendingRequestsTable.more', { count: partsRows.length - 4 })}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </DashboardWidget>
  );
}
