import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { InboxIcon } from 'lucide-react';
import { usePartsRequests } from '@/hooks/inventory/usePartsRequests';
import { usePartReturns } from '@/hooks/inventory/usePartReturns';
import { useAuthStore } from '@/store/authStore';
import type { PartReturn, RequestStatus } from '@/types/inventory';
import type { ReturnInfo } from './RequestQueueRow';
import { RequestQueueCard } from './RequestQueueCard';

type TabId = 'all' | 'pending_return' | RequestStatus;

const MANAGE_ROLES = ['store_keeper', 'supervisor', 'plant_manager', 'admin'];

interface TabDef {
  id: TabId;
  labelKey: string;
}

const TABS: TabDef[] = [
  { id: 'pending_storekeeper', labelKey: 'common.inventory.requests.queue.tabs.toReview' },
  { id: 'pending_supervisor', labelKey: 'common.inventory.requests.queue.tabs.awaitingSupervisor' },
  { id: 'parts_reserved', labelKey: 'common.inventory.requests.queue.tabs.partsToCollect' },
  { id: 'completed', labelKey: 'common.inventory.requests.queue.tabs.completed' },
  { id: 'pending_return', labelKey: 'common.inventory.requests.queue.tabs.pendingReturn' },
  { id: 'rejected', labelKey: 'common.inventory.requests.queue.tabs.rejected' },
];

// Store keeper's queue drops "Completed" — their Pending Return tab already
// covers everything with an open returnable/returning item, and completed
// requests with nothing outstanding aren't actionable for them.
const STORE_KEEPER_TABS: TabDef[] = TABS.filter((t) => t.id !== 'completed');

// Requester (technician/trainee/etc.) view — the review-stage tabs don't
// apply since they can't act on those; keep it focused on their own request
// lifecycle plus the return flow this component adds.
const OWN_TABS: TabDef[] = [
  { id: 'all', labelKey: 'common.inventory.requests.queue.tabs.myRequests' },
  { id: 'parts_reserved', labelKey: 'common.inventory.requests.queue.tabs.partsToCollect' },
  { id: 'completed', labelKey: 'common.inventory.requests.queue.tabs.completed' },
  { id: 'pending_return', labelKey: 'common.inventory.requests.queue.tabs.pendingReturn' },
  { id: 'rejected', labelKey: 'common.inventory.requests.queue.tabs.rejected' },
];

const PRIORITY_VALUES = ['critical', 'high', 'medium', 'low'];

export function RequestsQueue() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.userProfile?.role);
  // A requester (technician/trainee/etc.) only sees their own requests; the
  // review-queue tabs (To Review / Awaiting Supervisor) don't apply to them.
  const ownOnly = !MANAGE_ROLES.includes(role ?? '');
  // Completed parts requests are only ever visible to admins — every other
  // role stops seeing a request once it's completed.
  const isAdmin = role === 'admin';
  const baseTabs = ownOnly ? OWN_TABS : role === 'store_keeper' ? STORE_KEEPER_TABS : TABS;
  const tabs = isAdmin ? baseTabs : baseTabs.filter((tab) => tab.id !== 'completed');

  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');

  // The board shows every stage side by side, so the full set is fetched once
  // ("Pending Return" is derived client-side from item flags, not a real status).
  const { requests, loading } = usePartsRequests({
    status: 'all',
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

  // Completed requests are only visible to admins, so non-admins never see them here.
  const visibleRequests = isAdmin ? requests : requests.filter((r) => r.status !== 'completed');

  // Client-side search filter
  const matches = (r: (typeof requests)[number]) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      r.requestNumber.toLowerCase().includes(s) ||
      (r.workOrderNumber?.toLowerCase().includes(s) ?? false) ||
      r.requestedByName.toLowerCase().includes(s) ||
      r.items.some((i) => i.partName.toLowerCase().includes(s))
    );
  };

  // Pending Return deliberately bypasses the completed-hiding filter: an item
  // is tracked there by whether it's been physically returned (isReturnable &&
  // !isReturned), not by the parent request's status — collecting the parts
  // usually completes the request while a returnable item is still outstanding.
  const statusColumns = new Set(tabs.map((tab) => tab.id).filter((id) => id !== 'all' && id !== 'pending_return'));
  function itemsForTab(tabId: TabId) {
    if (tabId === 'pending_return') return requests.filter(hasPendingReturn).filter(matches);
    // "My requests" (requesters) holds everything not already in a stage column.
    if (tabId === 'all') return visibleRequests.filter((r) => !statusColumns.has(r.status)).filter(matches);
    return visibleRequests.filter((r) => r.status === tabId).filter(matches);
  }

  function handleReview(requestId: string) {
    navigate(`/app/inventory/requests/${requestId}`);
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('common.inventory.requests.queue.searchPlaceholder')}
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">{t('common.inventory.requests.queue.priorityOptions.all')}</option>
          {PRIORITY_VALUES.map((value) => (
            <option key={value} value={value}>
              {t(`common.workOrders.priorities.${value}`)}
            </option>
          ))}
        </select>
      </div>

      {/* Kanban board: one column per stage, a card per request */}
      {loading ? (
        <div className="flex gap-4 overflow-x-auto pb-3">
          {tabs.map((tab) => (
            <div key={tab.id} className="shrink-0 w-[85vw] sm:w-80 h-48 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-3 items-start">
          {tabs.map((tab) => {
            const cards = itemsForTab(tab.id);
            return (
              <section key={tab.id} className="shrink-0 w-[85vw] sm:w-80 rounded-xl bg-gray-50 border border-gray-200">
                <header className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-gray-200">
                  <h2 className="text-sm font-semibold text-gray-700 capitalize">{t(tab.labelKey)}</h2>
                  <span className="text-xs font-medium text-gray-500 bg-white border border-gray-200 rounded-full px-2 py-0.5">{cards.length}</span>
                </header>
                <div className="p-3 space-y-3 max-h-[70vh] overflow-y-auto">
                  {cards.length === 0 ? (
                    <div className="py-8 text-center">
                      <InboxIcon className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-gray-500 text-xs">{t('common.inventory.requests.queue.noRequestsFound')}</p>
                    </div>
                  ) : (
                    cards.map((r) => (
                      <RequestQueueCard
                        key={r.id}
                        request={r}
                        returnInfo={returnByRequestId.get(r.id) ?? null}
                        onReview={() => handleReview(r.id)}
                        canManageReturns={canManageReturns}
                        showStatus={tab.id !== 'pending_return'}
                      />
                    ))
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
