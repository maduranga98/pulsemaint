import { useMemo, useState } from 'react';
import { addDoc, collection, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuthStore } from '../../../store/authStore';
import { useToast } from '../../../hooks/useToast';
import { usePartsRequests } from '../../../hooks/inventory/usePartsRequests';
import { usePartReturns } from '../../../hooks/inventory/usePartReturns';
import DashboardWidget from '../shared/DashboardWidget';
import EmptyState from '../shared/EmptyState';
import type { PartsRequest, RequestItem } from '../../../types/inventory';

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
  const { addToast } = useToast();
  const userId = useAuthStore((s) => s.userProfile?.id) ?? '';
  const userName = useAuthStore((s) => s.userProfile?.fullName) ?? '';
  const companyId = useAuthStore((s) => s.userProfile?.companyId) ?? '';

  const { requests, loading: requestsLoading, error } = usePartsRequests({ ownOnly: true });
  const { returns: myPendingReturns, loading: returnsLoading } = usePartReturns({ ownOnly: true, status: 'pending' });
  const [busyKey, setBusyKey] = useState<string | null>(null);

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
      addToast('Return requested — a store keeper will confirm it.', 'success');
    } catch (err) {
      addToast('Failed to request return.', 'error');
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
      addToast('Return cancelled.', 'success');
    } catch (err) {
      addToast('Failed to cancel return.', 'error');
      console.error(err);
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <DashboardWidget title="My Returnable Parts" loading={requestsLoading || returnsLoading} error={error}>
      {rows.length === 0 ? (
        <EmptyState message="Nothing to return" subMessage="Returnable parts you've collected will appear here until they're handed back." />
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
                      Returning
                    </span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleCancel(row)}
                      className="px-2.5 py-1 rounded-md border border-[#1E3A5F] text-[#8BA3BF] hover:text-[#F0F4F8] hover:border-[#2E5A8F] text-xs font-medium disabled:opacity-50"
                    >
                      {busy ? 'Cancelling…' : 'Cancel'}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleReturn(row)}
                    className="shrink-0 px-2.5 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-xs font-medium disabled:opacity-50"
                  >
                    {busy ? 'Requesting…' : 'Return'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </DashboardWidget>
  );
}
