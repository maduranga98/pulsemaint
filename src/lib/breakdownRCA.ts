import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import type { Breakdown, BreakdownType } from '../types/breakdown';
import { generateClaudeJson, hasClaudeKey } from './claude';

// Kept in sync with SUPPORTED_LANGUAGES in lib/i18n.ts so the AI response
// language always matches the app's currently selected UI language rather
// than silently falling back to English for a language missing from here.
const RESPONSE_LANGUAGE_NAMES: Record<string, string> = {
  'en-US': 'English',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  zh: 'Chinese',
  ja: 'Japanese',
};

export interface BreakdownRCASuggestion {
  probableCauses: string[];
  recommendedActions: string[];
  source: 'ai' | 'heuristic';
}

interface RCAInput {
  machineId: string;
  machineName: string;
  machineModel?: string;
  machineManufacturer?: string;
  // Not yet known at report time — the technician classifies this once they
  // attend the ticket. The AI prompt is told explicitly when it's absent.
  breakdownType?: BreakdownType;
  severity?: string;
  description: string;
  attemptedFixes?: string;
  technicianFindings?: string;
}

// Keyword-driven fallback, mirrors the Audit module's aiRootCause engine so
// there's always a usable answer when no Gemini key is configured or the
// API call fails.
const RULES_BY_TYPE: Record<BreakdownType, { keywords: string[]; causes: string[]; actions: string[] }[]> = {
  mechanical: [
    {
      keywords: ['bearing', 'vibration', 'noise', 'shaft', 'rotat', 'belt', 'chain'],
      causes: ['Bearing wear or misalignment', 'Inadequate lubrication', 'Belt/chain fatigue or misadjustment'],
      actions: ['Inspect and replace worn bearings', 'Verify lubrication schedule', 'Check belt/chain tension and alignment'],
    },
    {
      keywords: ['jam', 'stuck', 'blocked', 'seized'],
      causes: ['Foreign material jam', 'Component seizure from lack of maintenance'],
      actions: ['Clear jam and inspect for damage', 'Add/verify lubrication points near the seizure'],
    },
  ],
  electrical: [
    {
      keywords: ['motor', 'fuse', 'overload', 'tripped', 'panel', 'wiring', 'short', 'breaker'],
      causes: ['Electrical overload or phase imbalance', 'Loose/corroded connections', 'Insulation degradation'],
      actions: ['Thermographic inspection of panel', 'Tighten and clean terminations', 'Test motor insulation resistance'],
    },
    {
      keywords: ['sensor', 'plc', 'signal', 'wiring'],
      causes: ['Sensor drift or failure', 'Wiring/connector fault'],
      actions: ['Swap/recalibrate sensor', 'Inspect wiring harness continuity'],
    },
  ],
  hydraulic: [
    {
      keywords: ['leak', 'seal', 'pressure', 'hose', 'pump', 'cylinder'],
      causes: ['Seal/gasket failure', 'Hose fatigue or pressure spike', 'Contaminated hydraulic fluid'],
      actions: ['Replace seals and inspect hoses', 'Verify system pressure settings', 'Sample and filter fluid'],
    },
  ],
  pneumatic: [
    {
      keywords: ['leak', 'air', 'valve', 'solenoid', 'pressure', 'hose'],
      causes: ['Air leak at fitting/hose', 'Solenoid valve failure', 'Low supply pressure'],
      actions: ['Leak-test fittings and hoses', 'Test/replace solenoid valve', 'Check compressor supply pressure'],
    },
  ],
  software: [
    {
      keywords: ['error', 'crash', 'freeze', 'plc', 'hmi', 'reboot', 'firmware'],
      causes: ['Software/firmware fault', 'Configuration drift', 'Communication timeout'],
      actions: ['Restart/reflash controller and monitor', 'Verify configuration against known-good backup', 'Check network/communication links'],
    },
  ],
  other: [],
};

function heuristicSuggestion(input: RCAInput): BreakdownRCASuggestion {
  const haystack = `${input.description} ${input.attemptedFixes ?? ''} ${input.technicianFindings ?? ''}`.toLowerCase();
  const rules = RULES_BY_TYPE[input.breakdownType ?? 'other'] ?? [];
  const matched = rules.filter((r) => r.keywords.some((k) => haystack.includes(k)));

  const causes = Array.from(new Set(matched.flatMap((r) => r.causes)));
  const actions = Array.from(new Set(matched.flatMap((r) => r.actions)));

  if (causes.length === 0) {
    causes.push('No specific pattern matched from the description — manual investigation recommended');
  }
  if (actions.length === 0) {
    actions.push('Perform a structured 5-Why / fishbone analysis with the assigned technician');
  }

  return {
    probableCauses: causes.slice(0, 4),
    recommendedActions: actions.slice(0, 4),
    source: 'heuristic',
  };
}

/** Recent resolved/attended tickets for the same machine, used as extra context for the AI prompt. */
async function fetchRecentHistory(machineId: string, excludeIds: string[]): Promise<Breakdown[]> {
  try {
    const q = query(
      collection(db, 'breakdown_tickets'),
      where('machineId', '==', machineId),
      orderBy('reportedAt', 'desc'),
      limit(8),
    );
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ ...d.data(), id: d.id }) as Breakdown)
      .filter((b) => !excludeIds.includes(b.id));
  } catch {
    // Missing composite index or offline — history is a nice-to-have, not required.
    return [];
  }
}

const CLAUDE_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    probableCauses: { type: 'array', items: { type: 'string' } },
    recommendedActions: { type: 'array', items: { type: 'string' } },
  },
  required: ['probableCauses', 'recommendedActions'],
};

function buildPrompt(input: RCAInput, history: Breakdown[], languageName: string): string {
  const historyBlock = history.length
    ? history
        .map(
          (h, i) =>
            `${i + 1}. [${h.type}/${h.severity}] ${h.description}${h.technicianFindings ? ` — findings: ${h.technicianFindings}` : ''}${h.attemptedFixes ? ` — fix tried: ${h.attemptedFixes}` : ''}`,
        )
        .join('\n')
    : 'No prior breakdown history available for this machine.';

  const machineLine = [input.machineName, input.machineManufacturer, input.machineModel]
    .filter(Boolean)
    .join(' — ');

  return `You are an industrial maintenance root-cause analysis assistant for a CMMS.
Machine: ${machineLine}
Failure type: ${input.breakdownType ?? 'not yet classified — this is the operator\'s initial report, before a technician has assessed it'}
Severity: ${input.severity ?? 'not yet assessed'}
Reported description ("what happened"): ${input.description || '(not provided)'}
Attempted fixes so far: ${input.attemptedFixes || '(none recorded)'}
Technician findings so far: ${input.technicianFindings || '(none recorded)'}

Recent breakdown history and completed root-cause analysis for this same machine (most recent first):
${historyBlock}

Based on this — the reported description, the machine's model/manufacturer, and the recurring patterns in its breakdown history — return the most probable root causes (ranked, most likely first) and concrete recommended next diagnostic/repair actions. Be specific and reuse patterns visible in the history when they recur. Keep each item to one concise sentence. Return 2-4 items per list. Respond in ${languageName}, in the exact JSON shape requested — nothing else.`;
}

/**
 * Suggests probable root causes and next actions for a breakdown, using the
 * machine's own history of past breakdowns/root-cause findings plus its
 * model/manufacturer as research context. Uses Claude when
 * VITE_ANTHROPIC_API_KEY is configured, falling back to a deterministic
 * keyword engine (mirrors the Audit module's approach) when the key is
 * absent or the API call fails. `language` is the app language the caller
 * currently has selected (e.g. from i18n.language) — the AI response is
 * written in that language; the heuristic fallback is English-only.
 */
export async function suggestBreakdownRootCause(
  input: RCAInput,
  excludeTicketIds: string[] = [],
  language = 'en-US',
): Promise<BreakdownRCASuggestion> {
  const history = await fetchRecentHistory(input.machineId, excludeTicketIds);

  if (!hasClaudeKey()) {
    return heuristicSuggestion(input);
  }

  try {
    const languageName = RESPONSE_LANGUAGE_NAMES[language] ?? 'English';
    const result = await generateClaudeJson<{ probableCauses: string[]; recommendedActions: string[] }>(
      buildPrompt(input, history, languageName),
      {
        systemInstruction: 'You are a concise, practical industrial maintenance root-cause analysis assistant. Always respond with the requested JSON shape only.',
        responseSchema: CLAUDE_RESPONSE_SCHEMA,
      },
    );
    if (!result.probableCauses?.length && !result.recommendedActions?.length) {
      return heuristicSuggestion(input);
    }
    return {
      probableCauses: result.probableCauses ?? [],
      recommendedActions: result.recommendedActions ?? [],
      source: 'ai',
    };
  } catch {
    return heuristicSuggestion(input);
  }
}
