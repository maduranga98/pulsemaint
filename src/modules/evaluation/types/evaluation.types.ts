import type { Timestamp } from 'firebase/firestore';
import type { TFunction } from 'i18next';

export type EvaluationRole =
  | 'operator'
  | 'technician'
  | 'supervisor'
  | 'plant_manager'
  | 'hr_officer'
  | 'safety_officer'
  | 'trainee'
  | 'other';

export const EVALUATION_ROLE_LABELS: Record<EvaluationRole, string> = {
  operator: 'Operator',
  technician: 'Technician',
  supervisor: 'Supervisor',
  plant_manager: 'Plant Manager',
  hr_officer: 'HR Officer',
  safety_officer: 'Safety Officer',
  trainee: 'Trainee',
  other: 'Other',
};

const EVALUATION_ROLE_LABEL_KEYS: Record<EvaluationRole, string> = {
  operator: 'common.evaluation.roles.operator',
  technician: 'common.evaluation.roles.technician',
  supervisor: 'common.evaluation.roles.supervisor',
  plant_manager: 'common.evaluation.roles.plantManager',
  hr_officer: 'common.evaluation.roles.hrOfficer',
  safety_officer: 'common.evaluation.roles.safetyOfficer',
  trainee: 'common.evaluation.roles.trainee',
  other: 'common.evaluation.roles.other',
};

/** Same optional-`t` pattern as `getCategoryLabel` in `audit.types.ts`. */
export function getRoleLabel(role: EvaluationRole, t?: TFunction): string {
  const englishLabel = EVALUATION_ROLE_LABELS[role];
  return t ? t(EVALUATION_ROLE_LABEL_KEYS[role], { defaultValue: englishLabel }) : englishLabel;
}

export type EvaluationCriterionScore = 1 | 2 | 3 | 4 | 5;

export interface EvaluationCriterion {
  id: string;
  label: string;
  description: string;
  weight: number; // 0-100, percentage weight in overall score
  /** i18n key resolving to `label`'s translation, when this is a built-in criterion. Absent for user-authored custom-template criteria. */
  labelKey?: string;
  /** i18n key resolving to `description`'s translation, when this is a built-in criterion. Absent for user-authored custom-template criteria. */
  descriptionKey?: string;
}

/** Resolves a criterion's translated label via its `labelKey`, falling back to the plain `label` for custom (non-built-in) criteria or when `t` is omitted. */
export function getCriterionLabel(criterion: EvaluationCriterion, t?: TFunction): string {
  if (t && criterion.labelKey) return t(criterion.labelKey, { defaultValue: criterion.label });
  return criterion.label;
}

/** Resolves a criterion's translated description via its `descriptionKey`, same fallback rules as `getCriterionLabel`. */
export function getCriterionDescription(criterion: EvaluationCriterion, t?: TFunction): string {
  if (t && criterion.descriptionKey) return t(criterion.descriptionKey, { defaultValue: criterion.description });
  return criterion.description;
}

export interface EvaluationCriterionResult {
  criterionId: string;
  label: string;
  score: EvaluationCriterionScore | null;
  comments: string;
}

export type AttachmentType = 'document' | 'image' | 'video';

export interface EvaluationAttachment {
  id: string;
  type: AttachmentType;
  name: string;
  url: string;
  mimeType: string;
  size: number;
}

export type EvaluationStatus = 'draft' | 'submitted';

/** 'individual' evaluates one person by role; 'department' evaluates a whole department/team. */
export type EvaluationTargetType = 'individual' | 'department';

export type EvaluationActionType = 'training_assigned' | 'position_upgraded' | 'position_degraded';

export interface EvaluationActionLog {
  id: string;
  type: EvaluationActionType;
  note: string;
  actorId: string;
  actorName: string;
  at: Timestamp | null;
}

export interface EvaluationSession {
  id: string;
  companyId: string;
  /** Missing on older documents — treat as 'individual'. */
  targetType?: EvaluationTargetType;
  evaluateeId: string;
  /** For a department evaluation, this holds the department name. */
  evaluateeName: string;
  evaluateeRole: EvaluationRole;
  evaluateeJobTitle: string;
  evaluateeEmployeeId: string | null;
  evaluateeCustomRole: string | null; // for 'other' role

  evaluatorId: string;
  evaluatorName: string;

  criteria: EvaluationCriterionResult[];
  overallScore: number; // 0-100 weighted
  overallComments: string;
  developmentPlan: string;

  attachments: EvaluationAttachment[];

  /** Template used to score this evaluation, if a custom one was picked. */
  templateId: string | null;
  templateName: string | null;

  /** Post-evaluation actions taken against the final mark (PM-124). */
  actionLog: EvaluationActionLog[];

  status: EvaluationStatus;
  evaluationDate: string; // YYYY-MM-DD
  createdAt: Timestamp | null;
  submittedAt: Timestamp | null;
}

// ─── Custom evaluation form templates (PM-122) ──────────────────────────────

export interface EvaluationTemplate {
  id: string;
  companyId: string;
  name: string;
  /** Role this template is intended for, or 'custom' if role-agnostic. */
  role: EvaluationRole | 'custom';
  criteria: EvaluationCriterion[];
  createdBy: string;
  createdByName: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

// ─── Per-role criteria definitions ──────────────────────────────────────────
// Every built-in criterion carries a `labelKey`/`descriptionKey` alongside its
// English `label`/`description` (the fallback); resolve them through
// `getCriterionLabel`/`getCriterionDescription` above rather than reading
// `.label`/`.description` directly wherever a `t` is available.

const OPERATOR_CRITERIA: EvaluationCriterion[] = [
  { id: 'machine_compliance', label: 'Machine Operation Compliance', description: 'Adherence to SOPs and safe operating procedures for assigned machines.', weight: 25, labelKey: 'common.evaluation.criteria.operator.machineCompliance.label', descriptionKey: 'common.evaluation.criteria.operator.machineCompliance.description' },
  { id: 'oee_contribution', label: 'OEE Contribution', description: 'Contribution to Overall Equipment Effectiveness metrics during shifts.', weight: 20, labelKey: 'common.evaluation.criteria.operator.oeeContribution.label', descriptionKey: 'common.evaluation.criteria.operator.oeeContribution.description' },
  { id: 'shift_reporting', label: 'Shift Production Reporting Accuracy', description: 'Accuracy and timeliness of shift production logs and reports.', weight: 20, labelKey: 'common.evaluation.criteria.operator.shiftReporting.label', descriptionKey: 'common.evaluation.criteria.operator.shiftReporting.description' },
  { id: 'downtime_reporting', label: 'Downtime Incident Reporting', description: 'Promptness and accuracy in reporting machine downtime and incidents.', weight: 20, labelKey: 'common.evaluation.criteria.operator.downtimeReporting.label', descriptionKey: 'common.evaluation.criteria.operator.downtimeReporting.description' },
  { id: 'safety_adherence', label: 'Safety Adherence', description: 'Consistent compliance with safety protocols, PPE usage, and hazard awareness.', weight: 15, labelKey: 'common.evaluation.criteria.operator.safetyAdherence.label', descriptionKey: 'common.evaluation.criteria.operator.safetyAdherence.description' },
];

const TECHNICIAN_CRITERIA: EvaluationCriterion[] = [
  { id: 'technical_skill', label: 'Technical Skill Competency', description: 'Demonstrated proficiency in maintenance and repair tasks relevant to assigned equipment.', weight: 25, labelKey: 'common.evaluation.criteria.technician.technicalSkill.label', descriptionKey: 'common.evaluation.criteria.technician.technicalSkill.description' },
  { id: 'wo_quality', label: 'Work Order Completion Quality', description: 'Quality and completeness of work performed on assigned work orders.', weight: 20, labelKey: 'common.evaluation.criteria.technician.woQuality.label', descriptionKey: 'common.evaluation.criteria.technician.woQuality.description' },
  { id: 'breakdown_response', label: 'Breakdown Response Time', description: 'Speed and effectiveness of response to machine breakdowns.', weight: 20, labelKey: 'common.evaluation.criteria.technician.breakdownResponse.label', descriptionKey: 'common.evaluation.criteria.technician.breakdownResponse.description' },
  { id: 'safety_protocol', label: 'Safety Protocol Adherence', description: 'Following LOTO, PPE, and all safety procedures during maintenance work.', weight: 20, labelKey: 'common.evaluation.criteria.technician.safetyProtocol.label', descriptionKey: 'common.evaluation.criteria.technician.safetyProtocol.description' },
  { id: 'tool_handling', label: 'Tool & Equipment Handling', description: 'Proper care, storage, and usage of tools and maintenance equipment.', weight: 15, labelKey: 'common.evaluation.criteria.technician.toolHandling.label', descriptionKey: 'common.evaluation.criteria.technician.toolHandling.description' },
];

const SUPERVISOR_CRITERIA: EvaluationCriterion[] = [
  { id: 'team_leadership', label: 'Team Leadership', description: 'Ability to lead, motivate, and develop team members effectively.', weight: 20, labelKey: 'common.evaluation.criteria.supervisor.teamLeadership.label', descriptionKey: 'common.evaluation.criteria.supervisor.teamLeadership.description' },
  { id: 'task_delegation', label: 'Task Delegation Effectiveness', description: 'Appropriate assignment of tasks based on skills and workload balancing.', weight: 20, labelKey: 'common.evaluation.criteria.supervisor.taskDelegation.label', descriptionKey: 'common.evaluation.criteria.supervisor.taskDelegation.description' },
  { id: 'safety_enforcement', label: 'Safety Enforcement', description: 'Consistent enforcement of safety rules and proactive hazard identification.', weight: 20, labelKey: 'common.evaluation.criteria.supervisor.safetyEnforcement.label', descriptionKey: 'common.evaluation.criteria.supervisor.safetyEnforcement.description' },
  { id: 'shift_handover', label: 'Shift Handover Quality', description: 'Completeness and clarity of shift handover documentation and communication.', weight: 15, labelKey: 'common.evaluation.criteria.supervisor.shiftHandover.label', descriptionKey: 'common.evaluation.criteria.supervisor.shiftHandover.description' },
  { id: 'kpi_monitoring', label: 'KPI Monitoring', description: 'Tracking and acting on key performance indicators for the shift.', weight: 15, labelKey: 'common.evaluation.criteria.supervisor.kpiMonitoring.label', descriptionKey: 'common.evaluation.criteria.supervisor.kpiMonitoring.description' },
  { id: 'escalation_handling', label: 'Escalation Handling', description: 'Effective escalation of issues to management and resolution coordination.', weight: 10, labelKey: 'common.evaluation.criteria.supervisor.escalationHandling.label', descriptionKey: 'common.evaluation.criteria.supervisor.escalationHandling.description' },
];

const PLANT_MANAGER_CRITERIA: EvaluationCriterion[] = [
  { id: 'plant_efficiency', label: 'Overall Plant Efficiency', description: 'Achievement of plant-level output, throughput, and efficiency targets.', weight: 20, labelKey: 'common.evaluation.criteria.plantManager.plantEfficiency.label', descriptionKey: 'common.evaluation.criteria.plantManager.plantEfficiency.description' },
  { id: 'downtime_reduction', label: 'Downtime Reduction Achievements', description: 'Measurable improvements in reducing unplanned downtime.', weight: 20, labelKey: 'common.evaluation.criteria.plantManager.downtimeReduction.label', descriptionKey: 'common.evaluation.criteria.plantManager.downtimeReduction.description' },
  { id: 'budget_adherence', label: 'Maintenance Budget Adherence', description: 'Operating within or optimising the maintenance budget.', weight: 20, labelKey: 'common.evaluation.criteria.plantManager.budgetAdherence.label', descriptionKey: 'common.evaluation.criteria.plantManager.budgetAdherence.description' },
  { id: 'team_development', label: 'Team Development', description: 'Investment in training, mentoring, and developing personnel.', weight: 15, labelKey: 'common.evaluation.criteria.plantManager.teamDevelopment.label', descriptionKey: 'common.evaluation.criteria.plantManager.teamDevelopment.description' },
  { id: 'regulatory_compliance', label: 'Regulatory Compliance', description: 'Ensuring all operations meet legal, safety, and regulatory standards.', weight: 15, labelKey: 'common.evaluation.criteria.plantManager.regulatoryCompliance.label', descriptionKey: 'common.evaluation.criteria.plantManager.regulatoryCompliance.description' },
  { id: 'oee_tracking', label: 'OEE Target Tracking', description: 'Monitoring OEE against targets and driving improvement initiatives.', weight: 10, labelKey: 'common.evaluation.criteria.plantManager.oeeTracking.label', descriptionKey: 'common.evaluation.criteria.plantManager.oeeTracking.description' },
];

const TRAINEE_CRITERIA: EvaluationCriterion[] = [
  { id: 'learning_progress', label: 'Learning Progress', description: 'Rate of progress through assigned training modules and materials.', weight: 25, labelKey: 'common.evaluation.criteria.trainee.learningProgress.label', descriptionKey: 'common.evaluation.criteria.trainee.learningProgress.description' },
  { id: 'practical_skills', label: 'Practical Skill Development', description: 'Application of theoretical knowledge in practical settings.', weight: 25, labelKey: 'common.evaluation.criteria.trainee.practicalSkills.label', descriptionKey: 'common.evaluation.criteria.trainee.practicalSkills.description' },
  { id: 'attendance', label: 'Attendance & Punctuality', description: 'Attendance rate and punctuality during training sessions.', weight: 20, labelKey: 'common.evaluation.criteria.trainee.attendance.label', descriptionKey: 'common.evaluation.criteria.trainee.attendance.description' },
  { id: 'attitude', label: 'Attitude & Engagement', description: 'Motivation, enthusiasm, and active participation in training.', weight: 15, labelKey: 'common.evaluation.criteria.trainee.attitude.label', descriptionKey: 'common.evaluation.criteria.trainee.attitude.description' },
  { id: 'safety_awareness', label: 'Safety Awareness', description: 'Understanding and demonstration of workplace safety practices.', weight: 15, labelKey: 'common.evaluation.criteria.trainee.safetyAwareness.label', descriptionKey: 'common.evaluation.criteria.trainee.safetyAwareness.description' },
];

const HR_OFFICER_CRITERIA: EvaluationCriterion[] = [
  { id: 'recruitment_onboarding', label: 'Recruitment & Onboarding', description: 'Effectiveness of hiring, onboarding, and workforce planning support.', weight: 20, labelKey: 'common.evaluation.criteria.hrOfficer.recruitmentOnboarding.label', descriptionKey: 'common.evaluation.criteria.hrOfficer.recruitmentOnboarding.description' },
  { id: 'training_compliance', label: 'Training & Compliance Management', description: 'Tracking of training completion, certifications, and compliance rates.', weight: 20, labelKey: 'common.evaluation.criteria.hrOfficer.trainingCompliance.label', descriptionKey: 'common.evaluation.criteria.hrOfficer.trainingCompliance.description' },
  { id: 'records_accuracy', label: 'Records & Documentation Accuracy', description: 'Accuracy and upkeep of employee records, contracts, and HR documentation.', weight: 20, labelKey: 'common.evaluation.criteria.hrOfficer.recordsAccuracy.label', descriptionKey: 'common.evaluation.criteria.hrOfficer.recordsAccuracy.description' },
  { id: 'employee_relations', label: 'Employee Relations & Grievance Handling', description: 'Handling of grievances, engagement, and staff welfare fairly and promptly.', weight: 20, labelKey: 'common.evaluation.criteria.hrOfficer.employeeRelations.label', descriptionKey: 'common.evaluation.criteria.hrOfficer.employeeRelations.description' },
  { id: 'policy_adherence', label: 'Policy & Regulatory Adherence', description: 'Ensuring HR policies and labour/regulatory requirements are followed.', weight: 20, labelKey: 'common.evaluation.criteria.hrOfficer.policyAdherence.label', descriptionKey: 'common.evaluation.criteria.hrOfficer.policyAdherence.description' },
];

const SAFETY_OFFICER_CRITERIA: EvaluationCriterion[] = [
  { id: 'incident_management', label: 'Incident & Near-Miss Management', description: 'Timely logging, investigation, and corrective-action follow-through on incidents.', weight: 25, labelKey: 'common.evaluation.criteria.safetyOfficer.incidentManagement.label', descriptionKey: 'common.evaluation.criteria.safetyOfficer.incidentManagement.description' },
  { id: 'inspections_audits', label: 'Safety Inspections & Audits', description: 'Completion and quality of scheduled safety inspections and audits.', weight: 20, labelKey: 'common.evaluation.criteria.safetyOfficer.inspectionsAudits.label', descriptionKey: 'common.evaluation.criteria.safetyOfficer.inspectionsAudits.description' },
  { id: 'hazard_risk', label: 'Hazard Identification & Risk Assessment', description: 'Proactive identification of hazards and rigor of risk assessments.', weight: 20, labelKey: 'common.evaluation.criteria.safetyOfficer.hazardRisk.label', descriptionKey: 'common.evaluation.criteria.safetyOfficer.hazardRisk.description' },
  { id: 'permit_compliance', label: 'Permit-to-Work Compliance', description: 'Correct issuing, review, and closure of work permits (hot work, confined space, LOTO).', weight: 15, labelKey: 'common.evaluation.criteria.safetyOfficer.permitCompliance.label', descriptionKey: 'common.evaluation.criteria.safetyOfficer.permitCompliance.description' },
  { id: 'training_awareness', label: 'Safety Training & Awareness', description: 'Delivery of toolbox talks and driving of a positive safety culture.', weight: 20, labelKey: 'common.evaluation.criteria.safetyOfficer.trainingAwareness.label', descriptionKey: 'common.evaluation.criteria.safetyOfficer.trainingAwareness.description' },
];

const OTHER_CRITERIA: EvaluationCriterion[] = [
  { id: 'job_knowledge', label: 'Job Knowledge', description: 'Knowledge of role-specific duties and responsibilities.', weight: 25, labelKey: 'common.evaluation.criteria.other.jobKnowledge.label', descriptionKey: 'common.evaluation.criteria.other.jobKnowledge.description' },
  { id: 'quality_of_work', label: 'Quality of Work', description: 'Accuracy, thoroughness, and reliability of work output.', weight: 25, labelKey: 'common.evaluation.criteria.other.qualityOfWork.label', descriptionKey: 'common.evaluation.criteria.other.qualityOfWork.description' },
  { id: 'teamwork', label: 'Teamwork & Collaboration', description: 'Cooperation and contribution to team goals.', weight: 20, labelKey: 'common.evaluation.criteria.other.teamwork.label', descriptionKey: 'common.evaluation.criteria.other.teamwork.description' },
  { id: 'safety_compliance', label: 'Safety Compliance', description: 'Adherence to safety rules and safe work practices.', weight: 15, labelKey: 'common.evaluation.criteria.other.safetyCompliance.label', descriptionKey: 'common.evaluation.criteria.other.safetyCompliance.description' },
  { id: 'initiative', label: 'Initiative & Problem Solving', description: 'Proactive identification and resolution of issues.', weight: 15, labelKey: 'common.evaluation.criteria.other.initiative.label', descriptionKey: 'common.evaluation.criteria.other.initiative.description' },
];

// ─── Department-level evaluation criteria ───────────────────────────────────
// Evaluates a whole department/team's performance, distinct from an
// individual's role-based evaluation above.

export const DEPARTMENT_CRITERIA: EvaluationCriterion[] = [
  { id: 'dept_output', label: 'Output & Productivity', description: 'Department met production/output targets for the period.', weight: 25, labelKey: 'common.evaluation.criteria.department.deptOutput.label', descriptionKey: 'common.evaluation.criteria.department.deptOutput.description' },
  { id: 'dept_safety', label: 'Safety Record', description: 'Incident-free operation and adherence to safety protocols across the department.', weight: 20, labelKey: 'common.evaluation.criteria.department.deptSafety.label', descriptionKey: 'common.evaluation.criteria.department.deptSafety.description' },
  { id: 'dept_quality', label: 'Quality Standards', description: 'Consistency in meeting quality standards and reducing defects/rework.', weight: 20, labelKey: 'common.evaluation.criteria.department.deptQuality.label', descriptionKey: 'common.evaluation.criteria.department.deptQuality.description' },
  { id: 'dept_coordination', label: 'Cross-Team Coordination', description: 'Effectiveness of coordination with other departments and shifts.', weight: 15, labelKey: 'common.evaluation.criteria.department.deptCoordination.label', descriptionKey: 'common.evaluation.criteria.department.deptCoordination.description' },
  { id: 'dept_compliance', label: 'Process & Compliance Adherence', description: 'Adherence to SOPs, audits, and regulatory requirements.', weight: 20, labelKey: 'common.evaluation.criteria.department.deptCompliance.label', descriptionKey: 'common.evaluation.criteria.department.deptCompliance.description' },
];

export const ROLE_CRITERIA: Record<EvaluationRole, EvaluationCriterion[]> = {
  operator: OPERATOR_CRITERIA,
  technician: TECHNICIAN_CRITERIA,
  supervisor: SUPERVISOR_CRITERIA,
  plant_manager: PLANT_MANAGER_CRITERIA,
  hr_officer: HR_OFFICER_CRITERIA,
  safety_officer: SAFETY_OFFICER_CRITERIA,
  trainee: TRAINEE_CRITERIA,
  other: OTHER_CRITERIA,
};
