import { Link } from 'react-router-dom';
import type { WatchFlag } from '@/types/handover.types';
import WatchFlagBadge from './WatchFlagBadge';

interface WatchFlagCardProps {
  flag: WatchFlag;
  onResolve?: (flagId: string) => void;
}

const BORDER = {
  critical_watch: 'border-l-red-500',
  monitor: 'border-l-amber-500',
  info_only: 'border-l-cyan-500',
};

export function WatchFlagCard({ flag, onResolve }: WatchFlagCardProps) {
  return (
    <article className={`rounded-lg border border-l-4 border-slate-200 bg-white p-4 shadow-sm ${BORDER[flag.watchLevel]} ${flag.watchLevel === 'critical_watch' && flag.status !== 'resolved' ? 'animate-pulse' : ''}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-[Sora] font-semibold text-slate-950">{flag.machineName}</h3>
            <WatchFlagBadge level={flag.watchLevel} />
            {flag.status === 'carried_forward' && <span className="text-xs font-semibold text-amber-700">Carried Forward</span>}
          </div>
          <p className="mt-1 text-xs text-slate-500">{flag.machineLocation}</p>
        </div>
        <Link to={`/app/machines/${flag.machineId}`} className="text-xs font-semibold text-blue-700">Machine Detail</Link>
      </div>
      <p className="mt-3 text-sm text-slate-800">{flag.reason}</p>
      <p className="mt-2 text-sm text-slate-600"><span className="font-semibold">Recommended:</span> {flag.recommendedAction}</p>
      {flag.linkedBreakdownId && <Link to={`/app/breakdowns/${flag.linkedBreakdownId}`} className="mt-3 inline-block text-xs font-semibold text-red-700">Linked breakdown</Link>}
      {onResolve && flag.status !== 'resolved' && (
        <button type="button" onClick={() => onResolve(flag.id)} className="mt-3 min-h-12 rounded-md border border-emerald-200 px-4 py-2 text-sm font-semibold text-emerald-700">
          Resolve Flag
        </button>
      )}
    </article>
  );
}

export default WatchFlagCard;
