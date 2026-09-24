import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, RefreshCw } from 'lucide-react';
import type { WOAiRca } from '../../types/workOrder';
import { generateWoAiRca } from '../../lib/woAiRca';

interface Props {
  woId: string;
  /** The RCA saved on the work order (live), if any. */
  rca: WOAiRca | null | undefined;
  /** Supervisors/managers/admins can (re)run the analysis. */
  canRegenerate: boolean;
  /** Run the analysis on mount when none is saved yet (the sign-off form). */
  autoGenerate?: boolean;
  /** Text shown while no RCA exists and none is running. */
  pendingText?: string;
}

type Ts = { toDate?: () => Date } | null | undefined;
const fmt = (ts: Ts) => (ts?.toDate ? ts.toDate().toLocaleString() : '—');

/**
 * AI root-cause analysis for a work order (see lib/woAiRca) — shown on the
 * sign-off form, so the supervisor reviews it before signing off, and on the
 * signed-off summary. The result is saved on the WO; a freshly generated one
 * is shown straight away even before the live WO snapshot catches up.
 */
export function WOAiRcaCard({ woId, rca: savedRca, canRegenerate, autoGenerate, pendingText }: Props) {
  const { t } = useTranslation();
  const d = (key: string, defaultValue: string, opts?: Record<string, unknown>) =>
    t(`common.workOrders.summary.${key}`, { defaultValue, ...opts });
  const [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState<WOAiRca | null>(null);
  const rca = fresh ?? savedRca ?? null;

  async function run() {
    setBusy(true);
    try {
      setFresh(await generateWoAiRca(woId));
    } finally {
      setBusy(false);
    }
  }

  const autoRan = useRef(false);
  useEffect(() => {
    if (!autoGenerate || autoRan.current || savedRca) return;
    autoRan.current = true;
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoGenerate, savedRca]);

  return (
    <div className="rounded-lg border border-[#1E3A5F] bg-[#0F1E35] p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-[#60A5FA]">
          <Sparkles className="w-4 h-4" /> {d('aiRca', 'AI root-cause analysis')}
        </p>
        {canRegenerate && !busy && (
          <button
            type="button"
            onClick={() => void run()}
            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-[#1E3A5F] text-[#93C5FD] hover:bg-[#1E3A5F]"
          >
            <RefreshCw className="w-3 h-3" /> {rca ? d('regenerate', 'Regenerate') : d('generate', 'Generate')}
          </button>
        )}
      </div>
      {busy ? (
        <p className="text-sm text-[#93C5FD]">{d('rcaRunning', 'Analysing the work order…')}</p>
      ) : !rca ? (
        <p className="text-sm text-[#B6C4D6]">{pendingText ?? d('rcaPending', 'Being generated after sign-off — it appears here shortly.')}</p>
      ) : rca.source === 'failed' ? (
        <p className="text-sm text-[#F87171]">{d('rcaFailed', 'AI analysis failed: {{error}}', { error: rca.error ?? '' })}</p>
      ) : (
        <div className="space-y-2 text-sm text-[#F0F4F8]">
          <p>{rca.summary}</p>
          <p>
            <span className="font-semibold">{d('rootCause', 'Root cause')}:</span> {rca.rootCause}{' '}
            <span className="text-xs text-[#8BA3BF]">({rca.rootCauseCategory.replace(/_/g, ' ')} · {d('confidence', 'confidence')}: {rca.confidence})</span>
          </p>
          {rca.contributingFactors.length > 0 && (
            <div><p className="font-semibold">{d('factors', 'Contributing factors')}</p><ul className="list-disc list-inside">{rca.contributingFactors.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
          )}
          {rca.evidence.length > 0 && (
            <div><p className="font-semibold">{d('evidence', 'Evidence')}</p><ul className="list-disc list-inside">{rca.evidence.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
          )}
          {rca.preventiveActions.length > 0 && (
            <div><p className="font-semibold">{d('preventive', 'Preventive actions')}</p><ul className="list-disc list-inside">{rca.preventiveActions.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
          )}
          <p className="text-[11px] text-[#8BA3BF]">{d('rcaGenerated', 'Generated {{at}} — verify before acting.', { at: fmt(rca.generatedAt) })}</p>
        </div>
      )}
    </div>
  );
}
