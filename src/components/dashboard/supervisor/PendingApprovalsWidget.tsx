import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, XCircle } from 'lucide-react';
import { useWorkOrders } from '../../../hooks/useWorkOrders';
import { useApprovalRequest } from '../../../hooks/useApprovalRequest';
import { useAuthStore } from '../../../store/authStore';
import { WODetailPanel } from '../../workorders/WODetailPanel';
import DashboardWidget from '../shared/DashboardWidget';
import EmptyState from '../shared/EmptyState';
import { useRecordPlantMatcher } from '../../../hooks/useRecordPlantMatcher';

/**
 * "Hold · Approval" requests raised by technicians/trainees that are still
 * waiting on a supervisor/plant manager/admin. Each request can be approved
 * or rejected right here; clicking a row opens the work order's detail panel
 * (same one as the Work Orders page) for the full context / a resolution note.
 */
export default function PendingApprovalsWidget() {
  const { t } = useTranslation();
  const { workOrders, loading, error, refetch } = useWorkOrders();
  const inScopedPlant = useRecordPlantMatcher();
  const userProfile = useAuthStore((st) => st.userProfile);
  const { resolveApprovalRequest, loading: resolving } = useApprovalRequest();
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [openWoId, setOpenWoId] = useState<string | null>(null);
  const openWo = openWoId ? workOrders.find((w) => w.id === openWoId) ?? null : null;

  async function handleResolve(woId: string, requestId: string, decision: 'approved' | 'rejected') {
    if (!userProfile) return;
    setResolvingId(requestId);
    await resolveApprovalRequest(
      woId,
      userProfile.companyId,
      requestId,
      decision,
      userProfile.id,
      userProfile.fullName ?? '',
      '',
    );
    setResolvingId(null);
  }

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
            <div key={`${wo.id}:${request.id}`} className="bg-[#0A1628] rounded-lg border border-[#1E3A5F] hover:border-[#1A56DB] transition-colors">
              <button
                type="button"
                onClick={() => setOpenWoId(wo.id)}
                className="w-full text-left p-3 pb-2 space-y-2"
              >
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
              </button>
              <div className="flex gap-2 px-3 pb-3">
                <button
                  type="button"
                  disabled={resolving && resolvingId === request.id}
                  onClick={() => handleResolve(wo.id, request.id, 'approved')}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> {t('common.widgets.pendingApprovalsWidget.approve')}
                </button>
                <button
                  type="button"
                  disabled={resolving && resolvingId === request.id}
                  onClick={() => handleResolve(wo.id, request.id, 'rejected')}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold bg-red-500/10 text-red-400 ring-1 ring-red-500/30 rounded-md hover:bg-red-500/20 disabled:opacity-50"
                >
                  <XCircle className="w-3.5 h-3.5" /> {t('common.widgets.pendingApprovalsWidget.reject')}
                </button>
              </div>
            </div>
          ))}
          {rows.length > 4 && (
            <p className="text-center text-xs text-[#8BA3BF] py-1">
              {t('common.widgets.pendingRequestsTable.more', { count: rows.length - 4 })}
            </p>
          )}
        </div>
      )}
      {openWo && <WODetailPanel workOrder={openWo} onClose={() => setOpenWoId(null)} />}
    </DashboardWidget>
  );
}
