import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, getDocs, type QuerySnapshot, type DocumentData } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export interface RolePerformanceSummary {
  role: string;
  memberCount: number;
  avgEvaluationScore: number;
  evaluationCount: number;
  auditCount: number;
  trainingsCompleted: number;
  quizzesPassed: number;
}

// A failed query (rules / missing collection) must not blank the whole
// widget — treat it as an empty result instead.
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

export function useTeamPerformanceAnalytics(companyId: string) {
  const [data, setData] = useState<RolePerformanceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
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
        // Quiz passes are recorded in triage_assessment_results.
        safeDocs(getDocs(
          query(
            collection(db, 'triage_assessment_results'),
            where('companyId', '==', companyId),
            where('passed', '==', true),
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

      // Quiz passes per role
      const roleQuizCount: Record<string, number> = {};
      quizResults.forEach((row) => {
        const role = roleOf(row.userId);
        roleQuizCount[role] = (roleQuizCount[role] ?? 0) + 1;
      });

      // Collect all roles from all sources
      const allRoles = new Set<string>([
        ...Object.keys(roleMemberCount),
        ...Object.keys(roleEvalScores),
        ...Object.keys(roleAuditCount),
        ...Object.keys(roleTrainingCount),
        ...Object.keys(roleQuizCount),
      ]);

      const summary: RolePerformanceSummary[] = Array.from(allRoles)
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
        }))
        .sort((a, b) => b.memberCount - a.memberCount);

      setData(summary);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}
