import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, ArrowRight } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useMyAssignments } from '../../hooks/training/useMyAssignments';
import MyModulesList from '../../components/training/learner/MyModulesList';

export default function TraineeDashboard() {
  const firstName = useAuthStore((s) => s.userProfile?.fullName?.split(' ')[0]) ?? 'there';
  const { assignments, loading } = useMyAssignments();

  const stats = useMemo(() => {
    const total = assignments.length;
    const certified = assignments.filter((a) => a.status === 'certified').length;
    const inProgress = assignments.filter(
      (a) => a.status !== 'certified' && a.status !== 'expired' && (a.overallProgress ?? 0) > 0,
    ).length;
    const notStarted = assignments.filter((a) => (a.overallProgress ?? 0) === 0 && a.status !== 'certified').length;
    const avgProgress =
      total > 0
        ? Math.round(assignments.reduce((s, a) => s + (a.overallProgress ?? 0), 0) / total)
        : 0;
    return { total, certified, inProgress, notStarted, avgProgress };
  }, [assignments]);

  const cards = [
    { label: 'Assigned', value: stats.total },
    { label: 'Certified', value: stats.certified },
    { label: 'In Progress', value: stats.inProgress },
    { label: 'Avg Progress', value: `${stats.avgProgress}%` },
  ];

  return (
    <div className="min-h-full">
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-blue-600" /> My Training
          </h1>
          <p className="text-sm text-slate-500">Good {getGreeting()}, {firstName}</p>
        </div>
        <Link
          to="/app/training/my-modules"
          className="inline-flex items-center gap-1 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700"
        >
          Continue learning <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="px-6 py-5 space-y-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((c) => (
            <div key={c.label} className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wide">{c.label}</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{loading ? '—' : c.value}</p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-900 mb-3">Module Progress</h2>
          <MyModulesList assignments={assignments} loading={loading} />
        </div>
      </div>
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
}
