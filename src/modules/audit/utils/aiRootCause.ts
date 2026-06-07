import type {
  AuditFinding,
  AuditSession,
  AIRootCauseSuggestion,
  FindingKind,
} from '../types/audit.types';
import { nanoid } from 'nanoid';

/**
 * Heuristic "AI" root-cause analyzer.
 *
 * The application has no LLM backend wired up, so this provides a deterministic,
 * keyword-driven root-cause engine that turns audit failure/loss data into
 * probable causes and recommended maintenance/safety actions. The output shape
 * matches AIRootCauseSuggestion so it can be swapped for a real model later
 * without changing callers.
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

/**
 * Runs root-cause analysis across all findings of an audit (plus any failed
 * tasks that were not captured as explicit findings).
 */
export function analyzeAudit(
  findings: AuditFinding[],
  failedAnswers: { taskText: string; notes: string }[] = [],
): AIRootCauseSuggestion[] {
  const suggestions = findings.map(analyzeFinding);

  // Surface failed critical tasks that the auditor didn't log as a finding.
  for (const fa of failedAnswers) {
    const synthetic: AuditFinding = {
      id: nanoid(),
      kind: 'maintenance',
      description: fa.taskText,
      reason: fa.notes,
      solution: '',
    };
    suggestions.push(analyzeFinding(synthetic));
  }

  return suggestions;
}

export function buildFailedAnswerInputs(session: Pick<AuditSession, 'answers'>) {
  return session.answers
    .filter((a) => a.failed)
    .map((a) => ({ taskText: a.taskText, notes: a.notes }));
}
