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
      {/* Spacing comes from gap/padding: the global `p { margin: 0 }` in style.css beats margin utilities on <p>. */}
      <div className="flex flex-col gap-2 pb-6">
        <h1 className="break-words text-xl font-bold leading-snug text-white! sm:text-2xl">{greeting}</h1>
        <p className="text-sm text-slate-400">What do you want to open?</p>
      </div>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {tiles.map(({ to, label, icon: Icon, badge, badgeTitle }) => (
          <Link
            key={to}
            to={to}
            title={badgeTitle}
            className="group relative flex min-h-[104px] flex-col items-center justify-start gap-2 rounded-2xl border border-[#1E3A5F] bg-[#0F1E35] px-1.5 pb-3 pt-4 text-center hover:bg-[#142849]"
          >
            {/* The count sits inside the card's corner, so it never runs over the greeting or a neighbour's label. */}
            {badge > 0 && (
              <span className="absolute right-2 top-2 min-w-[20px] rounded-full bg-red-500 px-1.5 text-center text-[11px] font-bold leading-5 text-white">
                {badge > 99 ? '99+' : badge}
              </span>
            )}
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#142849] text-[#9FB3D1] group-hover:text-white">
              <Icon className="h-6 w-6" />
            </span>
            <span className="text-xs font-semibold leading-tight text-slate-300 group-hover:text-white">{label}</span>
          </Link>
        ))}
      </div>

      {/* Reminders from the To-Do tab that are due today (or overdue). */}
      <section className="flex flex-col gap-3 pt-10" aria-label="Today's reminders">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-300!">
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
