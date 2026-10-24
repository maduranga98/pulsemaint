import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { Building2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { db } from '../../../lib/firebase';
import { useAuthStore } from '../../../store/authStore';
import { useActivePlantStore } from '../../../store/activePlantStore';
import { usePlants } from '../../../hooks/usePlants';
import { useSafetyCases } from '../../../hooks/safety/useSafety';
import { isOpenBreakdownStatus, isWoWorkStarted } from '../../../lib/machineWorkState';
import DashboardWidget from '../shared/DashboardWidget';

interface PlantStats {
  id: string;
  name: string;
  breakdowns: number;
  workOrders: number;
  safety: number;
}

type Tone = 'red' | 'amber' | 'green';
const TONE_CLASS: Record<Tone, string> = {
  red: 'bg-[#3A1A1E] text-[#FCA5A5]',
  amber: 'bg-[#3A2F12] text-[#FDE68A]',
  green: 'bg-[#13301F] text-[#86EFAC]',
};

/**
 * One card per plant with its open breakdowns, started work orders and open
 * safety cases, so every number on the dashboard can be traced to a plant. The
 * plant being viewed (the header's plant dropdown) is highlighted. Admin only —
 * the one role that sees every plant — and indication only: switching plant is
 * done from the dropdown. The counts come from company-wide reads of their own
 * so they stay correct for the plants that are not selected.
 */
export default function PlantOverviewWidget({ companyId }: { siteId?: string; companyId: string }) {
  const { t } = useTranslation();
  const role = useAuthStore((s) => s.userProfile?.role);
  const activePlantId = useActivePlantStore((s) => s.activePlantId);
  const { activePlants, loading: plantsLoading } = usePlants(companyId);
  const { cases, loading: scLoading } = useSafetyCases(companyId);
  const isAdmin = role === 'admin';

  const [breakdownByPlant, setBreakdownByPlant] = useState<Record<string, number>>({});
  const [woByPlant, setWoByPlant] = useState<Record<string, number>>({});
  const [bdLoading, setBdLoading] = useState(true);
  const [woLoading, setWoLoading] = useState(true);

  useEffect(() => {
    if (!isAdmin || !companyId) return;
    const count = (docs: { data: () => Record<string, unknown> }[], keep: (status: unknown) => boolean) => {
      const out: Record<string, number> = {};
      docs.forEach((d) => {
        const data = d.data();
        if (!keep(data.status)) return;
        const key = String(data.machinePlantId ?? '');
        out[key] = (out[key] ?? 0) + 1;
      });
      return out;
    };
    const unsubBd = onSnapshot(
      query(collection(db, 'breakdown_tickets'), where('companyId', '==', companyId)),
      (snap) => {
        setBreakdownByPlant(count(snap.docs, isOpenBreakdownStatus));
        setBdLoading(false);
      },
      () => setBdLoading(false),
    );
    const unsubWo = onSnapshot(
      query(collection(db, 'workOrders'), where('companyId', '==', companyId)),
      (snap) => {
        setWoByPlant(count(snap.docs, isWoWorkStarted));
        setWoLoading(false);
      },
      () => setWoLoading(false),
    );
    return () => {
      unsubBd();
      unsubWo();
    };
  }, [isAdmin, companyId]);

  const stats = useMemo<PlantStats[]>(
    () =>
      activePlants.map((p) => ({
        id: p.id,
        name: p.name,
        breakdowns: breakdownByPlant[p.id] ?? 0,
        workOrders: woByPlant[p.id] ?? 0,
        safety: cases.filter((c) => c.status !== 'closed' && c.plantId === p.id).length,
      })),
    [activePlants, breakdownByPlant, woByPlant, cases],
  );

  if (!isAdmin || (!plantsLoading && activePlants.length === 0)) return null;

  return (
    <DashboardWidget
      title={t('common.dashboard.plantsOverview.title', { defaultValue: 'Plants overview' })}
      loading={plantsLoading || bdLoading || woLoading || scLoading}
      action={
        <span className="text-xs text-[#8BA3BF]">
          {t('common.dashboard.plantsOverview.hint', { defaultValue: 'Alerts per plant' })}
        </span>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {stats.map((s) => {
          const alerts = s.breakdowns + s.workOrders + s.safety;
          const tone: Tone = s.breakdowns > 0 ? 'red' : alerts > 0 ? 'amber' : 'green';
          const parts = [
            s.breakdowns > 0 && t('common.dashboard.plantsOverview.breakdowns', { count: s.breakdowns, defaultValue_one: '{{count}} breakdown', defaultValue_other: '{{count}} breakdowns' }),
            s.workOrders > 0 && t('common.dashboard.plantsOverview.workOrders', { count: s.workOrders, defaultValue_one: '{{count}} work order', defaultValue_other: '{{count}} work orders' }),
            s.safety > 0 && t('common.dashboard.plantsOverview.safety', { count: s.safety, defaultValue_one: '{{count}} safety case', defaultValue_other: '{{count}} safety cases' }),
          ].filter(Boolean) as string[];
          const selected = s.id === activePlantId;
          return (
            <div
              key={s.id}
              aria-current={selected ? 'true' : undefined}
              className={`flex flex-col gap-1.5 rounded-xl border px-3.5 py-3 text-left ${
                selected ? 'border-[#3B82F6] bg-[#12203D]' : 'border-[#1E3A5F] bg-transparent'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2">
                  <Building2 className={`h-4 w-4 shrink-0 ${selected ? 'text-[#60A5FA]' : 'text-[#6C87A6]'}`} aria-hidden="true" />
                  <span className="truncate text-[13px] font-semibold text-[#F0F4F8]">{s.name}</span>
                </span>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${TONE_CLASS[tone]}`}>
                  {alerts === 0
                    ? t('common.dashboard.plantsOverview.allClear', { defaultValue: 'All clear' })
                    : t('common.dashboard.plantsOverview.alerts', { count: alerts, defaultValue_one: '{{count}} alert', defaultValue_other: '{{count}} alerts' })}
                </span>
              </div>
              <p className="text-[11.5px] text-[#8BA3BF]">
                {parts.length > 0
                  ? parts.join(' · ')
                  : t('common.dashboard.plantsOverview.nothing', { defaultValue: 'Nothing waiting' })}
              </p>
            </div>
          );
        })}
      </div>
    </DashboardWidget>
  );
}
