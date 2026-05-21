import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import type {
  TrainingAssignment,
  TrainingCertificate,
  TrainingModule,
  AssignmentStatus,
} from '@/lib/training/trainingTypes';
import type { Timestamp } from 'firebase/firestore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ComplianceStats {
  totalTrainees: number;
  certified: number;
  notCertified: number;
  expiringSoon: number;
  overdueAssignments: number;
  retrainingRequired: number;
}

export interface ComplianceMatrixRow {
  traineeId: string;
  traineeName: string;
  department: string;
  modules: Record<
    string,
    {
      status: AssignmentStatus | 'not_assigned';
      certifiedAt?: Timestamp;
      expiryDate?: Timestamp | null;
    }
  >;
}

export interface UseComplianceDataOptions {
  department?: string;
  machineTypeId?: string;
}

interface UseComplianceDataResult {
  stats: ComplianceStats;
  matrixRows: ComplianceMatrixRow[];
  moduleHeaders: { moduleId: string; moduleName: string }[];
  loading: boolean;
  error: string | null;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_STATS: ComplianceStats = {
  totalTrainees: 0,
  certified: 0,
  notCertified: 0,
  expiringSoon: 0,
  overdueAssignments: 0,
  retrainingRequired: 0,
};

const EXPIRING_SOON_DAYS = 30;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useComplianceData(
  options: UseComplianceDataOptions = {}
): UseComplianceDataResult {
  const { department, machineTypeId } = options;
  const companyId = useAuthStore((s) => s.userProfile?.companyId);

  const [stats, setStats] = useState<ComplianceStats>(DEFAULT_STATS);
  const [matrixRows, setMatrixRows] = useState<ComplianceMatrixRow[]>([]);
  const [moduleHeaders, setModuleHeaders] = useState<
    { moduleId: string; moduleName: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        // 1. Fetch all active assignments
        const assignmentsSnap = await getDocs(
          query(
            collection(db, 'trainingAssignments'),
            where('companyId', '==', companyId)
          )
        );
        let assignments = assignmentsSnap.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as TrainingAssignment
        );

        // 2. Fetch all active (non-revoked) certificates
        const certsSnap = await getDocs(
          query(
            collection(db, 'trainingCertificates'),
            where('companyId', '==', companyId),
            where('isRevoked', '==', false)
          )
        );
        const certificates = certsSnap.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as TrainingCertificate
        );

        // 3. Fetch active training modules
        const modulesSnap = await getDocs(
          query(
            collection(db, 'trainingModules'),
            where('companyId', '==', companyId),
            where('status', '==', 'active')
          )
        );
        let modules = modulesSnap.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as TrainingModule
        );

        if (cancelled) return;

        // Apply filters
        if (department) {
          assignments = assignments.filter(
            (a) => a.department === department
          );
        }
        if (machineTypeId) {
          const validModuleIds = new Set(
            modules
              .filter((m) => m.machineTypeId === machineTypeId)
              .map((m) => m.id)
          );
          assignments = assignments.filter((a) =>
            validModuleIds.has(a.moduleId)
          );
          modules = modules.filter((m) => m.machineTypeId === machineTypeId);
        }

        // Build a certificate lookup: assignmentId → certificate
        const certByAssignment = new Map<string, TrainingCertificate>();
        for (const cert of certificates) {
          certByAssignment.set(cert.assignmentId, cert);
        }

        // Build compliance matrix grouped by trainee
        const traineeMap = new Map<
          string,
          { traineeName: string; department: string; assignments: TrainingAssignment[] }
        >();

        for (const assignment of assignments) {
          const existing = traineeMap.get(assignment.traineeId);
          if (existing) {
            existing.assignments.push(assignment);
          } else {
            traineeMap.set(assignment.traineeId, {
              traineeName: assignment.traineeName,
              department: assignment.department,
              assignments: [assignment],
            });
          }
        }

        // Module headers ordered by title
        const moduleMap = new Map(modules.map((m) => [m.id, m.title]));
        const headers = modules
          .slice()
          .sort((a, b) => a.title.localeCompare(b.title))
          .map((m) => ({ moduleId: m.id, moduleName: m.title }));

        // Build matrix rows
        const rows: ComplianceMatrixRow[] = [];
        const nowMs = Date.now();
        const expiringSoonMs = EXPIRING_SOON_DAYS * 24 * 60 * 60 * 1000;

        for (const [traineeId, data] of traineeMap.entries()) {
          const moduleStatuses: ComplianceMatrixRow['modules'] = {};

          for (const moduleId of moduleMap.keys()) {
            // Find the most recent assignment for this trainee + module
            const relevant = data.assignments
              .filter((a) => a.moduleId === moduleId)
              .sort((a, b) => {
                const aMs = a.assignedAt?.toMillis?.() ?? 0;
                const bMs = b.assignedAt?.toMillis?.() ?? 0;
                return bMs - aMs;
              });

            if (relevant.length === 0) {
              moduleStatuses[moduleId] = { status: 'not_assigned' };
            } else {
              const latest = relevant[0];
              const cert = certByAssignment.get(latest.id);
              moduleStatuses[moduleId] = {
                status: latest.status,
                certifiedAt: cert?.issuedAt,
                expiryDate: cert?.expiryDate ?? null,
              };
            }
          }

          rows.push({
            traineeId,
            traineeName: data.traineeName,
            department: data.department,
            modules: moduleStatuses,
          });
        }

        rows.sort((a, b) => a.traineeName.localeCompare(b.traineeName));

        // Compute stats
        const uniqueTraineeIds = new Set(assignments.map((a) => a.traineeId));
        const totalTrainees = uniqueTraineeIds.size;

        const certifiedTraineeIds = new Set(
          assignments
            .filter((a) => a.status === 'certified')
            .map((a) => a.traineeId)
        );

        const certified = certifiedTraineeIds.size;
        const notCertified = totalTrainees - certified;

        let expiringSoon = 0;
        for (const cert of certificates) {
          if (cert.expiryDate) {
            const expiryMs = cert.expiryDate.toMillis();
            if (expiryMs > nowMs && expiryMs - nowMs <= expiringSoonMs) {
              expiringSoon += 1;
            }
          }
        }

        const overdueAssignments = assignments.filter((a) => {
          if (!a.dueDate) return false;
          const dueMs = a.dueDate.toMillis();
          return (
            dueMs < nowMs &&
            a.status !== 'certified' &&
            a.status !== 'expired'
          );
        }).length;

        const retrainingRequired = assignments.filter(
          (a) => a.status === 'retraining_required'
        ).length;

        if (!cancelled) {
          setStats({
            totalTrainees,
            certified,
            notCertified,
            expiringSoon,
            overdueAssignments,
            retrainingRequired,
          });
          setMatrixRows(rows);
          setModuleHeaders(headers);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load compliance data');
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [companyId, department, machineTypeId]);

  return { stats, matrixRows, moduleHeaders, loading, error };
}
