import { useMemo } from 'react';
import { Building2, AlertTriangle, Wrench, ShieldAlert } from 'lucide-react';
import { useAuthStore } from '../../../store/authStore';
import { useDepartmentScope } from '../../../hooks/useDepartmentScope';
import { usePlants } from '../../../hooks/usePlants';
import { useActiveBreakdowns } from '../../../hooks/dashboard/useActiveBreakdowns';
import { useOpenWorkOrders } from '../../../hooks/dashboard/useOpenWorkOrders';
import { useSafetyCases } from '../../../hooks/safety/useSafety';
import DashboardWidget from '../shared/DashboardWidget';

interface PlantStats {
  id: string | null;
  name: string;
  breakdowns: number;
  workOrders: number;
  safety: number;
}

/**
 * "Where is everything happening?" — one card per plant with its live open
 * breakdowns / work orders / safety cases, so the All Plants dashboard shows
 * which plant each number comes from. Clicking a card switches to that plant.
 * Hidden whenever a single plant is already selected.
 */
export default function PlantOverviewWidget({ siteId, companyId }: { siteId: string; companyId: string }) {
  const { plantId } = useDepartmentScope();
  const role = useAuthStore((s) => s.userProfile?.role);
  const { activePlants, loading: plantsLoading } = usePlants(companyId);
  const { breakdowns, loading: bdLoading } = useActiveBreakdowns(siteId);
  const { workOrders, loading: woLoading } = useOpenWorkOrders(siteId);
  const { cases, loading: scLoading } = useSafetyCases(companyId);

  const stats = useMemo<PlantStats[]>(() => {
    const rows = new Map<string | null, PlantStats>(
      activePlants.map((p) => [p.id, { id: p.id, name: p.name, breakdowns: 0, workOrders: 0, safety: 0 }]),
    );
    const bucket = (id?: string | null): PlantStats => {
      const key = id && rows.has(id) ? id : null;
      let row = rows.get(key);
      if (!row) {
        row = { id: null, name: 'Unassigned', breakdowns: 0, workOrders: 0, safety: 0 };
        rows.set(null, row);
      }
      return row;
    };
    breakdowns.forEach((b) => { bucket(b.machinePlantId).breakdowns += 1; });
    workOrders.forEach((w) => { bucket(w.machinePlantId).workOrders += 1; });
    cases.filter((c) => c.status !== 'closed').forEach((c) => { bucket(c.plantId).safety += 1; });
    return [...rows.values()];
  }, [activePlants, breakdowns, workOrders, cases]);

  // Only the company-wide view (admin on "All Plants") gets the breakdown.
  if (plantId || role !== 'admin' || (!plantsLoading && activePlants.length === 0)) return null;

  return (
    <DashboardWidget
      title="Plants overview"
      live
      loading={plantsLoading || bdLoading || woLoading || scLoading}
      action={<span className="text-xs text-[#8BA3BF]">{activePlants.length} plants · open items</span>}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {stats.map((s) => {
          const hot = s.breakdowns > 0;
          return (
            <div
              key={s.id ?? 'unassigned'}
              className={`rounded-xl border bg-[#0A1628] p-4 text-left ${hot ? 'border-[#EF4444]/40' : 'border-[#1E3A5F]'}`}
            >
              <div className="flex items-center gap-2.5">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${hot ? 'bg-[#EF4444]/15 text-[#EF4444]' : 'bg-[#1A56DB]/15 text-[#5B8DEF]'}`}>
                  <Building2 className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#F0F4F8]">{s.name}</p>
                  <p className="text-[11px] text-[#6C87A6]">{hot ? 'Needs attention' : 'Running normally'}</p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <Stat icon={<AlertTriangle className="h-3 w-3" />} label="Breakdowns" value={s.breakdowns} color={s.breakdowns ? '#EF4444' : '#6C87A6'} />
                <Stat icon={<Wrench className="h-3 w-3" />} label="Work orders" value={s.workOrders} color={s.workOrders ? '#5B8DEF' : '#6C87A6'} />
                <Stat icon={<ShieldAlert className="h-3 w-3" />} label="Safety" value={s.safety} color={s.safety ? '#F59E0B' : '#6C87A6'} />
              </div>
            </div>
          );
        })}
      </div>
    </DashboardWidget>
  );
}

function Stat({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg bg-[#0F1E35] px-1.5 py-2">
      <p className="text-lg font-bold leading-none" style={{ color }}>{value}</p>
      <p className="mt-1 flex items-center justify-center gap-1 text-[10px] text-[#8BA3BF]" >
        {icon}{label}
      </p>
    </div>
  );
}
