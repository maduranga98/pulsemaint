import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ScanLine, PackageMinus, Trash2, Search } from 'lucide-react';
import {
  collection,
  query,
  where,
  getDocs,
  limit,
  doc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import { useWorkOrders } from '@/hooks/useWorkOrders';
import { useInventoryParts } from '@/hooks/inventory/useInventoryParts';
import { PartQrScanModal } from '@/components/inventory/shared/PartQrScanModal';
import {
  addScannedPart,
  cartLineError,
  cartTotals,
  isCartIssuable,
  removeLine,
  setLineQuantity,
  type IssueCartLine,
} from '@/lib/inventory/issueCart';
import type { InventoryPart } from '@/types/inventory';

const ISSUE_REASONS = [
  'Breakdown repair (no WO request raised)',
  'Preventive maintenance',
  'Contractor job',
  'Emergency / urgent need',
  'Other',
];

export function ManualIssuePage() {
  const { addToast } = useToast();
  const userProfile = useAuthStore((s) => s.userProfile);
  const companyId = userProfile?.companyId ?? '';

  const [showScanner, setShowScanner] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  // The batch being built up — scan or search as many parts as needed, each
  // with its own quantity, then issue them all at once.
  const [lines, setLines] = useState<IssueCartLine[]>([]);
  const [lookingUp, setLookingUp] = useState(false);
  const [reason, setReason] = useState(ISSUE_REASONS[0]);
  const [customReason, setCustomReason] = useState('');
  const [workOrderId, setWorkOrderId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { workOrders } = useWorkOrders({ status: ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD_PARTS'] });
  const { parts: searchResults, loading: searching } = useInventoryParts({
    searchQuery: searchQuery.trim() || undefined,
    pageSize: 8,
  });

  const totals = cartTotals(lines);
  const issuable = isCartIssuable(lines);

  function addPartToBatch(part: InventoryPart) {
    if ((part.currentStock ?? 0) <= 0) {
      addToast(`${part.name} is out of stock.`, 'error');
      return;
    }
    const already = lines.some((line) => line.partId === part.id);
    setLines((prev) => addScannedPart(prev, part));
    addToast(
      already ? `Added another ${part.name} to the batch.` : `${part.name} added to the batch.`,
      'success',
    );
  }

  async function handleScan(partNumber: string) {
    setShowScanner(false);
    if (!companyId) return;
    setLookingUp(true);
    try {
      const snap = await getDocs(
        query(
          collection(db, 'inventoryParts'),
          where('companyId', '==', companyId),
          where('partNumber', '==', partNumber),
          limit(1),
        ),
      );
      if (snap.empty) {
        addToast(`No part found for "${partNumber}"`, 'error');
        return;
      }
      const docSnap = snap.docs[0];
      const part = { ...docSnap.data(), id: docSnap.id } as InventoryPart;
      addPartToBatch(part);
    } catch (err) {
      console.error(err);
      addToast('Failed to look up part.', 'error');
    } finally {
      setLookingUp(false);
    }
  }

  function handleSearchPick(part: InventoryPart) {
    addPartToBatch(part);
    setSearchQuery('');
  }

  function reset() {
    setLines([]);
    setReason(ISSUE_REASONS[0]);
    setCustomReason('');
    setWorkOrderId('');
    setShowScanner(false);
    setShowSearch(false);
    setSearchQuery('');
  }

  async function handleSubmit() {
    if (!userProfile || !companyId || lines.length === 0) return;
    const finalReason = reason === 'Other' ? customReason.trim() : reason;
    if (!finalReason) {
      addToast('Enter a reason for issuing these parts.', 'error');
      return;
    }
    if (!issuable) {
      addToast('Fix the highlighted quantities before issuing.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const selectedWo = workOrders.find((wo) => wo.id === workOrderId);

      await runTransaction(db, async (tx) => {
        // Firestore requires every read before any write, so read all the
        // parts first, validate stock against live data, then queue the
        // writes in a second pass.
        const partRefs = lines.map((line) => doc(db, 'inventoryParts', line.partId));
        const partSnaps = await Promise.all(partRefs.map((ref) => tx.get(ref)));

        const now = serverTimestamp();

        lines.forEach((line, idx) => {
          const partSnap = partSnaps[idx];
          if (!partSnap.exists()) {
            throw new Error(`${line.partName} no longer exists.`);
          }
          const data = partSnap.data();
          const currentStock = (data.currentStock as number) ?? 0;
          if (line.quantity > currentStock) {
            throw new Error(
              `Stock changed — only ${currentStock} ${line.unit} of ${line.partName} available now.`,
            );
          }
        });

        lines.forEach((line, idx) => {
          const data = partSnaps[idx].data() as Record<string, unknown>;
          const currentStock = (data.currentStock as number) ?? 0;
          const totalUsedAllTime = (data.totalUsedAllTime as number) ?? 0;

          tx.update(partRefs[idx], {
            currentStock: currentStock - line.quantity,
            totalUsedAllTime: totalUsedAllTime + line.quantity,
            lastIssuedAt: now,
            updatedAt: now,
            updatedBy: userProfile.id,
          });

          const movRef = doc(collection(db, 'stockMovements'));
          tx.set(movRef, {
            companyId,
            partId: line.partId,
            partNumber: line.partNumber,
            partName: line.partName,
            movementType: 'issue',
            quantityBefore: currentStock,
            quantityChange: -line.quantity,
            quantityAfter: currentStock - line.quantity,
            referenceType: 'manual_qr_issue',
            referenceId: null,
            workOrderId: selectedWo?.id ?? null,
            workOrderNumber: selectedWo?.woNumber ?? null,
            partsRequestId: null,
            performedBy: userProfile.id,
            performedByName: userProfile.fullName,
            performedByRole: userProfile.role,
            performedAt: now,
            notes: finalReason,
            unitCostAtTime: line.unitCost,
            totalCostImpact: line.unitCost * line.quantity,
          });
        });
      });

      addToast(
        lines.length === 1
          ? 'Part issued successfully.'
          : `${lines.length} parts issued successfully.`,
        'success',
      );
      reset();
    } catch (err) {
      console.error(err);
      addToast(err instanceof Error ? err.message : 'Failed to issue parts.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5 max-w-xl mx-auto pb-28">
      <div className="flex items-center gap-3">
        <Link to="/app/inventory" className="text-gray-400 hover:text-gray-700 transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 font-[Sora]">Scan &amp; Issue Parts</h1>
      </div>
      <p className="text-sm text-gray-500">
        Scan a part QR code or search for it by name/number to issue it directly from stock — for
        cases where no parts request exists yet (e.g. a breakdown handled on the spot). Add every
        part you need, set the quantities, then issue the whole batch at once.
      </p>

      {/* Scan / search triggers — always available so more parts can be added to the batch. */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => { setShowScanner(true); setShowSearch(false); }}
          disabled={lookingUp}
          className={[
            'flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-2xl transition-colors',
            lines.length === 0 ? 'py-8' : 'py-5',
            'border-gray-300 text-gray-500 hover:border-blue-400 hover:text-blue-600',
          ].join(' ')}
        >
          <ScanLine className="w-7 h-7" />
          <span className="font-medium text-sm">
            {lookingUp ? 'Looking up…' : lines.length === 0 ? 'Scan part QR' : 'Scan another'}
          </span>
        </button>
        <button
          onClick={() => { setShowSearch((v) => !v); setShowScanner(false); }}
          className={[
            'flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-2xl transition-colors',
            lines.length === 0 ? 'py-8' : 'py-5',
            showSearch
              ? 'border-blue-400 text-blue-600'
              : 'border-gray-300 text-gray-500 hover:border-blue-400 hover:text-blue-600',
          ].join(' ')}
        >
          <Search className="w-7 h-7" />
          <span className="font-medium text-sm">Search manually</span>
        </button>
      </div>

      {showSearch && (
        <div className="relative bg-white border border-gray-200 rounded-xl p-3 space-y-2">
          <input
            type="text"
            autoFocus
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by part name or number…"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {searchQuery.trim() && (
            <div className="max-h-64 overflow-y-auto divide-y divide-gray-100 border border-gray-100 rounded-lg">
              {searching ? (
                <p className="px-3 py-3 text-sm text-gray-400">Searching…</p>
              ) : searchResults.length === 0 ? (
                <p className="px-3 py-3 text-sm text-gray-400">No parts match "{searchQuery}".</p>
              ) : (
                searchResults.map((part) => (
                  <button
                    key={part.id}
                    onClick={() => handleSearchPick(part)}
                    disabled={(part.currentStock ?? 0) <= 0}
                    className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{part.name}</p>
                      <p className="text-xs text-gray-400 font-mono">{part.partNumber}</p>
                    </div>
                    <span className="text-xs text-gray-500 shrink-0">
                      {part.currentStock ?? 0} {part.unit} in stock
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Batch list */}
      {lines.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">
              Batch — {totals.lineCount} part{totals.lineCount === 1 ? '' : 's'}
            </h2>
            <button onClick={reset} className="text-xs text-gray-400 hover:text-red-600">
              Clear batch
            </button>
          </div>

          {lines.map((line) => {
            const error = cartLineError(line);
            return (
              <div
                key={line.partId}
                className={[
                  'bg-white border rounded-xl p-4 space-y-3',
                  error ? 'border-red-300' : 'border-gray-200',
                ].join(' ')}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-gray-400 font-mono">{line.partNumber}</p>
                    <h3 className="font-bold text-gray-900 truncate">{line.partName}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {line.availableStock} {line.unit} in stock
                      {line.storeLocation ? ` · ${line.storeLocation}` : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => setLines((prev) => removeLine(prev, line.partId))}
                    className="text-gray-300 hover:text-red-600 shrink-0"
                    aria-label={`Remove ${line.partName} from batch`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <label className="text-sm font-medium text-gray-700">
                    Quantity
                    <input
                      type="number"
                      min={1}
                      max={line.availableStock}
                      value={line.quantity}
                      onChange={(e) =>
                        setLines((prev) =>
                          setLineQuantity(prev, line.partId, parseInt(e.target.value, 10)),
                        )
                      }
                      className={[
                        'ml-2 w-24 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2',
                        error
                          ? 'border-red-400 focus:ring-red-500'
                          : 'border-gray-300 focus:ring-blue-500',
                      ].join(' ')}
                    />
                  </label>
                  <span className="text-sm text-gray-500">
                    {(line.unitCost * line.quantity).toLocaleString()} total
                  </span>
                </div>

                {error && <p className="text-xs text-red-600">{error}</p>}
              </div>
            );
          })}
        </div>
      )}

      {/* Shared reason + WO for the whole batch */}
      {lines.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason *</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {ISSUE_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            {reason === 'Other' && (
              <input
                type="text"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Describe the reason…"
                className="mt-2 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Work Order (optional)</label>
            <select
              value={workOrderId}
              onChange={(e) => setWorkOrderId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— No WO ticket —</option>
              {workOrders.map((wo) => (
                <option key={wo.id} value={wo.id}>{wo.woNumber} · {wo.machineName} — {wo.description}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-400">Applied to every part in this batch.</p>
          </div>

        </div>
      )}

      {/* Sticky issue bar */}
      {lines.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-10 bg-white border-t border-gray-200 p-4">
          <div className="max-w-xl mx-auto flex items-center gap-3">
            <div className="text-sm">
              <p className="font-semibold text-gray-900">
                {totals.totalQuantity} item{totals.totalQuantity === 1 ? '' : 's'} · {totals.totalCost.toLocaleString()}
              </p>
              <p className="text-xs text-gray-400">{totals.lineCount} part{totals.lineCount === 1 ? '' : 's'} in batch</p>
            </div>
            <button
              onClick={handleSubmit}
              disabled={submitting || !issuable}
              className="ml-auto py-3 px-5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <PackageMinus className="w-4 h-4" />
              {submitting ? 'Issuing…' : `Issue ${totals.lineCount} Part${totals.lineCount === 1 ? '' : 's'}`}
            </button>
          </div>
        </div>
      )}

      {showScanner && (
        <PartQrScanModal
          title="Scan Part to Issue"
          onScan={handleScan}
          onClose={() => setShowScanner(false)}
        />
      )}
    </div>
  );
}

export default ManualIssuePage;
