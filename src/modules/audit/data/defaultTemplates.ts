import type { AuditCategory, AuditTask } from '../types/audit.types';

let _seq = 0;
const t = (text: string, answerType: AuditTask['answerType'], critical = false): AuditTask => ({
  id: `def_${++_seq}`,
  text,
  answerType,
  critical,
});

/**
 * Built-in starter tasks per audit category. These are cloned into an editable
 * template the first time a plant opens a category, so auditors can add/remove
 * tasks and change answer types freely afterwards.
 */
export const DEFAULT_TASKS: Record<AuditCategory, AuditTask[]> = {
  tpm: [
    t('Autonomous maintenance checklist completed by operator', 'yes_no', true),
    t('Equipment cleaned and free of leaks/contamination', 'scale'),
    t('Lubrication points serviced per schedule', 'yes_no', true),
    t('Abnormalities (vibration, noise, heat) tagged', 'scale', true),
    t('Planned maintenance adherence this period', 'scale'),
    t('Breakdowns since last audit (describe)', 'text', true),
    t('Visual standards / one-point lessons displayed', 'yes_no'),
  ],
  fives: [
    t('Sort — unnecessary items removed from area', 'scale'),
    t('Set in Order — tools/items have designated places', 'scale'),
    t('Shine — area clean, no dirt/debris', 'scale'),
    t('Standardize — visual standards in place', 'scale'),
    t('Sustain — previous actions maintained', 'scale', true),
    t('Safety hazards observed in zone (describe)', 'text', true),
  ],
  oee: [
    t('Availability — unplanned downtime recorded', 'scale', true),
    t('Performance — speed losses / minor stops noted', 'scale', true),
    t('Quality — defects / rework recorded', 'scale', true),
    t('Major production loss this period (describe)', 'text', true),
    t('Changeover times within target', 'yes_no'),
    t('Downtime reasons logged accurately', 'yes_no', true),
  ],
  contractor: [
    t('Valid work permit / induction completed', 'yes_no', true),
    t('PPE compliance verified', 'yes_no', true),
    t('Work area isolated / LOTO applied where required', 'yes_no', true),
    t('Quality of completed work', 'scale'),
    t('Safety incidents or near-misses (describe)', 'text', true),
    t('Site left clean and tools accounted for', 'yes_no'),
    t('Documentation / sign-off submitted', 'yes_no', true),
  ],
};
