import { useEffect, useRef, useState } from 'react';
import { Sparkles, Loader2, Lightbulb, ListChecks, RefreshCw, ExternalLink } from 'lucide-react';
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
 * AI suggestions panel for the breakdown assessment form. Runs on its own as
 * soon as the form opens (no button): Claude reads the reporter's "what
 * happened", the machine's past repairs and root-cause analyses, and
 * researches the fault on the web (manuals, forums, videos), then suggests
 * probable causes and next actions with the sources it used. Falls back to
 * the keyword heuristic if AI is unavailable. A refresh button re-runs it
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
  excludeTicketIds = [],
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
        excludeTicketIds,
        i18n.language,
        { webResearch: true },
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
            {t('common.breakdowns.attendPage.rca.researching', { defaultValue: 'Analysing and researching…' })}
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
            {result.aiError && <span className="block text-[#F87171]">{t('common.breakdowns.attendPage.rca.aiError', { error: result.aiError })}</span>}
          </p>
          {(result.sources?.length ?? 0) > 0 && (
            <div className="sm:col-span-2">
              <p className="text-xs font-semibold text-[#60A5FA] mb-1">
                {t('common.breakdowns.attendPage.rca.sources', { defaultValue: 'Sources researched' })}
              </p>
              <ul className="space-y-0.5 text-xs">
                {result.sources!.map((src) => (
                  <li key={src.url}>
                    <a href={src.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#93C5FD] hover:underline break-all">
                      <ExternalLink className="w-3 h-3 shrink-0" />{src.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
