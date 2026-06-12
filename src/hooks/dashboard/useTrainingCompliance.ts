import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type {
  TrainingComplianceStats,
  ComplianceByMachine,
  OperatorTrainingStatus,
  TrainingActivityMonth,
} from '../../types/analytics.types';
import type {
  TrainingAssignment,
  TrainingModule,
} from '../../lib/training/trainingTypes';

const COMPLETED_STATUSES: ReadonlySet<string> = new Set(['certified']);

function toMillis(value: unknown): number | null {
  if (!value) return null;
  if (typeof (value as { toMillis?: () => number }).toMillis === 'function') {
    return (value as { toMillis: () => number }).toMillis();
  }
  const seconds = (value as { seconds?: number }).seconds;
  if (typeof seconds === 'number') return seconds * 1000;
  return null;
}

export function useTrainingCompliance(companyId: string) {
  const [stats, setStats] = useState<TrainingComplianceStats>({
    overallComplianceRate: 0,
    certificationsExpiring30Days: 0,
    certificationsExpired: 0,
    traineesInProgress: 0,
  });
  const [byMachine, setByMachine] = useState<ComplianceByMachine[]>([]);
  const [operators, setOperators] = useState<OperatorTrainingStatus[]>([]);
  const [activity, setActivity] = useState<TrainingActivityMonth[]>([]);
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
      const [assignSnap, moduleSnap] = await Promise.all([
        getDocs(
          query(
            collection(db, 'trainingAssignments'),
            where('companyId', '==', companyId)
          )
        ),
        getDocs(
          query(
            collection(db, 'trainingModules'),
            where('companyId', '==', companyId)
          )
        ),
      ]);

      const assignments = assignSnap.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as TrainingAssignment
      );
      const modules = moduleSnap.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as TrainingModule
      );

      const now = Date.now();
      const thirtyDays = 30 * 24 * 60 * 60 * 1000;

      // ---- Top-line stats ---------------------------------------------------
      const total = assignments.length;
      const completed = assignments.filter((a) =>
        COMPLETED_STATUSES.has(a.status)
      ).length;

      let expired = 0;
      let expiring = 0;
      let inProgress = 0;

      for (const a of assignments) {
        const expiry = toMillis(a.certificateExpiryDate);
        if (COMPLETED_STATUSES.has(a.status) && expiry !== null) {
          if (expiry < now) expired++;
          else if (expiry - now < thirtyDays) expiring++;
        }
        if (a.status === 'in_progress') inProgress++;
      }

      setStats({
        overallComplianceRate: total > 0 ? Math.round((completed / total) * 100) : 0,
        certificationsExpiring30Days: expiring,
        certificationsExpired: expired,
        traineesInProgress: inProgress,
      });

      // ---- Per-module compliance (mapped onto the "by machine" table) -------
      const moduleNameById = new Map(modules.map((m) => [m.id, m.title]));
      const moduleAgg = new Map<
        string,
        { name: string; required: number; certified: number; expiring: number; expired: number }
      >();

      for (const a of assignments) {
        const name = a.moduleName || moduleNameById.get(a.moduleId) || 'Unknown module';
        const key = a.moduleId || name;
        const entry =
          moduleAgg.get(key) ??
          { name, required: 0, certified: 0, expiring: 0, expired: 0 };
        entry.required += 1;
        const expiry = toMillis(a.certificateExpiryDate);
        if (COMPLETED_STATUSES.has(a.status)) {
          if (expiry !== null && expiry < now) entry.expired += 1;
          else {
            entry.certified += 1;
            if (expiry !== null && expiry - now < thirtyDays) entry.expiring += 1;
          }
        }
        moduleAgg.set(key, entry);
      }

      setByMachine(
        Array.from(moduleAgg.values())
          .map((m) => ({
            machineName: m.name,
            requiredOperators: m.required,
            certified: m.certified,
            expiring: m.expiring,
            expired: m.expired,
            compliancePercent:
              m.required > 0 ? Math.round((m.certified / m.required) * 100) : 0,
          }))
          .sort((a, b) => b.requiredOperators - a.requiredOperators)
      );

      // ---- Per-trainee (operator) status ------------------------------------
      const traineeAgg = new Map<
        string,
        {
          name: string;
          role: string;
          certified: number;
          expiring: number;
          hasExpired: boolean;
          openAssignments: number;
          lastTraining: number | null;
        }
      >();

      for (const a of assignments) {
        const key = a.traineeId || a.traineeName;
        const entry =
          traineeAgg.get(key) ??
          {
            name: a.traineeName || 'Unknown',
            role: a.department || 'Trainee',
            certified: 0,
            expiring: 0,
            hasExpired: false,
            openAssignments: 0,
            lastTraining: null as number | null,
          };
        const expiry = toMillis(a.certificateExpiryDate);
        if (COMPLETED_STATUSES.has(a.status)) {
          if (expiry !== null && expiry < now) entry.hasExpired = true;
          else {
            entry.certified += 1;
            if (expiry !== null && expiry - now < thirtyDays) entry.expiring += 1;
          }
          const certifiedAt = toMillis(a.certifiedAt) ?? toMillis(a.completedAt);
          if (certifiedAt !== null) {
            entry.lastTraining =
              entry.lastTraining === null
                ? certifiedAt
                : Math.max(entry.lastTraining, certifiedAt);
          }
        } else if (a.status !== 'expired') {
          entry.openAssignments += 1;
        }
        traineeAgg.set(key, entry);
      }

      setOperators(
        Array.from(traineeAgg.values())
          .map((t) => ({
            operatorName: t.name,
            role: t.role,
            machinesCertified: t.certified,
            expiringSoon: t.expiring,
            lastTrainingDate: null,
            status: (t.hasExpired
              ? 'expired'
              : t.openAssignments > 0 || t.expiring > 0
                ? 'action_required'
                : 'fully_compliant') as OperatorTrainingStatus['status'],
          }))
          .sort((a, b) => a.operatorName.localeCompare(b.operatorName))
      );

      // ---- Monthly activity (last 6 months) ---------------------------------
      const monthLabels: string[] = [];
      const monthBuckets: { newCerts: number; renewals: number }[] = [];
      const monthIndex = new Map<string, number>();
      const base = new Date(now);
      for (let i = 5; i >= 0; i--) {
        const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        monthIndex.set(key, monthLabels.length);
        monthLabels.push(d.toLocaleString('en-US', { month: 'short' }));
        monthBuckets.push({ newCerts: 0, renewals: 0 });
      }

      for (const a of assignments) {
        if (!COMPLETED_STATUSES.has(a.status)) continue;
        const ts = toMillis(a.certifiedAt) ?? toMillis(a.completedAt);
        if (ts === null) continue;
        const d = new Date(ts);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        const idx = monthIndex.get(key);
        if (idx === undefined) continue;
        if (a.isRetraining) monthBuckets[idx].renewals += 1;
        else monthBuckets[idx].newCerts += 1;
      }

      setActivity(
        monthLabels.map((month, i) => ({
          month,
          newCertifications: monthBuckets[i].newCerts,
          renewals: monthBuckets[i].renewals,
        }))
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { stats, byMachine, operators, activity, loading, error, refetch: fetch };
}
