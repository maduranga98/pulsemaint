import { useMachineHistory } from '../../hooks/useMachineHistory';
import { WO_COPY } from '../../constants/copy';
import { WO_TYPE_CONFIG } from '../../constants/woConfig';
import type { MachineHistoryEntry } from '../../types/workOrder';

interface MachineHistoryTimelineProps {
  machineId: string;
  machineName?: string;
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function HistoryEntry({ entry }: { entry: MachineHistoryEntry }) {
  const [expanded, setExpanded] = useState(false);
  const typeConfig = WO_TYPE_CONFIG[entry.woType] ?? { icon: '🔧', label: entry.woType ?? 'Work', bgClass: 'bg-gray-100', textClass: 'text-gray-700' };
  const totalCost = entry.totalPartsCost ?? 0;
  const internalTeamNames = entry.internalTeamNames ?? [];
  const partsUsed = entry.partsUsed ?? [];
  const finalPhotoUrls = entry.finalPhotoUrls ?? [];
  const contractorTechnicianNames = entry.contractorTechnicianNames ?? [];

  return (
    <li className="ml-4">
      <div className="absolute -left-2 h-4 w-4 rounded-full bg-blue-500 ring-2 ring-white flex-shrink-0" />

      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full text-left"
      >
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm text-gray-900">{entry.woNumber}</span>
              <span className="text-lg">{typeConfig.icon}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${typeConfig.bgClass} ${typeConfig.textClass}`}>
                {typeConfig.label}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {entry.date?.toDate?.().toLocaleDateString() ?? ''} ·{' '}
              {formatDuration(entry.totalDurationMinutes ?? 0)}
              {entry.supervisorSignOffBy ? ` · ${entry.supervisorSignOffBy}` : ''}
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <span
              className={`text-xs font-semibold ${
                entry.testRunResult === 'pass' ? 'text-emerald-600' :
                entry.testRunResult === 'fail' ? 'text-red-600' : 'text-amber-600'
              }`}
            >
              {entry.testRunResult?.toUpperCase()}
            </span>
            {totalCost > 0 && (
              <p className="text-xs text-gray-400 mt-0.5">LKR {totalCost.toLocaleString()}</p>
            )}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="mt-3 mb-6 bg-gray-50 rounded-xl p-4 space-y-3 text-sm">
          <p className="text-gray-700">{entry.workDoneDescription}</p>

          {entry.rootCause && (
            <p className="text-gray-500">
              Root cause: <span className="font-medium text-gray-700">{entry.rootCause.replace(/_/g, ' ')}</span>
            </p>
          )}

          {internalTeamNames.length > 0 && (
            <p className="text-gray-500">
              Team: {internalTeamNames.join(', ')}
            </p>
          )}

          {entry.contractorName && (
            <p className="text-gray-500">
              Contractor: <span className="font-medium">{entry.contractorName}</span>
              {contractorTechnicianNames.length > 0 && ` (${contractorTechnicianNames.join(', ')})`}
            </p>
          )}

          {partsUsed.length > 0 && (
            <div>
              <p className="text-gray-400 text-xs mb-1">Parts used:</p>
              <div className="space-y-1">
                {partsUsed.map((p, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span>{p.partName} × {p.quantity} {p.unit}</span>
                    <span className="text-gray-500">LKR {p.totalCost?.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {finalPhotoUrls.length > 0 && (
            <div className="grid grid-cols-4 gap-1">
              {finalPhotoUrls.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noreferrer">
                  <img src={url} alt={`Photo ${i + 1}`} className="aspect-square rounded object-cover w-full" />
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </li>
  );
}

import { useState } from 'react';

export function MachineHistoryTimeline({ machineId, machineName }: MachineHistoryTimelineProps) {
  const { entries, loading, error, hasMore, loadMore } = useMachineHistory(machineId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">{WO_COPY.machineHistoryTitle}</h2>
        {machineName && <p className="text-sm text-gray-500">{machineName}</p>}
      </div>

      {loading && entries.length === 0 && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 animate-pulse rounded-xl" />
          ))}
        </div>
      )}

      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}

      {!loading && entries.length === 0 && !error && (
        <div className="text-center py-12">
          <p className="text-3xl mb-3">🔧</p>
          <p className="text-gray-400 text-sm">{WO_COPY.noHistoryEntries}</p>
        </div>
      )}

      {entries.length > 0 && (
        <ol className="relative border-l-2 border-gray-200 ml-3 space-y-6">
          {entries.map((entry) => (
            <HistoryEntry key={entry.id} entry={entry} />
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
