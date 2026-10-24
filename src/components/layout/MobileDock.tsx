import { useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { flatNav, LAUNCHER_PATH, type VisibleNav } from './navConfig';

const HOME_ICON = (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
  </svg>
);

/**
 * Phone / tablet navigation: a floating, icons-only dock under the page.
 * It scrolls sideways (no visible scrollbar) so every module the role can open
 * is reachable; the first button returns to the app launcher. It is not
 * rendered on the launcher itself.
 */
export default function MobileDock({ nav }: { nav: VisibleNav }) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const items = flatNav(nav);
  // Several items can share a prefix (/app/training, /app/training/manage/…): the longest match wins.
  const activeTo = items
    .filter((i) => pathname.startsWith(i.to))
    .sort((a, b) => b.to.length - a.to.length)[0]?.to;
  const activeRef = useRef<HTMLAnchorElement | null>(null);

  // Keep the current module in view when the dock first appears or the route changes.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [pathname]);

  return (
    <nav aria-label={t('common.nav.mobile.label')} className="lg:hidden shrink-0 px-3 pt-1 pb-2">
      <div
        className="scrollbar-hide flex gap-1.5 overflow-x-auto rounded-2xl border border-[#1E3A5F] bg-[#0F1E35]/95 p-1.5 shadow-[0_8px_20px_rgba(0,0,0,0.4)]"
        style={{
          scrollSnapType: 'x proximity',
          WebkitMaskImage: 'linear-gradient(90deg, transparent 0, #000 14px, #000 calc(100% - 30px), transparent 100%)',
          maskImage: 'linear-gradient(90deg, transparent 0, #000 14px, #000 calc(100% - 30px), transparent 100%)',
        }}
      >
        <NavLink
          to={LAUNCHER_PATH}
          aria-label={t('common.nav.mobile.home')}
          className="mr-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.07] text-[#D5E2F5]"
        >
          {HOME_ICON}
        </NavLink>
        {items.map((item) => {
          const active = item.to === activeTo;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              ref={active ? activeRef : undefined}
              aria-label={t(item.labelKey)}
              title={t(item.labelKey)}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl [&>svg]:!h-5 [&>svg]:!w-5 ${
                active
                  ? 'bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-[0_4px_12px_rgba(37,99,235,0.5)]'
                  : 'text-[#9FB3D1]'
              }`}
              style={{ scrollSnapAlign: 'center' }}
            >
              {item.icon}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
