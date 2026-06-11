import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
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
      const [evalsSnap, auditsSnap, usersSnap, trainingSnap, triageSnap] = await Promise.all([
        getDocs(
          query(
            collection(db, 'evaluation_sessions'),
            where('companyId', '==', companyId),
            where('status', '==', 'submitted'),
          ),
        ),
        getDocs(
          query(
            collection(db, 'audit_sessions'),
            where('plantId', '==', companyId),
            where('status', '==', 'submitted'),
          ),
        ),
        getDocs(query(collection(db, 'users'), where('companyId', '==', companyId))),
        getDocs(
          query(
            collection(db, 'training_records'),
            where('companyId', '==', companyId),
            where('status', '==', 'completed'),
          ),
        ),
        getDocs(
          query(
            collection(db, 'triage_sessions'),
            where('companyId', '==', companyId),
          ),
        ),
      ]);

      // Count members per role
      const roleMemberCount: Record<string, number> = {};
      usersSnap.docs.forEach((d) => {
        const role = (d.data().role as string) ?? 'other';
        roleMemberCount[role] = (roleMemberCount[role] ?? 0) + 1;
      });

      // Evaluation scores per role
      const roleEvalScores: Record<string, { total: number; count: number }> = {};
      evalsSnap.docs.forEach((d) => {
        const row = d.data();
        const role = (row.evaluateeRole as string) ?? 'other';
        const score = Number(row.overallScore ?? 0);
        if (!roleEvalScores[role]) roleEvalScores[role] = { total: 0, count: 0 };
        roleEvalScores[role].total += score;
        roleEvalScores[role].count += 1;
      });

      // Audit count per role (by auditor role)
      const roleAuditCount: Record<string, number> = {};
      auditsSnap.docs.forEach((d) => {
        const role = (d.data().auditorRole as string) ?? 'other';
        roleAuditCount[role] = (roleAuditCount[role] ?? 0) + 1;
      });

      // Training completions per role (from training_records linked to user)
      const roleTrainingCount: Record<string, number> = {};
      trainingSnap.docs.forEach((d) => {
        const row = d.data();
        const role = (row.userRole as string) ?? 'other';
        roleTrainingCount[role] = (roleTrainingCount[role] ?? 0) + 1;
      });

      // Quiz (triage) passes per role
      const roleQuizCount: Record<string, number> = {};
      triageSnap.docs.forEach((d) => {
        const row = d.data();
        const role = (row.technicianRole as string) ?? (row.userRole as string) ?? 'other';
        if (row.passed === true || row.status === 'passed') {
          roleQuizCount[role] = (roleQuizCount[role] ?? 0) + 1;
        }
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
