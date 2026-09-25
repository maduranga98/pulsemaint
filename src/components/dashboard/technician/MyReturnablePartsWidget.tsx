import { useMemo, useState } from 'react';
import { addDoc, collection, doc, serverTimestamp, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuthStore } from '../../../store/authStore';
import { useToast } from '../../../hooks/useToast';
import { usePartsRequests } from '../../../hooks/inventory/usePartsRequests';
import { usePartReturns } from '../../../hooks/inventory/usePartReturns';
import { notifyRoles } from '../../../services/notifications.service';
import DashboardWidget from '../shared/DashboardWidget';
import EmptyState from '../shared/EmptyState';
import type { PartsRequest, RequestItem } from '../../../types/inventory';
import type { UserRole } from '../../../types/auth';
import { useTranslation } from 'react-i18next';

const WRITE_OFF_NOTIFY_ROLES: UserRole[] = ['store_keeper', 'plant_manager', 'admin'];

interface ReturnableRow {
  request: PartsRequest;
  item: RequestItem;
  pendingReturnId: string | null;
}

// A technician/trainee's own borrowed (returnable) parts, still with them —
// either not yet handed back, or handed back and awaiting store keeper
// confirmation ("Returning"). Lets them mark an item as returned or cancel
// a return they started by mistake, without leaving the dashboard.
export default function MyReturnablePartsWidget() {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const userId = useAuthStore((s) => s.userProfile?.id) ?? '';
  const userName = useAuthStore((s) => s.userProfile?.fullName) ?? '';
  const companyId = useAuthStore((s) => s.userProfile?.companyId) ?? '';

  const { requests, loading: requestsLoading, error } = usePartsRequests({ ownOnly: true });
  const { returns: myPendingReturns, loading: returnsLoading } = usePartReturns({ ownOnly: true, status: 'pending' });
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [writeOffRow, setWriteOffRow] = useState<ReturnableRow | null>(null);
  const [writeOffReason, setWriteOffReason] = useState('');

  const rows = useMemo<ReturnableRow[]>(() => {
    const out: ReturnableRow[] = [];
    for (const request of requests) {
      for (const item of request.items) {
        if (!item.isReturnable || item.isReturned) continue;
        const pending = myPendingReturns.find(
          (r) => r.partsRequestId === request.id && r.partId === item.partId,
        );
        out.push({ request, item, pendingReturnId: pending?.id ?? null });
      }
    }
    return out;
  }, [requests, myPendingReturns]);

  async function handleReturn(row: ReturnableRow) {
    const key = `${row.request.id}:${row.item.id}`;
    setBusyKey(key);
    try {
      const remaining = (row.item.quantityIssued > 0 ? row.item.quantityIssued : row.item.quantityApproved) - (row.item.quantityReturned ?? 0);
      await addDoc(collection(db, 'partReturns'), {
        companyId,
        partsRequestId: row.request.id,
        requestNumber: row.request.requestNumber,
        partId: row.item.partId,
        partNumber: row.item.partNumber,
        partName: row.item.partName,
        quantity: remaining,
        unit: row.item.unit,
        requestedBy: userId,
        requestedByName: userName,
        requestedAt: serverTimestamp(),
        status: 'pending',
        storeKeeperConfirmedBy: null,
        storeKeeperConfirmedByName: null,
        storeKeeperConfirmedAt: null,
        notes: '',
        workOrderId: row.request.workOrderId,
        workOrderNumber: row.request.workOrderNumber,
        machineId: row.request.machineId,
        machineName: row.request.machineName,
        issuedAt: row.request.issuedAt,
      });
      addToast(t('common.widgets.myReturnablePartsWidget.returnRequested'), 'success');
    } catch (err) {
      addToast(t('common.widgets.myReturnablePartsWidget.returnFailed'), 'error');
      console.error(err);
    } finally {
      setBusyKey(null);
    }
  }

  async function handleCancel(row: ReturnableRow) {
    if (!row.pendingReturnId) return;
    const key = `${row.request.id}:${row.item.id}`;
    setBusyKey(key);
    try {
      await updateDoc(doc(db, 'partReturns', row.pendingReturnId), { status: 'cancelled' });
      addToast(t('common.widgets.myReturnablePartsWidget.returnCancelled'), 'success');
    } catch (err) {
      addToast(t('common.widgets.myReturnablePartsWidget.cancelFailed'), 'error');
      console.error(err);
    } finally {
      setBusyKey(null);
    }
  }

  // The requester giving up on returning an item they were issued — lost,
  // damaged beyond return, consumed during the repair, etc. — instead of
  // physically handing it back. Distinct from handleCancel above, which
  // aborts a return already in progress; this closes out the obligation
  // itself, with a required reason recorded for the store keeper/supervisor/
  // plant manager/admin to see (RequestItemsTable on the request's detail
  // page) and notified about, so it never silently drops off nobody's radar.
  async function handleWriteOff() {
    const row = writeOffRow;
    if (!row || !writeOffReason.trim() || !userId) return;
    const key = `${row.request.id}:${row.item.id}`;
    setBusyKey(key);
    try {
      const updatedItems = row.request.items.map((item) =>
        item.id === row.item.id
          ? {
              ...item,
              isReturned: true,
              isWrittenOff: true,
              writeOffReason: writeOffReason.trim(),
              writeOffBy: userId,
              writeOffByName: userName,
              writeOffAt: Timestamp.now(),
            }
          : item,
      );
      await updateDoc(doc(db, 'partsRequests', row.request.id), {
        items: updatedItems,
        updatedAt: serverTimestamp(),
      });
      void notifyRoles(companyId, WRITE_OFF_NOTIFY_ROLES, {
        type: 'parts',
        message: `${userName} won't be returning ${row.item.partName} (${row.request.requestNumber}): ${writeOffReason.trim()}`,
        oversightMessage: `wrote off ${row.item.partName} from ${row.request.requestNumber} as unreturnable: ${writeOffReason.trim()}`,
        severity: 'medium',
        linkTo: `/app/inventory/requests/${row.request.id}`,
        actorName: userName,
        actorRole: null,
        actorUserId: userId,
      });
      addToast(t('common.widgets.myReturnablePartsWidget.writeOffRecorded'), 'success');
      setWriteOffRow(null);
      setWriteOffReason('');
    } catch (err) {
      addToast(t('common.widgets.myReturnablePartsWidget.writeOffFailed'), 'error');
      console.error(err);
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <DashboardWidget title={t('common.widgets.myReturnablePartsWidget.title')} loading={requestsLoading || returnsLoading} error={error}>
      {rows.length === 0 ? (
        <EmptyState message={t('common.widgets.myReturnablePartsWidget.empty')} subMessage={t('common.widgets.myReturnablePartsWidget.emptySub')} />
      ) : (
        <div className="space-y-2">
          {rows.map((row) => {
            const key = `${row.request.id}:${row.item.id}`;
            const busy = busyKey === key;
            return (
              <div
                key={key}
                className="flex items-center justify-between gap-3 px-3 py-2.5 bg-[#0A1628] rounded-lg border border-[#1E3A5F]"
              >
                <div className="min-w-0">
                  <p className="text-sm text-[#F0F4F8] truncate">{row.item.partName} × {row.item.quantityRequested}</p>
                  <p className="text-[11px] text-[#8BA3BF]">{row.request.requestNumber}{row.request.machineName ? ` · ${row.request.machineName}` : ''}</p>
                </div>
                {row.pendingReturnId ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-purple-500/15 text-purple-300">
                      {t('common.widgets.myReturnablePartsWidget.returning')}
                    </span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleCancel(row)}
                      className="px-2.5 py-1 rounded-md border border-[#1E3A5F] text-[#8BA3BF] hover:text-[#F0F4F8] hover:border-[#2E5A8F] text-xs font-medium disabled:opacity-50"
                    >
                      {busy ? t('common.widgets.myReturnablePartsWidget.cancelling') : t('common.widgets.myReturnablePartsWidget.cancel')}
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => { setWriteOffRow(row); setWriteOffReason(''); }}
                      className="px-2.5 py-1 rounded-md border border-[#1E3A5F] text-[#8BA3BF] hover:text-[#F0F4F8] hover:border-[#2E5A8F] text-xs font-medium disabled:opacity-50"
                    >
                      {t('common.widgets.myReturnablePartsWidget.writeOffButton')}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleReturn(row)}
                      className="px-2.5 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-xs font-medium disabled:opacity-50"
                    >
                      {busy ? t('common.widgets.myReturnablePartsWidget.requesting') : t('common.widgets.myReturnablePartsWidget.return')}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {writeOffRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-[#0F1E35] border border-[#1E3A5F] rounded-xl p-5 max-w-sm w-full space-y-3">
            <div>
              <h3 className="text-sm font-bold text-[#F0F4F8]">
                {t('common.widgets.myReturnablePartsWidget.writeOffTitle', { partName: writeOffRow.item.partName })}
              </h3>
              <p className="text-xs text-[#8BA3BF] mt-1">
                {t('common.widgets.myReturnablePartsWidget.writeOffBody')}
              </p>
            </div>
            <textarea
              autoFocus
              value={writeOffReason}
              onChange={(e) => setWriteOffReason(e.target.value)}
              placeholder={t('common.widgets.myReturnablePartsWidget.writeOffReasonPlaceholder')}
              rows={3}
              className="w-full rounded-lg border border-[#1E3A5F] bg-[#0A1628] px-3 py-2 text-sm text-[#F0F4F8] placeholder:text-[#5C7290] focus:outline-none focus:border-[#2E5A8F]"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setWriteOffRow(null); setWriteOffReason(''); }}
                className="px-3 py-1.5 text-xs font-medium border border-[#1E3A5F] text-[#8BA3BF] rounded-lg hover:text-[#F0F4F8]"
              >
                {t('common.actions.cancel')}
              </button>
              <button
                type="button"
                disabled={!writeOffReason.trim() || busyKey === `${writeOffRow.request.id}:${writeOffRow.item.id}`}
                onClick={() => void handleWriteOff()}
                className="px-3 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white rounded-lg disabled:opacity-50"
              >
                {t('common.widgets.myReturnablePartsWidget.writeOffConfirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardWidget>
  );
}
