import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import type { PartsRequest, PurchaseOrder } from '@/types/inventory';

interface PartActiveRequestsTabProps {
  partId: string;
}

const WAITING_REQUEST_STATUSES = new Set(['pending_storekeeper', 'pending_supervisor']);
const WAITING_PO_STATUSES = new Set(['pending_approval']);

// Live view of anything still waiting on a permission for this specific
// part — Parts Requests sitting with the store keeper/supervisor, and
// Purchase Orders awaiting approval — mirroring the same "waiting
// permissions" definition as the dashboard's Active Requests stat.
export function PartActiveRequestsTab({ partId }: PartActiveRequestsTabProps) {
  const companyId = useAuthStore((s) => s.userProfile?.companyId);
  const [requests, setRequests] = useState<PartsRequest[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    let requestsLoaded = false;
    let ordersLoaded = false;
    const maybeDone = () => {
      if (requestsLoaded && ordersLoaded) setLoading(false);
    };

    const unsubRequests = onSnapshot(
      query(collection(db, 'partsRequests'), where('companyId', '==', companyId)),
      (snap) => {
        setRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as PartsRequest[]);
        requestsLoaded = true;
        maybeDone();
      },
      () => { requestsLoaded = true; maybeDone(); },
    );
    const unsubOrders = onSnapshot(
      query(collection(db, 'purchaseOrders'), where('companyId', '==', companyId)),
      (snap) => {
        setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as PurchaseOrder[]);
        ordersLoaded = true;
        maybeDone();
      },
      () => { ordersLoaded = true; maybeDone(); },
    );

    return () => {
      unsubRequests();
      unsubOrders();
    };
  }, [companyId]);

  const relevantRequests = requests.filter(
    (r) => WAITING_REQUEST_STATUSES.has(r.status) && r.items.some((it) => it.partId === partId),
  );
  const relevantOrders = orders.filter(
    (o) => WAITING_PO_STATUSES.has(o.status) && o.items.some((it) => it.partId === partId),
  );

  if (loading) {
    return <div className="text-sm text-gray-400 py-8 text-center">Loading active requests…</div>;
  }

  if (relevantRequests.length === 0 && relevantOrders.length === 0) {
    return <div className="text-sm text-gray-500 py-8 text-center">No active requests waiting on approval for this part.</div>;
  }

  return (
    <div className="space-y-4">
      {relevantRequests.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900 text-sm">Parts Requests Awaiting Approval</h3>
          </div>
          <ul className="divide-y divide-gray-100">
            {relevantRequests.map((r) => {
              const item = r.items.find((it) => it.partId === partId);
              return (
                <li key={r.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div>
                    <Link to={`/app/inventory/requests/${r.id}`} className="font-medium text-blue-700 hover:underline text-sm">
                      {r.requestNumber}
                    </Link>
                    <p className="text-xs text-gray-500">
                      {item ? `Qty ${item.quantityRequested}` : ''} · Requested by {r.requestedByName}
                    </p>
                  </div>
                  <span className="text-xs font-medium px-2 py-1 rounded-full bg-amber-100 text-amber-700">
                    {r.status === 'pending_storekeeper' ? 'Awaiting Store Keeper' : 'Awaiting Supervisor'}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {relevantOrders.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900 text-sm">Purchase Orders Awaiting Approval</h3>
          </div>
          <ul className="divide-y divide-gray-100">
            {relevantOrders.map((o) => {
              const item = o.items.find((it) => it.partId === partId);
              return (
                <li key={o.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div>
                    <Link to={`/app/inventory/purchase-orders/${o.id}`} className="font-medium text-blue-700 hover:underline text-sm">
                      {o.poNumber}
                    </Link>
                    <p className="text-xs text-gray-500">
                      {item ? `Qty ${item.quantityOrdered}` : ''} · {o.supplierName}
                    </p>
                  </div>
                  <span className="text-xs font-medium px-2 py-1 rounded-full bg-amber-100 text-amber-700">
                    Pending Approval
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
