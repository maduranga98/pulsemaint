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
import { ApprovalRequestsPanel } from './ApprovalRequestsPanel';

// The "All" pill was removed — the list simply starts unfiltered (`all`,
// every active type combined). Once a WO reaches COMPLETED it moves into
// "Need Sign-Off" (still awaiting a supervisor's decision) and, once
// actually signed off, into the separate terminal "Signed Off" tab — a WO
// type filter stops being useful at either of those stages.
type CategoryId = 'all' | 'needSignOff' | 'signedOff' | 'approvalRequests' | WOType;

const NEED_SIGN_OFF_STATUSES: WorkOrder['status'][] = ['COMPLETED'];
const TERMINAL_STATUSES: WorkOrder['status'][] = ['SIGNED_OFF', 'CLOSED', 'CANCELLED'];
const SIGNED_OFF_STATUSES: WorkOrder['status'][] = [...NEED_SIGN_OFF_STATUSES, ...TERMINAL_STATUSES];

// Breakdown Repair and Preventive Maintenance work orders already have their
// own dedicated pages (Breakdowns, PM Schedules) — this list is for
// everything else, organized into a column per WO type.
const EXCLUDED_TYPES: WOType[] = ['BREAKDOWN', 'PREVENTIVE'];
const COLUMN_TYPES: WOType[] = WO_TYPES_ORDERED.filter((t) => !EXCLUDED_TYPES.includes(t));

export function WOListView() {
  const [searchParams, setSearchParams] = useSearchParams();
  const prefilledTab = searchParams.get('tab') as CategoryId | null;
  const [activeCategory, setActiveCategory] = useState<CategoryId>(prefilledTab ?? 'all');
  const [selectedWO, setSelectedWO] = useState<WorkOrder | null>(null);
  const [showCreateDrawer, setShowCreateDrawer] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
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
    if (searchParams.get('tab')) {
      const next = new URLSearchParams(searchParams);
      next.delete('tab');
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    role === 'supervisor' || role === 'admin' || role === 'plant_manager';

  const filters: WOFilters = {};
  if (searchQuery) filters.searchQuery = searchQuery;
  // Firestore rules only let technicians/trainees read WOs they are assigned
  // to, so the query must always be constrained to their own WOs or it is rejected.
  if (role === 'technician' || role === 'trainee') filters.technicianId = user?.uid;

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

  const displayedWOs =
    activeCategory === 'needSignOff'
      ? nonExcludedWOs.filter((wo) => NEED_SIGN_OFF_STATUSES.includes(wo.status))
      : activeCategory === 'signedOff'
      ? nonExcludedWOs.filter((wo) => TERMINAL_STATUSES.includes(wo.status))
      : activeCategory === 'approvalRequests'
      ? []
      : nonExcludedWOs
          .filter((wo) => !SIGNED_OFF_STATUSES.includes(wo.status))
          .filter((wo) => activeCategory === 'all' || wo.woType === activeCategory);

  // Approval-request holds can happen on any WO type, including breakdown
  // repair and PM ones excluded from the type columns above — a supervisor
  // still needs to see and resolve those.
  const pendingApprovalWOs = workOrders.filter((wo) => (wo.approvalRequests ?? []).some((r) => r.status === 'pending'));

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

        {/* Category tabs + Search — wraps to a second line instead of
            scrolling horizontally so every tab stays visible at once. */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-wrap gap-1">
            {COLUMN_TYPES.map((type) => {
              const config = WO_TYPE_CONFIG[type];
              const count = nonExcludedWOs.filter(
                (wo) => wo.woType === type && !SIGNED_OFF_STATUSES.includes(wo.status),
              ).length;
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
            <button
              type="button"
              onClick={() => setActiveCategory('needSignOff')}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
                activeCategory === 'needSignOff'
                  ? 'bg-amber-600 text-white'
                  : 'text-amber-700 bg-amber-50 hover:bg-amber-100'
              }`}
            >
              Need Sign-Off
              <span
                className={`text-xs font-medium rounded-full px-1.5 ${
                  activeCategory === 'needSignOff' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-600'
                }`}
              >
                {nonExcludedWOs.filter((wo) => NEED_SIGN_OFF_STATUSES.includes(wo.status)).length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveCategory('signedOff')}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
                activeCategory === 'signedOff'
                  ? 'bg-emerald-600 text-white'
                  : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
              }`}
            >
              Signed Off
              <span
                className={`text-xs font-medium rounded-full px-1.5 ${
                  activeCategory === 'signedOff' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-600'
                }`}
              >
                {nonExcludedWOs.filter((wo) => TERMINAL_STATUSES.includes(wo.status)).length}
              </span>
            </button>
            {canSignOff && (
              <button
                type="button"
                onClick={() => setActiveCategory('approvalRequests')}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
                  activeCategory === 'approvalRequests'
                    ? 'bg-orange-600 text-white'
                    : 'text-orange-700 bg-orange-50 hover:bg-orange-100'
                }`}
              >
                Approval Requests
                <span
                  className={`text-xs font-medium rounded-full px-1.5 ${
                    activeCategory === 'approvalRequests' ? 'bg-white/20 text-white' : 'bg-orange-100 text-orange-600'
                  }`}
                >
                  {pendingApprovalWOs.length}
                </span>
              </button>
            )}
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

        {!loading && !error && activeCategory === 'approvalRequests' && (
          <ApprovalRequestsPanel workOrders={pendingApprovalWOs} />
        )}

        {!loading && !error && activeCategory !== 'approvalRequests' && (
          displayedWOs.length === 0 ? (
            <div className="text-center py-16">
              <ClipboardList className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500">
                {activeCategory === 'needSignOff'
                  ? 'No work orders awaiting sign-off.'
                  : activeCategory === 'signedOff'
                  ? 'No work orders signed off or closed yet.'
                  : WO_COPY.noOpenWOs}
              </p>
            </div>
          ) : (
            /* Single flat table — no per-type grouping. Type column shows
               when every type is combined ("all" or either sign-off tab),
               hidden when a single category filters it down to one type
               already named by the active tab. */
            <WOTable
              workOrders={displayedWOs}
              onSelect={setSelectedWO}
              showTypeColumn={activeCategory === 'all' || activeCategory === 'needSignOff' || activeCategory === 'signedOff'}
              canSignOff={canSignOff}
              onSignOff={setSelectedWO}
            />
          )
        )}
      </div>

      {/* Detail panel — technicians assigned to an active WO get the execution
          sheet (start, safety gate, checklist, holds, completion) instead of
          the read-only detail panel. */}
      {liveSelectedWO && (
        (role === 'technician' || role === 'trainee') &&
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
