import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, query, where, onSnapshot, doc, writeBatch, arrayUnion, serverTimestamp, Timestamp } from 'firebase/firestore';
import { toast } from 'sonner';
import { db } from '../../../lib/firebase';
import { useAuthStore } from '../../../store/authStore';
import { useDepartmentScope } from '../../../hooks/useDepartmentScope';
import DashboardWidget from '../shared/DashboardWidget';
import EmptyState from '../shared/EmptyState';
import type { Breakdown, BreakdownSeverity } from '../../../types/breakdown';
import { groupBreakdownsByMachine } from '../../../lib/breakdowns/groupByMachine';
import { markMachineUnderMaintenance } from '../../../lib/machineOperationalStatus';
import { useTranslation } from 'react-i18next';

interface UnassignedBreakdownsWidgetProps {
  siteId: string;
}

const SEVERITY_COLOR: Record<string, string> = {
  critical: 'bg-red-600 text-white',
  high: 'bg-orange-500 text-white',
  medium: 'bg-amber-500 text-white',
  low: 'bg-slate-400 text-white',
};

const SEVERITY_RANK: Record<BreakdownSeverity, number> = { critical: 4, high: 3, medium: 2, low: 1 };

// Breakdowns nobody has attended or been assigned to yet, grouped by machine
// the same way the Breakdowns page's Reported tab does — every ticket on
// that machine is still listed individually (not collapsed into a count),
// and Attend is the exact same action the page uses: self-assign every
// reported ticket on that machine, then go straight to the assessment form.
export default function UnassignedBreakdownsWidget({ siteId }: UnassignedBreakdownsWidgetProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const userProfile = useAuthStore((s) => s.userProfile);
  const { department: scopedDepartment } = useDepartmentScope();
  const [breakdowns, setBreakdowns] = useState<Breakdown[]>([]);
  const [loading, setLoading] = useState(true);
  const [attendingMachineId, setAttendingMachineId] = useState<string | null>(null);

  useEffect(() => {
    if (!siteId) {
      setLoading(false);
      return;
    }
    const q = query(
      collection(db, 'breakdown_tickets'),
      where('siteId', '==', siteId),
      where('status', '==', 'reported'),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setBreakdowns(snap.docs.map((d) => ({ ...d.data(), id: d.id }) as Breakdown));
        setLoading(false);
      },
      () => setLoading(false),
    );
    return () => unsub();
  }, [siteId]);

  // Technician/trainee/floor_operator only ever see unassigned breakdowns in
  // their own registered department.
  const scopedBreakdowns = scopedDepartment
    ? breakdowns.filter((b) => b.machineDepartment === scopedDepartment)
    : breakdowns;
  const groups = groupBreakdownsByMachine(scopedBreakdowns);

  async function handleAttend(tickets: Breakdown[], machineId: string) {
    if (!userProfile || tickets.length === 0) return;
    setAttendingMachineId(machineId);
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
      void markMachineUnderMaintenance(machineId);
      // One shared assessment form for every ticket just attended on this
      // machine — the direct next step, not a detour through the Breakdowns
      // page/tab.
      navigate(`/app/breakdowns/attend?ids=${tickets.map((t) => t.id).join(',')}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('common.widgets.unassignedBreakdownsWidget.attendFailed'));
    } finally {
      setAttendingMachineId(null);
    }
  }

  return (
    <DashboardWidget title={t('common.widgets.unassignedBreakdownsWidget.title')} loading={loading}>
      {groups.length === 0 ? (
        <EmptyState message={t('common.widgets.unassignedBreakdownsWidget.empty')} />
      ) : (
        <div className="space-y-3">
          {groups.map((g) => {
            const worstSeverity = g.tickets.reduce<BreakdownSeverity | null>((worst, t) => {
              if (!t.severity) return worst;
              if (!worst || SEVERITY_RANK[t.severity] > SEVERITY_RANK[worst]) return t.severity;
              return worst;
            }, null);
            return (
              <div key={g.machineId} className="bg-[#0A1628] rounded-lg border border-[#1E3A5F] overflow-hidden">
                <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-[#1E3A5F]">
                  <p className="text-sm font-medium text-[#F0F4F8] truncate">{g.machineName}</p>
                  <div className="shrink-0 flex items-center gap-2">
                    {worstSeverity && (
                      <span className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${SEVERITY_COLOR[worstSeverity]}`}>
                        {worstSeverity}
                      </span>
                    )}
                    <button
                      type="button"
                      disabled={attendingMachineId === g.machineId}
                      onClick={() => handleAttend(g.tickets, g.machineId)}
                      className="px-2.5 py-1 text-[11px] font-medium bg-[#1A56DB] text-white rounded-md hover:bg-[#1442ad] disabled:opacity-50"
                    >
                      {attendingMachineId === g.machineId ? t('common.widgets.unassignedBreakdownsWidget.attending') : t('common.widgets.unassignedBreakdownsWidget.attend')}
                    </button>
                  </div>
                </div>
                <div className="divide-y divide-[#1E3A5F]">
                  {g.tickets.map((t) => (
                    <Link
                      key={t.id}
                      to={`/app/breakdowns/${t.id}`}
                      className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-[#0F1E35] transition-colors"
                    >
                      <span className="text-xs text-[#60A5FA]">{t.ticketNumber}</span>
                      {t.severity && (
                        <span className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${SEVERITY_COLOR[t.severity]}`}>
                          {t.severity}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </DashboardWidget>
  );
}
