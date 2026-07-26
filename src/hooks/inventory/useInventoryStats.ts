import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import type { InventoryStats, InventoryPart, PartsRequest, PurchaseOrder } from '@/types/inventory';
import { getStockStatus } from '@/lib/inventory/stockCalculator';

interface UseInventoryStatsResult {
  stats: InventoryStats;
  loading: boolean;
  error: string | null;
}

export function useInventoryStats(): UseInventoryStatsResult {
  const companyId = useAuthStore((s) => s.userProfile?.companyId);

  const [parts, setParts] = useState<InventoryPart[]>([]);
  const [requests, setRequests] = useState<PartsRequest[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Track which subscriptions have loaded
  const [partsLoaded, setPartsLoaded] = useState(false);
  const [requestsLoaded, setRequestsLoaded] = useState(false);
  const [ordersLoaded, setOrdersLoaded] = useState(false);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setPartsLoaded(false);
    setRequestsLoaded(false);
    setOrdersLoaded(false);

    const unsubParts = onSnapshot(
      query(collection(db, 'inventoryParts'), where('companyId', '==', companyId)),
      (snap) => {
        setParts(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as InventoryPart[]);
        setPartsLoaded(true);
      },
      (err) => setError(err.message)
    );

    const unsubRequests = onSnapshot(
      query(collection(db, 'partsRequests'), where('companyId', '==', companyId)),
      (snap) => {
        setRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as PartsRequest[]);
        setRequestsLoaded(true);
      },
      (err) => setError(err.message)
    );

    const unsubOrders = onSnapshot(
      query(collection(db, 'purchaseOrders'), where('companyId', '==', companyId)),
      (snap) => {
        setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as PurchaseOrder[]);
        setOrdersLoaded(true);
      },
      (err) => setError(err.message)
    );

    return () => {
      unsubParts();
      unsubRequests();
      unsubOrders();
    };
  }, [companyId]);

  useEffect(() => {
    if (partsLoaded && requestsLoaded && ordersLoaded) {
      setLoading(false);
    }
  }, [partsLoaded, requestsLoaded, ordersLoaded]);

  // "Active Requests" on the dashboard tracks things genuinely waiting on
  // someone's approval — Parts Requests sitting with the store keeper or
  // supervisor, and Purchase Orders awaiting approval — not every open,
  // unfulfilled record (an approved-but-not-yet-issued request, or a PO
  // that's already sent/acknowledged, isn't waiting on a permission).
  const openPartsRequestsCount = requests.filter(
    (r) => r.status === 'pending_storekeeper' || r.status === 'pending_supervisor'
  ).length;
  const openPurchaseOrdersCount = orders.filter(
    (o) => o.status === 'pending_approval'
  ).length;

  const stats: InventoryStats = {
    totalParts: parts.filter((p) => p.status === 'active').length,
    totalStockValue: parts.reduce((sum, p) => sum + p.currentStock * p.unitCost, 0),
    activeRequests: openPartsRequestsCount + openPurchaseOrdersCount,
    pendingPOs: orders.filter(
      (o) => o.status === 'draft' || o.status === 'sent' || o.status === 'acknowledged'
    ).length,
    outOfStockCount: parts.filter((p) => getStockStatus(p) === 'out_of_stock').length,
    lowStockCount: parts.filter((p) => getStockStatus(p) === 'low_stock').length,
    pendingRequestsCount: requests.filter((r) => r.status === 'pending_storekeeper').length,
    pendingSupervisorCount: requests.filter((r) => r.status === 'pending_supervisor').length,
    partsToIssueCount: requests.filter(
      (r) => r.status === 'approved' || r.status === 'parts_reserved'
    ).length,
  };

  return { stats, loading, error };
}
