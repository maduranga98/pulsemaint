import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Building2, Check, ChevronDown } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useActivePlantStore } from '../../store/activePlantStore';
import { usePlants } from '../../hooks/usePlants';
import { useTranslation } from 'react-i18next';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { LAUNCHER_PATH } from './navConfig';

// Admin group (Settings, Billing, Feedback & Requests) and Help are about the
// company/account, not a plant, so the plant switcher is hidden there.
const PLANT_FREE_PREFIXES = ['/app/settings', '/app/billing', '/app/support-requests', '/app/help'];

/**
 * Admin-only plant switcher, a dropdown chip in the header (next to the
 * company name). Plant is the main scoping category across the app; every
 * other role is locked to their own registered plant, but admin manages all of
 * them, so they pick which one they're "viewing as" here — one plant is always
 * selected (there is no "All Plants" option), and the first active plant is
 * picked when none (or a no-longer-active one) is. Anything that reads
 * useDepartmentScope's plantId automatically follows this selection.
 */
export function PlantSwitcher() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const isPhone = useMediaQuery('(max-width: 1023px)');
  const userProfile = useAuthStore((s) => s.userProfile);
  const companyId = userProfile?.companyId ?? '';
  const { activePlants, loading } = usePlants(companyId);
  const activePlantId = useActivePlantStore((s) => s.activePlantId);
  const setActivePlant = useActivePlantStore((s) => s.setActivePlant);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Every page is about one plant: no "All Plants" option, and a plant is
  // selected for the admin if none (or a no-longer-active one) is.
  const isAdmin = userProfile?.role === 'admin';
  const needsPlant = isAdmin && !loading && activePlants.length > 0
    && !activePlants.some((p) => p.id === activePlantId);
  useEffect(() => {
    if (needsPlant) setActivePlant(activePlants[0].id);
  }, [needsPlant, activePlants, setActivePlant]);

  // Close on outside click / Escape, and whenever the page changes.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!isAdmin || loading || activePlants.length === 0) return null;
  // On phones the plant switcher lives on the launcher only; the choice carries into every module.
  if (isPhone && pathname !== LAUNCHER_PATH) return null;
  if (PLANT_FREE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;

  const current = activePlants.find((p) => p.id === activePlantId) ?? activePlants[0];
  const label = t('common.layout.plantTabs.label', 'Plant');

  return (
    <div ref={rootRef} data-tour="plant-tabs" className="relative flex items-center gap-3 min-w-0">
      <span aria-hidden="true" className="hidden h-5 w-px bg-[#1E3A5F] sm:block" />
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
        className="flex h-[34px] min-w-0 items-center gap-2 rounded-lg border border-[#2B4170] bg-[#12203D] px-3 text-[13px] font-semibold text-[#E6EEFB] transition-colors hover:bg-[#162850] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5B8DEF]"
      >
        <Building2 className="h-[15px] w-[15px] shrink-0 text-[#60A5FA]" aria-hidden="true" />
        <span className="truncate">{current.name}</span>
        <ChevronDown className={`h-3 w-3 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={label}
          className="absolute left-0 top-[42px] z-40 w-60 rounded-xl border border-[#1E3A5F] bg-[#0F1E35] p-1.5 shadow-2xl shadow-black/50 sm:left-[21px]"
        >
          <p className="px-2.5 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#6C87A6]">
            {t('common.layout.plantTabs.viewing', { defaultValue: 'Viewing plant' })}
          </p>
          {activePlants.map((p) => {
            const active = p.id === current.id;
            return (
              <button
                key={p.id}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  setActivePlant(p.id);
                  setOpen(false);
                }}
                className={`flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[13px] transition-colors ${
                  active ? 'bg-[#16264A] font-semibold text-white' : 'font-medium text-[#CBD5EA] hover:bg-[#142849]'
                }`}
              >
                <span className="h-2 w-2 shrink-0 rounded-full bg-[#10B981]" />
                <span className="flex-1 truncate">{p.name}</span>
                {active && <Check className="h-3.5 w-3.5 text-[#60A5FA]" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default PlantSwitcher;
