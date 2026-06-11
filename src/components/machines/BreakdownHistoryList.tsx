import { useState } from 'react';
import { useMachineBreakdowns, type BreakdownHistoryItem } from '../../hooks/useMachineBreakdowns';

interface Props {
  machineId: string;
  machineName?: string;
}

const SEVERITY_STYLES: Record<string, string> = {
  critical: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-slate-100 text-slate-600',
};

const STATUS_STYLES: Record<string, string> = {
  reported: 'bg-blue-100 text-blue-700',
  acknowledged: 'bg-indigo-100 text-indigo-700',
  assigned: 'bg-purple-100 text-purple-700',
  en_route: 'bg-cyan-100 text-cyan-700',
  repair_started: 'bg-yellow-100 text-yellow-700',
  resolved: 'bg-green-100 text-green-700',
  closed: 'bg-gray-100 text-gray-600',
};

function formatTimestamp(ts: any): string {
  if (!ts) return '';
  const date = ts.toDate?.() ?? (ts.seconds ? new Date(ts.seconds * 1000) : null);
  if (!date) return '';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function BreakdownEntry({ entry }: { entry: BreakdownHistoryItem }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <li className="ml-4">
      <div className="absolute -left-2 h-4 w-4 rounded-full bg-red-500 ring-2 ring-white flex-shrink-0" />
      <button type="button" onClick={() => setExpanded((e) => !e)} className="w-full text-left">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm text-gray-900">{entry.ticketNumber}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SEVERITY_STYLES[entry.severity] ?? 'bg-gray-100 text-gray-600'}`}>
                {entry.severity}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_STYLES[entry.status] ?? 'bg-gray-100 text-gray-600'}`}>
                {entry.status.replace(/_/g, ' ')}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {formatTimestamp(entry.reportedAt)} · {entry.type.replace(/_/g, ' ')}
            </p>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="mt-3 mb-6 bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
          <p className="text-gray-700">{entry.description}</p>
          {entry.attemptedFixes && (
            <p className="text-gray-500">
              Attempted fixes: <span className="font-medium text-gray-700">{entry.attemptedFixes}</span>
            </p>
          )}
          {entry.assignedTechnicianNames.length > 0 && (
            <p className="text-gray-500">
              Assigned: {entry.assignedTechnicianNames.join(', ')}
            </p>
          )}
          {entry.resolvedAt && (
            <p className="text-gray-500">
              Resolved: {formatTimestamp(entry.resolvedAt)}
            </p>
          )}
        </div>
      )}
    </li>
  );
}

export function BreakdownHistoryList({ machineId, machineName }: Props) {
  const { entries, loading, error, hasMore, loadMore } = useMachineBreakdowns(machineId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">Breakdown History</h2>
        {machineName && <p className="text-sm text-gray-500">{machineName}</p>}
      </div>

      {loading && entries.length === 0 && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 animate-pulse rounded-xl" />
          ))}
        </div>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}

      {!loading && entries.length === 0 && !error && (
        <div className="text-center py-12">
          <p className="text-3xl mb-3">⚡</p>
          <p className="text-gray-400 text-sm">No breakdown history for this machine yet.</p>
        </div>
      )}

      {entries.length > 0 && (
        <ol className="relative border-l-2 border-gray-200 ml-3 space-y-6">
          {entries.map((entry) => (
            <BreakdownEntry key={entry.id} entry={entry} />
          ))}
        </ol>
      )}

      {hasMore && (
        <button
          type="button"
          onClick={loadMore}
          disabled={loading}
          className="w-full py-2.5 text-sm text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50"
        >
          {loading ? 'Loading…' : 'Load more'}
        </button>
      )}
    </div>
  );
}
