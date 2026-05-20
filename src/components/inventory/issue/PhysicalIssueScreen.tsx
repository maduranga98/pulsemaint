import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  doc,
  getDocs,
  collection,
  query,
  where,
  runTransaction,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import { usePartsRequest } from '@/hooks/inventory/usePartsRequest';
import { useToast } from '@/hooks/useToast';
import { IssuePartCheckItem } from './IssuePartCheckItem';
import { IssueConfirmButton } from './IssueConfirmButton';
import type { RequestItem } from '@/types/inventory';

interface ItemState {
  checked: boolean;
  skipped: boolean;
}

interface StoreLocations {
  [partId: string]: string;
}

export function PhysicalIssueScreen() {
  const { requestId } = useParams<{ requestId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const userProfile = useAuthStore((s) => s.userProfile);
  const companyId = userProfile?.companyId;

  const { request, loading, error } = usePartsRequest(requestId);
  const [storeLocations, setStoreLocations] = useState<StoreLocations>({});
  const [itemStates, setItemStates] = useState<Record<string, ItemState>>({});
  const [isConfirming, setIsConfirming] = useState(false);

  // Fetch store locations for all parts
  useEffect(() => {
    if (!request || !companyId) return;

    const partIds = [...new Set(request.items.map((i) => i.partId))];
    if (partIds.length === 0) return;

    async function fetchLocations() {
      const chunks: string[][] = [];
      for (let i = 0; i < partIds.length; i += 10) {
        chunks.push(partIds.slice(i, i + 10));
      }

      const locations: StoreLocations = {};
      for (const chunk of chunks) {
        const q = query(
          collection(db, 'inventoryParts'),
          where('__name__', 'in', chunk)
        );
        const snap = await getDocs(q);
        snap.forEach((d) => {
          const data = d.data();
          if (data.storeLocation) {
            locations[d.id] = data.storeLocation as string;
          }
        });
      }
      setStoreLocations(locations);
    }

    fetchLocations().catch(console.error);
  }, [request, companyId]);

  // Initialize item states
  useEffect(() => {
    if (!request) return;
    const initial: Record<string, ItemState> = {};
    for (const item of request.items) {
      if (item.quantityApproved > 0) {
        initial[item.id] = { checked: false, skipped: false };
      }
    }
    setItemStates(initial);
  }, [request]);

  const issuableItems: RequestItem[] = request?.items.filter((i) => i.quantityApproved > 0) ?? [];

  const checkedCount = Object.values(itemStates).filter((s) => s.checked || s.skipped).length;
  const allChecked = issuableItems.length > 0 && checkedCount === issuableItems.length;

  function toggleCheck(itemId: string) {
    setItemStates((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], checked: !prev[itemId]?.checked, skipped: false },
    }));
  }

  function toggleSkip(itemId: string) {
    setItemStates((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], skipped: !prev[itemId]?.skipped, checked: false },
    }));
  }

  async function handleConfirm() {
    if (!request || !userProfile || !companyId) return;
    setIsConfirming(true);

    try {
      const checkedItems = issuableItems.filter((i) => itemStates[i.id]?.checked);

      await runTransaction(db, async (tx) => {
        const now = serverTimestamp();
        const nowTs = Timestamp.fromDate(new Date());

        for (const item of checkedItems) {
          const partRef = doc(db, 'inventoryParts', item.partId);
          const partSnap = await tx.get(partRef);
          if (!partSnap.exists()) continue;

          const partData = partSnap.data();
          const currentStock = (partData.currentStock as number) ?? 0;
          const reservedStock = (partData.reservedStock as number) ?? 0;
          const totalUsedAllTime = (partData.totalUsedAllTime as number) ?? 0;

          tx.update(partRef, {
            currentStock: currentStock - item.quantityApproved,
            reservedStock: Math.max(0, reservedStock - item.quantityApproved),
            totalUsedAllTime: totalUsedAllTime + item.quantityApproved,
            lastIssuedAt: now,
            updatedAt: now,
            updatedBy: userProfile.id,
          });

          // Stock movement record
          const movementRef = doc(collection(db, 'stockMovements'));
          tx.set(movementRef, {
            companyId,
            partId: item.partId,
            partNumber: item.partNumber,
            partName: item.partName,
            movementType: 'issue',
            quantityBefore: currentStock,
            quantityChange: -item.quantityApproved,
            quantityAfter: currentStock - item.quantityApproved,
            referenceType: 'parts_request',
            referenceId: request.id,
            workOrderId: request.workOrderId,
            workOrderNumber: request.workOrderNumber,
            partsRequestId: request.id,
            performedBy: userProfile.id,
            performedByName: userProfile.fullName,
            performedByRole: userProfile.role,
            performedAt: now,
            notes: '',
            unitCostAtTime: item.unitCost,
            totalCostImpact: item.unitCost * item.quantityApproved,
          });
        }

        // Update the request
        const requestRef = doc(db, 'partsRequests', request.id);
        const updatedItems = request.items.map((item) => ({
          ...item,
          quantityIssued: itemStates[item.id]?.checked ? item.quantityApproved : 0,
        }));

        tx.update(requestRef, {
          status: 'issued',
          issuedAt: nowTs,
          issuedBy: userProfile.id,
          issuedByName: userProfile.fullName,
          items: updatedItems,
          updatedAt: now,
          updatedBy: userProfile.id,
        });
      });

      toast.success('Parts issued successfully');
      navigate('/app/inventory/requests');
    } catch (err) {
      console.error(err);
      toast.error('Failed to issue parts. Please try again.');
    } finally {
      setIsConfirming(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="p-6 text-center text-red-600">
        {error ?? 'Request not found'}
      </div>
    );
  }

  const progress = issuableItems.length > 0 ? (checkedCount / issuableItems.length) * 100 : 0;

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
        <div className="px-4 py-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Issue Parts</h1>
              <div className="flex items-center gap-3 text-sm text-gray-600 mt-0.5">
                <span className="font-mono">{request.requestNumber}</span>
                {request.workOrderNumber && (
                  <span>WO: <strong>{request.workOrderNumber}</strong></span>
                )}
              </div>
            </div>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            Technician <strong>{request.requestedByName}</strong> is collecting these parts.
          </p>
        </div>

        {/* Contractor banner */}
        {request.isContractorJob && request.contractorCompany && (
          <div className="mx-4 mb-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm font-medium">
            <span>⚠</span>
            <span>Parts for contractor job — {request.contractorCompany}</span>
          </div>
        )}

        {/* Progress bar */}
        <div className="px-4 pb-3">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span>{checkedCount} of {issuableItems.length} parts confirmed</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Items list */}
      <div className="flex-1 px-4 py-4 space-y-3 pb-32">
        {issuableItems.map((item) => (
          <IssuePartCheckItem
            key={item.id}
            item={{
              id: item.id,
              partName: item.partName,
              partNumber: item.partNumber,
              unit: item.unit,
              quantityApproved: item.quantityApproved,
              storeLocation: storeLocations[item.partId],
              isCritical: item.isCritical,
            }}
            checked={itemStates[item.id]?.checked ?? false}
            skipped={itemStates[item.id]?.skipped ?? false}
            onCheck={() => toggleCheck(item.id)}
            onSkip={() => toggleSkip(item.id)}
          />
        ))}
      </div>

      {/* Sticky confirm button */}
      <div className="fixed bottom-0 left-0 right-0 z-10 bg-white border-t border-gray-200 p-4">
        <IssueConfirmButton
          allChecked={allChecked}
          onConfirm={handleConfirm}
          isLoading={isConfirming}
          totalItems={issuableItems.length}
          checkedCount={checkedCount}
        />
      </div>
    </div>
  );
}
