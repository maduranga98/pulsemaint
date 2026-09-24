import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, XCircle, Paperclip, X } from 'lucide-react';
import { useWorkOrders } from '../../../hooks/useWorkOrders';
import { useApprovalRequest } from '../../../hooks/useApprovalRequest';
import { WODetailPanel } from '../../workorders/WODetailPanel';
import { usePartsRequests } from '../../../hooks/inventory/usePartsRequests';
import { useAuthStore } from '../../../store/authStore';
import DashboardWidget from '../shared/DashboardWidget';
import EmptyState from '../shared/EmptyState';
import { useRecordPlantMatcher } from '../../../hooks/useRecordPlantMatcher';

/**
 * "Hold · Approval" requests raised by technicians/trainees that are still
 * waiting on a supervisor/plant manager/admin. Each request can be approved
 * or rejected right here; clicking a row opens the work order's detail panel
 * (same one as the Work Orders page) for the full context / a resolution note.
 *
 * Also lists parts requests the store keeper escalated for supervisor
 * approval: a supervisor sees only the ones sent to them (the linked WO's
 * supervisor-in-charge, or the supervisor picked at escalation); plant
 * managers / admins see every escalated request in their plant. Clicking one
 * opens the request's detail page, where it's approved/rejected.
 */
export default function PendingApprovalsWidget() {
  const { t } = useTranslation();
  const { workOrders, loading, error, refetch } = useWorkOrders();
  const inScopedPlant = useRecordPlantMatcher();
  const me = useAuthStore((s) => s.userProfile);
  const navigate = useNavigate();
  const { resolveApprovalRequest, loading: resolving } = useApprovalRequest();
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  // Optional note + attachments per request, sent with the approve/reject.
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, File[]>>({});
  const [openWoId, setOpenWoId] = useState<string | null>(null);
  const openWo = openWoId ? workOrders.find((w) => w.id === openWoId) ?? null : null;

  async function handleResolve(woId: string, requestId: string, decision: 'approved' | 'rejected') {
    if (!me) return;
    setResolvingId(requestId);
    const ok = await resolveApprovalRequest(
      woId,
      me.companyId,
      requestId,
      decision,
      me.id,
      me.fullName ?? '',
      notes[requestId] ?? '',
      files[requestId],
    );
    if (ok) {
      setNotes((n) => ({ ...n, [requestId]: '' }));
      setFiles((f) => ({ ...f, [requestId]: [] }));
    }
    setResolvingId(null);
  }
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
                  {(request.attachments?.length ?? 0) > 0 && (
                    <div className="flex flex-wrap gap-1.5 px-3 pb-2">
                      {request.attachments!.map((a) => (
                        <a
                          key={a.id}
                          href={a.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 max-w-full px-2 py-0.5 rounded text-[11px] bg-[#1E3A5F] text-[#8BA3BF] hover:text-[#F0F4F8]"
                        >
                          <Paperclip className="w-3 h-3 shrink-0" />
                          <span className="truncate">{a.name}</span>
                        </a>
                      ))}
                    </div>
                  )}
                  <div className="px-3 pb-2 space-y-2">
                    <textarea
                      value={notes[request.id] ?? ''}
                      onChange={(e) => setNotes((n) => ({ ...n, [request.id]: e.target.value }))}
                      rows={1}
                      placeholder={t('common.widgets.pendingApprovalsWidget.notePlaceholder')}
                      className="w-full rounded-md bg-[#0F1E35] border border-[#1E3A5F] px-2.5 py-1.5 text-xs text-[#F0F4F8] placeholder:text-[#5A7390] focus:outline-none focus:ring-1 focus:ring-[#1A56DB]"
                    />
                    <div className="flex flex-wrap items-center gap-1.5">
                      <label className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-[#8BA3BF] border border-dashed border-[#1E3A5F] hover:text-[#F0F4F8] hover:border-[#1A56DB] cursor-pointer">
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
                        <span
                          key={`${file.name}-${i}`}
                          className="inline-flex items-center gap-1 max-w-full px-2 py-0.5 rounded text-[11px] bg-[#1E3A5F] text-[#F0F4F8]"
                        >
                          <span className="truncate">{file.name}</span>
                          <button
                            type="button"
                            aria-label={t('common.widgets.pendingApprovalsWidget.removeAttachment', 'Remove attachment')}
                            onClick={() =>
                              setFiles((f) => ({ ...f, [request.id]: (f[request.id] ?? []).filter((_, j) => j !== i) }))
                            }
                            className="text-[#8BA3BF] hover:text-red-400"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
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

          {partsRows.length > 0 && (
            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8BA3BF]">
                {t('common.widgets.pendingApprovalsWidget.partsRequests', 'Parts requests escalated for approval')}
              </p>
              {partsRows.slice(0, 4).map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => navigate(`/app/inventory/requests/${r.id}`)}
                  className="block w-full text-left bg-[#0A1628] rounded-lg border border-[#1E3A5F] p-3 space-y-2 hover:border-[#1A56DB] transition-colors"
                >
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
                </button>
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
      {openWo && <WODetailPanel workOrder={openWo} onClose={() => setOpenWoId(null)} />}
    </DashboardWidget>
  );
}
