import { collection, query, where, getDocs, type QuerySnapshot, type DocumentData } from 'firebase/firestore';
import { db } from '../lib/firebase';

// Per-person Team Performance row — shared by the Team Performance report
// (technician_performance) and the Analytics "Team Performance" dashboard
// widget, so both surfaces show exactly the same 6 columns computed the
// same way: Name, Role, Evaluation Score, Audit Score, Trainings Completed,
// Quizzes Passed.
export interface UserPerformanceSummary {
  userId: string;
  name: string;
  role: string;
  // Most recent submitted Evaluation's overall score (0-100); 0 if none.
  evaluationScore: number;
  hasEvaluation: boolean;
  // Most recent submitted Audit's score (0-100); 0 if none.
  auditScore: number;
  hasAudit: boolean;
  trainingsCompleted: number;
  quizzesPassed: number;
  // Sum of severity points from safety cases reported "about" this person
  // (subjectType technician/operator/contractor, subjectId === userId) —
  // subtracted from their composite performance score.
  safetyPenaltyPoints: number;
}

export interface RolePerformanceSummary {
  role: string;
  memberCount: number;
  avgEvaluationScore: number;
  evaluationCount: number;
  auditCount: number;
  trainingsCompleted: number;
  quizzesPassed: number;
  avgQuizMark: number;
  quizAttempts: number;
}

// A failed query (rules / missing collection) must not blank the whole
// widget/report — treat it as an empty result instead.
const safeDocs = async (
  promise: Promise<QuerySnapshot<DocumentData>>,
): Promise<Array<Record<string, any>>> => {
  try {
    const snap = await promise;
    return snap.docs.map((d) => ({ ...(d.data() as Record<string, any>), id: d.id }));
  } catch {
    return [];
  }
};

// Shared date-range filter for HR Analytics — plain 'YYYY-MM-DD' bounds
// (inclusive) applied client-side, since these reports already fetch every
// doc for the aggregation and adding server-side range queries on top of
// the existing `where`s would need new composite indexes per report.
export interface DateRange {
  from: string | null;
  to: string | null;
}

const asMillis = (value: unknown): number => {
  if (value && typeof (value as { toDate?: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().getTime();
  }
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string') {
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

// Records with no usable date are kept — a date filter should narrow what
// it can measure, not silently hide undated legacy rows.
const inRange = (millis: number, range?: DateRange | null): boolean => {
  if (!range || (!range.from && !range.to)) return true;
  if (!millis) return true;
  if (range.from && millis < new Date(`${range.from}T00:00:00`).getTime()) return false;
  if (range.to && millis > new Date(`${range.to}T23:59:59.999`).getTime()) return false;
  return true;
};

/**
 * Team Performance, aggregated by role from Evaluations, Audits, Training
 * completions, and Quick Assessment (Triage) results — one row per role.
 * Shared by the dashboard widget and the "Team Performance" report.
 */
export async function fetchTeamPerformanceByRole(
  companyId: string,
  dateRange?: DateRange | null,
): Promise<RolePerformanceSummary[]> {
  const [evals, audits, users, assignments, quizResults] = await Promise.all([
    // The Evaluations module writes to the 'evaluations' collection
    // (see src/modules/evaluation/services/evaluation.service.ts).
    safeDocs(getDocs(
      query(
        collection(db, 'evaluations'),
        where('companyId', '==', companyId),
        where('status', '==', 'submitted'),
      ),
    )),
    // Audits live in the audit_sessions/{plantId}/sessions subcollection.
    safeDocs(getDocs(collection(db, 'audit_sessions', companyId, 'sessions'))),
    // NOTE: the top-level `users` collection is only a thin auth-routing
    // mapping doc ({ uid, companyId, role, siteId } — see src/lib/auth.ts)
    // written for Firestore rules; it does NOT carry fullName. The real user
    // profile (fullName, department, etc.) lives at
    // `companies/{companyId}/users/{uid}`.
    safeDocs(getDocs(collection(db, `companies/${companyId}/users`))),
    // Training completions come from trainingAssignments (the training
    // module's live collection).
    safeDocs(getDocs(
      query(
        collection(db, 'trainingAssignments'),
        where('companyId', '==', companyId),
      ),
    )),
    // Quick Assessment (Triage) attempts + marks live in
    // triage_assessment_results. Fetch every attempt (not just passes)
    // so we can show the average mark, not just a pass count.
    safeDocs(getDocs(
      query(
        collection(db, 'triage_assessment_results'),
        where('companyId', '==', companyId),
      ),
    )),
  ]);

  // Count members per role + build a userId → role lookup so records
  // that only carry a user id can be attributed to a role. Headcount
  // counts only 'active' profiles (excludes inactive/pending — see
  // UserProfile.status), and reflects staff who joined within the date
  // range (undated legacy profiles are always kept — see inRange).
  const roleMemberCount: Record<string, number> = {};
  const userRole = new Map<string, string>();
  users.forEach((u) => {
    const role = (u.role as string) ?? 'other';
    if (u.uid) userRole.set(String(u.uid), role);
    if (u.id) userRole.set(String(u.id), role);
    if (u.status && u.status !== 'active') return;
    if (!inRange(asMillis(u.createdAt), dateRange)) return;
    roleMemberCount[role] = (roleMemberCount[role] ?? 0) + 1;
  });
  const roleOf = (id: unknown) => userRole.get(String(id ?? '')) ?? 'other';

  // Evaluation scores per role, within the date range
  const roleEvalScores: Record<string, { total: number; count: number }> = {};
  evals.forEach((row) => {
    if (!inRange(asMillis(row.submittedAt ?? row.createdAt), dateRange)) return;
    const role = (row.evaluateeRole as string) ?? 'other';
    const score = Number(row.overallScore ?? 0);
    if (!roleEvalScores[role]) roleEvalScores[role] = { total: 0, count: 0 };
    roleEvalScores[role].total += score;
    roleEvalScores[role].count += 1;
  });

  // Audit count per role (by auditor role; submitted sessions only), within the date range
  const roleAuditCount: Record<string, number> = {};
  audits.forEach((row) => {
    if (row.status && row.status !== 'submitted') return;
    if (!inRange(asMillis(row.submittedAt ?? row.createdAt), dateRange)) return;
    const role = (row.auditorRole as string) || roleOf(row.auditorId);
    roleAuditCount[role] = (roleAuditCount[role] ?? 0) + 1;
  });

  // Training completions per role (certified / quiz-passed assignments), within the date range
  const completedTraining = new Set(['certified', 'quiz_passed', 'awaiting_practical']);
  const roleTrainingCount: Record<string, number> = {};
  assignments.forEach((row) => {
    if (!completedTraining.has(String(row.status))) return;
    if (!inRange(asMillis(row.certifiedAt ?? row.completedAt ?? row.quizPassedAt), dateRange)) return;
    const role = roleOf(row.traineeId ?? row.userId);
    roleTrainingCount[role] = (roleTrainingCount[role] ?? 0) + 1;
  });

  // Quick Assessment marks + pass counts per role, within the date range
  const roleQuizCount: Record<string, number> = {};
  const roleQuizMarks: Record<string, { total: number; count: number }> = {};
  quizResults.forEach((row) => {
    if (!inRange(asMillis(row.createdAt ?? row.attemptedAt), dateRange)) return;
    const role = roleOf(row.userId);
    if (row.passed) roleQuizCount[role] = (roleQuizCount[role] ?? 0) + 1;
    const total = Number(row.total ?? 0);
    if (total > 0) {
      const mark = (Number(row.score ?? 0) / total) * 100;
      if (!roleQuizMarks[role]) roleQuizMarks[role] = { total: 0, count: 0 };
      roleQuizMarks[role].total += mark;
      roleQuizMarks[role].count += 1;
    }
  });

  // Collect all roles from all sources
  const allRoles = new Set<string>([
    ...Object.keys(roleMemberCount),
    ...Object.keys(roleEvalScores),
    ...Object.keys(roleAuditCount),
    ...Object.keys(roleTrainingCount),
    ...Object.keys(roleQuizCount),
    ...Object.keys(roleQuizMarks),
  ]);

  return Array.from(allRoles)
    .map((role) => ({
      role,
      memberCount: roleMemberCount[role] ?? 0,
      avgEvaluationScore: roleEvalScores[role]
        ? Math.round(roleEvalScores[role].total / roleEvalScores[role].count)
        : 0,
      evaluationCount: roleEvalScores[role]?.count ?? 0,
      auditCount: roleAuditCount[role] ?? 0,
      trainingsCompleted: roleTrainingCount[role] ?? 0,
      quizzesPassed: roleQuizCount[role] ?? 0,
      avgQuizMark: roleQuizMarks[role]
        ? Math.round(roleQuizMarks[role].total / roleQuizMarks[role].count)
        : 0,
      quizAttempts: roleQuizMarks[role]?.count ?? 0,
    }))
    .sort((a, b) => b.memberCount - a.memberCount);
}

/**
 * Team Performance, one row per user — Name, Role, most-recent Evaluation
 * score, most-recent Audit score, Trainings Completed, Quizzes Passed.
 * Shared by the "Team Performance" report (technician_performance) and the
 * Analytics "Team Performance" dashboard widget (TeamPerformanceAnalyticsWidget).
 */
export async function fetchTeamPerformanceByUser(
  companyId: string,
  dateRange?: DateRange | null,
): Promise<UserPerformanceSummary[]> {
  const [evals, audits, users, assignments, quizResults, safetyCases] = await Promise.all([
    safeDocs(getDocs(
      query(
        collection(db, 'evaluations'),
        where('companyId', '==', companyId),
        where('status', '==', 'submitted'),
      ),
    )),
    safeDocs(getDocs(collection(db, 'audit_sessions', companyId, 'sessions'))),
    // See NOTE in fetchTeamPerformanceByRole above — the real profile (with
    // fullName) lives under companies/{companyId}/users, not the top-level
    // `users` auth-routing collection.
    safeDocs(getDocs(collection(db, `companies/${companyId}/users`))),
    safeDocs(getDocs(
      query(
        collection(db, 'trainingAssignments'),
        where('companyId', '==', companyId),
      ),
    )),
    safeDocs(getDocs(
      query(
        collection(db, 'triage_assessment_results'),
        where('companyId', '==', companyId),
      ),
    )),
    safeDocs(getDocs(
      query(
        collection(db, 'safety_cases'),
        where('companyId', '==', companyId),
      ),
    )),
  ]);

  // Most-recent submitted Evaluation per evaluatee, within the date range.
  const latestEval = new Map<string, { score: number; at: number }>();
  evals.forEach((row) => {
    const userId = String(row.evaluateeId ?? '');
    if (!userId) return;
    const at = asMillis(row.submittedAt ?? row.updatedAt ?? row.createdAt);
    if (!inRange(at, dateRange)) return;
    const existing = latestEval.get(userId);
    if (!existing || at >= existing.at) {
      latestEval.set(userId, { score: Number(row.overallScore ?? 0), at });
    }
  });

  // Most-recent submitted Audit per auditor, within the date range.
  const latestAudit = new Map<string, { score: number; at: number }>();
  audits.forEach((row) => {
    if (row.status && row.status !== 'submitted') return;
    const userId = String(row.auditorId ?? '');
    if (!userId) return;
    const at = asMillis(row.submittedAt ?? row.createdAt);
    if (!inRange(at, dateRange)) return;
    const existing = latestAudit.get(userId);
    if (!existing || at >= existing.at) {
      latestAudit.set(userId, { score: Number(row.score ?? 0), at });
    }
  });

  // Training completions per user, within the date range.
  const completedTraining = new Set(['certified', 'quiz_passed', 'awaiting_practical']);
  const userTrainingCount = new Map<string, number>();
  assignments.forEach((row) => {
    if (!completedTraining.has(String(row.status))) return;
    const userId = String(row.traineeId ?? row.userId ?? '');
    if (!userId) return;
    const at = asMillis(row.certifiedAt ?? row.completedAt ?? row.quizPassedAt);
    if (!inRange(at, dateRange)) return;
    userTrainingCount.set(userId, (userTrainingCount.get(userId) ?? 0) + 1);
  });

  // Quizzes passed per user, within the date range.
  const userQuizPassed = new Map<string, number>();
  quizResults.forEach((row) => {
    if (!row.passed) return;
    const userId = String(row.userId ?? '');
    if (!userId) return;
    if (!inRange(asMillis(row.createdAt ?? row.attemptedAt), dateRange)) return;
    userQuizPassed.set(userId, (userQuizPassed.get(userId) ?? 0) + 1);
  });

  // Safety-case severity points against a person — a case's "Incident is
  // about" subject (technician/operator/contractor) accrues its points as
  // a performance deduction. Cases about a work order or "other" don't
  // name an individual, so they carry no penalty here.
  const PENALIZED_SUBJECT_TYPES = new Set(['technician', 'operator', 'contractor']);
  const userSafetyPenalty = new Map<string, number>();
  safetyCases.forEach((row) => {
    if (!PENALIZED_SUBJECT_TYPES.has(String(row.subjectType ?? ''))) return;
    const userId = String(row.subjectId ?? '');
    if (!userId) return;
    if (!inRange(asMillis(row.reportedAt), dateRange)) return;
    userSafetyPenalty.set(userId, (userSafetyPenalty.get(userId) ?? 0) + Number(row.points ?? 0));
  });

  return users
    .map((u) => {
      const userId = String(u.uid ?? u.id ?? '');
      const evalEntry = latestEval.get(userId);
      const auditEntry = latestAudit.get(userId);
      return {
        userId,
        name: String(u.fullName ?? u.name ?? 'Unknown'),
        role: String(u.role ?? 'other'),
        evaluationScore: evalEntry?.score ?? 0,
        hasEvaluation: Boolean(evalEntry),
        auditScore: auditEntry?.score ?? 0,
        safetyPenaltyPoints: userSafetyPenalty.get(userId) ?? 0,
        hasAudit: Boolean(auditEntry),
        trainingsCompleted: userTrainingCount.get(userId) ?? 0,
        quizzesPassed: userQuizPassed.get(userId) ?? 0,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------------------
// Ongoing (not yet completed) Evaluations & Audits — for the HR dashboard,
// which now shows what's currently in flight instead of a lifetime
// activity-by-role count.
// ---------------------------------------------------------------------------

export interface OngoingActivityRow {
  id: string;
  name: string;
  role: string;
  startedAt: number;
}

export async function fetchOngoingEvaluationsAndAudits(
  companyId: string,
): Promise<{ evaluations: OngoingActivityRow[]; audits: OngoingActivityRow[] }> {
  const [draftEvals, draftAudits] = await Promise.all([
    safeDocs(getDocs(
      query(
        collection(db, 'evaluations'),
        where('companyId', '==', companyId),
        where('status', '==', 'draft'),
      ),
    )),
    // In-progress audits autosave to audit_drafts/{plantId}/drafts (one doc
    // per auditor per category) — audit_sessions only ever gets 'submitted'
    // docs written to it (see src/modules/audit/services/audit.service.ts).
    safeDocs(getDocs(collection(db, 'audit_drafts', companyId, 'drafts'))),
  ]);

  return {
    evaluations: draftEvals
      .map((row) => ({
        id: String(row.id),
        name: String(row.evaluateeName ?? row.templateName ?? 'Evaluation'),
        role: String(row.evaluateeRole ?? 'other'),
        startedAt: asMillis(row.createdAt),
      }))
      .sort((a, b) => b.startedAt - a.startedAt),
    audits: draftAudits
      .map((row) => ({
        id: String(row.id),
        name: String(row.userName ?? row.templateName ?? 'Audit'),
        role: String(row.category ?? 'other'),
        startedAt: asMillis(row.startedAt ?? row.lastSaved),
      }))
      .sort((a, b) => b.startedAt - a.startedAt),
  };
}

// Top-10 leaderboard (marks + safety-case penalty points) is computed by
// src/components/dashboard/manager/TopPerformersWidget.tsx directly from
// fetchTeamPerformanceByUser's safetyPenaltyPoints field — no separate
// fetch needed here.

// ---------------------------------------------------------------------------
// Trainings / Audits / Evaluations by category, split into Ongoing vs.
// Completed counts, for HR Analytics' graphical per-category breakdowns.
// ---------------------------------------------------------------------------

export interface CategoryStatusRow {
  category: string;
  ongoing: number;
  completed: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  machine: 'Machine Training',
  offboard: 'Offboard / External',
};

const bumpStatus = (
  counts: Record<string, { ongoing: number; completed: number }>,
  category: string,
  isCompleted: boolean,
) => {
  if (!counts[category]) counts[category] = { ongoing: 0, completed: 0 };
  if (isCompleted) counts[category].completed += 1;
  else counts[category].ongoing += 1;
};

const toStatusRows = (counts: Record<string, { ongoing: number; completed: number }>): CategoryStatusRow[] =>
  Object.entries(counts).map(([category, v]) => ({ category, ...v }));

/** trainingAssignments joined through their trainingModules doc for `category` ('machine' | 'offboard'; missing = 'machine'). */
export async function fetchTrainingCategoryStatus(
  companyId: string,
  dateRange?: DateRange | null,
): Promise<CategoryStatusRow[]> {
  const completedStatuses = new Set(['certified', 'quiz_passed', 'awaiting_practical']);
  const [assignments, modules] = await Promise.all([
    safeDocs(getDocs(
      query(collection(db, 'trainingAssignments'), where('companyId', '==', companyId)),
    )),
    safeDocs(getDocs(
      query(collection(db, 'trainingModules'), where('companyId', '==', companyId)),
    )),
  ]);

  const moduleCategory = new Map<string, string>();
  modules.forEach((m) => moduleCategory.set(String(m.id), String(m.category ?? 'machine')));

  const counts: Record<string, { ongoing: number; completed: number }> = {};
  assignments.forEach((row) => {
    const isCompleted = completedStatuses.has(String(row.status));
    const at = isCompleted
      ? asMillis(row.certifiedAt ?? row.completedAt ?? row.quizPassedAt)
      : asMillis(row.startedAt ?? row.assignedAt);
    if (!inRange(at, dateRange)) return;
    const rawCategory = moduleCategory.get(String(row.moduleId)) ?? 'machine';
    bumpStatus(counts, CATEGORY_LABELS[rawCategory] ?? rawCategory, isCompleted);
  });

  return toStatusRows(counts);
}

/** Audits by category — in-progress drafts (audit_drafts) vs. submitted sessions (audit_sessions). */
export async function fetchAuditsByCategoryStatus(
  companyId: string,
  dateRange?: DateRange | null,
): Promise<CategoryStatusRow[]> {
  const [drafts, submitted] = await Promise.all([
    safeDocs(getDocs(collection(db, 'audit_drafts', companyId, 'drafts'))),
    safeDocs(getDocs(
      query(collection(db, 'audit_sessions', companyId, 'sessions'), where('status', '==', 'submitted')),
    )),
  ]);

  const counts: Record<string, { ongoing: number; completed: number }> = {};
  drafts.forEach((row) => {
    if (!inRange(asMillis(row.startedAt ?? row.lastSaved), dateRange)) return;
    const category = String(row.category ?? row.templateName ?? 'Other');
    bumpStatus(counts, category, false);
  });
  submitted.forEach((row) => {
    if (!inRange(asMillis(row.submittedAt ?? row.createdAt), dateRange)) return;
    const category = String(row.category ?? row.templateName ?? 'Other');
    bumpStatus(counts, category, true);
  });

  return toStatusRows(counts);
}

/** Evaluations by category (template/evaluatee role) — drafts vs. submitted. */
export async function fetchEvaluationsByCategoryStatus(
  companyId: string,
  dateRange?: DateRange | null,
): Promise<CategoryStatusRow[]> {
  const evals = await safeDocs(getDocs(
    query(collection(db, 'evaluations'), where('companyId', '==', companyId)),
  ));

  const counts: Record<string, { ongoing: number; completed: number }> = {};
  evals.forEach((row) => {
    const isCompleted = row.status === 'submitted';
    if (!isCompleted && row.status !== 'draft') return;
    const at = asMillis(row.submittedAt ?? row.createdAt);
    if (!inRange(at, dateRange)) return;
    const category = String(row.templateName ?? row.evaluateeRole ?? 'Other');
    bumpStatus(counts, category, isCompleted);
  });

  return toStatusRows(counts);
}
