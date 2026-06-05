import { useState, useMemo } from 'react';
import {
  ThumbsUp,
  ArrowUpDown,
  Download,
  CheckSquare,
  Square,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { useAuthStore } from '../../../store/authStore';
import { useKaizenList } from '../hooks/useKaizen';
import { transitionState } from '../services/kaizen.service';
import { KaizenDetail } from './KaizenDetail';
import {
  KAIZEN_STATUS_META,
  KAIZEN_CATEGORY_META,
  KAIZEN_PRIORITY_META,
} from '../types/kaizen.types';

type SortKey = 'title' | 'category' | 'status' | 'priority' | 'raisedByName' | 'voteCount' | 'estimatedBenefit' | 'raisedAt';
type SortDir = 'asc' | 'desc';

interface Props {
  isProPlan?: boolean;
}

export function KaizenListView({ isProPlan = false }: Props) {
  const userId = useAuthStore((s) => s.userProfile?.id ?? '');
  const userName = useAuthStore((s) => s.userProfile?.fullName ?? '');
  const role = useAuthStore((s) => s.userProfile?.role ?? 'technician');
  const plantId = useAuthStore((s) => s.userProfile?.companyId ?? '');

  const { cards, loading } = useKaizenList({});

  const [sortKey, setSortKey] = useState<SortKey>('raisedAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detailCardId, setDetailCardId] = useState<string | null>(null);
  const [bulkRejectReason, setBulkRejectReason] = useState('');
  const [showBulkReject, setShowBulkReject] = useState(false);
  const [bulkProcessing, setBulkProcessing] = useState(false);

  const canBulkAction =
    role === 'admin' || role === 'supervisor' || role === 'plant_manager';

  const sorted = useMemo(() => {
    return [...cards].sort((a, b) => {
      let va: string | number;
      let vb: string | number;

      if (sortKey === 'raisedAt') {
        va = a.raisedAt?.toMillis() ?? 0;
        vb = b.raisedAt?.toMillis() ?? 0;
      } else if (sortKey === 'voteCount') {
        va = a.voteCount;
        vb = b.voteCount;
      } else if (sortKey === 'estimatedBenefit') {
        va = a.estimatedBenefit ?? 0;
        vb = b.estimatedBenefit ?? 0;
      } else {
        va = String(a[sortKey] ?? '');
        vb = String(b[sortKey] ?? '');
      }

      const cmp = va < vb ? -1 : va > vb ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [cards, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === sorted.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(sorted.map((c) => c.id)));
    }
  }

  async function bulkApprove() {
    const reviewedCards = sorted.filter((c) => selected.has(c.id) && c.status === 'REVIEWED');
    if (reviewedCards.length === 0) {
      toast.error('No REVIEWED cards selected');
      return;
    }
    setBulkProcessing(true);
    try {
      await Promise.all(
        reviewedCards.map((c) =>
          transitionState(plantId, c.id, 'APPROVED', 'Bulk approved', userId, userName, role)
        )
      );
      toast.success(`${reviewedCards.length} Kaizen(s) approved`);
      setSelected(new Set());
    } catch (e: unknown) {
      toast.error((e as Error).message);
    } finally {
      setBulkProcessing(false);
    }
  }

  async function bulkReject() {
    if (!bulkRejectReason.trim()) {
      toast.error('Rejection reason required');
      return;
    }
    setBulkProcessing(true);
    const selectedCards = sorted.filter((c) => selected.has(c.id));
    try {
      await Promise.all(
        selectedCards.map((c) =>
          transitionState(
            plantId, c.id, 'REJECTED', bulkRejectReason, userId, userName, role,
            { rejectionReason: bulkRejectReason }
          )
        )
      );
      toast.success(`${selectedCards.length} Kaizen(s) rejected`);
      setSelected(new Set());
      setShowBulkReject(false);
    } catch (e: unknown) {
      toast.error((e as Error).message);
    } finally {
      setBulkProcessing(false);
    }
  }

  function exportToExcel() {
    const data = sorted.map((c) => ({
      ID: c.id.slice(-6).toUpperCase(),
      Title: c.title,
      Category: KAIZEN_CATEGORY_META[c.category].label,
      Status: KAIZEN_STATUS_META[c.status].label,
      Priority: KAIZEN_PRIORITY_META[c.priority].label,
      'Raised By': c.raisedByName,
      Area: c.machineName ?? c.area,
      Votes: c.voteCount,
      'Est. Cost (LKR)': c.estimatedCost ?? '',
      'Est. Benefit/mo (LKR)': c.estimatedBenefit ?? '',
      'Date Raised': c.raisedAt ? format(c.raisedAt.toDate(), 'yyyy-MM-dd') : '',
      Tags: c.tags.join(', '),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Kaizens');
    XLSX.writeFile(wb, `kaizen_export_${format(new Date(), 'yyyyMMdd')}.xlsx`);
  }

  const SortableHeader = ({
    col,
    label,
  }: {
    col: SortKey;
    label: string;
  }) => (
    <th
      className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase cursor-pointer select-none hover:text-gray-700 whitespace-nowrap"
      onClick={() => toggleSort(col)}
    >
      <span className="flex items-center gap-1">
        {label}
        <ArrowUpDown size={11} className={sortKey === col ? 'text-blue-600' : 'text-gray-300'} />
      </span>
    </th>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-white flex-shrink-0 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          {canBulkAction && selected.size > 0 && (
            <>
              <span className="text-xs text-gray-600">{selected.size} selected</span>
              <button
                onClick={bulkApprove}
                disabled={bulkProcessing}
                className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-60"
              >
                Bulk Approve
              </button>
              <button
                onClick={() => setShowBulkReject(!showBulkReject)}
                className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
              >
                Bulk Reject
              </button>
            </>
          )}
          {showBulkReject && (
            <div className="flex items-center gap-2">
              <input
                value={bulkRejectReason}
                onChange={(e) => setBulkRejectReason(e.target.value)}
                placeholder="Rejection reason"
                className="border border-gray-300 rounded px-2 py-1 text-xs"
              />
              <button
                onClick={bulkReject}
                disabled={bulkProcessing}
                className="px-2 py-1 text-xs bg-red-700 text-white rounded hover:bg-red-800 disabled:opacity-60"
              >
                Confirm
              </button>
            </div>
          )}
        </div>
        <button
          onClick={exportToExcel}
          className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg px-2.5 py-1.5"
        >
          <Download size={13} /> Export Excel
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-8 text-center text-gray-400 animate-pulse">Loading...</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-50 border-b border-gray-200 z-10">
              <tr>
                {canBulkAction && (
                  <th className="px-3 py-2.5 w-8">
                    <button onClick={toggleAll}>
                      {selected.size === sorted.length && sorted.length > 0 ? (
                        <CheckSquare size={15} className="text-blue-600" />
                      ) : (
                        <Square size={15} className="text-gray-400" />
                      )}
                    </button>
                  </th>
                )}
                <SortableHeader col="title" label="Title" />
                <SortableHeader col="category" label="Category" />
                <SortableHeader col="status" label="Status" />
                <SortableHeader col="priority" label="Priority" />
                <SortableHeader col="raisedByName" label="Raised By" />
                <SortableHeader col="voteCount" label="Votes" />
                {isProPlan && <SortableHeader col="estimatedBenefit" label="Est. Benefit" />}
                <SortableHeader col="raisedAt" label="Date" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sorted.map((card) => {
                const statusMeta = KAIZEN_STATUS_META[card.status];
                const categoryMeta = KAIZEN_CATEGORY_META[card.category];
                const priorityMeta = KAIZEN_PRIORITY_META[card.priority];
                const isSelected = selected.has(card.id);

                return (
                  <tr
                    key={card.id}
                    onClick={() => setDetailCardId(card.id)}
                    className={`cursor-pointer hover:bg-gray-50 transition-colors ${
                      isSelected ? 'bg-blue-50' : ''
                    }`}
                  >
                    {canBulkAction && (
                      <td
                        className="px-3 py-2"
                        onClick={(e) => { e.stopPropagation(); toggleSelect(card.id); }}
                      >
                        {isSelected ? (
                          <CheckSquare size={15} className="text-blue-600" />
                        ) : (
                          <Square size={15} className="text-gray-300" />
                        )}
                      </td>
                    )}
                    <td className="px-3 py-2.5">
                      <p className="font-medium text-gray-900 line-clamp-1">{card.title}</p>
                      {(card.machineName ?? card.area) && (
                        <p className="text-xs text-gray-400">{card.machineName ?? card.area}</p>
                      )}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span style={{ color: categoryMeta.color }}>
                        {categoryMeta.icon} {categoryMeta.label}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ color: statusMeta.color, backgroundColor: statusMeta.bgColor }}
                      >
                        {statusMeta.label}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ color: priorityMeta.color, backgroundColor: priorityMeta.bgColor }}
                      >
                        {priorityMeta.label}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-sm text-gray-600 whitespace-nowrap">
                      {card.raisedByName}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="flex items-center gap-1 text-gray-600">
                        <ThumbsUp size={12} />
                        {card.voteCount}
                      </span>
                    </td>
                    {isProPlan && (
                      <td className="px-3 py-2.5 text-sm text-emerald-700">
                        {card.estimatedBenefit != null
                          ? `LKR ${card.estimatedBenefit.toLocaleString()}`
                          : '—'}
                      </td>
                    )}
                    <td className="px-3 py-2.5 text-xs text-gray-400 whitespace-nowrap">
                      {card.raisedAt ? format(card.raisedAt.toDate(), 'dd MMM yyyy') : ''}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {!loading && sorted.length === 0 && (
          <div className="py-16 text-center text-gray-400">
            <p className="text-4xl mb-3">💡</p>
            <p className="font-medium">No Kaizen cards yet</p>
            <p className="text-sm mt-1">Raise the first improvement idea!</p>
          </div>
        )}
      </div>

      {/* Detail drawer */}
      {detailCardId && (
        <KaizenDetail
          cardId={detailCardId}
          onClose={() => setDetailCardId(null)}
          isProPlan={isProPlan}
        />
      )}
    </div>
  );
}
