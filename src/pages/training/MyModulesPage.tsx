import { useAuthStore } from '@/store/authStore';
import { useMyAssignments } from '@/hooks/training/useMyAssignments';
import { isLearnerOutstanding } from '@/lib/training/assignmentStatus';
import MyModulesList from '@/components/training/learner/MyModulesList';

export default function MyModulesPage() {
  const userProfile = useAuthStore((s) => s.userProfile);
  const { assignments, loading, error } = useMyAssignments();

  const name = userProfile?.fullName?.split(' ')[0] ?? 'there';
  // Anything the learner still has to act on. A module waiting on a manager's
  // practical sign-off isn't one of those — it sits in the Completed tab, so
  // counting it here would tell the learner to complete something they can't.
  const pendingCount = assignments.filter((a) => isLearnerOutstanding(a.status)).length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">My Training</h1>
        {!loading && (
          <p className="mt-1 text-slate-600">
            {pendingCount > 0
              ? `Hello, ${name}. You have ${pendingCount} module${pendingCount > 1 ? 's' : ''} to complete.`
              : `Hello, ${name}. You're all caught up!`}
          </p>
        )}
      </div>
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Could not load your assigned trainings: {error}
        </div>
      )}
      <MyModulesList assignments={assignments} loading={loading} />
    </div>
  );
}
