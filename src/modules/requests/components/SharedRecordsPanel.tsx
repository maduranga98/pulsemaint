import { useState } from 'react';
import { Eye, Trash2, Wrench, AlertTriangle, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/hooks/useToast';
import { formatTimeLeft, isGrantActive } from '@/lib/recordAccess';
import { revokeRecordGrant } from '@/services/recordAccessGrants.service';
import type { RecordAccessGrant } from '@/types/recordAccessGrant';
import SharedRecordViewer from './SharedRecordViewer';
import { useNow } from '../useNow';
import { fmtTs } from '../requestUi';

/**
 * Records shared through record_access requests.
 * - viewer: the requester — only unexpired shares, each openable read-only.
 * - grantor: the plant manager / admin who shared them — every share of the
 *   request, with its expiry state and a Revoke action.
 */
export default function SharedRecordsPanel({
  grants,
  mode,
  showRequestSubject,
}: {
  grants: RecordAccessGrant[];
  mode: 'viewer' | 'grantor';
  showRequestSubject?: (g: RecordAccessGrant) => string | undefined;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const now = useNow();
  const [viewing, setViewing] = useState<RecordAccessGrant | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const rows = mode === 'viewer' ? grants.filter((g) => isGrantActive(g, now)) : grants;
  // Close an open viewer the moment its share expires.
  const openGrant = viewing && (mode === 'grantor' || isGrantActive(viewing, now)) ? viewing : null;

  async function revoke(g: RecordAccessGrant) {
    if (!window.confirm(t('common.staffRequests.records.revokeConfirm', { number: g.recordNumber }))) return;
    setBusyId(g.id);
    try {
      await revokeRecordGrant(g.id);
      toast.success(t('common.staffRequests.records.revoked'));
    } catch (err) {
      console.error(err);
      toast.error(t('common.staffRequests.reply.failed'));
    } finally {
      setBusyId(null);
    }
  }

  if (rows.length === 0) return null;

  return (
    <>
      <ul className="space-y-2">
        {rows.map((g) => {
          const active = isGrantActive(g, now);
          const Icon = g.recordType === 'work_order' ? Wrench : AlertTriangle;
          const subject = showRequestSubject?.(g);
          return (
            <li key={g.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-[#1E3A5F] bg-[#0A1628] px-3 py-2">
              <Icon className="h-4 w-4 shrink-0 text-[#5B8DEF]" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-[#F0F4F8]">
                  {g.recordNumber}
                  {g.machineName ? <span className="font-normal text-[#8BA3BF]"> · {g.machineName}</span> : null}
                </div>
                <div className="flex flex-wrap items-center gap-1 text-xs text-[#8BA3BF]">
                  <Clock className="h-3 w-3" />
                  {active
                    ? t('common.staffRequests.records.availableUntil', { date: fmtTs(g.expiresAt), left: formatTimeLeft(g.expiresAt, now) })
                    : t('common.staffRequests.records.expiredOn', { date: fmtTs(g.expiresAt) })}
                  {mode === 'viewer' && <> · {t('common.staffRequests.records.sharedBy', { name: g.grantedByName })}</>}
                  {subject && <> · {subject}</>}
                </div>
              </div>
              {mode === 'grantor' && !active && (
                <span className="rounded-full bg-[#475569]/30 px-2 py-0.5 text-xs text-[#94A3B8]">
                  {t('common.staffRequests.records.expired')}
                </span>
              )}
              <button
                type="button"
                onClick={() => setViewing(g)}
                className="inline-flex items-center gap-1 rounded-lg border border-[#1E3A5F] px-2.5 py-1 text-xs font-medium text-[#B8C7DB] hover:border-[#2E5A8F]"
              >
                <Eye className="h-3.5 w-3.5" /> {t('common.staffRequests.records.view')}
              </button>
              {mode === 'grantor' && (
                <button
                  type="button"
                  onClick={() => void revoke(g)}
                  disabled={busyId === g.id}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#7F1D1D] px-2.5 py-1 text-xs font-medium text-[#F87171] hover:bg-[#7F1D1D]/20 disabled:opacity-60"
                >
                  <Trash2 className="h-3.5 w-3.5" /> {active ? t('common.staffRequests.records.revoke') : t('common.staffRequests.records.remove')}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {openGrant && <SharedRecordViewer grant={openGrant} onClose={() => setViewing(null)} />}
    </>
  );
}
