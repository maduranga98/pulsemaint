import { useEffect, useRef, useState } from 'react';
import { Sparkles, Loader2, Lightbulb, ListChecks, RefreshCw } from 'lucide-react';
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
  disabled?: boolean;
}

/**
 * AI suggestions panel for the breakdown assessment form. Runs on its own as
 * soon as the form opens (no button): Claude reads the reporter's "what
 * happened" and this company's own past root-cause records (breakdowns,
 * breakdown work orders, all other work orders) and suggests probable causes
 * and next actions from them — no web research, no other company's data.
 * Falls back to the keyword heuristic if the AI call fails. A refresh button re-runs it
 * with the technician's latest findings. Purely advisory — nothing here
 * writes back to the ticket.
 */
export function RCASuggestionPanel({
  machineId,
  machineName,
  breakdownType,
  severity,
  description,
  attemptedFixes,
  technicianFindings,
  disabled,
}: RCASuggestionPanelProps) {
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BreakdownRCASuggestion | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const suggestion = await suggestBreakdownRootCause(
        { machineId, machineName, breakdownType, severity, description, attemptedFixes, technicianFindings },
        i18n.language,
      );
      setResult(suggestion);
    } catch {
      setError(t('common.breakdowns.attendPage.rca.error'));
    } finally {
      setLoading(false);
    }
  }

  // Run once, automatically, as soon as the tickets (and so the reporter's
  // description) have loaded.
  const autoRan = useRef(false);
  useEffect(() => {
    if (autoRan.current || disabled || !machineId || !description.trim()) return;
    autoRan.current = true;
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled, machineId, description]);

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
        {loading ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-[#8BA3BF]">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            {t('common.breakdowns.attendPage.rca.researching', { defaultValue: 'Reading past root-cause records…' })}
          </span>
        ) : result && (
          <button
            type="button"
            onClick={() => void run()}
            disabled={disabled}
            title={t('common.breakdowns.attendPage.rca.refreshTitle', { defaultValue: 'Re-run with the latest findings' })}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-[#1E3A5F] text-[#8BA3BF] text-xs hover:text-white disabled:opacity-50"
          >
            <RefreshCw className="w-3 h-3" />
            {t('common.breakdowns.attendPage.rca.refresh', { defaultValue: 'Refresh' })}
          </button>
        )}
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      {result?.noHistory && (
        <p className="text-sm text-[#8BA3BF]">
          {t('common.breakdowns.attendPage.rca.noHistory', { defaultValue: 'No past root-cause record matches this fault yet. Suggestions appear once similar work orders have been signed off with a root cause.' })}
        </p>
      )}

      {result && !result.noHistory && (
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
              ? t('common.breakdowns.attendPage.rca.sourceAiHistory', { defaultValue: "Generated by AI from your company's past root-cause records — verify before acting." })
              : t('common.breakdowns.attendPage.rca.sourceHeuristic')}
            {result.aiError && <span className="block text-[#F87171]">{t('common.breakdowns.attendPage.rca.aiError', { error: result.aiError })}</span>}
          </p>
        </div>
      )}
    </div>
  );
}
