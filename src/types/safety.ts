import type { Timestamp } from 'firebase/firestore';

// ---------------------------------------------------------------------------
// Safety cases — incidents, near-misses, hazards, unsafe acts. The backbone
// of the Safety Officer dashboard's "total safety cases" / "near-miss" counts.
// ---------------------------------------------------------------------------

export type SafetyCaseType = 'incident' | 'near_miss' | 'hazard' | 'unsafe_act';
export type SafetyCaseSeverity = 'low' | 'medium' | 'high' | 'critical';
export type SafetyCaseStatus = 'open' | 'investigating' | 'closed';

export const SAFETY_CASE_TYPES: { value: SafetyCaseType; label: string }[] = [
  { value: 'incident', label: 'Incident' },
  { value: 'near_miss', label: 'Near-Miss' },
  { value: 'hazard', label: 'Hazard' },
  { value: 'unsafe_act', label: 'Unsafe Act / Condition' },
];

export const SAFETY_CASE_SEVERITIES: { value: SafetyCaseSeverity; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

/**
 * "Points" for a safety issue are derived automatically from its severity — a
 * simple escalating weight so higher-severity cases carry more risk points on
 * dashboards and reports. Auto-categorised, never entered by hand.
 */
export const SAFETY_CASE_SEVERITY_POINTS: Record<SafetyCaseSeverity, number> = {
  low: 1,
  medium: 3,
  high: 6,
  critical: 10,
};

export function severityPoints(severity: SafetyCaseSeverity): number {
  return SAFETY_CASE_SEVERITY_POINTS[severity] ?? 0;
}

// What a safety case is "near" / about — drives the conditional picker on the
// report form (a work order, a named person, a contractor, or nothing).
export type SafetyCaseSubjectType =
  | 'work_order'
  | 'operator'
  | 'technician'
  | 'contractor'
  | 'other';

export const SAFETY_CASE_SUBJECT_TYPES: { value: SafetyCaseSubjectType; label: string }[] = [
  { value: 'work_order', label: 'Work Order' },
  { value: 'operator', label: 'Operator' },
  { value: 'technician', label: 'Technician' },
  { value: 'contractor', label: 'Contractor' },
  { value: 'other', label: 'Other' },
];

// An action logged against a safety case by whoever is managing it (safety
// officer, or a manager the case was reported to).
export interface SafetyCaseAction {
  note: string;
  /** Status the case moved to with this action, if it changed. */
  newStatus: SafetyCaseStatus | null;
  by: string;
  byName: string;
  byRole: string;
  at: Timestamp | null;
}

export interface SafetyCase {
  id: string;
  companyId: string;
  siteId: string;
  type: SafetyCaseType;
  title: string;
  description: string;
  severity: SafetyCaseSeverity;
  /** Auto-derived from severity via {@link severityPoints}. */
  points: number;
  status: SafetyCaseStatus;
  location: string;
  machineId: string | null;
  machineName: string | null;
  /** What the case is near/about. */
  subjectType: SafetyCaseSubjectType;
  subjectId: string | null;
  subjectName: string | null;
  correctiveAction: string;
  /** "Action that should be taken" captured at report time. */
  actionToTake: string;
  // Optional escalation to a manager (admin / plant manager / supervisor).
  reportedToRole: string | null;
  reportedToUserId: string | null;
  reportedToName: string | null;
  /** Chronological log of actions taken on the case. */
  actions: SafetyCaseAction[];
  reportedBy: string;
  reportedByName: string;
  reportedByRole: string;
  reportedAt: Timestamp | null;
  updatedAt: Timestamp | null;
  closedAt: Timestamp | null;
}

export type SafetyCaseInput = Omit<
  SafetyCase,
  'id' | 'reportedAt' | 'updatedAt' | 'closedAt'
>;

// ---------------------------------------------------------------------------
// Work permits (Permit-to-Work) — categorised safety permits, distinct from
// the LOTO machine-isolation `permits` collection tied to work orders.
// ---------------------------------------------------------------------------

export type WorkPermitCategory =
  | 'hot_work'
  | 'confined_space'
  | 'electrical_isolation'
  | 'working_at_height'
  | 'excavation'
  | 'chemical_handling'
  | 'general';

export type WorkPermitStatus = 'draft' | 'active' | 'closed' | 'expired';

export const WORK_PERMIT_CATEGORIES: {
  value: WorkPermitCategory;
  label: string;
  /** Category-specific precaution prompts shown on the form. */
  precautions: string[];
}[] = [
  {
    value: 'hot_work',
    label: 'Hot Work',
    precautions: ['Fire extinguisher on site', 'Fire watch assigned', 'Combustibles removed/covered', 'Gas test (if applicable)'],
  },
  {
    value: 'confined_space',
    label: 'Confined Space',
    precautions: ['Atmosphere gas-tested', 'Continuous ventilation', 'Standby/attendant posted', 'Rescue plan in place'],
  },
  {
    value: 'electrical_isolation',
    label: 'Electrical Isolation',
    precautions: ['Isolated & locked out (LOTO)', 'Zero-energy verified', 'Warning tags applied', 'Insulated PPE worn'],
  },
  {
    value: 'working_at_height',
    label: 'Working at Height',
    precautions: ['Fall arrest / harness', 'Anchor points inspected', 'Exclusion zone below', 'Weather suitable'],
  },
  {
    value: 'excavation',
    label: 'Excavation',
    precautions: ['Underground services checked', 'Shoring / benching', 'Edge protection', 'Access/egress provided'],
  },
  {
    value: 'chemical_handling',
    label: 'Chemical Handling',
    precautions: ['SDS reviewed', 'Spill kit available', 'Correct PPE (gloves/goggles/respirator)', 'Ventilation adequate'],
  },
  {
    value: 'general',
    label: 'General Work Permit',
    precautions: ['Risk assessment completed', 'PPE identified', 'Area barricaded (if needed)'],
  },
];

export interface WorkPermit {
  id: string;
  companyId: string;
  siteId: string;
  permitNumber: string;
  category: WorkPermitCategory;
  title: string;
  description: string;
  location: string;
  machineId: string | null;
  status: WorkPermitStatus;
  /** ISO date strings 'YYYY-MM-DD'. */
  validFrom: string;
  validTo: string;
  hazards: string;
  precautions: string[];
  ppeRequired: string;
  requestedBy: string;
  requestedByName: string;
  requestedByRole: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
  closedAt: Timestamp | null;
}

export type WorkPermitInput = Omit<
  WorkPermit,
  'id' | 'permitNumber' | 'createdAt' | 'updatedAt' | 'closedAt'
>;
