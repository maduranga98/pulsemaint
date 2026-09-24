import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, XCircle } from 'lucide-react';
import { useApprovalRequest } from '../../hooks/useApprovalRequest';
import { useAuthStore } from '../../store/authStore';
import type { WorkOrder } from '../../types/workOrder';

/**
 * Pending "Hold · Approval" requests on a work order, resolved by the
 * supervisor/plant manager/admin from the WO detail panel on the Work Orders
 * page. (Dashboards are display-only; this is where approvals are actioned.)
 */
export function WOApprovalRequests({ workOrder }: { workOrder: WorkOrder }) {
  const { t } = useTranslation();
  const userProfile = useAuthStore((s) => s.userProfile);
  const { resolveApprovalRequest, loading } = useApprovalRequest();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const pending = (workOrder.approvalRequests ?? []).filter((r) => r.status === 'pending');
  if (pending.length === 0) return null;

  async function handleResolve(requestId: string, decision: 'approved' | 'rejected') {
    if (!userProfile) return;
    setResolvingId(requestId);
    await resolveApprovalRequest(
      workOrder.id,
      userProfile.companyId,
      requestId,
      decision,
      userProfile.id,
      userProfile.fullName ?? '',
      notes[requestId] ?? '',
    );
    setResolvingId(null);
  }

  return (
    <section className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-3">
      <h3 className="text-xs font-semibold text-orange-700 uppercase tracking-wide">
        {t('common.widgets.pendingApprovalsWidget.title')}
      </h3>
      {pending.map((request) => {
        const busy = loading && resolvingId === request.id;
        return (
          <div key={request.id} className="bg-white rounded-lg border border-orange-200 p-3 space-y-2">
            <p className="text-sm text-gray-700">
              <span className="font-semibold text-gray-900">{request.technicianName}</span>{' '}
              {t('common.widgets.pendingApprovalsWidget.requested')}: {request.note}
            </p>
            <textarea
              value={notes[request.id] ?? ''}
              onChange={(e) => setNotes((n) => ({ ...n, [request.id]: e.target.value }))}
              rows={1}
              placeholder={t('common.widgets.pendingApprovalsWidget.notePlaceholder')}
              className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:ring-1 focus:ring-blue-500 outline-none"
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => handleResolve(request.id, 'approved')}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> {t('common.widgets.pendingApprovalsWidget.approve')}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => handleResolve(request.id, 'rejected')}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold bg-red-50 text-red-600 border border-red-200 rounded-md hover:bg-red-100 disabled:opacity-50"
              >
                <XCircle className="w-3.5 h-3.5" /> {t('common.widgets.pendingApprovalsWidget.reject')}
              </button>
            </div>
          </div>
        );
      })}
    </section>
  );
}
