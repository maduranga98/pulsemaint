import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ClipboardList } from 'lucide-react';
import type { WorkOrder, WOFilters, WOStatus, WOType } from '../../types/workOrder';
import { WO_COPY } from '../../constants/copy';
import { WO_TYPE_CONFIG, WO_TYPES_ORDERED } from '../../constants/woConfig';
import { useWorkOrders } from '../../hooks/useWorkOrders';
import { useAuthStore } from '../../store/authStore';
import { WOCard } from './WOCard';
import { WODetailPanel } from './WODetailPanel';
import { WOStatsBar } from './WOStatsBar';
import { CreateWODrawer } from './CreateWODrawer';
import { TechnicianWOExecutionSheet } from './technician/TechnicianWOExecutionSheet';

type TabId = 'all' | 'mine' | 'open' | 'overdue' | 'week';

const TABS: { id: TabId; label: string }[] = [
  { id: 'all', label: WO_COPY.tabAll },
  { id: 'mine', label: WO_COPY.tabMyWOs },
  { id: 'open', label: WO_COPY.tabOpen },
  { id: 'overdue', label: WO_COPY.tabOverdue },
  { id: 'week', label: WO_COPY.tabThisWeek },
];

const OPEN_STATUSES: WOStatus[] = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD_PARTS', 'ON_HOLD_APPROVAL'];

// Breakdown Repair and Preventive Maintenance work orders already have their
// own dedicated pages (Breakdowns, PM Schedules) — this list is for
// everything else, organized into a column per WO type.
const EXCLUDED_TYPES: WOType[] = ['BREAKDOWN', 'PREVENTIVE'];
const COLUMN_TYPES: WOType[] = WO_TYPES_ORDERED.filter((t) => !EXCLUDED_TYPES.includes(t));

export function WOListView() {
  const [activeTab, setActiveTab] = useState<TabId>('all');
  const [selectedWO, setSelectedWO] = useState<WorkOrder | null>(null);
  const [showCreateDrawer, setShowCreateDrawer] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const prefilledMachineId = searchParams.get('machineId');
  const prefilledBreakdownId = searchParams.get('breakdownId');
  const prefilledBreakdownTicket = searchParams.get('breakdownTicket');
  // Comma-separated list — one WO covering every breakdown ticket in the
  // group (e.g. raised from the Breakdowns list for a whole machine).
  const prefilledBreakdownIds = searchParams.get('breakdownIds');
  const prefilledWoType = searchParams.get('woType') as WOType | null;
  const openWoId = searchParams.get('woId');

  useEffect(() => {
    if (searchParams.get('create') === '1') {
      setShowCreateDrawer(true);
      const next = new URLSearchParams(searchParams);
      next.delete('create');
      next.delete('woType');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const user = useAuthStore((s) => s.user);
  const userProfile = useAuthStore((s) => s.userProfile);
  const role = userProfile?.role;
  // Plant managers create work orders alongside supervisors and admins —
  // firestore.rules grants them the matching create permission.
  const canCreateWorkOrder =
    role === 'supervisor' || role === 'admin' || role === 'plant_manager';

  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const filters: WOFilters = {};
  if (searchQuery) filters.searchQuery = searchQuery;
  if (activeTab === 'mine') filters.technicianId = user?.uid;
  // Firestore rules only let technicians read WOs they are assigned to, so
  // every tab must constrain the query to their own WOs or it is rejected.
  if (role === 'technician') filters.technicianId = user?.uid;
  if (activeTab === 'open') filters.status = OPEN_STATUSES;
  if (activeTab === 'week') {
    filters.dateFrom = startOfWeek;
    filters.dateTo = now;
  }

  const { workOrders, loading, error } = useWorkOrders(filters);

  // Deep-link straight to a specific WO's detail view (e.g. from the PM
  // Schedules table or PM Calendar), once it has loaded.
  useEffect(() => {
    if (!openWoId) return;
    const wo = workOrders.find((w) => w.id === openWoId);
    if (wo) {
      setSelectedWO(wo);
      const next = new URLSearchParams(searchParams);
      next.delete('woId');
      setSearchParams(next, { replace: true });
    }
  }, [openWoId, workOrders, searchParams, setSearchParams]);

  // Track the open WO against the live snapshot so the detail/execution
  // views update in realtime (e.g. after Start Work / Hold / Complete).
  const liveSelectedWO = selectedWO
    ? workOrders.find((w) => w.id === selectedWO.id) ?? selectedWO
    : null;

  // Breakdown Repair and Preventive Maintenance WOs live on their own pages
  // (Breakdowns, PM Schedules) — never shown here.
  const nonExcludedWOs = workOrders.filter((wo) => !EXCLUDED_TYPES.includes(wo.woType));

  const displayedWOs = activeTab === 'overdue'
    ? nonExcludedWOs.filter(
        (wo) =>
          wo.slaBreached ||
          (wo.slaDeadline?.toMillis() < Date.now() &&
            !['COMPLETED', 'SIGNED_OFF', 'CLOSED', 'CANCELLED'].includes(wo.status)),
      )
    : nonExcludedWOs;

  const columns = COLUMN_TYPES.map((type) => ({
    type,
    config: WO_TYPE_CONFIG[type],
    items: displayedWOs.filter((wo) => wo.woType === type),
  }));

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Page header */}
      <div className="bg-white border-b border-gray-100 px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="font-bold text-2xl text-gray-900">{WO_COPY.listTitle}</h1>
            <p className="text-sm text-gray-500">{nonExcludedWOs.length} work orders</p>
          </div>
          <div className="flex items-center gap-2">
            {canCreateWorkOrder && (
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
          displayedWOs.length === 0 ? (
            <div className="text-center py-16">
              <ClipboardList className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500">{WO_COPY.noOpenWOs}</p>
            </div>
          ) : (
            /* One column per WO type — each a self-contained board lane so a
               reviewer can scan by type instead of one long mixed-type list. */
            <div className="flex gap-4 overflow-x-auto pb-2">
              {columns.filter((col) => col.items.length > 0).map((col) => (
                <div key={col.type} className="w-72 shrink-0 flex flex-col">
                  <div className="flex items-center gap-2 px-1 pb-2">
                    <span style={{ color: col.config.color }}>{col.config.icon}</span>
                    <h2 className="text-sm font-semibold text-gray-700">{col.config.label}</h2>
                    <span className="ml-auto text-xs font-medium text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
                      {col.items.length}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {col.items.map((wo) => (
                      <WOCard key={wo.id} workOrder={wo} onClick={setSelectedWO} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* Detail panel — technicians assigned to an active WO get the execution
          sheet (start, safety gate, checklist, holds, completion) instead of
          the read-only detail panel. */}
      {liveSelectedWO && (
        role === 'technician' &&
        liveSelectedWO.assignedTechnicianIds?.some((id) => [user?.uid, userProfile?.id].includes(id)) &&
        ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD_PARTS', 'ON_HOLD_APPROVAL'].includes(liveSelectedWO.status) ? (
          <TechnicianWOExecutionSheet
            workOrder={liveSelectedWO}
            onClose={() => setSelectedWO(null)}
          />
        ) : (
          <WODetailPanel
            workOrder={liveSelectedWO}
            onClose={() => setSelectedWO(null)}
          />
        )
      )}

      {/* Create drawer — conditionally rendered so each open is a fresh form */}
      {showCreateDrawer && (
        <CreateWODrawer
          open={showCreateDrawer}
          onClose={() => setShowCreateDrawer(false)}
          onCreated={() => {
            setShowCreateDrawer(false);
          }}
          prefilledMachineId={prefilledMachineId ?? undefined}
          linkedBreakdownId={prefilledBreakdownId ?? undefined}
          linkedBreakdownTicketNumber={prefilledBreakdownTicket ?? undefined}
          linkedBreakdownIds={prefilledBreakdownIds ? prefilledBreakdownIds.split(',').filter(Boolean) : undefined}
          defaultWoType={prefilledWoType ?? undefined}
        />
      )}
    </div>
  );
}
