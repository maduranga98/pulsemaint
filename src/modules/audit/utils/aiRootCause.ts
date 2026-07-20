import type {
  AuditFinding,
  AuditSession,
  AIRootCauseSuggestion,
  FindingKind,
} from '../types/audit.types';
import { nanoid } from 'nanoid';
import { generateGeminiJson, hasGeminiKey } from '../../../lib/gemini';

/**
 * Heuristic "AI" root-cause analyzer.
 *
 * Used as the fallback when no Gemini API key is configured, or when the
 * Gemini call fails — a deterministic, keyword-driven root-cause engine that
 * turns audit failure/loss data into probable causes and recommended
 * maintenance/safety actions. The output shape matches AIRootCauseSuggestion
 * so both paths are interchangeable to callers.
 */

interface Rule {
  keywords: string[];
  causes: string[];
  actions: string[];
}

const RULES_BY_KIND: Record<FindingKind, Rule[]> = {
  breakdown: [
    {
      keywords: ['bearing', 'vibration', 'noise', 'shaft', 'rotat'],
      causes: ['Bearing wear or misalignment', 'Inadequate lubrication', 'Imbalance in rotating assembly'],
      actions: ['Schedule bearing inspection and replacement', 'Verify lubrication schedule and quantities', 'Perform vibration analysis and balancing'],
    },
    {
      keywords: ['motor', 'electric', 'fuse', 'overload', 'tripped', 'panel', 'wiring'],
      causes: ['Electrical overload or phase imbalance', 'Loose/corroded connections', 'Insulation degradation'],
      actions: ['Thermographic inspection of panel', 'Tighten and clean terminations', 'Test motor insulation resistance'],
    },
    {
      keywords: ['leak', 'hydraulic', 'pneumatic', 'seal', 'pressure', 'hose'],
      causes: ['Seal/gasket failure', 'Hose fatigue or pressure spikes', 'Contaminated fluid'],
      actions: ['Replace seals and inspect hoses', 'Verify system pressure settings', 'Sample and filter fluid'],
    },
  ],
  loss: [
    {
      keywords: ['changeover', 'setup', 'startup'],
      causes: ['Excessive changeover/setup time', 'Lack of SMED standard work'],
      actions: ['Implement SMED quick-changeover study', 'Pre-stage tooling and materials'],
    },
    {
      keywords: ['speed', 'minor stop', 'jam', 'idle', 'slow'],
      causes: ['Minor stoppages / speed loss', 'Material feed issues', 'Worn wear-parts'],
      actions: ['Root-cause minor stops with line-side logging', 'Replace wear-parts on condition', 'Tune line speed to standard'],
    },
    {
      keywords: ['material', 'supply', 'shortage', 'waiting'],
      causes: ['Material starvation', 'Upstream supply variability'],
      actions: ['Review kanban / buffer levels', 'Coordinate with planning on supply'],
    },
  ],
  safety: [
    {
      keywords: ['guard', 'interlock', 'exposed', 'pinch', 'moving'],
      causes: ['Missing/defeated machine guarding', 'Inadequate interlocks'],
      actions: ['Restore guarding and interlocks immediately', 'Conduct machine safety risk assessment'],
    },
    {
      keywords: ['ppe', 'glove', 'helmet', 'goggle', 'harness'],
      causes: ['PPE non-compliance', 'PPE unavailable at point of use'],
      actions: ['Reinforce PPE policy and toolbox talk', 'Stock PPE at workstation'],
    },
    {
      keywords: ['spill', 'slip', 'trip', 'housekeep', 'clutter', 'wet'],
      causes: ['Housekeeping / slip-trip hazard', 'Spill containment failure'],
      actions: ['Immediate clean-up and 5S of area', 'Install spill containment / signage'],
    },
  ],
  maintenance: [
    {
      keywords: ['lubric', 'grease', 'oil'],
      causes: ['Lubrication schedule not followed', 'Incorrect lubricant/quantity'],
      actions: ['Reinforce autonomous lubrication standards', 'Audit lubrication route adherence'],
    },
    {
      keywords: ['overdue', 'pm', 'schedule', 'preventive', 'backlog'],
      causes: ['PM backlog / overdue preventive tasks', 'Resource constraints'],
      actions: ['Reschedule overdue PMs with priority', 'Review PM resourcing and frequency'],
    },
  ],
};

const DISCIPLINE_BY_KIND: Record<FindingKind, AIRootCauseSuggestion['discipline']> = {
  breakdown: 'maintenance',
  loss: 'operations',
  safety: 'safety',
  maintenance: 'maintenance',
};

const PRIORITY_BY_KIND: Record<FindingKind, AIRootCauseSuggestion['priority']> = {
  safety: 'high',
  breakdown: 'high',
  loss: 'medium',
  maintenance: 'medium',
};

function analyzeFinding(finding: AuditFinding): AIRootCauseSuggestion {
  const haystack = `${finding.description} ${finding.reason}`.toLowerCase();
  const rules = RULES_BY_KIND[finding.kind] ?? [];
  const matched = rules.filter((r) => r.keywords.some((k) => haystack.includes(k)));

  const causes = matched.flatMap((r) => r.causes);
  const actions = matched.flatMap((r) => r.actions);

  // Always fold in the auditor-provided reason/solution as primary signal.
  if (finding.reason) causes.unshift(`Reported reason: ${finding.reason}`);
  if (finding.solution) actions.unshift(`Auditor-proposed solution: ${finding.solution}`);

  if (causes.length === 0) {
    causes.push('No specific pattern matched — manual investigation recommended');
  }
  if (actions.length === 0) {
    actions.push('Assign to the responsible discipline for detailed root-cause analysis (5-Why / fishbone)');
  }

  return {
    findingId: finding.id,
    findingDescription: finding.description,
    kind: finding.kind,
    probableCauses: Array.from(new Set(causes)).slice(0, 4),
    recommendedActions: Array.from(new Set(actions)).slice(0, 4),
    discipline: DISCIPLINE_BY_KIND[finding.kind],
    priority: PRIORITY_BY_KIND[finding.kind],
  };
}

/** Expands findings with synthetic entries for failed tasks not logged as findings. */
function expandFindings(
  findings: AuditFinding[],
  failedAnswers: { taskText: string; notes: string }[],
): AuditFinding[] {
  const synthetic: AuditFinding[] = failedAnswers.map((fa) => ({
    id: nanoid(),
    kind: 'maintenance',
    description: fa.taskText,
    reason: fa.notes,
    solution: '',
  }));
  return [...findings, ...synthetic];
}

/**
 * Runs root-cause analysis across all findings of an audit (plus any failed
 * tasks that were not captured as explicit findings).
 */
export function analyzeAudit(
  findings: AuditFinding[],
  failedAnswers: { taskText: string; notes: string }[] = [],
): AIRootCauseSuggestion[] {
  return expandFindings(findings, failedAnswers).map(analyzeFinding);
}

export function buildFailedAnswerInputs(session: Pick<AuditSession, 'answers'>) {
  return session.answers
    .filter((a) => a.failed)
    .map((a) => ({ taskText: a.taskText, notes: a.notes }));
}

const GEMINI_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    suggestions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          findingId: { type: 'string' },
          probableCauses: { type: 'array', items: { type: 'string' } },
          recommendedActions: { type: 'array', items: { type: 'string' } },
          discipline: { type: 'string', enum: ['maintenance', 'safety', 'operations', 'quality'] },
          priority: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
        required: ['findingId', 'probableCauses', 'recommendedActions', 'discipline', 'priority'],
      },
    },
  },
  required: ['suggestions'],
};

interface GeminiRootCauseResult {
  suggestions: Array<{
    findingId: string;
    probableCauses: string[];
    recommendedActions: string[];
    discipline: AIRootCauseSuggestion['discipline'];
    priority: AIRootCauseSuggestion['priority'];
  }>;
}

function buildPrompt(inputs: { id: string; kind: FindingKind; description: string; reason: string; solution: string }[]): string {
  const items = inputs
    .map(
      (f, i) =>
        `${i + 1}. id="${f.id}" kind=${f.kind}\n   Description: ${f.description || '—'}\n   Reported reason: ${f.reason || '—'}\n   Auditor-proposed solution: ${f.solution || '—'}`,
    )
    .join('\n');

  return (
    'You are a plant maintenance and safety root-cause analysis assistant. ' +
    'For each audit finding below, identify the most likely probable causes and ' +
    'recommended corrective actions, and classify the discipline and priority.\n\n' +
    `Findings:\n${items}\n\n` +
    'Return JSON matching the given schema — one entry per finding id, in the same order. ' +
    'Keep each cause/action concise (one sentence). Provide 2-4 causes and 2-4 actions per finding.'
  );
}

/**
 * Runs root-cause analysis via the Gemini API when VITE_GEMINI_API_KEY is
 * configured, falling back to the local heuristic engine (analyzeAudit) if
 * the key is missing or the call fails, so audit submission never blocks on
 * the AI provider being unavailable.
 */
export async function analyzeAuditWithAI(
  findings: AuditFinding[],
  failedAnswers: { taskText: string; notes: string }[] = [],
): Promise<AIRootCauseSuggestion[]> {
  const expanded = expandFindings(findings, failedAnswers);
  const heuristic = expanded.map(analyzeFinding);

  if (!hasGeminiKey() || expanded.length === 0) {
    return heuristic;
  }

  try {
    const result = await generateGeminiJson<GeminiRootCauseResult>(buildPrompt(expanded), {
      responseSchema: GEMINI_RESPONSE_SCHEMA,
    });

    const byId = new Map(result.suggestions.map((s) => [s.findingId, s]));
    return heuristic.map((fallback) => {
      const ai = byId.get(fallback.findingId);
      if (!ai || ai.probableCauses.length === 0 || ai.recommendedActions.length === 0) return fallback;
      return {
        ...fallback,
        probableCauses: ai.probableCauses.slice(0, 4),
        recommendedActions: ai.recommendedActions.slice(0, 4),
        discipline: ai.discipline,
        priority: ai.priority,
      };
    });
  } catch (err) {
    console.error('Gemini root-cause analysis failed, using heuristic fallback', err);
    return heuristic;
  }
}
