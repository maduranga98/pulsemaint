import { useState } from 'react';
import type { WorkOrder, WOFilters, WOStatus } from '../../types/workOrder';
import { WO_COPY } from '../../constants/copy';
import { useWorkOrders } from '../../hooks/useWorkOrders';
import { useAuthStore } from '../../store/authStore';
import { WOCard } from './WOCard';
import { WODetailPanel } from './WODetailPanel';
import { WOStatsBar } from './WOStatsBar';
import { WOKanbanBoard } from './WOKanbanBoard';
import { WOTypeBadge } from './WOTypeBadge';
import { PriorityBadge } from './PriorityBadge';
import { WOStatusBadge } from './WOStatusBadge';
import { SLACountdownTimer } from './SLACountdownTimer';
import { CreateWODrawer } from './CreateWODrawer';

type TabId = 'all' | 'mine' | 'open' | 'overdue' | 'week';
type ViewMode = 'list' | 'kanban';

const TABS: { id: TabId; label: string }[] = [
  { id: 'all', label: WO_COPY.tabAll },
  { id: 'mine', label: WO_COPY.tabMyWOs },
  { id: 'open', label: WO_COPY.tabOpen },
  { id: 'overdue', label: WO_COPY.tabOverdue },
  { id: 'week', label: WO_COPY.tabThisWeek },
];

const OPEN_STATUSES: WOStatus[] = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD_PARTS', 'ON_HOLD_APPROVAL'];

export function WOListView() {
  const [activeTab, setActiveTab] = useState<TabId>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedWO, setSelectedWO] = useState<WorkOrder | null>(null);
  const [showCreateDrawer, setShowCreateDrawer] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const user = useAuthStore((s) => s.user);
  const userProfile = useAuthStore((s) => s.userProfile);
  const role = userProfile?.role;
  const isSupervisorOrAdmin =
    role === 'maintenance_supervisor' || role === 'supervisor' || role === 'admin';

  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const filters: WOFilters = {};
  if (searchQuery) filters.searchQuery = searchQuery;
  if (activeTab === 'mine') filters.technicianId = user?.uid;
  if (activeTab === 'open') filters.status = OPEN_STATUSES;
  if (activeTab === 'week') {
    filters.dateFrom = startOfWeek;
    filters.dateTo = now;
  }

  const { workOrders, loading, error } = useWorkOrders(filters);

  const displayedWOs = activeTab === 'overdue'
    ? workOrders.filter(
        (wo) =>
          wo.slaBreached ||
          (wo.slaDeadline?.toMillis() < Date.now() &&
            !['COMPLETED', 'SIGNED_OFF', 'CLOSED', 'CANCELLED'].includes(wo.status)),
      )
    : workOrders;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Page header */}
      <div className="bg-white border-b border-gray-100 px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="font-bold text-2xl text-gray-900">{WO_COPY.listTitle}</h1>
            <p className="text-sm text-gray-500">{workOrders.length} work orders</p>
          </div>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`px-3 py-1.5 text-sm ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                ≡ List
              </button>
              <button
                type="button"
                onClick={() => setViewMode('kanban')}
                className={`px-3 py-1.5 text-sm ${viewMode === 'kanban' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                ⊞ Kanban
              </button>
            </div>

            {isSupervisorOrAdmin && (
              <button
                type="button"
                onClick={() => setShowCreateDrawer(true)}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
              >
                + {WO_COPY.createButton}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 py-5 space-y-5">
        {/* Stats */}
        <WOStatsBar />

        {/* Tabs + Search */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-1 overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search WO number, machine…"
            className="w-full sm:w-64 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Content */}
        {loading && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-32 bg-white animate-pulse rounded-lg shadow-sm" />
            ))}
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && (
          viewMode === 'kanban' ? (
            <WOKanbanBoard workOrders={displayedWOs} onSelectWO={setSelectedWO} />
          ) : displayedWOs.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-5xl mb-4">📋</p>
              <p className="text-gray-500">{WO_COPY.noOpenWOs}</p>
            </div>
          ) : (
            <>
              {/* Desktop table (md+) */}
              <div className="hidden md:block bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                    <tr>
                      <th className="px-4 py-3 text-left">WO #</th>
                      <th className="px-4 py-3 text-left">Type</th>
                      <th className="px-4 py-3 text-left">Priority</th>
                      <th className="px-4 py-3 text-left">Machine</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3 text-left">Assigned</th>
                      <th className="px-4 py-3 text-left">SLA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {displayedWOs.map((wo) => (
                      <tr
                        key={wo.id}
                        onClick={() => setSelectedWO(wo)}
                        className="hover:bg-gray-50 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3 font-medium text-blue-600">{wo.woNumber || '—'}</td>
                        <td className="px-4 py-3"><WOTypeBadge woType={wo.woType} size="sm" /></td>
                        <td className="px-4 py-3"><PriorityBadge priority={wo.priority} size="sm" /></td>
                        <td className="px-4 py-3">
                          <p className="font-medium">{wo.machineName}</p>
                          <p className="text-gray-400 text-xs">{wo.machineLocation}</p>
                        </td>
                        <td className="px-4 py-3"><WOStatusBadge status={wo.status} size="sm" /></td>
                        <td className="px-4 py-3">
                          <div className="flex -space-x-1.5">
                            {wo.assignedTechnicianNames.slice(0, 3).map((n, i) => (
                              <span
                                key={i}
                                title={n}
                                className="h-7 w-7 flex items-center justify-center rounded-full bg-blue-500 ring-2 ring-white text-white text-xs font-bold"
                              >
                                {n[0]?.toUpperCase()}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <SLACountdownTimer slaDeadline={wo.slaDeadline} status={wo.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:hidden">
                {displayedWOs.map((wo) => (
                  <WOCard key={wo.id} workOrder={wo} onClick={setSelectedWO} />
                ))}
              </div>
            </>
          )
        )}
      </div>

      {/* Detail panel */}
      {selectedWO && (
        <WODetailPanel
          workOrder={selectedWO}
          onClose={() => setSelectedWO(null)}
        />
      )}

      {/* Create drawer */}
      <CreateWODrawer
        open={showCreateDrawer}
        onClose={() => setShowCreateDrawer(false)}
        onCreated={() => {
          setShowCreateDrawer(false);
        }}
      />
    </div>
  );
}
