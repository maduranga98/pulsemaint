import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, XCircle } from 'lucide-react';
import { useWorkOrders } from '../../../hooks/useWorkOrders';
import { useApprovalRequest } from '../../../hooks/useApprovalRequest';
import { useAuthStore } from '../../../store/authStore';
import DashboardWidget from '../shared/DashboardWidget';
import EmptyState from '../shared/EmptyState';
import { useTranslation } from 'react-i18next';

/**
 * Supervisor-facing queue of "Hold · Approval" requests raised by
 * technicians/trainees, surfaced directly on the dashboard so a supervisor
 * doesn't have to go hunting in the Work Orders list to find them. Approving
 * or rejecting here resolves the same request the Work Orders "Approval
 * Requests" tab shows — approving resumes the requester's own work.
 */
export default function PendingApprovalsWidget() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { workOrders, loading, error, refetch } = useWorkOrders();
  const { resolveApprovalRequest, loading: resolving } = useApprovalRequest();
  const userProfile = useAuthStore((s) => s.userProfile);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [resolvingKey, setResolvingKey] = useState<string | null>(null);

  const rows = useMemo(
    () =>
      workOrders.flatMap((wo) =>
        (wo.approvalRequests ?? [])
          .filter((r) => r.status === 'pending')
          .map((r) => ({ wo, request: r })),
      ),
    [workOrders],
  );

  async function handleResolve(woId: string, requestId: string, decision: 'approved' | 'rejected') {
    if (!userProfile) return;
    const key = `${woId}:${requestId}`;
    setResolvingKey(key);
    await resolveApprovalRequest(
      woId,
      userProfile.companyId,
      requestId,
      decision,
      userProfile.id,
      userProfile.fullName ?? '',
      notes[key] ?? '',
    );
    setResolvingKey(null);
  }

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
        ) : (
          <button
            type="button"
            onClick={() => navigate('/app/work-orders?tab=approvalRequests')}
            className="text-xs text-[#8BA3BF] hover:text-[#F0F4F8]"
          >
            {t('common.widgets.common.viewAll')}
          </button>
        )
      }
    >
      {rows.length === 0 ? (
        <EmptyState message={t('common.widgets.pendingApprovalsWidget.empty')} subMessage={t('common.widgets.pendingApprovalsWidget.emptySub')} />
      ) : (
        <div className="space-y-3">
          {rows.slice(0, 4).map(({ wo, request }) => {
            const key = `${wo.id}:${request.id}`;
            const busy = resolving && resolvingKey === key;
            return (
              <div key={key} className="bg-[#0A1628] rounded-lg border border-[#1E3A5F] p-3 space-y-2">
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
                <textarea
                  value={notes[key] ?? ''}
                  onChange={(e) => setNotes((n) => ({ ...n, [key]: e.target.value }))}
                  rows={1}
                  placeholder={t('common.widgets.pendingApprovalsWidget.notePlaceholder')}
                  className="w-full rounded-md border border-[#1E3A5F] bg-[#0F1E35] px-2.5 py-1.5 text-xs text-[#F0F4F8] placeholder:text-[#5B7186] focus:ring-1 focus:ring-[#1A56DB] outline-none"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleResolve(wo.id, request.id, 'approved')}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> {t('common.widgets.pendingApprovalsWidget.approve')}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleResolve(wo.id, request.id, 'rejected')}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/30 rounded-md hover:bg-red-500/20 disabled:opacity-50"
                  >
                    <XCircle className="w-3.5 h-3.5" /> {t('common.widgets.pendingApprovalsWidget.reject')}
                  </button>
                </div>
              </div>
            );
          })}
          {rows.length > 4 && (
            <button
              type="button"
              onClick={() => navigate('/app/work-orders?tab=approvalRequests')}
              className="w-full text-center text-xs text-[#8BA3BF] hover:text-[#F0F4F8] py-1"
            >
              {t('common.widgets.pendingApprovalsWidget.viewMore', { count: rows.length - 4 })}
            </button>
          )}
        </div>
      )}
    </DashboardWidget>
  );
}
