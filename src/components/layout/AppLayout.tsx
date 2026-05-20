import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useAuthActions } from '../../hooks/useAuthActions';
import type { UserRole } from '../../types/auth';

interface NavItem {
  label: string;
  to: string;
  roles: UserRole[];
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', to: '/app/dashboard', icon: '📊', roles: ['plant_manager', 'admin'] },
  { label: 'Machines', to: '/app/machines', icon: '⚙️', roles: ['supervisor', 'plant_manager', 'admin', 'technician'] },
  { label: 'Breakdowns', to: '/app/breakdowns', icon: '🚨', roles: ['supervisor', 'plant_manager', 'admin'] },
  { label: 'Report Breakdown', to: '/app/breakdowns/report', icon: '📝', roles: ['floor_operator', 'technician', 'supervisor', 'plant_manager', 'admin'] },
  { label: 'Work Orders', to: '/app/work-orders', icon: '🧰', roles: ['technician', 'supervisor', 'plant_manager', 'admin'] },
  { label: 'Inventory', to: '/app/inventory', icon: '📦', roles: ['store_keeper', 'supervisor', 'plant_manager', 'admin'] },
  { label: 'Training', to: '/app/training', icon: '🎓', roles: ['hr_officer', 'supervisor', 'plant_manager', 'admin'] },
  { label: 'My Training', to: '/app/training/my-modules', icon: '📚', roles: ['trainee', 'floor_operator'] },
  { label: 'Users', to: '/app/settings/users', icon: '👥', roles: ['admin', 'supervisor'] },
  { label: 'Settings', to: '/app/settings', icon: '⚡', roles: ['admin'] },
];

export default function AppLayout() {
  const navigate = useNavigate();
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
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 text-slate-100 transform transition-transform lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-16 flex items-center px-6 border-b border-slate-800">
          <span className="text-lg font-semibold">PulseMaint</span>
        </div>
        <nav className="px-3 py-4 space-y-1 overflow-y-auto">
          {visibleItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/app/dashboard'}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <span aria-hidden>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-6 sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen((v) => !v)}
              className="lg:hidden p-2 rounded-md hover:bg-gray-100"
              aria-label="Toggle navigation"
            >
              ☰
            </button>
            <div className="text-sm text-gray-600 hidden sm:block">
              {company?.name ?? 'PulseMaint'}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-medium text-gray-900">{userProfile?.fullName ?? 'User'}</div>
              <div className="text-xs text-gray-500 capitalize">{role?.replace('_', ' ')}</div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
            >
              Sign out
            </button>
          </div>
        </header>

        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
