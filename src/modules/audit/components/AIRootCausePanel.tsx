import { Sparkles, Wrench, ShieldAlert } from 'lucide-react';
import type { AIRootCauseSuggestion } from '../types/audit.types';

const PRIORITY_STYLES: Record<string, string> = {
  high: 'bg-red-900/40 border-red-700/50 text-red-200',
  medium: 'bg-amber-900/40 border-amber-700/50 text-amber-200',
  low: 'bg-slate-700/40 border-slate-600 text-slate-300',
};

/**
 * Renders AI root-cause analysis derived from audit findings/losses, surfacing
 * suggested maintenance/safety actions (this is the Triage AI integration view).
 */
export function AIRootCausePanel({ suggestions }: { suggestions: AIRootCauseSuggestion[] }) {
  if (suggestions.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Sparkles className="h-4 w-4 text-emerald-400" />
        No issues detected — AI found nothing requiring root-cause analysis.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-emerald-300">
        <Sparkles className="h-4 w-4" />
        AI analyzed {suggestions.length} finding{suggestions.length > 1 ? 's' : ''} and suggests:
      </div>
      {suggestions.map((s, i) => (
        <div key={i} className="p-3 bg-slate-900 border border-emerald-900/40 rounded-lg">
          <div className="flex items-center justify-between mb-2 gap-2">
            <p className="text-sm font-semibold text-white truncate">{s.findingDescription || '(unlabeled finding)'}</p>
            <span className={`shrink-0 px-2 py-0.5 text-[11px] font-semibold rounded border ${PRIORITY_STYLES[s.priority]}`}>
              {s.priority.toUpperCase()} · {s.discipline}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 mb-1">
                <ShieldAlert className="h-3.5 w-3.5" /> Probable causes
              </p>
              <ul className="space-y-0.5 text-xs text-slate-300 list-disc list-inside">
                {s.probableCauses.map((c, j) => <li key={j}>{c}</li>)}
              </ul>
            </div>
            <div>
              <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 mb-1">
                <Wrench className="h-3.5 w-3.5" /> Recommended actions
              </p>
              <ul className="space-y-0.5 text-xs text-slate-300 list-disc list-inside">
                {s.recommendedActions.map((a, j) => <li key={j}>{a}</li>)}
              </ul>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
