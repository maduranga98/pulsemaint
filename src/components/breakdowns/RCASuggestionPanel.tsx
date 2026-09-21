import { useState } from 'react';
import { Sparkles, Loader2, Lightbulb, ListChecks } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { suggestBreakdownRootCause, type BreakdownRCASuggestion } from '../../lib/breakdownRCA';
import type { BreakdownType } from '../../types/breakdown';

interface RCASuggestionPanelProps {
  machineId: string;
  machineName: string;
  breakdownType: BreakdownType;
  severity: string;
  description: string;
  attemptedFixes: string;
  technicianFindings: string;
  excludeTicketIds?: string[];
  disabled?: boolean;
}

/**
 * "Get AI Suggestions" panel for the breakdown assessment form. Calls
 * suggestBreakdownRootCause (Claude when configured, keyword heuristic
 * otherwise) and renders the probable causes / recommended actions it
 * returns. Purely advisory — nothing here writes back to the ticket.
 */
export function RCASuggestionPanel({
  machineId,
  machineName,
  breakdownType,
  severity,
  description,
  attemptedFixes,
  technicianFindings,
  excludeTicketIds = [],
  disabled,
}: RCASuggestionPanelProps) {
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BreakdownRCASuggestion | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const suggestion = await suggestBreakdownRootCause(
        { machineId, machineName, breakdownType, severity, description, attemptedFixes, technicianFindings },
        excludeTicketIds,
        i18n.language,
      );
      setResult(suggestion);
    } catch {
      setError(t('common.breakdowns.attendPage.rca.error'));
    } finally {
      setLoading(false);
    }
  }

  return (
    // Explicit dark-palette hex classes, not the usual light Tailwind
    // classes the app-wide .app-main-dark stylesheet auto-converts — that
    // override doesn't match the bg-indigo-50/50 opacity variant or shades
    // like text-indigo-900 that aren't in its mapping, which left this panel
    // barely visible against the dark app shell.
    <div className="rounded-xl border border-[#1E3A5F] bg-[#0A1628] p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-medium text-[#60A5FA]">
          <Sparkles className="w-4 h-4 text-[#60A5FA]" />
          {t('common.breakdowns.attendPage.rca.title')}
        </div>
        <button
          type="button"
          onClick={handleClick}
          disabled={disabled || loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1A56DB] text-white text-xs font-medium hover:bg-[#1648B0] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          {loading ? t('common.breakdowns.attendPage.rca.loading') : t('common.breakdowns.attendPage.rca.cta')}
        </button>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      {result && (
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="bg-[#0F1E35] rounded-lg border border-[#1E3A5F] p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-[#60A5FA] mb-2">
              <Lightbulb className="w-3.5 h-3.5" /> {t('common.breakdowns.attendPage.rca.causesLabel')}
            </p>
            <ul className="space-y-1.5 text-sm text-[#D5DEEA] list-disc list-inside">
              {result.probableCauses.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>
          <div className="bg-[#0F1E35] rounded-lg border border-[#1E3A5F] p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-[#60A5FA] mb-2">
              <ListChecks className="w-3.5 h-3.5" /> {t('common.breakdowns.attendPage.rca.actionsLabel')}
            </p>
            <ul className="space-y-1.5 text-sm text-[#D5DEEA] list-disc list-inside">
              {result.recommendedActions.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </div>
          <p className="sm:col-span-2 text-[11px] text-[#6B7F9A]">
            {result.source === 'ai'
              ? t('common.breakdowns.attendPage.rca.sourceAi')
              : t('common.breakdowns.attendPage.rca.sourceHeuristic')}
          </p>
        </div>
      )}
    </div>
  );
}
