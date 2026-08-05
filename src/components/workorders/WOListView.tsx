import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ClipboardList } from 'lucide-react';
import type { WorkOrder, WOFilters, WOType } from '../../types/workOrder';
import { WO_COPY } from '../../constants/copy';
import { WO_TYPE_CONFIG, WO_TYPES_ORDERED } from '../../constants/woConfig';
import { useWorkOrders } from '../../hooks/useWorkOrders';
import { useAuthStore } from '../../store/authStore';
import { WOTable } from './WOTable';
import { WODetailPanel } from './WODetailPanel';
import { WOStatsBar } from './WOStatsBar';
import { CreateWODrawer } from './CreateWODrawer';
import { TechnicianWOExecutionSheet } from './technician/TechnicianWOExecutionSheet';

type CategoryId = 'all' | WOType;
type LifecycleTab = 'open' | 'closed';

const CLOSED_STATUSES: WorkOrder['status'][] = ['CLOSED', 'CANCELLED', 'SIGNED_OFF'];

// Breakdown Repair and Preventive Maintenance work orders already have their
// own dedicated pages (Breakdowns, PM Schedules) — this list is for
// everything else, organized into a column per WO type.
const EXCLUDED_TYPES: WOType[] = ['BREAKDOWN', 'PREVENTIVE'];
const COLUMN_TYPES: WOType[] = WO_TYPES_ORDERED.filter((t) => !EXCLUDED_TYPES.includes(t));

export function WOListView() {
  const [activeCategory, setActiveCategory] = useState<CategoryId>('all');
  const [activeTab, setActiveTab] = useState<LifecycleTab>('open');
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
  // Same roles that gate the sign-off action inside WODetailPanel/
  // WOReviewSignOffPanel — supervisor and above.
  const canSignOff =
    role === 'supervisor' || role === 'maintenance_supervisor' || role === 'admin' || role === 'plant_manager';

  const filters: WOFilters = {};
  if (searchQuery) filters.searchQuery = searchQuery;
  // Firestore rules only let technicians read WOs they are assigned to, so
  // the query must always be constrained to their own WOs or it is rejected.
  if (role === 'technician') filters.technicianId = user?.uid;

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

  const tabFilteredWOs = nonExcludedWOs.filter((wo) =>
    activeTab === 'closed' ? CLOSED_STATUSES.includes(wo.status) : !CLOSED_STATUSES.includes(wo.status),
  );

  const displayedWOs = activeCategory === 'all'
    ? tabFilteredWOs
    : tabFilteredWOs.filter((wo) => wo.woType === activeCategory);

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

        {/* Open / Closed lifecycle tabs */}
        <div className="flex gap-1 border-b border-gray-200">
          {(['open', 'closed'] as LifecycleTab[]).map((tab) => {
            const count = nonExcludedWOs.filter((wo) =>
              tab === 'closed' ? CLOSED_STATUSES.includes(wo.status) : !CLOSED_STATUSES.includes(wo.status),
            ).length;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  activeTab === tab
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab === 'open' ? 'Open' : 'Closed'} <span className="text-xs text-gray-400">({count})</span>
              </button>
            );
          })}
        </div>

        {/* Category tabs + Search */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-1 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveCategory('all')}
              className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
                activeCategory === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {WO_COPY.tabAll}
            </button>
            {COLUMN_TYPES.map((type) => {
              const config = WO_TYPE_CONFIG[type];
              const count = nonExcludedWOs.filter((wo) => wo.woType === type).length;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setActiveCategory(type)}
                  className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
                    activeCategory === type
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  <span className={activeCategory === type ? 'text-white' : ''} style={activeCategory === type ? undefined : { color: config.color }}>
                    {config.icon}
                  </span>
                  {config.label}
                  <span
                    className={`text-xs font-medium rounded-full px-1.5 ${
                      activeCategory === type ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
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
              <p className="text-gray-500">
                {activeTab === 'closed' ? 'No closed work orders yet.' : WO_COPY.noOpenWOs}
              </p>
            </div>
          ) : (
            /* Single flat table — no per-type grouping. Type column shows
               when "All" is selected, hidden when a single category filters
               it down to one type already named by the active tab. */
            <WOTable
              workOrders={displayedWOs}
              onSelect={setSelectedWO}
              showTypeColumn={activeCategory === 'all'}
              canSignOff={activeTab === 'open' && canSignOff}
              onSignOff={setSelectedWO}
            />
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
