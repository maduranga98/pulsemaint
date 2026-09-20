import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, XCircle, ChevronDown, Paperclip } from 'lucide-react';
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
  const { t } = useTranslation();
  const { resolveApprovalRequest, loading } = useApprovalRequest();
  const userProfile = useAuthStore((s) => s.userProfile);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [resolvingKey, setResolvingKey] = useState<string | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

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
        <p className="text-gray-500">{t('common.workOrders.approvalRequests.noPendingRequests')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map(({ wo, request }) => {
        const key = `${wo.id}:${request.id}`;
        const busy = loading && resolvingKey === key;
        const expanded = expandedKey === key;
        return (
          <div key={key} className="bg-white rounded-xl border border-orange-200 p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-orange-50 text-orange-700 ring-1 ring-orange-200 whitespace-nowrap">
                {t('common.workOrders.approvalRequests.pendingApprovalBadge')}
              </span>
            </div>

            <div className="bg-orange-50 rounded-lg p-3 space-y-2">
              <p className="text-xs font-medium text-orange-700 uppercase tracking-wide">
                {t('common.workOrders.approvalRequests.requestedByLabel', { name: request.technicianName })}
              </p>
              <p className="text-sm text-gray-800">{request.note}</p>
              <p className="text-xs text-gray-400">
                {request.requestedAt?.toDate ? request.requestedAt.toDate().toLocaleString() : ''}
              </p>
              {request.attachments && request.attachments.length > 0 && (
                <div className="space-y-1 pt-1">
                  <p className="text-xs font-medium text-orange-700 uppercase tracking-wide">
                    {t('common.workOrders.approvalRequests.attachmentsLabel')}
                  </p>
                  {request.attachments.map((a) => (
                    <a
                      key={a.id}
                      href={a.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 text-sm text-blue-700 hover:underline"
                    >
                      <Paperclip className="w-3.5 h-3.5 shrink-0" /> {a.name}
                    </a>
                  ))}
                </div>
              )}
            </div>

            <textarea
              value={notes[key] ?? ''}
              onChange={(e) => setNotes((n) => ({ ...n, [key]: e.target.value }))}
              rows={2}
              placeholder={t('common.workOrders.approvalRequests.notePlaceholder')}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => handleResolve(wo.id, request.id, 'approved')}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" /> {t('common.workOrders.approvalRequests.approveButton')}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => handleResolve(wo.id, request.id, 'rejected')}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-semibold bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50"
              >
                <XCircle className="w-4 h-4" /> {t('common.workOrders.approvalRequests.rejectButton')}
              </button>
            </div>

            <div className="border-t border-gray-100 pt-2">
              <button
                type="button"
                onClick={() => setExpandedKey(expanded ? null : key)}
                className="flex w-full items-center justify-between text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                <span>{wo.woNumber || wo.id} · {wo.machineName}</span>
                <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
              </button>
              {expanded && (
                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-gray-600">
                  <p><span className="text-gray-400">{t('common.workOrders.approvalRequests.woNumberLabel')}:</span> {wo.woNumber || wo.id}</p>
                  <p><span className="text-gray-400">{t('common.workOrders.approvalRequests.machineLabel')}:</span> {wo.machineName}</p>
                  <p><span className="text-gray-400">{t('common.workOrders.approvalRequests.priorityLabel')}:</span> {wo.priority}</p>
                  <p><span className="text-gray-400">{t('common.workOrders.approvalRequests.statusLabel')}:</span> {wo.status}</p>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
