import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, query, where, orderBy, onSnapshot, doc, writeBatch, arrayUnion, serverTimestamp, Timestamp, documentId, getDocs } from 'firebase/firestore';
import { AlertCircle, CheckCircle, ClipboardPlus, Plus, QrCode, Search, UserPlus, HardHat, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { db } from '../../lib/firebase';
import { useAuthStore } from '../../store/authStore';
import { notifyUsers } from '../../services/notifications.service';
import { AssignTechnicianModal } from '../../components/breakdowns/AssignTechnicianModal';
import { CreateWODrawer } from '../../components/workorders/CreateWODrawer';
import type { Breakdown, BreakdownStatus, BreakdownSeverity } from '../../types/breakdown';

const ROLE_LABELS: Record<string, string> = {
  technician: 'Technician', trainee: 'Trainee', supervisor: 'Supervisor',
  maintenance_supervisor: 'Supervisor', plant_manager: 'Plant Manager',
  store_keeper: 'Store Keeper', floor_operator: 'Floor Operator',
  hr_officer: 'HR Officer', safety_officer: 'Safety Officer', admin: 'Admin',
};
function roleLabel(role: string | undefined): string {
  if (!role) return '';
  return ROLE_LABELS[role] ?? role.replace(/_/g, ' ');
}
function stripRoleSuffix(name: string): string {
  return name.replace(/\s*\([^)]*\)\s*$/, '').trim();
}
function nameWithRole(name: string, uid: string | undefined, roles: Record<string, string>): string {
  const base = stripRoleSuffix(name);
  const role = uid ? roles[uid] : undefined;
  return role ? `${base} (${roleLabel(role)})` : base;
}

const STATUS_LABEL: Record<BreakdownStatus, string> = {
  reported: 'Reported',
  acknowledged: 'Acknowledged',
  triage_in_progress: 'In Triage',
  assigned: 'Assigned',
  en_route: 'En Route',
  repair_in_progress: 'In Progress',
  on_hold_parts: 'On Hold (Parts)',
  on_hold_approval: 'On Hold (Approval)',
  resolved: 'Resolved',
  closed: 'Closed',
  cancelled: 'Cancelled',
};

const STATUS_COLOR: Record<BreakdownStatus, string> = {
  reported: 'bg-red-50 text-red-700 ring-red-200',
  acknowledged: 'bg-amber-50 text-amber-700 ring-amber-200',
  triage_in_progress: 'bg-amber-50 text-amber-700 ring-amber-200',
  assigned: 'bg-blue-50 text-blue-700 ring-blue-200',
  en_route: 'bg-blue-50 text-blue-700 ring-blue-200',
  repair_in_progress: 'bg-cyan-50 text-cyan-700 ring-cyan-200',
  on_hold_parts: 'bg-orange-50 text-orange-700 ring-orange-200',
  on_hold_approval: 'bg-orange-50 text-orange-700 ring-orange-200',
  resolved: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  closed: 'bg-slate-100 text-slate-600 ring-slate-200',
  cancelled: 'bg-slate-200 text-slate-700 ring-slate-300',
};

// Repair progress (%) per lifecycle stage — used for the at-a-glance progress bar
// and to pick the "most advanced" ticket to represent a machine's grouped row.
const STATUS_PROGRESS: Record<BreakdownStatus, number> = {
  reported: 5,
  acknowledged: 15,
  triage_in_progress: 25,
  assigned: 40,
  en_route: 55,
  repair_in_progress: 70,
  on_hold_parts: 60,
  on_hold_approval: 60,
  resolved: 95,
  closed: 100,
  cancelled: 0,
};

function progressBarColor(status: BreakdownStatus): string {
  if (status === 'cancelled') return 'bg-slate-300';
  if (status === 'resolved' || status === 'closed') return 'bg-emerald-500';
  if (status === 'on_hold_parts' || status === 'on_hold_approval') return 'bg-orange-400';
  return 'bg-blue-500';
}

const SEVERITY_COLOR: Record<BreakdownSeverity, string> = {
  critical: 'bg-red-600 text-white',
  high: 'bg-orange-500 text-white',
  medium: 'bg-amber-500 text-white',
  low: 'bg-slate-400 text-white',
};

const SEVERITY_RANK: Record<BreakdownSeverity, number> = { critical: 4, high: 3, medium: 2, low: 1 };

// Only these four buckets are shown — a breakdown's lifecycle in this view
// is: reported -> assigned (someone is visiting/filling it) -> open (a work
// order has actually been started) -> closed (WO signed off).
type Filter = 'reported' | 'assigned' | 'open' | 'closed';
type SeverityFilter = 'all' | 'high' | 'medium' | 'normal';

const CAN_ASSIGN_ROLES = ['supervisor', 'maintenance_supervisor', 'plant_manager', 'admin'];
const CAN_ATTEND_ROLES = ['technician', 'trainee'];

interface MachineGroup {
  machineId: string;
  machineName: string;
  machineLocation: string;
  tickets: Breakdown[];
}

export default function BreakdownsPage() {
  const navigate = useNavigate();
  const userProfile = useAuthStore((s) => s.userProfile);
  const siteId = userProfile?.siteIds?.[0] || userProfile?.companyId;
  const role = userProfile?.role ?? '';
  const canAssign = CAN_ASSIGN_ROLES.includes(role);
  const canAttend = CAN_ATTEND_ROLES.includes(role);

  const [breakdowns, setBreakdowns] = useState<Breakdown[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('reported');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [search, setSearch] = useState('');
  const [showQrScanner, setShowQrScanner] = useState(false);
  const qrScannerRef = useRef<Html5Qrcode | null>(null);
  const [assigningGroup, setAssigningGroup] = useState<MachineGroup | null>(null);
  const [assignBusy, setAssignBusy] = useState(false);
  const [attendingMachineId, setAttendingMachineId] = useState<string | null>(null);
  // Expanding a machine's row (clicking its name) reveals full details inline,
  // right under the row, instead of navigating to a separate page.
  const [expandedMachineId, setExpandedMachineId] = useState<string | null>(null);
  const [actorRoles, setActorRoles] = useState<Record<string, string>>({});
  // Opened inline so creating a WO from a breakdown group stays on this page
  // instead of jumping to the Work Orders tab.
  const [createWOTickets, setCreateWOTickets] = useState<Breakdown[] | null>(null);

  useEffect(() => {
    if (!siteId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(
      collection(db, 'breakdown_tickets'),
      where('siteId', '==', siteId),
      orderBy('reportedAt', 'desc'),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setBreakdowns(snap.docs.map((d) => ({ ...d.data(), id: d.id }) as Breakdown));
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
    return () => unsub();
  }, [siteId]);

  const filtered = useMemo(() => {
    const closedSet = new Set<BreakdownStatus>(['closed', 'cancelled']);
    let list = breakdowns;
    if (filter === 'reported') list = list.filter((b) => b.status === 'reported');
    if (filter === 'assigned') list = list.filter((b) => b.status === 'assigned');
    if (filter === 'open') list = list.filter((b) => !closedSet.has(b.status) && b.status !== 'reported' && b.status !== 'assigned');
    if (filter === 'closed') list = list.filter((b) => closedSet.has(b.status));
    if (severityFilter !== 'all') {
      const sevMatch = severityFilter === 'normal' ? 'low' : severityFilter;
      list = list.filter((b) => b.severity === sevMatch);
    }
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(
        (b) =>
          b.ticketNumber?.toLowerCase().includes(s) ||
          b.machineName?.toLowerCase().includes(s) ||
          b.description?.toLowerCase().includes(s),
      );
    }
    return list;
  }, [breakdowns, filter, severityFilter, search]);

  // Multiple open tickets on the same machine are shown as one row so a
  // supervisor isn't assigning/attending the same machine ticket by ticket.
  // On the Closed tab, though, a machine can carry many separate historical
  // incidents (different work orders, weeks apart) — grouping those purely
  // by machine merged unrelated repair histories into one noisy form, so
  // closed tickets are grouped by their work order instead (falling back to
  // the ticket itself when none is linked), one row per actual incident.
  const groups = useMemo<MachineGroup[]>(() => {
    const byGroup = new Map<string, MachineGroup>();
    for (const b of filtered) {
      const key = filter === 'closed' ? `${b.machineId}::${b.linkedWOId ?? b.id}` : b.machineId;
      const existing = byGroup.get(key);
      if (existing) {
        existing.tickets.push(b);
      } else {
        byGroup.set(key, {
          machineId: b.machineId,
          machineName: b.machineName,
          machineLocation: b.machineLocation,
          tickets: [b],
        });
      }
    }
    return Array.from(byGroup.values()).sort((a, b) => {
      const aTime = a.tickets[0]?.reportedAt?.toDate?.().getTime() ?? 0;
      const bTime = b.tickets[0]?.reportedAt?.toDate?.().getTime() ?? 0;
      return bTime - aTime;
    });
  }, [filtered]);

  const expandedGroup = groups.find((g) => g.machineId === expandedMachineId) ?? null;
  const groupsNeedingRoles = expandedGroup ? [expandedGroup] : [];
  const expandedRowRef = useRef<HTMLTableRowElement | null>(null);

  // Clicking a machine name toggles its detail row open/closed; when opening,
  // scroll it into view since the table can be long and the row appears
  // below the fold.
  function toggleExpanded(machineId: string) {
    setExpandedMachineId((cur) => (cur === machineId ? null : machineId));
  }

  useEffect(() => {
    if (expandedMachineId && expandedRowRef.current) {
      expandedRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [expandedMachineId]);

  // Resolve every actor's current role across the relevant tickets
  // (attended-by, assigned technicians, status history) so names can be
  // shown with their role — Firestore's `in` filter caps at 30 ids per call.
  useEffect(() => {
    if (groupsNeedingRoles.length === 0) return;
    const uids = Array.from(
      new Set(
        groupsNeedingRoles.flatMap((g) =>
          g.tickets.flatMap((b) => [
            b.attendedBy,
            ...(b.assignedTechnicianIds ?? []),
            ...(b.statusHistory ?? []).map((h: any) => h.changedBy),
          ]),
        ),
      ),
    ).filter((id): id is string => !!id);
    if (uids.length === 0) return;
    const chunks: string[][] = [];
    for (let i = 0; i < uids.length; i += 30) chunks.push(uids.slice(i, i + 30));
    Promise.all(
      chunks.map((chunk) => getDocs(query(collection(db, 'users'), where(documentId(), 'in', chunk)))),
    )
      .then((snaps) => {
        const roles: Record<string, string> = {};
        snaps.forEach((snap) => {
          snap.docs.forEach((d) => {
            roles[d.id] = (d.data() as any).role ?? '';
          });
        });
        setActorRoles((prev) => ({ ...prev, ...roles }));
      })
      .catch(() => {}); // silently ignore permission errors
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, groups]);

  async function openQrScanner() {
    setShowQrScanner(true);
    setTimeout(async () => {
      try {
        const scanner = new Html5Qrcode('qr-reader');
        qrScannerRef.current = scanner;
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          async (decodedText) => {
            await scanner.stop();
            qrScannerRef.current = null;
            setShowQrScanner(false);
            const url = new URL(decodedText);
            const machineId = url.searchParams.get('machineId');
            if (machineId) {
              navigate(`/app/breakdowns/report?machineId=${machineId}`);
            } else {
              setError('QR code did not contain a valid machine ID.');
            }
          },
          () => {},
        );
      } catch (err: any) {
        setError(err?.message || 'Failed to open camera.');
        setShowQrScanner(false);
      }
    }, 100);
  }

  async function closeQrScanner() {
    if (qrScannerRef.current) {
      try { await qrScannerRef.current.stop(); } catch {}
      qrScannerRef.current = null;
    }
    setShowQrScanner(false);
  }

  // Reported tickets for a machine that assign/attend should act on together.
  function reportedTickets(group: MachineGroup): Breakdown[] {
    return group.tickets.filter((t) => t.status === 'reported');
  }

  async function handleAssign(candidate: { id: string; fullName: string; role: string }) {
    if (!assigningGroup || !userProfile) return;
    const tickets = reportedTickets(assigningGroup);
    if (tickets.length === 0) return;
    setAssignBusy(true);
    try {
      const batch = writeBatch(db);
      for (const t of tickets) {
        batch.update(doc(db, 'breakdown_tickets', t.id), {
          assignedTechnicianIds: [candidate.id],
          assignedTechnicianNames: [candidate.fullName],
          assignedBy: userProfile.id,
          assignedByName: userProfile.fullName,
          assignedAt: serverTimestamp(),
          attendedBy: candidate.id,
          attendedByName: candidate.fullName,
          attendedAt: serverTimestamp(),
          status: 'assigned',
          statusHistory: arrayUnion({
            status: 'assigned',
            changedBy: userProfile.id,
            changedByName: userProfile.fullName,
            changedAt: Timestamp.now(),
            note: `Assigned to ${candidate.fullName} by ${userProfile.fullName}`,
          }),
        });
      }
      await batch.commit();
      void notifyUsers(userProfile.companyId, [candidate.id], {
        type: 'breakdown',
        message: `You've been assigned to ${tickets.length > 1 ? `${tickets.length} breakdowns` : 'a breakdown'} on ${assigningGroup.machineName}`,
        oversightMessage: `assigned ${candidate.fullName} to ${tickets.length > 1 ? `${tickets.length} breakdowns` : 'a breakdown'} on ${assigningGroup.machineName}`,
        actorName: userProfile.fullName ?? '',
        actorRole: userProfile.role,
        actorUserId: userProfile.id,
        linkTo: `/app/breakdowns/${tickets[0].id}`,
      });
      setAssigningGroup(null);
    } catch (e: any) {
      setError(e?.message || 'Failed to assign.');
    } finally {
      setAssignBusy(false);
    }
  }

  async function handleAttend(group: MachineGroup) {
    if (!userProfile) return;
    const tickets = reportedTickets(group);
    if (tickets.length === 0) return;
    setAttendingMachineId(group.machineId);
    try {
      const batch = writeBatch(db);
      for (const t of tickets) {
        batch.update(doc(db, 'breakdown_tickets', t.id), {
          assignedTechnicianIds: [userProfile.id],
          assignedTechnicianNames: [userProfile.fullName],
          attendedBy: userProfile.id,
          attendedByName: userProfile.fullName,
          attendedAt: serverTimestamp(),
          status: 'assigned',
          statusHistory: arrayUnion({
            status: 'assigned',
            changedBy: userProfile.id,
            changedByName: userProfile.fullName,
            changedAt: Timestamp.now(),
            note: `Self-attended by ${userProfile.fullName}`,
          }),
        });
      }
      await batch.commit();
      // One shared assessment form for every ticket just attended on this
      // machine, instead of bouncing the technician between separate pages.
      navigate(`/app/breakdowns/attend?ids=${tickets.map((t) => t.id).join(',')}`);
    } catch (e: any) {
      setError(e?.message || 'Failed to attend.');
    } finally {
      setAttendingMachineId(null);
    }
  }

  // Opens the exact same Create Work Order drawer used from the WOs tab,
  // right here — prefilled with every filled-in ticket on this machine so
  // one WO covers the whole group — instead of navigating to the Work
  // Orders tab and losing this page's filters/scroll position.
  function goToCreateWorkOrder(tickets: Breakdown[]) {
    if (tickets.length === 0) return;
    setCreateWOTickets(tickets);
  }

  return (
    <div className="min-h-full">
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Breakdowns</h1>
            <p className="text-sm text-slate-500">{filtered.length} {filter} across {groups.length} machine{groups.length === 1 ? '' : 's'}</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={openQrScanner}
              className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 bg-white text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-50"
            >
              <QrCode className="w-4 h-4" />
              Report via QR
            </button>
            <Link
              to="/app/breakdowns/report"
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg"
            >
              <Plus className="w-4 h-4" />
              Report Breakdown
            </Link>
          </div>
        </div>
      </div>

      <div className="px-6 py-5 space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-1">
            {(['reported', 'assigned', 'open', 'closed'] as Filter[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`px-4 py-2 text-sm font-medium rounded-lg capitalize transition-colors ${
                  filter === f ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Severity</label>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value as SeverityFilter)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="all">All</option>
              <option value="normal">Normal</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search ticket, machine, description…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 flex gap-2 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 bg-white rounded-lg animate-pulse" />
            ))}
          </div>
        ) : groups.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-slate-100">
            <p className="text-5xl mb-3">🛠️</p>
            <p className="text-slate-500">No breakdowns matching this filter.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Ticket(s)</th>
                  <th className="px-4 py-3 text-left">Machine</th>
                  <th className="px-4 py-3 text-left">Severity</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Progress</th>
                  <th className="px-4 py-3 text-left">Reported</th>
                  <th className="px-4 py-3 text-left">Assigned To</th>
                  <th className="px-4 py-3 text-left">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {groups.map((g) => {
                  const worstSeverity = g.tickets.reduce<BreakdownSeverity | null>((worst, t) => {
                    if (!t.severity) return worst;
                    if (!worst || SEVERITY_RANK[t.severity] > SEVERITY_RANK[worst]) return t.severity;
                    return worst;
                  }, null);
                  const representative = g.tickets.reduce((best, t) =>
                    (STATUS_PROGRESS[t.status] ?? 0) > (STATUS_PROGRESS[best.status] ?? 0) ? t : best
                  , g.tickets[0]);
                  const assignedNames = Array.from(new Set(g.tickets.flatMap((t) => t.assignedTechnicianNames ?? [])));
                  const mostRecentReportedAt = g.tickets
                    .map((t) => t.reportedAt)
                    .filter(Boolean)
                    .sort((a, b) => (b?.toDate?.().getTime() ?? 0) - (a?.toDate?.().getTime() ?? 0))[0];
                  const hasReported = reportedTickets(g).length > 0;
                  // Assigned tickets still waiting on the technician's
                  // assessment (no severity set yet) — these get "Attend &
                  // Fill". Once filled, a ticket moves to filledTickets()
                  // below and only a "Create Work Order" action applies —
                  // filled/reported tickets are never directly editable from
                  // this list, only viewable via the ticket link.
                  const assignedTickets = g.tickets.filter((t) => t.status === 'assigned' && !t.severity);
                  const filledTickets = g.tickets.filter((t) => t.status === 'assigned' && !!t.severity && !t.linkedWOId);

                  return (
                    <Fragment key={`${g.machineId}::${g.tickets[0]?.id}`}>
                    <tr className="hover:bg-slate-50 transition-colors align-top">
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          {g.tickets.map((t) => (
                            <Link key={t.id} to={`/app/breakdowns/${t.id}`} className="font-medium text-blue-600 hover:underline">
                              {t.ticketNumber}
                            </Link>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => toggleExpanded(g.machineId)}
                          className="inline-flex items-center gap-1 font-medium text-slate-900 hover:text-blue-600 hover:underline"
                        >
                          {g.machineName}
                          {expandedMachineId === g.machineId ? (
                            <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                          )}
                        </button>
                        <p className="text-slate-400 text-xs">{g.machineLocation}</p>
                      </td>
                      <td className="px-4 py-3">
                        {worstSeverity ? (
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold uppercase ${SEVERITY_COLOR[worstSeverity]}`}>
                            {worstSeverity}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-500">Pending</span>
                        )}
                        {g.tickets.length > 1 && (
                          <span className="ml-1 text-xs text-slate-400">×{g.tickets.length}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ring-1 ${STATUS_COLOR[representative.status]}`}>
                          {STATUS_LABEL[representative.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 min-w-[120px]">
                          <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${progressBarColor(representative.status)}`}
                              style={{ width: `${STATUS_PROGRESS[representative.status] ?? 0}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-500 tabular-nums w-9 text-right">
                            {STATUS_PROGRESS[representative.status] ?? 0}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {mostRecentReportedAt?.toDate ? mostRecentReportedAt.toDate().toLocaleString() : ''}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {assignedNames.length > 0
                          ? assignedNames.join(', ')
                          : <span className="text-slate-400 text-xs">Unassigned</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {hasReported && canAssign && (
                            <button
                              type="button"
                              onClick={() => setAssigningGroup(g)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors"
                              title="Assign a technician or trainee to every open breakdown on this machine"
                            >
                              <UserPlus className="w-3 h-3" />
                              Assign
                            </button>
                          )}
                          {hasReported && canAttend && (
                            <button
                              type="button"
                              disabled={attendingMachineId === g.machineId}
                              onClick={() => handleAttend(g)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors disabled:opacity-50"
                              title="Attend to every open breakdown on this machine yourself"
                            >
                              <HardHat className="w-3 h-3" />
                              {attendingMachineId === g.machineId ? 'Attending…' : 'Attend'}
                            </button>
                          )}
                          {!hasReported && assignedTickets.length > 0 && canAttend
                            && assignedTickets.some((t) => (t.assignedTechnicianIds ?? []).includes(userProfile?.id ?? '')) && (
                            <Link
                              to={`/app/breakdowns/attend?ids=${assignedTickets.map((t) => t.id).join(',')}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                              title="Attend and fill in the assessment for every ticket assigned to you on this machine"
                            >
                              <HardHat className="w-3 h-3" />
                              Attend &amp; Fill{assignedTickets.length > 1 ? ` (${assignedTickets.length})` : ''}
                            </Link>
                          )}
                          {filledTickets.length > 0 && canAssign && (
                            <button
                              type="button"
                              onClick={() => goToCreateWorkOrder(filledTickets)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors"
                              title="Create one Work Order covering every filled-in breakdown on this machine"
                            >
                              <ClipboardPlus className="w-3 h-3" />
                              Create WO{filledTickets.length > 1 ? ` (${filledTickets.length})` : ''}
                            </button>
                          )}
                          {representative.status === 'resolved' && canAssign && (
                            <Link
                              to={`/app/breakdowns/${representative.id}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
                              title="The repair work order is complete — sign off (and RCA if required) to close this breakdown"
                            >
                              <CheckCircle className="w-3 h-3" />
                              Sign-Off &amp; Close
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expandedMachineId === g.machineId && (
                      <tr ref={expandedMachineId === g.machineId ? expandedRowRef : undefined}>
                        <td colSpan={8} className="bg-slate-50 px-4 py-5 border-t border-b border-slate-200">
                          <MachineBreakdownDetails group={g} actorRoles={actorRoles} showHistory={filter === 'closed'} />
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showQrScanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Scan Machine QR Code</h3>
              <button type="button" onClick={closeQrScanner} className="p-1 rounded-lg hover:bg-slate-100">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div id="qr-reader" className="w-full" />
            <p className="text-xs text-slate-500 mt-3 text-center">Point your camera at a machine QR code to auto-select the machine.</p>
          </div>
        </div>
      )}

      {assigningGroup && userProfile && (
        <AssignTechnicianModal
          companyId={userProfile.companyId}
          assigning={assignBusy}
          onClose={() => setAssigningGroup(null)}
          onAssign={handleAssign}
        />
      )}

      {createWOTickets && createWOTickets.length > 0 && (
        <CreateWODrawer
          open
          onClose={() => setCreateWOTickets(null)}
          onCreated={() => setCreateWOTickets(null)}
          linkedBreakdownId={createWOTickets[0].id}
          linkedBreakdownIds={createWOTickets.map((t) => t.id)}
          prefilledMachineId={createWOTickets[0].machineId}
          defaultWoType="BREAKDOWN"
        />
      )}
    </div>
  );
}

interface MachineBreakdownDetailsProps {
  group: MachineGroup;
  actorRoles: Record<string, string>;
  // Status history is only useful once a breakdown is closed and someone is
  // reviewing the whole chain — everywhere else it's noise on top of the
  // live status badge already shown.
  showHistory: boolean;
}

function sortTicketsByReportedAt(tickets: Breakdown[]): Breakdown[] {
  return [...tickets].sort(
    (a, b) => (a.reportedAt?.toDate?.().getTime() ?? 0) - (b.reportedAt?.toDate?.().getTime() ?? 0),
  );
}

// A field that can differ ticket to ticket (what happened, attempted fixes,
// production impact) — shown as one line per ticket that has a value, tagged
// with its ticket number only when there's more than one ticket, so a
// single-ticket machine reads as plain prose instead of a labelled list.
function MergedField({ tickets, get }: { tickets: Breakdown[]; get: (t: Breakdown) => string | null | undefined }) {
  const entries = tickets.map((t) => ({ ticketNumber: t.ticketNumber, value: get(t) })).filter((e) => e.value);
  if (entries.length === 0) return <p className="text-slate-400 italic">—</p>;
  if (entries.length === 1) return <p className="text-slate-800">{entries[0].value}</p>;
  return (
    <ul className="space-y-1">
      {entries.map((e, i) => (
        <li key={i} className="text-slate-800">
          <span className="text-slate-400 text-xs font-medium mr-1">{e.ticketNumber}:</span>
          {e.value}
        </li>
      ))}
    </ul>
  );
}

// One consolidated form for every breakdown ticket grouped on a machine's
// row — shown inline under the row (no popup, no page navigation, no
// per-ticket repeated boxes) so a supervisor can just scroll down and see
// everything as a single form: earliest report time first, what happened /
// attempted fixes / production impact / attended-by / assigned technicians
// merged across every ticket, then the full status history in chronological
// order (oldest first) ending at the machine's current status.
function MachineBreakdownDetails({ group, actorRoles, showHistory }: MachineBreakdownDetailsProps) {
  const tickets = sortTicketsByReportedAt(group.tickets);
  const firstReported = tickets[0]?.reportedAt;

  const attendees = Array.from(
    new Map(
      tickets
        .filter((t) => t.attendedByName)
        .map((t) => [t.attendedBy ?? t.attendedByName, { name: t.attendedByName!, uid: t.attendedBy ?? undefined, at: t.attendedAt }]),
    ).values(),
  );
  const technicians = Array.from(
    new Map(
      tickets.flatMap((t) =>
        (t.assignedTechnicianNames ?? []).map((name, i) => {
          const uid = t.assignedTechnicianIds?.[i];
          return [uid ?? name, { name, uid }] as const;
        }),
      ),
    ).values(),
  );

  // Assigning/attending a whole group of tickets at once (see handleAssign/
  // handleAttend above) writes a near-identical status history entry to
  // every ticket in the batch (same step, same actor, same moment, only the
  // note's wording differs slightly per ticket) — merging tickets' histories
  // together would show the same step repeated several times over. Collapse
  // entries that share a status, actor, and timestamp (to the minute) down
  // to one, ignoring the note entirely.
  const historyEntries = Array.from(
    new Map(
      tickets
        .flatMap((t) => t.statusHistory ?? [])
        .map((h: any) => {
          const ms = h.changedAt?.toDate ? h.changedAt.toDate().getTime() : new Date(h.changedAt ?? 0).getTime();
          const minuteKey = Math.floor(ms / 60000);
          return [`${h.status}|${h.changedBy}|${minuteKey}`, { ...h, _ms: ms }] as const;
        }),
    ).values(),
  ).sort((a, b) => a._ms - b._ms);

  const worstSeverity = tickets.reduce<BreakdownSeverity | null>((worst, t) => {
    if (!t.severity) return worst;
    if (!worst || SEVERITY_RANK[t.severity] > SEVERITY_RANK[worst]) return t.severity;
    return worst;
  }, null);
  const photos = tickets.flatMap((t) => t.photos ?? []);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-5">
      <div className="flex items-center gap-2 flex-wrap">
        {tickets.map((t) => (
          <Link key={t.id} to={`/app/breakdowns/${t.id}`} className="font-semibold text-blue-600 hover:underline text-sm">
            {t.ticketNumber}
          </Link>
        ))}
        {worstSeverity ? (
          <span className={`px-2 py-0.5 rounded text-xs font-semibold uppercase ${SEVERITY_COLOR[worstSeverity]}`}>
            {worstSeverity}
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-500">Pending assessment</span>
        )}
        <span className={`px-2 py-0.5 rounded text-xs font-medium ring-1 ${STATUS_COLOR[tickets[tickets.length - 1].status]}`}>
          {STATUS_LABEL[tickets[tickets.length - 1].status]}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-slate-500 text-xs font-medium uppercase tracking-wide mb-1">Reported</p>
          <p className="text-slate-800">
            {tickets[0]?.source?.replace(/_/g, ' ') || 'Web'}
            {firstReported?.toDate && <span className="text-slate-400"> · {firstReported.toDate().toLocaleString()}</span>}
          </p>
        </div>
        <div>
          <p className="text-slate-500 text-xs font-medium uppercase tracking-wide mb-1">Attended By</p>
          {attendees.length === 0 ? (
            <p className="text-slate-400 italic">—</p>
          ) : (
            <p className="text-slate-800">
              {attendees
                .map((a) => `${nameWithRole(a.name, a.uid, actorRoles)}${a.at?.toDate ? ` (${a.at.toDate().toLocaleString()})` : ''}`)
                .join(', ')}
            </p>
          )}
        </div>

        <div className="sm:col-span-2">
          <p className="text-slate-500 text-xs font-medium uppercase tracking-wide mb-1">What Happened</p>
          <MergedField tickets={tickets} get={(t) => t.description} />
        </div>

        <div className="sm:col-span-2">
          <p className="text-slate-500 text-xs font-medium uppercase tracking-wide mb-1">Production Impact</p>
          <MergedField tickets={tickets} get={(t) => t.productionImpact} />
        </div>

        <div className="sm:col-span-2">
          <p className="text-slate-500 text-xs font-medium uppercase tracking-wide mb-1">Attempted Fixes</p>
          <MergedField tickets={tickets} get={(t) => t.attemptedFixes} />
        </div>

        <div className="sm:col-span-2">
          <p className="text-slate-500 text-xs font-medium uppercase tracking-wide mb-1">Assigned Technicians</p>
          {technicians.length === 0 ? (
            <p className="text-slate-400 italic">—</p>
          ) : (
            <p className="text-slate-800">
              {technicians.map((t) => nameWithRole(t.name, t.uid, actorRoles)).join(', ')}
            </p>
          )}
        </div>

        {photos.length > 0 && (
          <div className="sm:col-span-2">
            <p className="text-slate-500 text-xs font-medium uppercase tracking-wide mb-2">Attached Media</p>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {photos.map((url, i) => {
                const isImage = /\.(jpe?g|png|gif|webp|heic|bmp)(\?|$)/i.test(url);
                const isVideo = /\.(mp4|mov|avi|webm)(\?|$)/i.test(url);
                return (
                  <a
                    key={i}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block border border-slate-200 rounded-lg overflow-hidden hover:ring-2 hover:ring-blue-300 transition-shadow"
                  >
                    {isImage ? (
                      <img src={url} alt={`Attachment ${i + 1}`} className="w-full h-20 object-cover" />
                    ) : isVideo ? (
                      <video src={url} className="w-full h-20 object-cover" muted />
                    ) : (
                      <div className="w-full h-20 flex items-center justify-center bg-slate-50 text-slate-400 text-xs">
                        File {i + 1}
                      </div>
                    )}
                  </a>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {showHistory && (
        <div className="pt-2 border-t border-slate-100">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Status History</p>
          {historyEntries.length === 0 ? (
            <p className="text-sm text-slate-500">No status changes yet.</p>
          ) : (
            <ol className="space-y-2 text-sm">
              {historyEntries.map((h, idx) => (
                <li key={idx} className="flex gap-3 items-start">
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-50 border border-slate-200 whitespace-nowrap">
                    {STATUS_LABEL[h.status as BreakdownStatus] ?? h.status}
                  </span>
                  <div>
                    <span className="text-slate-700">
                      {nameWithRole(h.changedByName ?? '', h.changedBy, actorRoles)}
                    </span>
                    <span className="text-slate-400 text-xs ml-2">
                      {h.changedAt?.toDate ? h.changedAt.toDate().toLocaleString() : (typeof h.changedAt === 'string' ? new Date(h.changedAt).toLocaleString() : '')}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
