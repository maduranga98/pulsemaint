import type { BreakdownType } from '../types/breakdown';
import { generateClaudeJson, isClaudeEnabled } from './claude';

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
  /** Why the AI call failed, when it was attempted and fell back to the heuristic. */
  aiError?: string;
  /** True when the company has no past root-cause record matching this fault. */
  noHistory?: boolean;
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
  // Who the recommended actions are written for. 'reporter' (default) is the
  // person who just filed the breakdown — usually not a maintenance
  // specialist — so actions are safe, non-invasive checks anyone can try
  // before a technician arrives. 'technician' is the person attending the
  // ticket, who gets hands-on diagnostic/repair steps instead.
  audience?: 'reporter' | 'technician';
}

// Keyword-driven fallback, mirrors the Audit module's aiRootCause engine so
// there's always a usable answer when AI is disabled or the
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

const STOPWORDS = new Set([
  'the', 'and', 'was', 'were', 'has', 'have', 'had', 'that', 'this', 'with', 'from',
  'when', 'then', 'there', 'their', 'about', 'into', 'onto', 'just', 'been', 'being',
  'machine', 'what', 'happened', 'today', 'yesterday', 'again', 'still', 'also',
]);

// Pulls the most distinctive words out of the operator's own description, so
// the fallback below can point the technician at what was actually reported
// instead of a content-free "nothing matched" message — this is the input
// the AI path would otherwise have researched from.
function extractKeyTerms(text: string, max = 6): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOPWORDS.has(w));
  return Array.from(new Set(words)).slice(0, max);
}

function heuristicSuggestion(input: RCAInput): BreakdownRCASuggestion {
  const haystack = `${input.description} ${input.attemptedFixes ?? ''} ${input.technicianFindings ?? ''}`.toLowerCase();
  // A technician's later assessment narrows to one failure type, so only that
  // type's rules apply. At report time (breakdownType not yet set) nothing
  // has narrowed it down yet, so check every category's keywords instead of
  // just "other" (which has none) — the description alone should still be
  // able to surface a match.
  const rules = input.breakdownType ? (RULES_BY_TYPE[input.breakdownType] ?? []) : Object.values(RULES_BY_TYPE).flat();
  const matched = rules.filter((r) => r.keywords.some((k) => haystack.includes(k)));

  const causes = Array.from(new Set(matched.flatMap((r) => r.causes)));
  const actions = Array.from(new Set(matched.flatMap((r) => r.actions)));

  if (causes.length === 0) {
    const terms = extractKeyTerms(input.description);
    causes.push(
      terms.length > 0
        ? `No matching historical failure pattern for the reported symptoms (${terms.join(', ')}) — treat as a new or infrequent fault and investigate directly from the description`
        : 'No matching historical failure pattern — investigate directly from the reported description',
    );
  }

  if (input.audience === 'reporter') {
    // Matched-rule actions ("Inspect and replace worn bearings", etc.) are
    // technician-level repair steps — not safe or appropriate to hand to
    // whoever just reported the fault. Give the reporter safe, non-invasive
    // checks instead, grounded in what they actually described.
    const terms = extractKeyTerms(input.description);
    return {
      probableCauses: causes.slice(0, 4),
      recommendedActions: [
        terms.length > 0
          ? `Take a closer look and note anything matching what you reported: ${terms.join(', ')}`
          : 'Take a closer look at the machine and note exactly what you observe',
        'Check that the emergency stop is not engaged and the power supply/breaker is on',
        'Look for anything visibly wrong nearby — loose cables, leaks, unusual smell or smoke, obstructions',
        'Do not attempt an internal repair yourself — leave the machine as-is and wait for a technician',
      ].slice(0, 4),
      source: 'heuristic',
    };
  }

  if (actions.length === 0) {
    const terms = extractKeyTerms(input.description);
    actions.push(
      terms.length > 0
        ? `Physically inspect the machine focusing on what was reported: ${terms.join(', ')}`
        : 'Physically inspect the machine based on the reported description',
    );
    actions.push('Perform a structured 5-Why / fishbone analysis with the assigned technician');
  }

  return {
    probableCauses: causes.slice(0, 4),
    recommendedActions: actions.slice(0, 4),
    source: 'heuristic',
  };
}

const CLAUDE_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    probableCauses: { type: 'array', items: { type: 'string' } },
    recommendedActions: { type: 'array', items: { type: 'string' } },
  },
  required: ['probableCauses', 'recommendedActions'],
  additionalProperties: false,
};

function buildPrompt(input: RCAInput, languageName: string): string {
  const machineLine = [input.machineName, input.machineManufacturer, input.machineModel]
    .filter(Boolean)
    .join(' — ');

  const audienceInstruction =
    input.audience === 'reporter'
      ? `The "recommended next actions" are for the PERSON WHO JUST REPORTED THIS FAULT — usually an operator, not a maintenance specialist, and no technician has attended yet. Give only safe, non-invasive checks they can do themselves right now (what to look/listen/smell for, power/breaker/emergency-stop state) — never a repair step — and always end with a reminder not to attempt an internal repair and to wait for a technician.`
      : `The "recommended next actions" are for the TECHNICIAN who will attend this ticket — what to check first, and the fixes that worked before.`;

  return `A new fault has just been reported in a CMMS.
Machine: ${machineLine}
Failure type: ${input.breakdownType ?? 'not yet classified'}
Severity: ${input.severity ?? 'not yet assessed'}
Reported description ("what happened"): ${input.description || '(not provided)'}
Attempted fixes so far: ${input.attemptedFixes || '(none recorded)'}
Technician findings so far: ${input.technicianFindings || '(none recorded)'}

Below this prompt are this company's own past root-cause records (breakdown work orders, all other work orders, breakdown tickets and 5-Why analyses). Using ONLY those records, say what probably happened this time (most likely first) and what should be checked or done, reusing the causes and fixes that were recorded for similar faults. Do not use outside knowledge and do not invent causes that no record supports. If no record is relevant, return two empty lists. ${audienceInstruction} One concise sentence per item, 2-4 items per list. Respond in ${languageName}, in the exact JSON shape requested — nothing else.`;
}

/**
 * Suggests probable causes and next actions for a new breakdown. The AI is
 * used only to read and summarise the company's own past root-cause records
 * (gathered server-side by `claudeJson`, strictly scoped to the caller's
 * company) — no web research and no generic guesses. Falls back to the
 * deterministic keyword engine only when the AI call itself fails or is
 * disabled. `language` is the app language the AI response is written in.
 */
export async function suggestBreakdownRootCause(
  input: RCAInput,
  language = 'en-US',
): Promise<BreakdownRCASuggestion> {
  if (!isClaudeEnabled()) {
    return heuristicSuggestion(input);
  }

  try {
    const languageName = RESPONSE_LANGUAGE_NAMES[language] ?? 'English';
    const result = await generateClaudeJson<{ probableCauses: string[]; recommendedActions: string[] }>(
      buildPrompt(input, languageName),
      {
        systemInstruction: 'You summarise a company\'s own past maintenance root-cause records to help with a new fault. You only use the records provided. Always respond with the requested JSON shape only.',
        responseSchema: CLAUDE_RESPONSE_SCHEMA,
        machineId: input.machineId || undefined,
        historyQuery: [input.description, input.technicianFindings].filter(Boolean).join(' ').slice(0, 1500) || undefined,
      },
    );
    const probableCauses = result.probableCauses ?? [];
    const recommendedActions = result.recommendedActions ?? [];
    return {
      probableCauses,
      recommendedActions,
      source: 'ai',
      noHistory: !probableCauses.length && !recommendedActions.length,
    };
  } catch (err) {
    console.warn('AI root-cause suggestion failed, using heuristic fallback', err);
    const code = (err as { code?: string })?.code;
    const message = err instanceof Error ? err.message : String(err);
    return { ...heuristicSuggestion(input), aiError: code ? `${code}: ${message}` : message };
  }
}
