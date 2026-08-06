import { useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import type { WorkOrder } from '../../types/workOrder';
import { useApprovalRequest } from '../../hooks/useApprovalRequest';
import { useAuthStore } from '../../store/authStore';

interface ApprovalRequestsPanelProps {
  workOrders: WorkOrder[];
}

/**
 * Supervisor-facing queue of pending "Hold · Approval" requests raised by
 * technicians across every work order. A resolved request drops out of this
 * list immediately (see the `pending`-only filter in WOListView) — its full
 * record (note, decision, resolution note, timestamp) stays visible forever
 * on the work order's own status history.
 */
export function ApprovalRequestsPanel({ workOrders }: ApprovalRequestsPanelProps) {
  const { resolveApprovalRequest, loading } = useApprovalRequest();
  const userProfile = useAuthStore((s) => s.userProfile);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [resolvingKey, setResolvingKey] = useState<string | null>(null);

  const rows = workOrders.flatMap((wo) =>
    (wo.approvalRequests ?? [])
      .filter((r) => r.status === 'pending')
      .map((r) => ({ wo, request: r })),
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

  if (rows.length === 0) {
    return (
      <div className="text-center py-16">
        <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
        <p className="text-gray-500">No pending approval requests.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map(({ wo, request }) => {
        const key = `${wo.id}:${request.id}`;
        const busy = loading && resolvingKey === key;
        return (
          <div key={key} className="bg-white rounded-xl border border-orange-200 p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-gray-900">{wo.woNumber || wo.id}</p>
                <p className="text-sm text-gray-500">{wo.machineName}</p>
              </div>
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-orange-50 text-orange-700 ring-1 ring-orange-200 whitespace-nowrap">
                Pending Approval
              </span>
            </div>
            <div className="bg-orange-50 rounded-lg p-3">
              <p className="text-xs font-medium text-orange-700 uppercase tracking-wide mb-1">
                {request.technicianName} requested
              </p>
              <p className="text-sm text-gray-800">{request.note}</p>
              <p className="text-xs text-gray-400 mt-1">
                {request.requestedAt?.toDate ? request.requestedAt.toDate().toLocaleString() : ''}
              </p>
            </div>
            <textarea
              value={notes[key] ?? ''}
              onChange={(e) => setNotes((n) => ({ ...n, [key]: e.target.value }))}
              rows={2}
              placeholder="Note (optional)"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => handleResolve(wo.id, request.id, 'approved')}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" /> Approve
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => handleResolve(wo.id, request.id, 'rejected')}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-semibold bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50"
              >
                <XCircle className="w-4 h-4" /> Reject
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
