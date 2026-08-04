import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, query, where, orderBy, onSnapshot, doc, writeBatch, arrayUnion, serverTimestamp, Timestamp } from 'firebase/firestore';
import { AlertCircle, Eye, Pencil, Plus, QrCode, Search, UserPlus, HardHat, X } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { db } from '../../lib/firebase';
import { useAuthStore } from '../../store/authStore';
import { notifyUsers } from '../../services/notifications.service';
import { AssignTechnicianModal } from '../../components/breakdowns/AssignTechnicianModal';
import type { Breakdown, BreakdownStatus, BreakdownSeverity } from '../../types/breakdown';

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
  const groups = useMemo<MachineGroup[]>(() => {
    const byMachine = new Map<string, MachineGroup>();
    for (const b of filtered) {
      const existing = byMachine.get(b.machineId);
      if (existing) {
        existing.tickets.push(b);
      } else {
        byMachine.set(b.machineId, {
          machineId: b.machineId,
          machineName: b.machineName,
          machineLocation: b.machineLocation,
          tickets: [b],
        });
      }
    }
    return Array.from(byMachine.values()).sort((a, b) => {
      const aTime = a.tickets[0]?.reportedAt?.toDate?.().getTime() ?? 0;
      const bTime = b.tickets[0]?.reportedAt?.toDate?.().getTime() ?? 0;
      return bTime - aTime;
    });
  }, [filtered]);

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
                  // Every assigned-but-not-yet-in-progress ticket on this
                  // machine — the technician can (re)open the shared
                  // assessment form for any of them until a Work Order
                  // actually starts the repair, since a pre-existing
                  // severity value (e.g. legacy data) doesn't mean the
                  // technician themself has already filled it in.
                  const assignedTickets = g.tickets.filter((t) => t.status === 'assigned');

                  return (
                    <tr key={g.machineId} className="hover:bg-slate-50 transition-colors align-top">
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          {g.tickets.map((t) => (
                            <div key={t.id} className="flex items-center gap-1.5">
                              <Link to={`/app/breakdowns/${t.id}`} className="font-medium text-blue-600 hover:underline">
                                {t.ticketNumber}
                              </Link>
                              {t.status !== 'reported' && (
                                <Link to={`/app/breakdowns/${t.id}/edit`} title="Edit assessment" className="text-slate-400 hover:text-slate-600">
                                  <Pencil className="w-3 h-3" />
                                </Link>
                              )}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">{g.machineName}</p>
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
                          {g.tickets.length === 1 && (
                            <Link
                              to={`/app/breakdowns/${g.tickets[0].id}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                              title="View breakdown details"
                            >
                              <Eye className="w-3 h-3" />
                              View
                            </Link>
                          )}
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
                        </div>
                      </td>
                    </tr>
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
    </div>
  );
}
