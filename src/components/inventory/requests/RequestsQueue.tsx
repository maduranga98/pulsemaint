import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { InboxIcon } from 'lucide-react';
import { usePartsRequests } from '@/hooks/inventory/usePartsRequests';
import type { RequestStatus } from '@/types/inventory';
import { RequestQueueRow } from './RequestQueueRow';
import { RequestQueueCard } from './RequestQueueCard';

type TabId = 'all' | RequestStatus;

interface TabDef {
  id: TabId;
  label: string;
}

const TABS: TabDef[] = [
  { id: 'all', label: 'All' },
  { id: 'pending_storekeeper', label: 'Pending' },
  { id: 'pending_supervisor', label: 'Awaiting Supervisor' },
  { id: 'approved', label: 'Approved' },
  { id: 'parts_reserved', label: 'Reserved' },
  { id: 'issued', label: 'Issued' },
  { id: 'completed', label: 'Completed' },
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
  const [activeTab, setActiveTab] = useState<TabId>('all');
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');

  const { requests, loading } = usePartsRequests({
    status: activeTab === 'all' ? 'all' : activeTab,
    priorityLevel: priorityFilter || undefined,
  });

  // Client-side search filter
  const filtered = requests.filter((r) => {
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
    return requests.filter((r) => r.status === tabId).length;
  }

  function handleReview(requestId: string) {
    navigate(`/app/inventory/requests/${requestId}`);
  }

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
        {TABS.map((tab) => {
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
              {['Request #', 'WO # / Type', 'Requested By', 'Parts', 'Total Cost', 'Priority', 'Status', 'Age', ''].map(
                (h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap"
                  >
                    {h}
                  </th>
                )
              )}
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
                <td colSpan={9} className="px-4 py-12 text-center">
                  <InboxIcon className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">No requests found</p>
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <RequestQueueRow key={r.id} request={r} onReview={() => handleReview(r.id)} />
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
            <RequestQueueCard key={r.id} request={r} onReview={() => handleReview(r.id)} />
          ))
        )}
      </div>

    </div>
  );
}
