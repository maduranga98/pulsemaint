import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, limit } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuthStore } from '../../store/authStore';
import JobQueueList from '../../components/dashboard/technician/JobQueueList';
import MyTrainingsWidget from '../../components/dashboard/technician/MyTrainingsWidget';
import MySafetyTrainingsWidget from '../../components/dashboard/technician/MySafetyTrainingsWidget';
import MySafetyCasesWidget from '../../components/dashboard/technician/MySafetyCasesWidget';
import MyProgramWidget from '../../components/dashboard/trainee/MyProgramWidget';
import DashboardWidget from '../../components/dashboard/shared/DashboardWidget';
import EmptyState from '../../components/dashboard/shared/EmptyState';
import type { EvaluationSession } from '../../modules/evaluation/types/evaluation.types';

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
}

function useMyRecentEvaluations(userId: string, limitCount = 3) {
  const [evaluations, setEvaluations] = useState<EvaluationSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    const q = query(
      collection(db, 'evaluations'),
      where('evaluateeId', '==', userId),
      where('status', '==', 'submitted'),
      limit(limitCount),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const docs = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as EvaluationSession))
          .sort((a, b) => (b.evaluationDate > a.evaluationDate ? 1 : -1));
        setEvaluations(docs);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return () => unsub();
  }, [userId, limitCount]);

  return { evaluations, loading };
}

export default function TraineeDashboard() {
  const user = useAuthStore((s) => s.user);
  const userProfile = useAuthStore((s) => s.userProfile);
  // Match the security rule, which authorizes assigned-WO reads on
  // `request.auth.uid` — query on the auth uid, not the profile id.
  const traineeId = user?.uid ?? userProfile?.id ?? '';
  const siteId = userProfile?.siteIds?.[0] ?? userProfile?.companyId ?? '';
  const firstName = userProfile?.fullName?.split(' ')[0] ?? 'Trainee';

  const { evaluations, loading: evalLoading } = useMyRecentEvaluations(traineeId);

  return (
    <div className="min-h-full bg-[#0A1628] text-[#F0F4F8]">
      <div className="px-4 py-4 sm:px-6 lg:px-8">
        <h1 className="text-xl font-bold text-[#F0F4F8] font-[Sora]">Trainee Dashboard</h1>
        <p className="text-sm text-[#8BA3BF] mt-0.5">
          Good {getGreeting()}, {firstName}
        </p>
      </div>

      <div className="px-4 pb-8 sm:px-6 lg:px-8 space-y-6">
        <JobQueueList technicianId={traineeId} siteId={siteId} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <MyProgramWidget />
          <MySafetyCasesWidget />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <MySafetyTrainingsWidget />
          <MyTrainingsWidget />
        </div>

        <DashboardWidget title="My Evaluations" loading={evalLoading}>
          {evaluations.length === 0 ? (
            <EmptyState message="No evaluations recorded yet" />
          ) : (
            <div className="space-y-2">
              {evaluations.map((ev) => (
                <div
                  key={ev.id}
                  className="flex items-center justify-between gap-3 rounded-lg bg-[#0A1628] border border-[#1E3A5F] px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#F0F4F8]">{ev.evaluationDate}</p>
                    {ev.templateName && (
                      <p className="text-xs text-[#8BA3BF] truncate">{ev.templateName}</p>
                    )}
                  </div>
                  <span className="text-sm font-semibold text-[#00C2FF]">{ev.overallScore}%</span>
                </div>
              ))}
            </div>
          )}
        </DashboardWidget>
      </div>
    </div>
  );
}
