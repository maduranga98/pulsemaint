import { useState, type ReactNode } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useAuthActions } from '../../hooks/useAuthActions';
import type { UserRole } from '../../types/auth';
import EndShiftButton from '../handover/EndShiftButton';
import ErrorBoundary from '../ErrorBoundary';

interface NavItem {
  label: string;
  to: string;
  roles: UserRole[];
  icon: ReactNode;
}

const iconClass = 'w-[18px] h-[18px] shrink-0';

const Icon = {
  dashboard: (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>
  ),
  machines: (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1A2 2 0 1 1 4.3 17l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1A2 2 0 1 1 7 4.3l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/></svg>
  ),
  alert: (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
  ),
  report: (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/></svg>
  ),
  wrench: (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a4.5 4.5 0 0 0 6 6L17 16v3l-2 2h-3l-2-2v-3l3.7-3.7a4.5 4.5 0 0 0-6-6L8 8l-2-2V3L4 1H1l2 2v3l2 2h3z"/></svg>
  ),
  box: (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
  ),
  graduation: (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6"/><path d="M2 10l10-5 10 5-10 5z"/><path d="M6 12v5a6 3 0 0 0 12 0v-5"/></svg>
  ),
  book: (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
  ),
  users: (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
  ),
  settings: (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1A2 2 0 1 1 4.3 17l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1Z"/></svg>
  ),
  menu: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
  ),
};

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', to: '/app/dashboard', icon: Icon.dashboard, roles: ['plant_manager', 'admin', 'supervisor', 'technician', 'store_keeper', 'hr_officer'] },
  { label: 'Machines', to: '/app/machines', icon: Icon.machines, roles: ['supervisor', 'plant_manager', 'admin', 'technician'] },
  { label: 'Breakdowns', to: '/app/breakdowns', icon: Icon.report, roles: ['floor_operator', 'technician', 'supervisor', 'plant_manager', 'admin'] },
  { label: 'Work Orders', to: '/app/work-orders', icon: Icon.wrench, roles: ['technician', 'supervisor', 'plant_manager', 'admin'] },
  { label: 'My Work Orders', to: '/app/my-work-orders', icon: Icon.wrench, roles: ['technician', 'admin'] },
  { label: 'Sign-Off Queue', to: '/app/sign-off-queue', icon: Icon.report, roles: ['supervisor', 'plant_manager', 'admin'] },
  {
    label: 'PM Schedules',
    to: '/app/pm-schedules',
    icon: (
      <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    ),
    roles: ['supervisor', 'plant_manager', 'admin', 'technician'],
  },
  {
    label: 'PM Calendar',
    to: '/app/pm-calendar',
    icon: (
      <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><circle cx="12" cy="15" r="1" fill="currentColor"/><circle cx="8" cy="15" r="1" fill="currentColor"/><circle cx="16" cy="15" r="1" fill="currentColor"/>
      </svg>
    ),
    roles: ['supervisor', 'plant_manager', 'admin'],
  },
  {
    label: 'Analytics',
    to: '/app/analytics',
    icon: (
      <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v18h18"/><path d="M7 14l4-4 4 4 5-5"/>
      </svg>
    ),
    roles: ['plant_manager', 'admin', 'supervisor'],
  },
  {
    label: 'PM Compliance',
    to: '/app/pm-compliance',
    icon: (
      <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
      </svg>
    ),
    roles: ['supervisor', 'plant_manager', 'admin'],
  },
  { label: 'Inventory / Parts', to: '/app/inventory', icon: Icon.box, roles: ['store_keeper', 'technician', 'supervisor', 'plant_manager', 'admin'] },
  { label: 'Contractors', to: '/app/contractors', icon: Icon.users, roles: ['supervisor', 'plant_manager', 'admin', 'hr_officer'] },
  { label: 'Reports', to: '/app/reports', icon: Icon.report, roles: ['supervisor', 'plant_manager', 'store_keeper', 'hr_officer', 'admin'] },
  {
    label: 'Handovers',
    to: '/app/shift/handover/history',
    icon: (
      <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 7h10"/><path d="M7 12h7"/><path d="M7 17h5"/><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M16 3v4h4"/>
      </svg>
    ),
    roles: ['supervisor', 'plant_manager', 'admin', 'hr_officer'],
  },
  { label: 'Training', to: '/app/training', icon: Icon.graduation, roles: ['hr_officer', 'supervisor', 'plant_manager', 'admin'] },
  { label: 'My Training', to: '/app/training/my-modules', icon: Icon.book, roles: ['trainee', 'floor_operator'] },
  {
    label: 'Triage',
    to: '/app/triage',
    icon: (
      <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    ),
    roles: ['floor_operator', 'technician', 'supervisor', 'plant_manager', 'admin', 'hr_officer', 'store_keeper'],
  },
  {
    label: 'Triage Builder',
    to: '/app/triage-builder',
    icon: (
      <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>
      </svg>
    ),
    roles: ['supervisor', 'plant_manager', 'admin'],
  },
  {
    label: 'OEE',
    to: '/app/oee',
    icon: (
      <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>
      </svg>
    ),
    roles: ['supervisor', 'plant_manager', 'admin'],
  },
  {
    label: 'Audit',
    to: '/app/audit',
    icon: (
      <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9"/><path d="M9 7h6"/>
      </svg>
    ),
    roles: ['supervisor', 'plant_manager', 'admin', 'technician'],
  },
  {
    label: 'Evaluations',
    to: '/app/evaluations',
    icon: (
      <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
        <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
        <line x1="9" y1="12" x2="15" y2="12"/>
        <line x1="9" y1="16" x2="13" y2="16"/>
      </svg>
    ),
    roles: ['supervisor', 'plant_manager', 'admin', 'hr_officer'],
  },
  { label: 'Users', to: '/app/settings/users', icon: Icon.users, roles: ['admin', 'supervisor'] },
  { label: 'Settings', to: '/app/settings', icon: Icon.settings, roles: ['admin'] },
];

function roleLabel(role?: UserRole) {
  if (!role) return '';
  return role
    .split('_')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

function initials(name?: string | null) {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'U';
}

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuthActions();
  const userProfile = useAuthStore((s) => s.userProfile);
  const company = useAuthStore((s) => s.company);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const role = userProfile?.role;
  const visibleItems = role ? NAV_ITEMS.filter((i) => i.roles.includes(role)) : [];

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="h-screen bg-[#0A1628] text-[#F0F4F8] flex overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-60 bg-[#0F1E35] border-r border-[#1E3A5F] flex flex-col transform transition-transform lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-14 flex items-center px-5 border-b border-[#1E3A5F] shrink-0">
          <img src="/logo.png" alt="PulseMaint" className="w-7 h-7 rounded-md mr-2 object-contain" />
          <span className="text-sm font-semibold tracking-tight text-[#F0F4F8] font-[Sora]">
            PulseMaint
          </span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {visibleItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/app/dashboard'}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] font-medium transition-colors ${
                  isActive
                    ? 'bg-[#1A56DB]/15 text-[#60A5FA] border-l-2 border-[#1A56DB] pl-[10px]'
                    : 'text-[#8BA3BF] hover:bg-[#142849] hover:text-[#F0F4F8]'
                }`
              }
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0 h-screen">
        <header className="h-14 shrink-0 bg-[#0F1E35] border-b border-[#1E3A5F] flex items-center justify-between px-4 lg:px-6 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen((v) => !v)}
              className="lg:hidden p-2 -ml-2 rounded-md hover:bg-[#142849] text-[#8BA3BF]"
              aria-label="Toggle navigation"
            >
              {Icon.menu}
            </button>
            <div className="text-[13px] text-[#8BA3BF] hidden sm:block truncate">
              {company?.name ?? ''}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {(role === 'supervisor' || role === 'admin') && <EndShiftButton />}
            <div className="text-right hidden sm:block leading-tight">
              <div className="text-[13px] font-medium text-[#F0F4F8] truncate max-w-[160px]">
                {userProfile?.fullName ?? 'User'}
              </div>
              <div className="text-[11px] text-[#8BA3BF]">{roleLabel(role)}</div>
            </div>
            <div className="w-8 h-8 rounded-full bg-[#1A56DB]/20 text-[#60A5FA] flex items-center justify-center text-[12px] font-semibold border border-[#1E3A5F]">
              {initials(userProfile?.fullName)}
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="px-3 py-1.5 text-[12px] font-medium text-[#D5DEEA] bg-[#142849] border border-[#1E3A5F] hover:bg-[#1E3A5F] hover:text-[#F0F4F8] rounded-md transition-colors"
            >
              Sign out
            </button>
          </div>
        </header>

        <main className="app-main-dark flex-1 min-w-0 bg-[#0A1628] overflow-y-auto">
          <div className="px-4 sm:px-6 lg:px-8 py-5 max-w-[1400px] mx-auto w-full">
            <ErrorBoundary key={location.pathname}>
              <Outlet />
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
}
