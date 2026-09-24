import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, XCircle, Paperclip, X } from 'lucide-react';
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
  const [files, setFiles] = useState<Record<string, File[]>>({});
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
      files[requestId],
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
            {(request.attachments?.length ?? 0) > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {request.attachments!.map((a) => (
                  <a
                    key={a.id}
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 max-w-full px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700 hover:text-blue-600"
                  >
                    <Paperclip className="w-3 h-3 shrink-0" />
                    <span className="truncate">{a.name}</span>
                  </a>
                ))}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-1.5">
              <label className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-gray-600 border border-dashed border-gray-300 hover:border-blue-400 hover:text-blue-600 cursor-pointer">
                <Paperclip className="w-3 h-3" />
                {t('common.widgets.pendingApprovalsWidget.attach', 'Attach (optional)')}
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const picked = Array.from(e.target.files ?? []);
                    e.target.value = '';
                    setFiles((f) => ({ ...f, [request.id]: [...(f[request.id] ?? []), ...picked] }));
                  }}
                />
              </label>
              {(files[request.id] ?? []).map((file, i) => (
                <span key={`${file.name}-${i}`} className="inline-flex items-center gap-1 max-w-full px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-800">
                  <span className="truncate">{file.name}</span>
                  <button
                    type="button"
                    aria-label={t('common.widgets.pendingApprovalsWidget.removeAttachment', 'Remove attachment')}
                    onClick={() => setFiles((f) => ({ ...f, [request.id]: (f[request.id] ?? []).filter((_, j) => j !== i) }))}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
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
