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

/** Marks are only meaningful once the learner has actually attempted the
 *  quiz — a score of 0 with attempts used is a real result, not "no data". */
function marks(a: TrainingAssignment): string {
  if ((a.attemptsUsed ?? 0) === 0 && !a.quizPassed) return '—';
  return `${a.bestScore ?? 0}%`;
}

/**
 * Live per-assignment progress table for the Training tab's own module
 * library (libraryScope: 'training') — module topic, who it's assigned to,
 * who assigned it, assigned/completed dates, progress, marks, and status.
 * Trainee Management has its own equivalent view (TraineeManagementList)
 * scoped to its own library and to the trainee role.
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

  const completedCount = rows.filter((a) => a.status === 'completed').length;
  const inProgressCount = rows.filter((a) => a.status === 'in_progress').length;

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 flex justify-center">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <ClipboardList className="h-6 w-6 text-blue-600" />
        <h2 className="text-xl font-bold text-slate-900">Training Progress</h2>
      </div>

      <div className="mb-5 grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-center">
          <div className="text-2xl font-bold text-slate-900">{rows.length}</div>
          <div className="text-xs text-slate-500">Assignments</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-center">
          <div className="text-2xl font-bold text-slate-900">{inProgressCount}</div>
          <div className="text-xs text-slate-500">In progress</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-center">
          <div className="text-2xl font-bold text-slate-900">{completedCount}</div>
          <div className="text-xs text-slate-500">Completed</div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-slate-400">
            <ClipboardList className="w-8 h-8 mb-2" />
            <p className="text-sm">No modules assigned yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-400">
                  <th className="px-4 py-3 font-medium">Module</th>
                  <th className="px-4 py-3 font-medium">Assigned To</th>
                  <th className="px-4 py-3 font-medium">Assigned By</th>
                  <th className="px-4 py-3 font-medium">Assigned</th>
                  <th className="px-4 py-3 font-medium">Completed</th>
                  <th className="px-4 py-3 font-medium">Progress</th>
                  <th className="px-4 py-3 font-medium">Marks</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-4 py-3 font-medium text-slate-900">{a.moduleName}</td>
                    <td className="px-4 py-3 text-slate-700">{a.traineeName}</td>
                    <td className="px-4 py-3 text-slate-500">{a.assignedByName}</td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDate(a.assignedAt)}</td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                      {formatDate(a.completedAt ?? a.certifiedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full"
                            style={{ width: `${Math.min(100, Math.max(0, a.overallProgress ?? 0))}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-500">{a.overallProgress ?? 0}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{marks(a)}</td>
                    <td className="px-4 py-3"><TrainingStatusBadge status={a.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
