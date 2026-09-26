import { useState } from 'react';
import { X, Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import { createStaffRequest } from '@/services/staffRequests.service';
import { notifyUsers } from '@/services/notifications.service';
import type { UserRole } from '@/types/auth';
import {
  STAFF_REQUEST_CATEGORIES,
  type StaffRequestCategory,
  type StaffRequestRecipientRole,
} from '@/types/staffRequest';
import { canGrantRecords } from '@/types/recordAccessGrant';
import { AttachmentPicker } from './Attachments';
import { useEligibleRequestRecipients } from '../useRequestRecipients';
import { categoryLabel, field, labelCls, roleLabel } from '../requestUi';

interface Props {
  onClose: () => void;
}

export default function NewRequestModal({ onClose }: Props) {
  const { t } = useTranslation();
  const toast = useToast();
  const profile = useAuthStore((s) => s.userProfile);
  const { recipients: eligible, loading: recipientsLoading } = useEligibleRequestRecipients();

  const [category, setCategory] = useState<StaffRequestCategory>('work');
  const [recipientId, setRecipientId] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [reference, setReference] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  // Only plant managers and admins can share past WO / breakdown records.
  const recipients = category === 'record_access' ? eligible.filter((u) => canGrantRecords(u.role)) : eligible;

  async function submit() {
    if (!profile?.companyId) return;
    const recipient = recipients.find((u) => u.id === recipientId);
    if (!recipient) {
      toast.error(t('common.staffRequests.newRequest.errors.recipient'));
      return;
    }
    if (!subject.trim() || !message.trim()) {
      toast.error(t('common.staffRequests.newRequest.errors.required'));
      return;
    }
    const recipientRole = recipient.role as StaffRequestRecipientRole;
    setSaving(true);
    try {
      await createStaffRequest({
        plantId: profile.plantId ?? null,
        department: profile.department ?? null,
        recipientRole,
        recipientUserId: recipient.id,
        recipientName: recipient.fullName,
        companyId: profile.companyId,
        requesterId: profile.id,
        requesterName: profile.fullName ?? '',
        requesterRole: profile.role,
        category,
        subject: subject.trim(),
        message: message.trim(),
        reference: category === 'record_access' && reference.trim() ? reference.trim() : null,
        files,
      });
      void notifyUsers(profile.companyId, [recipient.id], {
        type: 'request',
        message: t('common.staffRequests.notifications.newRequest', {
          name: profile.fullName ?? '',
          category: categoryLabel(category, t),
          subject: subject.trim(),
        }),
        linkTo: '/app/requests/inbox',
        actorName: profile.fullName ?? '',
        actorRole: profile.role as UserRole,
        actorUserId: profile.id,
        plantId: profile.plantId ?? null,
        department: recipientRole === 'supervisor' ? profile.department ?? null : null,
      });
      toast.success(t('common.staffRequests.newRequest.sent'));
      onClose();
    } catch (err) {
      console.error(err);
      toast.error(t('common.staffRequests.newRequest.failed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-[#1E3A5F] bg-[#0F1E35] shadow-xl">
        <div className="flex items-center justify-between border-b border-[#1E3A5F] px-5 py-4">
          <h2 className="text-base font-semibold text-[#F0F4F8]">{t('common.staffRequests.newRequest.title')}</h2>
          <button type="button" onClick={onClose} className="text-[#8BA3BF] hover:text-[#F0F4F8]" aria-label={t('common.staffRequests.close')}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div>
            <label className={labelCls}>{t('common.staffRequests.newRequest.category')}</label>
            <select
              value={category}
              onChange={(e) => {
                const next = e.target.value as StaffRequestCategory;
                setCategory(next);
                const current = eligible.find((u) => u.id === recipientId);
                if (next === 'record_access' && current && !canGrantRecords(current.role)) setRecipientId('');
              }}
              className={field}
            >
              {STAFF_REQUEST_CATEGORIES.map((c) => (
                <option key={c} value={c}>{categoryLabel(c, t)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls}>{t('common.staffRequests.newRequest.sendTo')}</label>
            <select value={recipientId} onChange={(e) => setRecipientId(e.target.value)} className={field}>
              <option value="">
                {recipientsLoading ? t('common.staffRequests.newRequest.loadingPeople') : t('common.staffRequests.newRequest.choosePerson')}
              </option>
              {recipients.map((u) => (
                <option key={u.id} value={u.id}>{u.fullName} ({roleLabel(u.role, t)})</option>
              ))}
            </select>
            {category === 'record_access' && (
              <p className="mt-1 text-xs text-[#8BA3BF]">{t('common.staffRequests.records.recipientHint')}</p>
            )}
            {!recipientsLoading && recipients.length === 0 && (
              <p className="mt-1 text-xs text-[#FBBF24]">{t('common.staffRequests.newRequest.noRecipients')}</p>
            )}
          </div>

          {category === 'record_access' && (
            <div>
              <label className={labelCls}>{t('common.staffRequests.newRequest.reference')}</label>
              <input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder={t('common.staffRequests.newRequest.referencePlaceholder')}
                className={field}
              />
            </div>
          )}

          <div>
            <label className={labelCls}>{t('common.staffRequests.newRequest.subject')}</label>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={150} className={field} />
          </div>

          <div>
            <label className={labelCls}>{t('common.staffRequests.newRequest.message')}</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} className={field} />
          </div>

          <AttachmentPicker
            files={files}
            onChange={setFiles}
            disabled={saving}
            onRejected={(name) => toast.error(t('common.staffRequests.attachments.tooLarge', { name }))}
          />
        </div>

        <div className="flex justify-end gap-2 border-t border-[#1E3A5F] px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-[#1E3A5F] px-4 py-2 text-sm font-medium text-[#B8C7DB] hover:border-[#2E5A8F]"
          >
            {t('common.staffRequests.cancel')}
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#1A56DB] px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
          >
            <Send className="h-4 w-4" />
            {saving ? t('common.staffRequests.sending') : t('common.staffRequests.newRequest.send')}
          </button>
        </div>
      </div>
    </div>
  );
}
