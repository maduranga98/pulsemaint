import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Send, CheckCircle2, RotateCcw, Share2, Ban } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import { addStaffRequestReply, setStaffRequestStatus } from '@/services/staffRequests.service';
import { notifyUsers } from '@/services/notifications.service';
import type { UserRole } from '@/types/auth';
import type { StaffRequest, StaffRequestStatus } from '@/types/staffRequest';
import { canGrantRecords, type RecordAccessGrant } from '@/types/recordAccessGrant';
import { isGrantActive } from '@/lib/recordAccess';
import { rejectRecordRequest, subscribeRequestRecordGrants } from '@/services/recordAccessGrants.service';
import { AttachmentList, AttachmentPicker } from './Attachments';
import GrantRecordsModal from './GrantRecordsModal';
import SharedRecordsPanel from './SharedRecordsPanel';
import { useRequestRecipients } from '../useRequestRecipients';
import { useMyGrants } from '../myGrantsContext';
import { useNow } from '../useNow';
import {
  categoryLabel,
  field,
  fmtTs,
  recipientLabel,
  roleLabel,
  STATUS_COLOR,
  statusLabel,
} from '../requestUi';

interface Props {
  request: StaffRequest;
  /** requester: the person who raised it; handler: supervisor / plant manager / admin it was sent to. */
  mode: 'requester' | 'handler';
}

export default function RequestCard({ request: r, mode }: Props) {
  const { t } = useTranslation();
  const toast = useToast();
  const profile = useAuthStore((s) => s.userProfile);
  const resolveRecipients = useRequestRecipients();

  const [open, setOpen] = useState(false);
  const [reply, setReply] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  const isClosed = r.status === 'closed';
  const isRecordAccess = r.category === 'record_access';
  const isGrantor = mode === 'handler' && isRecordAccess && canGrantRecords(profile?.role);
  const [showGrant, setShowGrant] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const now = useNow();

  // Requester: shares come from the page-level subscription (grantees can
  // only query by their own id). Grantor: this request's shares, once opened.
  const myGrants = useMyGrants();
  const [requestGrants, setRequestGrants] = useState<RecordAccessGrant[]>([]);
  useEffect(() => {
    if (!isGrantor || !open || !profile?.companyId) return;
    return subscribeRequestRecordGrants(profile.companyId, r.id, setRequestGrants, (msg) => console.error(msg));
  }, [isGrantor, open, profile?.companyId, r.id]);
  const grants = mode === 'requester' ? myGrants.filter((g) => g.requestId === r.id) : requestGrants;
  const activeShares = mode === 'requester' ? grants.filter((g) => isGrantActive(g, now)).length : 0;

  async function reject() {
    if (!profile?.companyId) return;
    setSaving(true);
    try {
      await rejectRecordRequest({
        requestId: r.id,
        author: { id: profile.id, name: profile.fullName ?? '', role: profile.role },
        message: rejectReason.trim() || t('common.staffRequests.records.reject.defaultMessage'),
      });
      notifyOtherSide(t('common.staffRequests.records.reject.notification', { name: profile.fullName ?? '', subject: r.subject }));
      setRejecting(false);
      setRejectReason('');
      toast.success(t('common.staffRequests.records.reject.done'));
    } catch (err) {
      console.error(err);
      toast.error(t('common.staffRequests.reply.failed'));
    } finally {
      setSaving(false);
    }
  }

  function notifyOtherSide(message: string) {
    if (!profile?.companyId) return;
    const targets = mode === 'handler' ? [r.requesterId] : resolveRecipients(r);
    void notifyUsers(profile.companyId, targets, {
      type: 'request',
      message,
      linkTo: mode === 'handler' ? '/app/requests' : '/app/requests/inbox',
      actorName: profile.fullName ?? '',
      actorRole: profile.role as UserRole,
      actorUserId: profile.id,
      plantId: r.plantId,
      department: r.recipientRole === 'supervisor' ? r.department : null,
    });
  }

  async function sendReply(close: boolean) {
    if (!profile?.companyId) return;
    if (!reply.trim() && files.length === 0) {
      toast.error(t('common.staffRequests.reply.errors.empty'));
      return;
    }
    // A handler's reply marks the request answered; the requester following
    // up re-opens it for the handlers.
    const nextStatus: StaffRequestStatus = close ? 'closed' : mode === 'handler' ? 'answered' : 'open';
    setSaving(true);
    try {
      await addStaffRequestReply({
        companyId: profile.companyId,
        requestId: r.id,
        authorId: profile.id,
        authorName: profile.fullName ?? '',
        authorRole: profile.role,
        message: reply.trim(),
        files,
        status: nextStatus,
      });
      notifyOtherSide(
        t('common.staffRequests.notifications.newReply', { name: profile.fullName ?? '', subject: r.subject }),
      );
      setReply('');
      setFiles([]);
      toast.success(t('common.staffRequests.reply.sent'));
    } catch (err) {
      console.error(err);
      toast.error(t('common.staffRequests.reply.failed'));
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(status: StaffRequestStatus) {
    setSaving(true);
    try {
      await setStaffRequestStatus(r.id, status);
      if (status === 'closed') {
        notifyOtherSide(
          t('common.staffRequests.notifications.closed', { name: profile?.fullName ?? '', subject: r.subject }),
        );
      }
    } catch (err) {
      console.error(err);
      toast.error(t('common.staffRequests.reply.failed'));
    } finally {
      setSaving(false);
    }
  }

  const who =
    mode === 'handler'
      ? `${r.requesterName} (${roleLabel(r.requesterRole, t)})${r.department ? ` · ${r.department}` : ''}`
      : t('common.staffRequests.card.sentTo', {
          to: r.recipientName
            ? `${r.recipientName} (${roleLabel(r.recipientRole, t)})`
            : recipientLabel(r.recipientRole, t),
        });

  return (
    <div className="rounded-lg border border-[#1E3A5F] bg-[#0F1E35]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
        aria-expanded={open}
      >
        {open ? <ChevronDown className="h-4 w-4 shrink-0 text-[#8BA3BF]" /> : <ChevronRight className="h-4 w-4 shrink-0 text-[#8BA3BF]" />}
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium text-[#F0F4F8]">{r.subject}</div>
          <div className="truncate text-xs text-[#8BA3BF]">
            {categoryLabel(r.category, t)} · {who}
          </div>
        </div>
        {r.replies.length > 0 && (
          <span className="hidden shrink-0 text-xs text-[#8BA3BF] sm:inline">
            {t('common.staffRequests.card.replies', { count: r.replies.length })}
          </span>
        )}
        {activeShares > 0 && (
          <span className="shrink-0 rounded-full bg-[#10B981]/15 px-2 py-0.5 text-xs font-medium text-[#34D399]">
            {t('common.staffRequests.records.sharedCount', { count: activeShares })}
          </span>
        )}
        {isRecordAccess && r.decision === 'rejected' && (
          <span className="shrink-0 rounded-full bg-[#EF4444]/15 px-2 py-0.5 text-xs font-medium text-[#F87171]">
            {t('common.staffRequests.records.decision.rejected')}
          </span>
        )}
        <span className="hidden shrink-0 text-xs text-[#8BA3BF] md:inline">{fmtTs(r.updatedAt ?? r.createdAt)}</span>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[r.status]}`}>
          {statusLabel(r.status, t)}
        </span>
      </button>

      {open && (
        <div className="space-y-3 border-t border-[#1E3A5F] px-3 py-3">
          <div className="rounded-lg border border-[#1E3A5F] bg-[#0A1628] px-3 py-2">
            <div className="text-xs text-[#8BA3BF]">
              {r.requesterName} ({roleLabel(r.requesterRole, t)}) · {fmtTs(r.createdAt)}
            </div>
            {r.reference && (
              <div className="mt-1 text-xs text-[#93C5FD]">
                {t('common.staffRequests.card.reference', {
                  reference: r.referenceMachineName ? `${r.reference} · ${r.referenceMachineName}` : r.reference,
                })}
              </div>
            )}
            <p className="mt-1 whitespace-pre-wrap text-sm text-[#F0F4F8]">{r.message}</p>
            <AttachmentList attachments={r.attachments} />
          </div>

          {r.replies.length > 0 && (
            <ul className="space-y-2">
              {r.replies.map((rep) => {
                const mine = rep.authorId === profile?.id;
                return (
                  <li
                    key={rep.id}
                    className={`rounded-lg border px-3 py-2 ${mine ? 'border-[#1A56DB]/40 bg-[#1A56DB]/10' : 'border-[#1E3A5F] bg-[#0A1628]'}`}
                  >
                    <div className="text-xs text-[#8BA3BF]">
                      {rep.authorName} ({roleLabel(rep.authorRole, t)}) · {fmtTs(rep.createdAt)}
                    </div>
                    {rep.message && <p className="mt-1 whitespace-pre-wrap text-sm text-[#F0F4F8]">{rep.message}</p>}
                    <AttachmentList attachments={rep.attachments} />
                  </li>
                );
              })}
            </ul>
          )}

          {isRecordAccess && grants.length > 0 && (mode === 'handler' || activeShares > 0) && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-[#8BA3BF]">
                {mode === 'handler' ? t('common.staffRequests.records.sharedHeadingGrantor') : t('common.staffRequests.records.sharedHeading')}
              </div>
              <SharedRecordsPanel grants={grants} mode={mode === 'handler' ? 'grantor' : 'viewer'} />
            </div>
          )}

          {isGrantor && !isClosed && (
            <div className="space-y-2 rounded-lg border border-[#10B981]/30 bg-[#10B981]/5 p-3">
              <div className="text-xs font-medium text-[#8BA3BF]">{t('common.staffRequests.records.decisionHeading')}</div>
              {rejecting ? (
                <>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    rows={2}
                    placeholder={t('common.staffRequests.records.reject.placeholder')}
                    className={field}
                  />
                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setRejecting(false)}
                      disabled={saving}
                      className="rounded-lg border border-[#1E3A5F] px-3 py-2 text-sm font-medium text-[#B8C7DB] hover:border-[#2E5A8F]"
                    >
                      {t('common.staffRequests.cancel')}
                    </button>
                    <button
                      type="button"
                      onClick={() => void reject()}
                      disabled={saving}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#DC2626] px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                    >
                      <Ban className="h-4 w-4" /> {t('common.staffRequests.records.reject.confirm')}
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setShowGrant(true)}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#10B981] px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                  >
                    <Share2 className="h-4 w-4" /> {t('common.staffRequests.records.shareButton')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRejecting(true)}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#7F1D1D] px-4 py-2 text-sm font-medium text-[#F87171] hover:bg-[#7F1D1D]/20 disabled:opacity-60"
                  >
                    <Ban className="h-4 w-4" /> {t('common.staffRequests.records.reject.button')}
                  </button>
                </div>
              )}
            </div>
          )}

          {isClosed ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-[#8BA3BF]">
                {t('common.staffRequests.card.closedOn', { date: fmtTs(r.closedAt) })}
              </p>
              <button
                type="button"
                onClick={() => void changeStatus('open')}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#1E3A5F] px-3 py-1.5 text-xs font-medium text-[#B8C7DB] hover:border-[#2E5A8F] disabled:opacity-60"
              >
                <RotateCcw className="h-3.5 w-3.5" /> {t('common.staffRequests.reply.reopen')}
              </button>
            </div>
          ) : (
            <div className="space-y-2 rounded-lg border border-[#1E3A5F] bg-[#0A1628] p-3">
              <div className="text-xs font-medium text-[#8BA3BF]">
                {mode === 'handler' ? t('common.staffRequests.reply.headingHandler') : t('common.staffRequests.reply.headingRequester')}
              </div>
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                rows={3}
                placeholder={t('common.staffRequests.reply.placeholder')}
                className={field}
              />
              <AttachmentPicker
                files={files}
                onChange={setFiles}
                disabled={saving}
                onRejected={(name) => toast.error(t('common.staffRequests.attachments.tooLarge', { name }))}
              />
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => void changeStatus('closed')}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#1E3A5F] px-3 py-2 text-sm font-medium text-[#B8C7DB] hover:border-[#2E5A8F] disabled:opacity-60"
                >
                  <CheckCircle2 className="h-4 w-4" /> {t('common.staffRequests.reply.close')}
                </button>
                {mode === 'handler' && (
                  <button
                    type="button"
                    onClick={() => void sendReply(true)}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#1A56DB] px-3 py-2 text-sm font-bold text-[#5B8DEF] disabled:opacity-60"
                  >
                    {t('common.staffRequests.reply.sendAndClose')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void sendReply(false)}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#1A56DB] px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                >
                  <Send className="h-4 w-4" /> {saving ? t('common.staffRequests.sending') : t('common.staffRequests.reply.send')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {showGrant && <GrantRecordsModal request={r} onClose={() => setShowGrant(false)} />}
    </div>
  );
}
