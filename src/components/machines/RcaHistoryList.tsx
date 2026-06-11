import { useState } from 'react';
import { Search, ChevronDown, ChevronRight } from 'lucide-react';
import { useMachineRcas } from '../../hooks/useRca';

interface RcaHistoryListProps {
  machineId: string;
}

export function RcaHistoryList({ machineId }: RcaHistoryListProps) {
  const { rcas, loading } = useMachineRcas(machineId);
  const [expanded, setExpanded] = useState<string | null>(null);

  if (loading) {
    return <p className="text-sm text-slate-500">Loading root-cause analyses…</p>;
  }

  if (rcas.length === 0) {
    return (
      <p className="text-sm text-slate-500">No completed root-cause analyses for this machine.</p>
    );
  }

  return (
    <div className="space-y-2">
      {rcas.map((rca) => {
        const isOpen = expanded === rca.id;
        return (
          <div key={rca.id} className="rounded-lg border border-slate-200 overflow-hidden">
            <button
              type="button"
              onClick={() => setExpanded(isOpen ? null : rca.id)}
              className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-slate-50"
            >
              {isOpen ? (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-400" />
              )}
              <Search className="w-4 h-4 text-blue-600" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{rca.problem}</p>
                <p className="text-xs text-slate-500">
                  {rca.breakdownTicketNumber} •{' '}
                  {rca.completedAt?.toDate
                    ? rca.completedAt.toDate().toLocaleDateString()
                    : '—'}
                </p>
              </div>
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
                Completed
              </span>
            </button>

            {isOpen && (
              <div className="border-t border-slate-100 px-4 py-3 space-y-3 text-sm bg-slate-50/50">
                <ol className="space-y-1.5">
                  {rca.whys
                    .filter((w) => w.question || w.answer)
                    .map((w, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="flex-shrink-0 h-5 w-5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold flex items-center justify-center">
                          {i + 1}
                        </span>
                        <div>
                          {w.question && <p className="text-slate-700">{w.question}</p>}
                          {w.answer && (
                            <p className="text-slate-500 text-xs">
                              <span className="font-medium">Because</span> {w.answer}
                            </p>
                          )}
                        </div>
                      </li>
                    ))}
                </ol>
                <div>
                  <p className="text-slate-500 text-xs uppercase tracking-wide">Root Cause</p>
                  <p className="text-slate-800">{rca.rootCause}</p>
                </div>
                {rca.correctiveAction && (
                  <div>
                    <p className="text-slate-500 text-xs uppercase tracking-wide">Corrective Action</p>
                    <p className="text-slate-800">{rca.correctiveAction}</p>
                  </div>
                )}
                {rca.linkedWOId && (
                  <p className="text-xs text-blue-600">Linked corrective Work Order created.</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
