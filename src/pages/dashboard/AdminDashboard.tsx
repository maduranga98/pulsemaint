import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  Wrench,
  Package,
  Users,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useActiveBreakdowns } from '../../hooks/dashboard/useActiveBreakdowns';
import { useOpenWorkOrders } from '../../hooks/dashboard/useOpenWorkOrders';
import { useInventoryStats } from '../../hooks/inventory/useInventoryStats';
import { useCompanyUsers } from '../../hooks/useCompanyUsers';

export default function AdminDashboard() {
  const userProfile = useAuthStore((s) => s.userProfile);
  const companyId = userProfile?.companyId ?? '';
  const siteId = userProfile ? userProfile.siteIds[0] || companyId : '';
  const firstName = userProfile?.fullName?.split(' ')[0] ?? 'Admin';

  const { count: activeBreakdowns } = useActiveBreakdowns(siteId);
  const { count: openWos } = useOpenWorkOrders(siteId);
  const { stats } = useInventoryStats();
  const { users } = useCompanyUsers(companyId);

  const activeUsers = users.length;

  const health: {
    label: string;
    value: number;
    icon: React.ReactNode;
    tone: 'ok' | 'warn' | 'bad';
    to: string;
  }[] = [
    {
      label: 'Active Breakdowns',
      value: activeBreakdowns,
      icon: <AlertTriangle className="w-4 h-4" />,
      tone: activeBreakdowns > 5 ? 'bad' : activeBreakdowns > 0 ? 'warn' : 'ok',
      to: '/app/breakdowns',
    },
    {
      label: 'Open Work Orders',
      value: openWos,
      icon: <Wrench className="w-4 h-4" />,
      tone: openWos > 20 ? 'warn' : 'ok',
      to: '/app/work-orders',
    },
    {
      label: 'Out of Stock',
      value: stats.outOfStockCount,
      icon: <Package className="w-4 h-4" />,
      tone: stats.outOfStockCount > 0 ? 'bad' : 'ok',
      to: '/app/inventory',
    },
    {
      label: 'Low Stock',
      value: stats.lowStockCount,
      icon: <Package className="w-4 h-4" />,
      tone: stats.lowStockCount > 0 ? 'warn' : 'ok',
      to: '/app/inventory',
    },
    {
      label: 'Pending Parts Requests',
      value: stats.pendingRequestsCount,
      icon: <Package className="w-4 h-4" />,
      tone: stats.pendingRequestsCount > 0 ? 'warn' : 'ok',
      to: '/app/inventory/requests',
    },
    {
      label: 'Active Users',
      value: activeUsers,
      icon: <Users className="w-4 h-4" />,
      tone: 'ok',
      to: '/app/settings/users',
    },
  ];

  const toneClass = {
    ok: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    warn: 'border-amber-200 bg-amber-50 text-amber-700',
    bad: 'border-red-200 bg-red-50 text-red-700',
  };

  const quickLinks = [
    { label: 'Users & Roles', to: '/app/settings/users', icon: <Users className="w-4 h-4" /> },
    { label: 'Company Settings', to: '/app/settings', icon: <ShieldCheck className="w-4 h-4" /> },
    { label: 'Full Analytics', to: '/app/analytics', icon: <Activity className="w-4 h-4" /> },
    { label: 'Manager View', to: '/app/dashboard/manager', icon: <Activity className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-full">
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Activity className="w-6 h-6 text-blue-600" /> System Health
        </h1>
        <p className="text-sm text-slate-500">Good {getGreeting()}, {firstName}</p>
      </div>

      <div className="px-6 py-5 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {health.map((h) => (
            <Link
              key={h.label}
              to={h.to}
              className={`rounded-xl border p-4 hover:shadow-sm transition ${toneClass[h.tone]}`}
            >
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide opacity-80">
                {h.icon}
                {h.label}
              </div>
              <p className="mt-2 text-3xl font-bold">{h.value}</p>
            </Link>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-900 mb-3">Administration</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {quickLinks.map((q) => (
              <Link
                key={q.to}
                to={q.to}
                className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <span className="flex items-center gap-2">
                  {q.icon}
                  {q.label}
                </span>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
}
