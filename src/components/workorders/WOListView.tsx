import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ClipboardList } from 'lucide-react';
import type { WorkOrder, WOFilters, WOType } from '../../types/workOrder';
import { useWorkOrders } from '../../hooks/useWorkOrders';
import { useAuthStore } from '../../store/authStore';
import { WOCard } from './WOCard';
import { WODetailPanel } from './WODetailPanel';
import { WOStatsBar } from './WOStatsBar';
import { CreateWODrawer } from './CreateWODrawer';
import { TechnicianWOExecutionSheet } from './technician/TechnicianWOExecutionSheet';
import { useRecordPlantMatcher } from '../../hooks/useRecordPlantMatcher';
import { isBeyondViewWindow } from '../../lib/viewWindow';

// Breakdown Repair and Preventive Maintenance work orders already have their
// own dedicated pages (Breakdowns, PM Schedules) — this list is for
// everything else, shown as a kanban board (not grouped by WO type).
const EXCLUDED_TYPES: WOType[] = ['BREAKDOWN', 'PREVENTIVE'];

// Board columns, left to right. A WO on hold counts as still in progress, and
// an assigned WO as open. Completed holds work every assignee has finished that
// still needs sign-off; there is no Signed Off column — signed-off work sits in
// Closed. Closed is only for the roles that may see finished work
// (`canViewSignedOff`), Cancelled only for admins.
interface BoardColumn {
  id: string;
  label: string;
  dot: string;
  statuses: WorkOrder['status'][];
  /** Needs `canViewSignedOff` (signed-off / closed work) or `canViewCancelled`. */
  access?: 'finished' | 'cancelled';
}
const BOARD_COLUMNS: BoardColumn[] = [
  { id: 'open', label: 'Open', dot: 'bg-blue-500', statuses: ['DRAFT', 'OPEN', 'ASSIGNED'] },
  { id: 'in_progress', label: 'In Progress', dot: 'bg-amber-500', statuses: ['IN_PROGRESS', 'ON_HOLD_PARTS', 'ON_HOLD_APPROVAL'] },
  { id: 'completed', label: 'Completed', dot: 'bg-emerald-500', statuses: ['COMPLETED'] },
  { id: 'closed', label: 'Closed', dot: 'bg-slate-500', statuses: ['SIGNED_OFF', 'CLOSED'], access: 'finished' },
  { id: 'cancelled', label: 'Cancelled', dot: 'bg-gray-400', statuses: ['CANCELLED'], access: 'cancelled' },
];

export function WOListView() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedWO, setSelectedWO] = useState<WorkOrder | null>(null);
  const [showCreateDrawer, setShowCreateDrawer] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  // Admin / plant manager / supervisor can narrow the board to the work orders they raised, supervise or are assigned.
  const [scope, setScope] = useState<'all' | 'mine'>('all');
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
      // Legacy deep links (?tab=…): the board shows every stage, so just drop it.
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
  // Signed-off work orders (every type, Breakdown Repair and PM included):
  // admins and plant managers see all of them; supervisors see the ones
  // signed off in the last 30 days, after which they drop off their list.
  // Cancelled work orders stay admin-only.
  const canViewSignedOff = role === 'admin' || role === 'plant_manager' || role === 'supervisor';
  const canViewCancelled = role === 'admin';

  const filters: WOFilters = {};
  if (searchQuery) filters.searchQuery = searchQuery;
  // Firestore rules only let technicians/trainees read WOs they are assigned
  // to, so the query must always be constrained to their own WOs or it is rejected.
  if (role === 'technician' || role === 'trainee') filters.technicianId = user?.uid;

  // Falls back to the machine's plant for records predating plant stamping.
  const inScopedPlant = useRecordPlantMatcher();
  const { workOrders: fetchedWorkOrders, loading, error } = useWorkOrders(filters);
  // Plant-scoped roles only see work orders for their own registered plant
  // (admin: whichever plant is selected in the plant-tab switcher, or all if
  // none is); technician/trainee/supervisor/floor_operator are further
  // scoped to their own registered department within that plant.
  const workOrders = fetchedWorkOrders
    .filter((wo) => inScopedPlant(wo));

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
  const myIds = [user?.uid, userProfile?.id].filter(Boolean) as string[];
  const isMine = (wo: WorkOrder) =>
    myIds.includes(wo.createdBy) ||
    myIds.includes(wo.supervisorInChargeId) ||
    (wo.assignedTechnicianIds ?? []).some((id) => myIds.includes(id));
  // "My WOs" lists every work order the person raised, supervises or is
  // assigned to — including breakdown repair and PM ones, which the general
  // board leaves to their own pages.
  const mineOnly = canCreateWorkOrder && scope === 'mine';
  const nonExcludedWOs = workOrders.filter((wo) =>
    mineOnly ? isMine(wo) : !EXCLUDED_TYPES.includes(wo.woType),
  );

  // A supervisor sees a finished WO for 90 days (the view window); admin and plant manager see all.
  const visibleColumns = BOARD_COLUMNS.filter((c) =>
    c.access === 'finished' ? canViewSignedOff : c.access === 'cancelled' ? canViewCancelled : true,
  );
  const cardsFor = (c: BoardColumn) =>
    nonExcludedWOs.filter((wo) => {
      if (!c.statuses.includes(wo.status)) return false;
      if (c.access === 'finished') return !isBeyondViewWindow(role, true, wo.supervisorSignOffAt ?? wo.closedAt);
      return true;
    });

  return (
    <div className="min-h-full">
      {/* Page header */}
      <div className="pb-4 mb-5 border-b border-gray-100">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="font-bold text-2xl text-gray-900">{t('common.workOrders.pageTitle')}</h1>
            <p className="text-sm text-gray-500">{t('common.workOrders.count', { count: nonExcludedWOs.length })}</p>
          </div>
          <div className="flex items-center gap-2">
            {canCreateWorkOrder && (
              <button
                type="button"
                onClick={() => setShowCreateDrawer(true)}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
              >
                {t('common.workOrders.createButton')}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-5">
        {/* Stats */}
        <WOStatsBar />

        {/* Scope toggle + search */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {canCreateWorkOrder ? (
            <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5 text-sm" role="tablist">
              {(['all', 'mine'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  role="tab"
                  aria-selected={scope === s}
                  onClick={() => setScope(s)}
                  className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                    scope === s ? 'bg-blue-600 text-white' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {t(`common.workOrders.scope.${s}`)}
                </button>
              ))}
            </div>
          ) : <span />}
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('common.workOrders.searchPlaceholder')}
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
          /* Kanban board: one column per stage, a card per work order. */
          <div className="flex gap-4 overflow-x-auto pb-3 items-start snap-x snap-mandatory sm:snap-none">
            {visibleColumns.map((c) => {
              const cards = cardsFor(c);
              return (
                <section key={c.id} className="shrink-0 snap-start w-[85vw] sm:w-72 rounded-xl bg-gray-50 border border-gray-200">
                  <header className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-gray-200">
                    <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                      <span className={`h-2 w-2 rounded-full ${c.dot}`} />
                      {t(`common.workOrders.board.${c.id}`, { defaultValue: c.label })}
                    </h2>
                    <span className="text-xs font-medium text-gray-500 bg-white border border-gray-200 rounded-full px-2 py-0.5">{cards.length}</span>
                  </header>
                  <div className="p-3 space-y-3 sm:max-h-[70vh] sm:overflow-y-auto">
                    {cards.length === 0 ? (
                      <div className="py-6 text-center">
                        <ClipboardList className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                        <p className="text-xs text-gray-400">{t('common.workOrders.board.empty', { defaultValue: 'No work orders' })}</p>
                      </div>
                    ) : (
                      cards.map((wo) => <WOCard key={wo.id} workOrder={wo} onClick={setSelectedWO} />)
                    )}
                  </div>
                </section>
              );
            })}
          </div>
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
