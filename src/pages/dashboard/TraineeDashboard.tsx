import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot, limit } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuthStore } from '../../store/authStore';
import { useMyJobQueue } from '../../hooks/dashboard/useMyJobQueue';
import { useMyAssignments } from '../../hooks/training/useMyAssignments';
import { WOStatusBadge } from '../../components/workorders/WOStatusBadge';
import TrainingStatusBadge from '../../components/training/shared/TrainingStatusBadge';
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
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const userProfile = useAuthStore((s) => s.userProfile);
  // Match the security rule, which authorizes assigned-WO reads on
  // `request.auth.uid` — query on the auth uid, not the profile id.
  const traineeId = user?.uid ?? userProfile?.id ?? '';
  const siteId = userProfile?.siteIds?.[0] ?? userProfile?.companyId ?? '';
  const firstName = userProfile?.fullName?.split(' ')[0] ?? 'Trainee';

  const { workOrders, loading: woLoading } = useMyJobQueue(traineeId, siteId);
  const { assignments, loading: trainingLoading } = useMyAssignments();
  const { evaluations, loading: evalLoading } = useMyRecentEvaluations(traineeId);

  const pendingTrainings = assignments.filter(
    (a) => a.status !== 'certified' && a.status !== 'expired',
  );

  return (
    <div className="min-h-full bg-[#0A1628] text-[#F0F4F8]">
      <div className="px-4 py-4 sm:px-6 lg:px-8">
        <h1 className="text-xl font-bold text-[#F0F4F8] font-[Sora]">Trainee Dashboard</h1>
        <p className="text-sm text-[#8BA3BF] mt-0.5">
          Good {getGreeting()}, {firstName}. Here's what's assigned to you today.
        </p>
      </div>

      <div className="px-4 pb-8 sm:px-6 lg:px-8 space-y-6">
        {/* Today's Work Orders */}
        <section className="bg-[#0F1E35] border border-[#1E3A5F] rounded-xl p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-[#F0F4F8]">My Work Orders</h2>
            <button
              onClick={() => navigate('/app/my-work-orders')}
              className="text-xs text-[#00C2FF] hover:underline"
            >
              View all
            </button>
          </div>
          {woLoading ? (
            <p className="text-sm text-[#8BA3BF]">Loading…</p>
          ) : workOrders.length === 0 ? (
            <p className="text-sm text-[#8BA3BF]">No work orders assigned right now.</p>
          ) : (
            <div className="space-y-2">
              {workOrders.slice(0, 5).map((wo) => (
                <button
                  key={wo.id}
                  onClick={() => navigate('/app/my-work-orders')}
                  className="w-full flex items-center justify-between gap-3 rounded-lg bg-[#0A1628] border border-[#1E3A5F] px-3 py-2.5 text-left hover:border-[#00C2FF] transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#F0F4F8] truncate">{wo.woNumber} — {wo.machineName}</p>
                    <p className="text-xs text-[#8BA3BF] truncate">{wo.description}</p>
                  </div>
                  <WOStatusBadge status={wo.status} size="sm" />
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Today's Trainings */}
        <section className="bg-[#0F1E35] border border-[#1E3A5F] rounded-xl p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-[#F0F4F8]">My Trainings</h2>
            <button
              onClick={() => navigate('/app/training/my-modules')}
              className="text-xs text-[#00C2FF] hover:underline"
            >
              View all
            </button>
          </div>
          {trainingLoading ? (
            <p className="text-sm text-[#8BA3BF]">Loading…</p>
          ) : pendingTrainings.length === 0 ? (
            <p className="text-sm text-[#8BA3BF]">No pending training modules — you're caught up.</p>
          ) : (
            <div className="space-y-2">
              {pendingTrainings.slice(0, 5).map((a) => (
                <button
                  key={a.id}
                  onClick={() => navigate('/app/training/my-modules')}
                  className="w-full flex items-center justify-between gap-3 rounded-lg bg-[#0A1628] border border-[#1E3A5F] px-3 py-2.5 text-left hover:border-[#00C2FF] transition-colors"
                >
                  <p className="text-sm font-medium text-[#F0F4F8] truncate">{a.moduleName}</p>
                  <TrainingStatusBadge status={a.status} />
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Recent Evaluations */}
        <section className="bg-[#0F1E35] border border-[#1E3A5F] rounded-xl p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-[#F0F4F8] mb-3">My Evaluations</h2>
          {evalLoading ? (
            <p className="text-sm text-[#8BA3BF]">Loading…</p>
          ) : evaluations.length === 0 ? (
            <p className="text-sm text-[#8BA3BF]">No evaluations recorded yet.</p>
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
        </section>
      </div>
    </div>
  );
}
