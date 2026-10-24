import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { LayoutGrid } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useActivePlantStore } from '../../store/activePlantStore';
import { usePlants } from '../../hooks/usePlants';
import { useTranslation } from 'react-i18next';

// Admin group (Settings, Billing, Feedback & Requests) and Help are about the
// company/account, not a plant, so the plant switcher is hidden there.
const PLANT_FREE_PREFIXES = ['/app/settings', '/app/billing', '/app/support-requests', '/app/help'];

/**
 * Admin-only plant switcher. Plant is the main scoping category across the
 * app; every other role is locked to their own registered plant, but admin
 * manages all of them, so they pick which one they're "viewing as" here —
 * "All Plants" (the default) leaves every module unscoped/company-wide,
 * same as before this existed. Anything that reads useDepartmentScope's
 * plantId (Machines' department picker today, more modules as they land
 * plant scoping) automatically follows this selection.
 */
export function PlantTabs() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const userProfile = useAuthStore((s) => s.userProfile);
  const companyId = userProfile?.companyId ?? '';
  const { activePlants, loading } = usePlants(companyId);
  const activePlantId = useActivePlantStore((s) => s.activePlantId);
  const setActivePlant = useActivePlantStore((s) => s.setActivePlant);

  // The dashboard is always about one plant: no "All Plants" there, and a
  // plant is selected for the admin if none (or a no-longer-active one) is.
  const onDashboard = pathname === '/app/dashboard' || pathname.startsWith('/app/dashboard/');
  const isAdmin = userProfile?.role === 'admin';
  const needsPlant = onDashboard && isAdmin && !loading && activePlants.length > 0
    && !activePlants.some((p) => p.id === activePlantId);
  useEffect(() => {
    if (needsPlant) setActivePlant(activePlants[0].id);
  }, [needsPlant, activePlants, setActivePlant]);

  if (!isAdmin || loading || activePlants.length === 0) return null;
  if (PLANT_FREE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;

  const options: { id: string | null; label: string }[] = [
    ...(onDashboard ? [] : [{ id: null, label: t('common.layout.plantTabs.allPlants', 'All Plants') }]),
    ...activePlants.map((p) => ({ id: p.id, label: p.name })),
  ];

  return (
    <div data-tour="plant-tabs" className="shrink-0 border-b border-[#1E3A5F] bg-[#0B172A] px-4 py-2.5 lg:px-6">
      <div className="flex items-center gap-3">
        <div
          role="tablist"
          aria-label={t('common.layout.plantTabs.label', 'Plant')}
          className="scrollbar-hide flex min-w-0 items-center gap-1 overflow-x-auto rounded-xl border border-[#1E3A5F] bg-[#0F1E35] p-1"
        >
          {options.map((o) => {
            const active = activePlantId === o.id;
            return (
              <button
                key={o.id ?? 'all'}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActivePlant(o.id)}
                className={`flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 text-[12.5px] font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5B8DEF] ${
                  active
                    ? 'bg-gradient-to-b from-[#2563EB] to-[#1A56DB] text-white shadow-md shadow-[#1A56DB]/30'
                    : 'text-[#8BA3BF] hover:bg-[#142849] hover:text-[#F0F4F8]'
                }`}
              >
                {o.id === null ? (
                  <LayoutGrid className="h-3.5 w-3.5" />
                ) : (
                  <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-white' : 'bg-[#10B981]'}`} />
                )}
                {o.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default PlantTabs;
