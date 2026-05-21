import { useAuthStore } from '@/store/authStore';
import { useMyAssignments } from '@/hooks/training/useMyAssignments';
import MyModulesList from '@/components/training/learner/MyModulesList';

export default function MyModulesPage() {
  const userProfile = useAuthStore((s) => s.userProfile);
  const { assignments, loading } = useMyAssignments();

  const name = userProfile?.fullName?.split(' ')[0] ?? 'there';
  const pendingCount = assignments.filter(
    (a) => a.status !== 'certified' && a.status !== 'expired'
  ).length;

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
      <MyModulesList assignments={assignments} loading={loading} />
    </div>
  );
}
