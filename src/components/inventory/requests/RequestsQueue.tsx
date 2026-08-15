import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { InboxIcon } from 'lucide-react';
import { usePartsRequests } from '@/hooks/inventory/usePartsRequests';
import { usePartReturns } from '@/hooks/inventory/usePartReturns';
import { useAuthStore } from '@/store/authStore';
import type { PartReturn, RequestStatus } from '@/types/inventory';
import { RequestQueueRow, type ReturnInfo } from './RequestQueueRow';
import { RequestQueueCard } from './RequestQueueCard';

type TabId = 'all' | 'pending_return' | RequestStatus;

const MANAGE_ROLES = ['store_keeper', 'supervisor', 'plant_manager', 'admin'];

interface TabDef {
  id: TabId;
  label: string;
}

const TABS: TabDef[] = [
  { id: 'pending_storekeeper', label: 'To Review' },
  { id: 'pending_supervisor', label: 'Awaiting Supervisor' },
  { id: 'parts_reserved', label: 'Parts to Collect' },
  { id: 'completed', label: 'Completed' },
  { id: 'pending_return', label: 'Pending Return' },
  { id: 'rejected', label: 'Rejected' },
];

// Store keeper's queue drops "Completed" — their Pending Return tab already
// covers everything with an open returnable/returning item, and completed
// requests with nothing outstanding aren't actionable for them.
const STORE_KEEPER_TABS: TabDef[] = TABS.filter((t) => t.id !== 'completed');

// Requester (technician/trainee/etc.) view — the review-stage tabs don't
// apply since they can't act on those; keep it focused on their own request
// lifecycle plus the return flow this component adds.
const OWN_TABS: TabDef[] = [
  { id: 'all', label: 'My Requests' },
  { id: 'parts_reserved', label: 'Parts to Collect' },
  { id: 'completed', label: 'Completed' },
  { id: 'pending_return', label: 'Pending Return' },
  { id: 'rejected', label: 'Rejected' },
];

const PRIORITY_OPTIONS = [
  { value: '', label: 'All Priorities' },
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

function SkeletonRow() {
  return (
    <tr className="border-b border-gray-100">
      {Array.from({ length: 9 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-gray-200 rounded animate-pulse" />
        </td>
      ))}
    </tr>
  );
}

export function RequestsQueue() {
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.userProfile?.role);
  // A requester (technician/trainee/etc.) only sees their own requests; the
  // review-queue tabs (To Review / Awaiting Supervisor) don't apply to them.
  const ownOnly = !MANAGE_ROLES.includes(role ?? '');
  const tabs = ownOnly ? OWN_TABS : role === 'store_keeper' ? STORE_KEEPER_TABS : TABS;

  const [activeTab, setActiveTab] = useState<TabId>(ownOnly ? 'all' : 'pending_storekeeper');
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');

  // "Pending Return" is derived client-side from item flags, not a real
  // request status, so it always fetches the full set.
  const { requests, loading } = usePartsRequests({
    status: activeTab === 'all' || activeTab === 'pending_return' ? 'all' : activeTab,
    priorityLevel: priorityFilter || undefined,
    ownOnly,
  });

  // Per-request return status/timing/who, for the Return column — pending
  // takes priority over a settled outcome so an in-progress return is never
  // hidden behind an older resolved one for the same request.
  const { returns } = usePartReturns({ status: 'all', ownOnly });
  const returnByRequestId = useMemo(() => {
    const map = new Map<string, ReturnInfo>();
    const priority: Record<PartReturn['status'], number> = { pending: 0, returned: 1, rejected: 1, cancelled: 2 };
    for (const r of returns) {
      const existing = map.get(r.partsRequestId);
      if (!existing || priority[r.status] < priority[existing.status]) {
        map.set(r.partsRequestId, {
          status: r.status,
          at: r.status === 'pending' ? r.requestedAt : r.storeKeeperConfirmedAt,
          byName: r.status === 'pending' ? r.requestedByName : r.storeKeeperConfirmedByName,
          byRole: r.status === 'pending' ? null : r.storeKeeperConfirmedByRole,
          pendingReturn: r.status === 'pending' ? r : null,
        });
      }
    }
    return map;
  }, [returns]);

  // Only store keepers/supervisors/plant managers/admins can act on a
  // pending return directly from this list — requesters just see its status.
  const canManageReturns = !ownOnly;

  const hasPendingReturn = (r: (typeof requests)[number]) =>
    r.items.some((i) => i.isReturnable && !i.isReturned);

  const scoped = activeTab === 'pending_return' ? requests.filter(hasPendingReturn) : requests;

  // Client-side search filter
  const filtered = scoped.filter((r) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      r.requestNumber.toLowerCase().includes(s) ||
      (r.workOrderNumber?.toLowerCase().includes(s) ?? false) ||
      r.requestedByName.toLowerCase().includes(s) ||
      r.items.some((i) => i.partName.toLowerCase().includes(s))
    );
  });

  // Count badges per tab
  function countForTab(tabId: TabId): number {
    if (tabId === 'all') return requests.length;
    if (tabId === 'pending_return') return requests.filter(hasPendingReturn).length;
    return requests.filter((r) => r.status === tabId).length;
  }

  function handleReview(requestId: string) {
    navigate(`/app/inventory/requests/${requestId}`);
  }

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
        {tabs.map((tab) => {
          const count = countForTab(tab.id);
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab.label}
              {count > 0 && (
                <span
                  className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-xs font-bold ${
                    isActive ? 'bg-white/30 text-white' : 'bg-gray-300 text-gray-700'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by request #, WO #, technician or part…"
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {PRIORITY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto rounded-xl border border-gray-200">
        <table className="min-w-full bg-white">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {(
                // On Pending Return every visible request is already Completed —
                // the Status column is redundant there, so it's dropped in
                // favor of the Return column showing the actual action taken.
                activeTab === 'pending_return'
                  ? ['Request #', 'WO # / Type', 'Requested By', 'Parts', 'Total Cost', 'Priority', 'Return', 'Age', '']
                  : ['Request #', 'WO # / Type', 'Requested By', 'Parts', 'Total Cost', 'Priority', 'Status', 'Return', 'Age', '']
              ).map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <>
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-12 text-center">
                  <InboxIcon className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">No requests found</p>
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <RequestQueueRow
                  key={r.id}
                  request={r}
                  returnInfo={returnByRequestId.get(r.id) ?? null}
                  onReview={() => handleReview(r.id)}
                  canManageReturns={canManageReturns}
                  showStatus={activeTab !== 'pending_return'}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-40 bg-gray-100 rounded-xl animate-pulse" />
          ))
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center">
            <InboxIcon className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">No requests found</p>
          </div>
        ) : (
          filtered.map((r) => (
            <RequestQueueCard
              key={r.id}
              request={r}
              returnInfo={returnByRequestId.get(r.id) ?? null}
              onReview={() => handleReview(r.id)}
              canManageReturns={canManageReturns}
              showStatus={activeTab !== 'pending_return'}
            />
          ))
        )}
      </div>

    </div>
  );
}
