import type { Timestamp } from 'firebase/firestore';

export type EvaluationRole =
  | 'operator'
  | 'technician'
  | 'supervisor'
  | 'plant_manager'
  | 'trainee'
  | 'other';

export const EVALUATION_ROLE_LABELS: Record<EvaluationRole, string> = {
  operator: 'Operator',
  technician: 'Technician',
  supervisor: 'Supervisor',
  plant_manager: 'Plant Manager',
  trainee: 'Trainee',
  other: 'Other',
};

export type EvaluationCriterionScore = 1 | 2 | 3 | 4 | 5;

export interface EvaluationCriterion {
  id: string;
  label: string;
  description: string;
  weight: number; // 0-100, percentage weight in overall score
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

export interface EvaluationSession {
  id: string;
  companyId: string;
  evaluateeId: string;
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

  status: EvaluationStatus;
  evaluationDate: string; // YYYY-MM-DD
  createdAt: Timestamp | null;
  submittedAt: Timestamp | null;
}

// ─── Per-role criteria definitions ──────────────────────────────────────────

const OPERATOR_CRITERIA: EvaluationCriterion[] = [
  { id: 'machine_compliance', label: 'Machine Operation Compliance', description: 'Adherence to SOPs and safe operating procedures for assigned machines.', weight: 25 },
  { id: 'oee_contribution', label: 'OEE Contribution', description: 'Contribution to Overall Equipment Effectiveness metrics during shifts.', weight: 20 },
  { id: 'shift_reporting', label: 'Shift Production Reporting Accuracy', description: 'Accuracy and timeliness of shift production logs and reports.', weight: 20 },
  { id: 'downtime_reporting', label: 'Downtime Incident Reporting', description: 'Promptness and accuracy in reporting machine downtime and incidents.', weight: 20 },
  { id: 'safety_adherence', label: 'Safety Adherence', description: 'Consistent compliance with safety protocols, PPE usage, and hazard awareness.', weight: 15 },
];

const TECHNICIAN_CRITERIA: EvaluationCriterion[] = [
  { id: 'technical_skill', label: 'Technical Skill Competency', description: 'Demonstrated proficiency in maintenance and repair tasks relevant to assigned equipment.', weight: 25 },
  { id: 'wo_quality', label: 'Work Order Completion Quality', description: 'Quality and completeness of work performed on assigned work orders.', weight: 20 },
  { id: 'breakdown_response', label: 'Breakdown Response Time', description: 'Speed and effectiveness of response to machine breakdowns.', weight: 20 },
  { id: 'safety_protocol', label: 'Safety Protocol Adherence', description: 'Following LOTO, PPE, and all safety procedures during maintenance work.', weight: 20 },
  { id: 'tool_handling', label: 'Tool & Equipment Handling', description: 'Proper care, storage, and usage of tools and maintenance equipment.', weight: 15 },
];

const SUPERVISOR_CRITERIA: EvaluationCriterion[] = [
  { id: 'team_leadership', label: 'Team Leadership', description: 'Ability to lead, motivate, and develop team members effectively.', weight: 20 },
  { id: 'task_delegation', label: 'Task Delegation Effectiveness', description: 'Appropriate assignment of tasks based on skills and workload balancing.', weight: 20 },
  { id: 'safety_enforcement', label: 'Safety Enforcement', description: 'Consistent enforcement of safety rules and proactive hazard identification.', weight: 20 },
  { id: 'shift_handover', label: 'Shift Handover Quality', description: 'Completeness and clarity of shift handover documentation and communication.', weight: 15 },
  { id: 'kpi_monitoring', label: 'KPI Monitoring', description: 'Tracking and acting on key performance indicators for the shift.', weight: 15 },
  { id: 'escalation_handling', label: 'Escalation Handling', description: 'Effective escalation of issues to management and resolution coordination.', weight: 10 },
];

const PLANT_MANAGER_CRITERIA: EvaluationCriterion[] = [
  { id: 'plant_efficiency', label: 'Overall Plant Efficiency', description: 'Achievement of plant-level output, throughput, and efficiency targets.', weight: 20 },
  { id: 'downtime_reduction', label: 'Downtime Reduction Achievements', description: 'Measurable improvements in reducing unplanned downtime.', weight: 20 },
  { id: 'budget_adherence', label: 'Maintenance Budget Adherence', description: 'Operating within or optimising the maintenance budget.', weight: 20 },
  { id: 'team_development', label: 'Team Development', description: 'Investment in training, mentoring, and developing personnel.', weight: 15 },
  { id: 'regulatory_compliance', label: 'Regulatory Compliance', description: 'Ensuring all operations meet legal, safety, and regulatory standards.', weight: 15 },
  { id: 'oee_tracking', label: 'OEE Target Tracking', description: 'Monitoring OEE against targets and driving improvement initiatives.', weight: 10 },
];

const TRAINEE_CRITERIA: EvaluationCriterion[] = [
  { id: 'learning_progress', label: 'Learning Progress', description: 'Rate of progress through assigned training modules and materials.', weight: 25 },
  { id: 'practical_skills', label: 'Practical Skill Development', description: 'Application of theoretical knowledge in practical settings.', weight: 25 },
  { id: 'attendance', label: 'Attendance & Punctuality', description: 'Attendance rate and punctuality during training sessions.', weight: 20 },
  { id: 'attitude', label: 'Attitude & Engagement', description: 'Motivation, enthusiasm, and active participation in training.', weight: 15 },
  { id: 'safety_awareness', label: 'Safety Awareness', description: 'Understanding and demonstration of workplace safety practices.', weight: 15 },
];

const OTHER_CRITERIA: EvaluationCriterion[] = [
  { id: 'job_knowledge', label: 'Job Knowledge', description: 'Knowledge of role-specific duties and responsibilities.', weight: 25 },
  { id: 'quality_of_work', label: 'Quality of Work', description: 'Accuracy, thoroughness, and reliability of work output.', weight: 25 },
  { id: 'teamwork', label: 'Teamwork & Collaboration', description: 'Cooperation and contribution to team goals.', weight: 20 },
  { id: 'safety_compliance', label: 'Safety Compliance', description: 'Adherence to safety rules and safe work practices.', weight: 15 },
  { id: 'initiative', label: 'Initiative & Problem Solving', description: 'Proactive identification and resolution of issues.', weight: 15 },
];

export const ROLE_CRITERIA: Record<EvaluationRole, EvaluationCriterion[]> = {
  operator: OPERATOR_CRITERIA,
  technician: TECHNICIAN_CRITERIA,
  supervisor: SUPERVISOR_CRITERIA,
  plant_manager: PLANT_MANAGER_CRITERIA,
  trainee: TRAINEE_CRITERIA,
  other: OTHER_CRITERIA,
};
