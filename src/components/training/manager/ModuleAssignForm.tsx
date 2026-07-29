import { useEffect, useMemo, useState } from 'react';
import { collection, addDoc, getDocs, onSnapshot, query, serverTimestamp, where } from 'firebase/firestore';
import { X, Loader2, Users, Shield, Building2 } from 'lucide-react';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import { useDepartments } from '@/hooks/useDepartments';
import { notifyUsers } from '@/services/notifications.service';
import type { UserProfile, UserRole } from '@/types/auth';
import type { TrainingModule } from '@/lib/training/trainingTypes';
import { getModuleCategory } from '@/lib/training/offboardTraining';

const ROLE_LABEL: Record<UserRole, string> = {
  admin: 'Admin',
  plant_manager: 'Plant Manager',
  supervisor: 'Supervisor',
  technician: 'Technician',
  store_keeper: 'Store Keeper',
  hr_officer: 'HR Officer',
  trainee: 'Trainee',
  floor_operator: 'Floor Operator',
};
const ROLE_OPTIONS = Object.keys(ROLE_LABEL) as UserRole[];

type TargetMode = 'users' | 'roles' | 'departments';

interface ModuleAssignFormProps {
  module: TrainingModule;
  onClose: () => void;
  onAssigned: () => void;
}

/**
 * Training tab's own module-scoped assign flow — separate from Trainee
 * Management's trainee-first AssignTrainingWizard. Targets any staff by
 * individual user, whole role, or whole department, rather than only
 * trainees.
 */
export default function ModuleAssignForm({ module, onClose, onAssigned }: ModuleAssignFormProps) {
  const userProfile = useAuthStore((s) => s.userProfile);
  const companyId = userProfile?.companyId ?? '';

  const [mode, setMode] = useState<TargetMode>('users');
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const { departments } = useDepartments(companyId);

  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [selectedRoles, setSelectedRoles] = useState<Set<UserRole>>(new Set());
  const [selectedDepartments, setSelectedDepartments] = useState<Set<string>>(new Set());
  const [userSearch, setUserSearch] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notifyTrainee, setNotifyTrainee] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ assigned: number; skipped: number } | null>(null);

  useEffect(() => {
    if (!companyId) return;
    // Everyone except deactivated accounts. Filtering on status == 'active'
    // hid every invited-but-not-yet-accepted person (`pending`) — including
    // every trainee added through the Training Dashboard, which creates them
    // as pending — so the picker came up empty and nothing could be assigned.
    const unsub = onSnapshot(
      collection(db, `companies/${companyId}/users`),
      (snap) => {
        setAllUsers(
          snap.docs
            .map((d) => ({ ...d.data(), id: d.id }) as UserProfile)
            .filter((u) => u.status !== 'inactive')
        );
        setUsersLoading(false);
      },
      () => setUsersLoading(false)
    );
    return () => unsub();
  }, [companyId]);

  const filteredUsers = useMemo(() => {
    const term = userSearch.trim().toLowerCase();
    if (!term) return allUsers;
    return allUsers.filter((u) => u.fullName.toLowerCase().includes(term));
  }, [allUsers, userSearch]);

  const resolvedUsers: UserProfile[] = useMemo(() => {
    if (mode === 'users') return allUsers.filter((u) => selectedUserIds.has(u.id));
    if (mode === 'roles') return allUsers.filter((u) => selectedRoles.has(u.role));
    return allUsers.filter((u) => u.department && selectedDepartments.has(u.department));
  }, [mode, allUsers, selectedUserIds, selectedRoles, selectedDepartments]);

  function toggle<T>(set: Set<T>, value: T, setter: (s: Set<T>) => void) {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setter(next);
  }

  async function handleSubmit() {
    if (resolvedUsers.length === 0 || !userProfile) return;
    setSubmitting(true);
    setError(null);
    try {
      let assigned = 0;
      let skipped = 0;
      for (const trainee of resolvedUsers) {
        const existingSnap = await getDocs(
          query(
            collection(db, 'trainingAssignments'),
            where('companyId', '==', companyId),
            where('traineeId', '==', trainee.id),
            where('moduleId', '==', module.id)
          )
        );
        const hasActive = existingSnap.docs.some((d) => {
          const data = d.data();
          return data.status !== 'certified' && data.status !== 'expired';
        });
        if (hasActive) {
          skipped++;
          continue;
        }

        await addDoc(collection(db, 'trainingAssignments'), {
          companyId,
          moduleId: module.id,
          moduleName: module.title,
          machineId: module.machineId ?? '',
          machineName: module.machineName,
          traineeId: trainee.id,
          traineeName: trainee.fullName,
          traineeEmail: trainee.email ?? '',
          traineeRole: trainee.role,
          department: trainee.department ?? '',
          assignedBy: userProfile.id,
          assignedByName: userProfile.fullName ?? '',
          assignedAt: serverTimestamp(),
          dueDate: dueDate ? new Date(dueDate) : null,
          trainingType: module.trainingType ?? null,
          trainingPeriodMonths: null,
          status: 'not_started',
          isRetraining: false,
          retrainingReason: '',
          retrainingTriggeredAt: null,
          lessonProgress: {},
          overallProgress: 0,
          lessonsCompleted: 0,
          totalLessons: module.lessons?.length ?? 0,
          // The full assignment shape. Leaving the quiz/progress fields out
          // made `attemptsUsed` undefined, so the quiz pre-screen computed
          // `maxAttempts - undefined = NaN`, showed "NaN attempts remaining"
          // and disabled Start Quiz — the assignee could never take the quiz.
          quizAttempts: [],
          bestScore: 0,
          latestScore: 0,
          quizPassed: false,
          quizPassedAt: null,
          attemptsUsed: 0,
          practicalSignOff: module.quiz
            ? {
                required: true,
                signedOffBy: '',
                signedOffByName: '',
                signedOffAt: null,
                observations: '',
                passed: false,
              }
            : null,
          certificateId: null,
          certifiedAt: null,
          certificateExpiryDate: null,
          startedAt: null,
          completedAt: null,
          lastActivityAt: null,
          category: getModuleCategory(module),
          notifyTrainee,
        });
        assigned++;

        if (notifyTrainee) {
          void notifyUsers(companyId, [trainee.id], {
            type: 'training',
            message: `You've been assigned a new training module: ${module.title}`,
            linkTo: '/app/training',
          });
        }
      }
      setResult({ assigned, skipped });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign training.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Assign Module</h2>
            <p className="text-xs text-slate-500 mt-0.5 truncate">{module.title}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        {result ? (
          <div className="p-6 space-y-4">
            <p className="text-sm text-slate-700">
              Assigned to <strong>{result.assigned}</strong> {result.assigned === 1 ? 'person' : 'people'}.
              {result.skipped > 0 && ` ${result.skipped} already had an active assignment for this module and were skipped.`}
            </p>
            <button
              onClick={onAssigned}
              className="w-full px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="p-6 space-y-4">
            <div className="flex gap-2">
              {([
                ['users', 'Users', Users],
                ['roles', 'Roles', Shield],
                ['departments', 'Departments', Building2],
              ] as [TargetMode, string, typeof Users][]).map(([value, label, Icon]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMode(value)}
                  className={`flex-1 flex items-center justify-center gap-1.5 text-sm font-medium rounded-lg px-3 py-2 border transition-colors ${
                    mode === value
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>

            {usersLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : mode === 'users' ? (
              <div>
                <input
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search users…"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-2"
                />
                <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-56 overflow-y-auto">
                  {filteredUsers.map((u) => (
                    <label key={u.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={selectedUserIds.has(u.id)}
                        onChange={() => toggle(selectedUserIds, u.id, setSelectedUserIds)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-900 truncate">{u.fullName}</span>
                      {u.status === 'pending' && (
                        <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                          Invite pending
                        </span>
                      )}
                      <span className="text-xs text-gray-400 ml-auto">{ROLE_LABEL[u.role]}</span>
                    </label>
                  ))}
                </div>
              </div>
            ) : mode === 'roles' ? (
              <div className="grid grid-cols-2 gap-2">
                {ROLE_OPTIONS.map((r) => (
                  <label key={r} className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={selectedRoles.has(r)}
                      onChange={() => toggle(selectedRoles, r, setSelectedRoles)}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-900">{ROLE_LABEL[r]}</span>
                  </label>
                ))}
              </div>
            ) : (
              <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-56 overflow-y-auto">
                {departments.length === 0 ? (
                  <p className="text-center py-6 text-sm text-gray-400">No departments set up yet.</p>
                ) : (
                  departments.map((d) => (
                    <label key={d} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={selectedDepartments.has(d)}
                        onChange={() => toggle(selectedDepartments, d, setSelectedDepartments)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-900">{d}</span>
                    </label>
                  ))
                )}
              </div>
            )}

            <p className="text-sm text-gray-500">
              {resolvedUsers.length} {resolvedUsers.length === 1 ? 'person' : 'people'} will be assigned
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Due Date <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer">
              <span className="text-sm font-medium text-gray-900">Notify assignees</span>
              <input
                type="checkbox"
                checked={notifyTrainee}
                onChange={(e) => setNotifyTrainee(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
            </label>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={onClose} disabled={submitting} className="px-4 py-2 text-sm font-medium border border-slate-300 rounded-lg hover:bg-slate-50">
                Cancel
              </button>
              <button
                onClick={() => void handleSubmit()}
                disabled={submitting || resolvedUsers.length === 0}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Assign
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
