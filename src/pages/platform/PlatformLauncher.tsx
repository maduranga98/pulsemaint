import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';

export interface LauncherTile {
  to: string;
  label: string;
  icon: LucideIcon;
  badge: number;
  badgeTitle?: string;
}

/** Phone home of the platform console: one big icon per tab, like the client app's launcher. */
export default function PlatformLauncher({ greeting, tiles }: { greeting: string; tiles: LauncherTile[] }) {
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
    </div>
  );
}
