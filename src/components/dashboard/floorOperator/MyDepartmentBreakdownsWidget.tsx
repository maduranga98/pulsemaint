import { useEffect, useState } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';
import { db } from '../../../lib/firebase';
import DashboardWidget from '../shared/DashboardWidget';
import EmptyState from '../shared/EmptyState';
import type { Breakdown, BreakdownStatus } from '../../../types/breakdown';
import { useRecordPlantMatcher } from '../../../hooks/useRecordPlantMatcher';
import { plantConstraints } from '../../../lib/plantQuery';
import { useAuthStore } from '../../../store/authStore';

interface MyDepartmentBreakdownsWidgetProps {
  siteId: string;
}

type Indication = 'waiting' | 'fixing';

// Floor operators only need to know *that* a machine is down and whether
// someone is on it — not ticket numbers, assignees or actions. Every open
// breakdown therefore collapses to one of two indications.
const WAITING: ReadonlySet<BreakdownStatus> = new Set(['reported', 'acknowledged', 'triage_in_progress']);
const OPEN: ReadonlySet<BreakdownStatus> = new Set([
  'reported', 'acknowledged', 'triage_in_progress', 'assigned', 'en_route',
  'repair_in_progress', 'on_hold_parts', 'on_hold_approval',
]);
const indicationOf = (b: Breakdown): Indication => (WAITING.has(b.status) ? 'waiting' : 'fixing');

const INDICATION_STYLE: Record<Indication, { dot: string; chip: string }> = {
  waiting: { dot: 'bg-red-500', chip: 'bg-red-500/15 text-red-300' },
  fixing: { dot: 'bg-amber-400', chip: 'bg-amber-500/15 text-amber-300' },
};

// A read-only indicator of the breakdowns currently open in the floor
// operator's own department. They report breakdowns (ReportBreakdownWidget) but
// have no assign/attend/close permissions on breakdown_tickets (see
// firestore.rules), so this shows status lights only: no ticket numbers, no
// links, no actions.
export default function MyDepartmentBreakdownsWidget({ siteId }: MyDepartmentBreakdownsWidgetProps) {
  const { t } = useTranslation();
  // Falls back to the machine's plant for records predating plant stamping.
  const inScopedPlant = useRecordPlantMatcher();
  const [breakdowns, setBreakdowns] = useState<Breakdown[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // The query is built from the signed-in profile's plant and department, so
  // it must be rebuilt when those arrive or change (a new user's profile can
  // complete after the dashboard first renders).
  const plantId = useAuthStore((s) => s.userProfile?.plantId ?? null);
  const department = useAuthStore((s) => s.userProfile?.department ?? null);

  useEffect(() => {
    if (!siteId) {
      setLoading(false);
      return;
    }
    setError(null);
    const q = query(
      collection(db, 'breakdown_tickets'),
      where('siteId', '==', siteId),
      ...plantConstraints('breakdown_tickets'),
      orderBy('reportedAt', 'desc'),
      limit(50),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setBreakdowns(snap.docs.map((d) => ({ ...d.data(), id: d.id }) as Breakdown));
        setLoading(false);
      },
      (err) => {
        // Show why nothing is listed instead of an empty "all clear".
        setError(err.message);
        setLoading(false);
      },
    );
    return () => unsub();
  }, [siteId, plantId, department]);

  const open = breakdowns.filter((b) => inScopedPlant(b) && OPEN.has(b.status));
  // One light per machine, showing its most urgent state.
  const byMachine = new Map<string, { name: string; indication: Indication }>();
  for (const b of open) {
    const key = b.machineId || b.id;
    const next = indicationOf(b);
    const prev = byMachine.get(key);
    if (!prev || (prev.indication === 'fixing' && next === 'waiting')) {
      byMachine.set(key, { name: b.machineName || '—', indication: next });
    }
  }
  const machines = [...byMachine.values()].sort((a, b) => (a.indication === b.indication ? a.name.localeCompare(b.name) : a.indication === 'waiting' ? -1 : 1));
  const waiting = machines.filter((m) => m.indication === 'waiting').length;
  const fixing = machines.length - waiting;

  return (
    <DashboardWidget title={t('common.breakdowns.floorOperatorWidgets.myDepartmentTitle')} loading={loading} error={error} live>
      {machines.length === 0 ? (
        <EmptyState message={t('common.breakdowns.floorOperatorWidgets.noOpenBreakdowns')} />
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 text-xs">
            {waiting > 0 && (
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium ${INDICATION_STYLE.waiting.chip}`}>
                <span className={`h-2 w-2 rounded-full ${INDICATION_STYLE.waiting.dot}`} />
                {t('common.breakdowns.floorOperatorWidgets.waitingCount', { count: waiting, defaultValue: '{{count}} waiting for a technician' })}
              </span>
            )}
            {fixing > 0 && (
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium ${INDICATION_STYLE.fixing.chip}`}>
                <span className={`h-2 w-2 rounded-full ${INDICATION_STYLE.fixing.dot}`} />
                {t('common.breakdowns.floorOperatorWidgets.fixingCount', { count: fixing, defaultValue: '{{count}} being fixed' })}
              </span>
            )}
          </div>
          <ul className="divide-y divide-[#1E3A5F]">
            {machines.slice(0, 12).map((m) => (
              <li key={m.name} className="flex items-center gap-2.5 py-2">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${INDICATION_STYLE[m.indication].dot}`} />
                <span className="truncate text-sm text-[#F0F4F8]">{m.name}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </DashboardWidget>
  );
}
