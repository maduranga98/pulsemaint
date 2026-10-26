import { Link } from 'react-router-dom';
import { BellRing, type LucideIcon } from 'lucide-react';
import type { Todo } from '@/lib/platform/todos';

export interface LauncherTile {
  to: string;
  label: string;
  icon: LucideIcon;
  badge: number;
  badgeTitle?: string;
}

/** Phone home of the platform console: one big icon per tab, like the client app's launcher. */
export default function PlatformLauncher({ greeting, tiles, reminders }: { greeting: string; tiles: LauncherTile[]; reminders: Todo[] }) {
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-bold text-white!">{greeting}</h1>
      <p className="mb-5 mt-1 text-sm text-slate-400">What do you want to open?</p>
      <div className="grid grid-cols-4 gap-x-2 gap-y-5">
        {tiles.map(({ to, label, icon: Icon, badge, badgeTitle }) => (
          <Link key={to} to={to} className="group flex flex-col items-center gap-1.5 text-center" title={badgeTitle}>
            <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-[#1E3A5F] bg-[#0F1E35] text-[#9FB3D1] group-hover:bg-[#142849] group-hover:text-white">
              <Icon className="h-6 w-6" />
              {badge > 0 && (
                <span className="absolute -right-1.5 -top-1.5 min-w-[18px] rounded-full bg-red-500 px-1 text-center text-[10px] font-bold leading-[18px] text-white">
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </span>
            <span className="text-[11px] font-semibold leading-tight text-slate-300">{label}</span>
          </Link>
        ))}
      </div>

      {/* Reminders from the To-Do tab that are due today (or overdue). */}
      <section className="mt-8" aria-label="Today's reminders">
        <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-300!">
          <BellRing className="h-4 w-4" /> Today's reminders · {reminders.length}
        </p>
        {reminders.length === 0 ? (
          <p className="rounded-xl border border-[#1E3A5F] bg-[#0F1E35] p-4 text-center text-sm text-slate-400">Nothing due today.</p>
        ) : (
          <ul className="divide-y divide-[#1E3A5F] overflow-hidden rounded-xl border border-[#1E3A5F] bg-[#0F1E35]">
            {reminders.map((t) => (
              <li key={t.id}>
                <Link to="/platform/todos" className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-[#142849]">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-white">{t.title}</span>
                    {t.leadName && <span className="block truncate text-xs text-slate-400">{t.leadName}</span>}
                  </span>
                  <span className={`shrink-0 text-xs ${t.dueAt! < Date.now() ? 'text-red-300' : 'text-slate-400'}`}>
                    {new Date(t.dueAt!).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
