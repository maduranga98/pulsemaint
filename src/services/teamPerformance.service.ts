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

/**
 * Team Performance, aggregated by role from Evaluations, Audits, Training
 * completions, and Quick Assessment (Triage) results — one row per role.
 * Shared by the dashboard widget and the "Team Performance" report.
 */
export async function fetchTeamPerformanceByRole(companyId: string): Promise<RolePerformanceSummary[]> {
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
    safeDocs(getDocs(query(collection(db, 'users'), where('companyId', '==', companyId)))),
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
  // that only carry a user id can be attributed to a role.
  const roleMemberCount: Record<string, number> = {};
  const userRole = new Map<string, string>();
  users.forEach((u) => {
    const role = (u.role as string) ?? 'other';
    roleMemberCount[role] = (roleMemberCount[role] ?? 0) + 1;
    if (u.uid) userRole.set(String(u.uid), role);
    if (u.id) userRole.set(String(u.id), role);
  });
  const roleOf = (id: unknown) => userRole.get(String(id ?? '')) ?? 'other';

  // Evaluation scores per role
  const roleEvalScores: Record<string, { total: number; count: number }> = {};
  evals.forEach((row) => {
    const role = (row.evaluateeRole as string) ?? 'other';
    const score = Number(row.overallScore ?? 0);
    if (!roleEvalScores[role]) roleEvalScores[role] = { total: 0, count: 0 };
    roleEvalScores[role].total += score;
    roleEvalScores[role].count += 1;
  });

  // Audit count per role (by auditor role; submitted sessions only)
  const roleAuditCount: Record<string, number> = {};
  audits.forEach((row) => {
    if (row.status && row.status !== 'submitted') return;
    const role = (row.auditorRole as string) || roleOf(row.auditorId);
    roleAuditCount[role] = (roleAuditCount[role] ?? 0) + 1;
  });

  // Training completions per role (certified / quiz-passed assignments)
  const completedTraining = new Set(['certified', 'quiz_passed', 'awaiting_practical']);
  const roleTrainingCount: Record<string, number> = {};
  assignments.forEach((row) => {
    if (!completedTraining.has(String(row.status))) return;
    const role = roleOf(row.traineeId ?? row.userId);
    roleTrainingCount[role] = (roleTrainingCount[role] ?? 0) + 1;
  });

  // Quick Assessment marks + pass counts per role
  const roleQuizCount: Record<string, number> = {};
  const roleQuizMarks: Record<string, { total: number; count: number }> = {};
  quizResults.forEach((row) => {
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
export async function fetchTeamPerformanceByUser(companyId: string): Promise<UserPerformanceSummary[]> {
  const [evals, audits, users, assignments, quizResults] = await Promise.all([
    safeDocs(getDocs(
      query(
        collection(db, 'evaluations'),
        where('companyId', '==', companyId),
        where('status', '==', 'submitted'),
      ),
    )),
    safeDocs(getDocs(collection(db, 'audit_sessions', companyId, 'sessions'))),
    safeDocs(getDocs(query(collection(db, 'users'), where('companyId', '==', companyId)))),
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
  ]);

  const asMillis = (value: unknown): number => {
    if (value && typeof (value as { toDate?: () => Date }).toDate === 'function') {
      return (value as { toDate: () => Date }).toDate().getTime();
    }
    if (value instanceof Date) return value.getTime();
    const parsed = new Date(String(value ?? ''));
    return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
  };

  // Most-recent submitted Evaluation per evaluatee.
  const latestEval = new Map<string, { score: number; at: number }>();
  evals.forEach((row) => {
    const userId = String(row.evaluateeId ?? '');
    if (!userId) return;
    const at = asMillis(row.submittedAt ?? row.updatedAt ?? row.createdAt);
    const existing = latestEval.get(userId);
    if (!existing || at >= existing.at) {
      latestEval.set(userId, { score: Number(row.overallScore ?? 0), at });
    }
  });

  // Most-recent submitted Audit per auditor.
  const latestAudit = new Map<string, { score: number; at: number }>();
  audits.forEach((row) => {
    if (row.status && row.status !== 'submitted') return;
    const userId = String(row.auditorId ?? '');
    if (!userId) return;
    const at = asMillis(row.submittedAt ?? row.createdAt);
    const existing = latestAudit.get(userId);
    if (!existing || at >= existing.at) {
      latestAudit.set(userId, { score: Number(row.score ?? 0), at });
    }
  });

  // Training completions per user.
  const completedTraining = new Set(['certified', 'quiz_passed', 'awaiting_practical']);
  const userTrainingCount = new Map<string, number>();
  assignments.forEach((row) => {
    if (!completedTraining.has(String(row.status))) return;
    const userId = String(row.traineeId ?? row.userId ?? '');
    if (!userId) return;
    userTrainingCount.set(userId, (userTrainingCount.get(userId) ?? 0) + 1);
  });

  // Quizzes passed per user.
  const userQuizPassed = new Map<string, number>();
  quizResults.forEach((row) => {
    if (!row.passed) return;
    const userId = String(row.userId ?? '');
    if (!userId) return;
    userQuizPassed.set(userId, (userQuizPassed.get(userId) ?? 0) + 1);
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
        hasAudit: Boolean(auditEntry),
        trainingsCompleted: userTrainingCount.get(userId) ?? 0,
        quizzesPassed: userQuizPassed.get(userId) ?? 0,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
