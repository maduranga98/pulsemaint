import { Link } from 'react-router-dom';
import type { TriageSession } from '../../../types/triage';
import TriageSessionStatusBadge from '../shared/TriageSessionStatusBadge';
import TriageOutcomeCard from '../shared/TriageOutcomeCard';

interface Props {
  session: TriageSession;
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

export default function TriageHistoryCard({ session }: Props) {
  const startedAt = new Date(session.startedAt.seconds * 1000);

  return (
    <Link
      to={`/app/triage/history/${session.id}`}
      className="block bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-[#0A1628] truncate">{session.machineName}</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            {startedAt.toLocaleDateString()} {startedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <TriageSessionStatusBadge status={session.status} />
      </div>

      <div className="flex flex-wrap gap-3 mt-3 text-xs text-gray-500">
        <span>Supervisor: {session.supervisorName}</span>
        <span>·</span>
        <span>Flow: {session.flowName}</span>
        <span>·</span>
        <span>{formatDuration(session.totalDuration)}</span>
        {session.isDemo && <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Demo</span>}
      </div>

      {session.outcomeType && (
        <div className="mt-3">
          <TriageOutcomeCard outcome={session.outcomeType} />
        </div>
      )}
    </Link>
  );
}
