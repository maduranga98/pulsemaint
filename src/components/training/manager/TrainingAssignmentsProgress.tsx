import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where, type Timestamp } from 'firebase/firestore';
import { ClipboardList } from 'lucide-react';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import { useTrainingLibraryModules } from '@/hooks/training/useTrainingLibraryModules';
import TrainingStatusBadge from '@/components/training/shared/TrainingStatusBadge';
import type { TrainingAssignment } from '@/lib/training/trainingTypes';

function formatDate(ts: Timestamp | null | undefined): string {
  if (!ts) return '—';
  return (ts as unknown as { toDate: () => Date }).toDate().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function finalDecision(a: TrainingAssignment): string {
  if (a.status === 'certified') {
    return a.practicalSignOff?.signedOffByName
      ? `Certified — signed off by ${a.practicalSignOff.signedOffByName}`
      : 'Certified';
  }
  if (a.status === 'retraining_required') return 'Retraining required';
  if (a.status === 'quiz_failed') return 'Failed';
  if (a.status === 'expired') return 'Expired';
  return '—';
}

/** Marks are only meaningful once the learner has actually attempted the
 *  quiz — a score of 0 with attempts used is a real result, not "no data". */
function marks(a: TrainingAssignment): string {
  if ((a.attemptsUsed ?? 0) === 0 && !a.quizPassed) return '—';
  return `${a.bestScore ?? 0}%`;
}

/**
 * Live per-assignment progress table for the Training tab's own module
 * library (libraryScope: 'training') — module topic, who it's assigned to,
 * who assigned it, assigned/completed dates, marks, and the final decision
 * (certified/failed/retraining, and who signed it off). Trainee Management
 * has its own equivalent view (TraineeManagementList) scoped to its own
 * library and to the trainee role.
 */
export default function TrainingAssignmentsProgress() {
  const companyId = useAuthStore((s) => s.userProfile?.companyId) ?? '';
  const { modules } = useTrainingLibraryModules();
  const [assignments, setAssignments] = useState<TrainingAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  const moduleIds = new Set(modules.map((m) => m.id));

  useEffect(() => {
    if (!companyId) return;
    const unsub = onSnapshot(
      query(collection(db, 'trainingAssignments'), where('companyId', '==', companyId)),
      (snap) => {
        setAssignments(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as TrainingAssignment));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, [companyId]);

  const rows = assignments
    .filter((a) => moduleIds.has(a.moduleId))
    .sort((a, b) => ((b.assignedAt as any)?.toMillis?.() ?? 0) - ((a.assignedAt as any)?.toMillis?.() ?? 0));

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 flex justify-center">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <h2 className="text-base font-semibold text-gray-800">Assignment Progress</h2>
        <span className="text-xs text-gray-400">{rows.length} assignment{rows.length !== 1 ? 's' : ''}</span>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-gray-400">
          <ClipboardList className="w-8 h-8 mb-2" />
          <p className="text-sm">No modules assigned yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">Module</th>
                <th className="px-4 py-3 text-left">Assigned To</th>
                <th className="px-4 py-3 text-left">Assigned By</th>
                <th className="px-4 py-3 text-left">Assigned</th>
                <th className="px-4 py-3 text-left">Completed</th>
                <th className="px-4 py-3 text-left">Progress</th>
                <th className="px-4 py-3 text-left">Marks</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Final Decision</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((a) => (
                <tr key={a.id}>
                  <td className="px-4 py-3 font-medium text-gray-900">{a.moduleName}</td>
                  <td className="px-4 py-3 text-gray-700">{a.traineeName}</td>
                  <td className="px-4 py-3 text-gray-500">{a.assignedByName}</td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(a.assignedAt)}</td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {formatDate(a.completedAt ?? a.certifiedAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${Math.min(100, Math.max(0, a.overallProgress ?? 0))}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500">{a.overallProgress ?? 0}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{marks(a)}</td>
                  <td className="px-4 py-3"><TrainingStatusBadge status={a.status} /></td>
                  <td className="px-4 py-3 text-gray-500">{finalDecision(a)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
