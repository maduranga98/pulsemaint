import { useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { getDashboardRoute } from '../../lib/auth';
import { flatNav, visibleNav } from '../../components/layout/navConfig';
import { useMyNotifications } from '../../hooks/useMyNotifications';
import { useDerivedAlerts } from '../../hooks/useDerivedAlerts';
import { badgeLabel, launcherBadgeCounts } from '../../lib/launcherBadges';

/**
 * Phone / tablet home: a grid of every module the signed-in role can open.
 * The bottom dock is hidden here — it appears once a module is opened.
 */
export default function MobileHomePage() {
  const { t } = useTranslation();
  const userProfile = useAuthStore((s) => s.userProfile);
  const company = useAuthStore((s) => s.company);
  const isPhone = useMediaQuery('(max-width: 1023px)');
  const [search, setSearch] = useState('');

  const role = userProfile?.role;
  const items = useMemo(() => flatNav(visibleNav(role, company)), [role, company]);
  // Red tags: unread notifications + "needs attention" alerts (what the bell lists), per module.
  // PM alerts only count when due today or overdue, not the 7-day look-ahead.
  const { notifications } = useMyNotifications();
  const derivedAlerts = useDerivedAlerts();
  const badges = useMemo(
    () =>
      launcherBadgeCounts(
        [...notifications, ...derivedAlerts.filter((a) => a.type !== 'pm' || (a.dueInDays ?? 0) <= 0)],
        items.map((i) => i.to),
      ),
    [notifications, derivedAlerts, items],
  );
  const needle = search.trim().toLowerCase();
  const shown = needle ? items.filter((i) => t(i.labelKey).toLowerCase().includes(needle)) : items;

  // The launcher only exists on small screens; desktop keeps the sidebar.
  if (!isPhone) return <Navigate to={role ? getDashboardRoute(role) : '/app/dashboard'} replace />;

  const firstName = userProfile?.fullName?.trim().split(/\s+/)[0] ?? '';

  return (
    <div className="space-y-5 pb-20">
      <div>
        <h1 className="text-2xl font-bold text-[#F0F4F8]">
          {firstName ? t('common.nav.mobile.hello', { name: firstName }) : t('common.nav.mobile.helloAnon')}
        </h1>
        <p className="mt-1 text-base text-[#A7B6D3]">{t('common.nav.mobile.prompt')}</p>
      </div>

      <label className="relative block" data-tour="launcher-search">
        <span className="sr-only">{t('common.nav.mobile.search')}</span>
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#A7B6D3]" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('common.nav.mobile.search')}
          className="h-12 w-full rounded-2xl border border-[#1F2F4A] bg-[#0E1628] pl-12 pr-4 text-base text-[#E2E8F0] placeholder:text-[#7F93B5] focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </label>

      <nav
        aria-label={t('common.nav.mobile.apps')}
        data-tour="launcher-apps"
        className="grid grid-cols-4 gap-x-1.5 gap-y-[18px]"
      >
        {shown.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="flex flex-col items-center gap-[7px] text-[#D5E2F5] no-underline"
          >
            {/* Same plain icon style as the bottom dock — no per-app colours. */}
            <span className="relative flex h-[52px] w-[52px] items-center justify-center rounded-2xl border border-[#1E3A5F] bg-[#0F1E35] text-[#9FB3D1] [&>svg]:!h-6 [&>svg]:!w-6">
              {item.icon}
              {badges[item.to] > 0 && (
                <span
                  className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-[#0A1628]"
                  aria-label={t('common.nav.mobile.needsAttention', { count: badges[item.to] })}
                >
                  {badgeLabel(badges[item.to])}
                </span>
              )}
            </span>
            <span className="text-center text-xs font-medium leading-tight">{t(item.labelKey)}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
