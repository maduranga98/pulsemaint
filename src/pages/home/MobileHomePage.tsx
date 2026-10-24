import { useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { getDashboardRoute } from '../../lib/auth';
import { flatNav, visibleNav } from '../../components/layout/navConfig';

// Tile colours cycle through this palette so neighbouring apps look different.
const TILE_GRADIENTS = [
  'from-sky-400 to-blue-600',
  'from-amber-400 to-orange-600',
  'from-violet-400 to-purple-600',
  'from-teal-400 to-teal-700',
  'from-rose-400 to-red-600',
  'from-emerald-400 to-emerald-700',
  'from-indigo-400 to-indigo-700',
  'from-pink-400 to-pink-700',
  'from-cyan-400 to-cyan-700',
  'from-lime-400 to-lime-700',
];

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
  const needle = search.trim().toLowerCase();
  const shown = needle ? items.filter((i) => t(i.labelKey).toLowerCase().includes(needle)) : items;

  // The launcher only exists on small screens; desktop keeps the sidebar.
  if (!isPhone) return <Navigate to={role ? getDashboardRoute(role) : '/app/dashboard'} replace />;

  const firstName = userProfile?.fullName?.trim().split(/\s+/)[0] ?? '';

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-[#F0F4F8]">
          {firstName ? t('common.nav.mobile.hello', { name: firstName }) : t('common.nav.mobile.helloAnon')}
        </h1>
        <p className="mt-1 text-base text-[#A7B6D3]">{t('common.nav.mobile.prompt')}</p>
      </div>

      <label className="relative block">
        <span className="sr-only">{t('common.nav.mobile.search')}</span>
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#A7B6D3]" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('common.nav.mobile.search')}
          className="h-[54px] w-full rounded-2xl border border-[#1F2F4A] bg-[#0E1628] pl-12 pr-4 text-base text-[#E2E8F0] placeholder:text-[#7F93B5] focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </label>

      <nav aria-label={t('common.nav.mobile.apps')} className="grid grid-cols-4 gap-x-2 gap-y-5 pb-6">
        {shown.map((item, i) => (
          <Link
            key={item.to}
            to={item.to}
            className="flex flex-col items-center gap-2 text-[#E2E8F0] no-underline"
          >
            <span
              className={`flex h-[68px] w-[68px] items-center justify-center rounded-[20px] bg-gradient-to-br text-white shadow-[0_8px_18px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.28)] [&>svg]:!h-[30px] [&>svg]:!w-[30px] ${
                TILE_GRADIENTS[i % TILE_GRADIENTS.length]
              }`}
            >
              {item.icon}
            </span>
            <span className="text-center text-[13px] font-medium leading-tight">{t(item.labelKey)}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
