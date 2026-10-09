import { useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import { Building2, ClipboardList, CreditCard, Gauge, LogOut, ArrowLeft, BellRing, Menu, X, Contact, PhoneCall, Users, Lightbulb, ListTodo } from 'lucide-react';
import { useSuperadmin } from '@/lib/platform/useSuperadmin';
import { usePlatformUnread } from '@/lib/platform/usePlatformUnread';
import { usePaymentAlerts } from '@/lib/platform/usePaymentAlerts';
import { useCallsDue } from '@/lib/platform/useCallsDue';
import { usePendingRegistrations } from '@/lib/platform/usePendingRegistrations';
import { getNotificationPermission, isDeviceNotificationSupported, requestDeviceNotificationPermission } from '@/lib/notifications/deviceNotify';
import { logout } from '@/lib/auth';
import { useAuthStore } from '@/store/authStore';
import AuthLoading from '@/components/auth/AuthLoading';
import SuperadminActivatePage from './SuperadminActivatePage';
import PlatformBell from './PlatformBell';

const NAV = [
  { to: '/platform', label: 'Overview', icon: Gauge, end: true },
  { to: '/platform/companies', label: 'Companies', icon: Building2 },
  { to: '/platform/payments', label: 'Payments', icon: CreditCard },
  { to: '/platform/requests', label: 'Requests & feedback', icon: ClipboardList },
  { section: 'Sales' },
  { to: '/platform/leads', label: 'Leads', icon: Contact },
  { to: '/platform/calls', label: 'Calls', icon: PhoneCall },
  { to: '/platform/sales-team', label: 'Sales team', icon: Users },
  { to: '/platform/feature-requests', label: 'Feature requests', icon: Lightbulb },
  { to: '/platform/todos', label: 'To-Do', icon: ListTodo },
] as const;

/**
 * Lumora Ventures platform console. Separate from the tenant app shell: it
 * is not tied to one company, and company suspension never applies here.
 * Signed-in accounts without the superadmin claim see the activation page.
 */
export default function PlatformLayout() {
  const { ready, signedIn, isSuperadmin, email } = useSuperadmin();
  const hasCompany = useAuthStore((s) => !!s.userProfile);
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const unread = usePlatformUnread(ready && isSuperadmin);
  const paymentAlerts = usePaymentAlerts(ready && isSuperadmin);
  const callsDue = useCallsDue(ready && isSuperadmin);
  const pendingRegistrations = usePendingRegistrations(ready && isSuperadmin);
  const [permission, setPermission] = useState(() => getNotificationPermission());

  if (!ready) return <AuthLoading />;
  if (!signedIn) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!isSuperadmin) return <SuperadminActivatePage />;

  return (
    <div className="scrollbar-dark min-h-screen bg-[#0A1628] text-slate-200 lg:flex">
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 transform border-r border-[#1E3A5F] bg-[#0F1E35] transition-transform lg:static lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center gap-3 border-b border-[#1E3A5F] px-5 py-4">
          <img src="/brand/lumora-logo.svg" alt="" className="h-9 w-9 rounded-full bg-white p-0.5" />
          <div>
            <p className="text-sm font-bold text-white">Lumora Ventures</p>
            <p className="text-[11px] uppercase tracking-wider text-blue-300">FirmiCore platform</p>
          </div>
          <button className="ml-auto lg:hidden text-slate-400" onClick={() => setOpen(false)} aria-label="Close menu"><X className="h-5 w-5" /></button>
        </div>
        <nav className="max-h-[calc(100vh-190px)] space-y-1 overflow-y-auto p-3">
          {NAV.map((item) => {
            if ('section' in item) return <p key={item.section} className="px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{item.section}</p>;
            const { to, label, icon: Icon } = item;
            const end = 'end' in item ? item.end : false;
            return (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium ${isActive ? 'bg-blue-600/20 text-blue-300' : 'text-slate-300 hover:bg-[#142849] hover:text-white'}`
              }
            >
              <Icon className="h-4 w-4" />
              {label}
              {to === '/platform/payments' && paymentAlerts.length > 0 && (
                <span className="ml-auto rounded-full bg-emerald-500 px-1.5 text-[10px] font-bold leading-4 text-black">{paymentAlerts.length}</span>
              )}
              {to === '/platform/requests' && unread.length > 0 && (
                <span className="ml-auto rounded-full bg-amber-500 px-1.5 text-[10px] font-bold leading-4 text-black">{unread.length}</span>
              )}
              {to === '/platform/companies' && pendingRegistrations.length > 0 && (
                <span className="ml-auto rounded-full bg-amber-500 px-1.5 text-[10px] font-bold leading-4 text-black" title="Registrations waiting for approval">{pendingRegistrations.length}</span>
              )}
              {to === '/platform/calls' && callsDue > 0 && (
                <span className="ml-auto rounded-full bg-red-500 px-1.5 text-[10px] font-bold leading-4 text-white" title="Calls due today or overdue">{callsDue}</span>
              )}
            </NavLink>
            );
          })}
        </nav>
        <div className="absolute inset-x-0 bottom-0 space-y-1 border-t border-[#1E3A5F] p-3">
          {isDeviceNotificationSupported() && permission === 'default' && (
            <button
              onClick={() => void requestDeviceNotificationPermission().then(setPermission)}
              className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-amber-300 hover:bg-[#142849]"
            >
              <BellRing className="h-4 w-4" /> Enable desktop notifications
            </button>
          )}
          <p className="truncate px-3 pb-1 text-xs text-slate-500">{email}</p>
          {hasCompany && (
            <Link to="/app/dashboard" className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-[#142849]">
              <ArrowLeft className="h-4 w-4" /> Back to FirmiCore
            </Link>
          )}
          <button onClick={() => void logout()} className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-[#142849]">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>
      {open && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setOpen(false)} />}
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-8">
        <div className="mb-4 flex items-center justify-between gap-3">
          <button className="inline-flex items-center gap-2 text-sm text-slate-300 lg:invisible" onClick={() => setOpen(true)}>
            <Menu className="h-5 w-5" /> Menu
          </button>
          <PlatformBell paymentAlerts={paymentAlerts} requests={unread} />
        </div>
        <Outlet context={{ paymentAlerts }} />
      </main>
    </div>
  );
}
