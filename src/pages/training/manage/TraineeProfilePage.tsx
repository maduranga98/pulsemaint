import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, User, Loader2 } from 'lucide-react';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import type { TrainingAssignment } from '@/lib/training/trainingTypes';
import type { UserProfile } from '@/types/auth';
import type { Timestamp } from 'firebase/firestore';
import TrainingProgressBar from '@/components/training/shared/TrainingProgressBar';
import TrainingStatusBadge from '@/components/training/shared/TrainingStatusBadge';
import PracticalSignOffCard from '@/components/training/manager/PracticalSignOffCard';
import { canSignOffTraining } from '@/lib/training/trainingSignOff';

function formatTs(ts: Timestamp | null | undefined): string {
  if (!ts) return '';
  const d = new Date((ts as unknown as { seconds: number }).seconds * 1000);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function TraineeProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const companyId = useAuthStore((s) => s.userProfile?.companyId);
  const currentUserId = useAuthStore((s) => s.userProfile?.id);
  const currentUserRole = useAuthStore((s) => s.userProfile?.role);
  const currentUserFullName = useAuthStore((s) => s.userProfile?.fullName);

  const [trainee, setTrainee] = useState<UserProfile | null>(null);
  const [assignments, setAssignments] = useState<TrainingAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [signOffLoading, setSignOffLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!userId || !companyId) return;

    const loadTrainee = async () => {
      // Full profiles live under companies/{companyId}/users — the top-level
      // `users/{uid}` doc is only a lightweight uid→companyId/role mapping
      // (see lib/auth.ts), so reading it here left name/email/department blank.
      const snap = await getDoc(doc(db, `companies/${companyId}/users/${userId}`));
      if (snap.exists()) setTrainee({ id: snap.id, ...snap.data() } as UserProfile);
    };

    void loadTrainee();

    const q = query(
      collection(db, 'trainingAssignments'),
      where('traineeId', '==', userId),
      where('companyId', '==', companyId)
    );

    const unsub = onSnapshot(q, (snap) => {
      setAssignments(snap.docs.map((d) => ({ id: d.id, ...d.data() } as TrainingAssignment)));
      setLoading(false);
    });

    return () => unsub();
  }, [userId, companyId]);

  const handleSignOff = async (assignmentId: string, data: { passed: boolean; observations: string }) => {
    if (!currentUserId) return;
    setSignOffLoading(assignmentId);
    try {
      await updateDoc(doc(db, 'trainingAssignments', assignmentId), {
        status: data.passed ? 'certified' : 'quiz_failed',
        practicalSignOff: {
          required: true,
          passed: data.passed,
          observations: data.observations,
          signedOffBy: currentUserId,
          // Without this the issued certificate had a blank "issued by" name.
          signedOffByName: currentUserFullName ?? '',
          signedOffAt: serverTimestamp(),
        },
        updatedAt: serverTimestamp(),
      });
    } finally {
      setSignOffLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  const awaitingSignOff = assignments.filter((a) => a.status === 'awaiting_practical');
  const otherAssignments = assignments.filter((a) => a.status !== 'awaiting_practical');

  return (
    <div className="min-h-full">
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 flex items-center gap-3 px-4 h-12">
        <button
          onClick={() => navigate(-1)}
          className="p-1.5 -ml-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
          aria-label="Back"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="font-semibold text-slate-900 text-sm truncate flex-1">Trainee Profile</h1>
      </div>

      <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
        {/* Trainee header */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
            <User size={24} className="text-slate-400" />
          </div>
          <div>
            <p className="font-semibold text-slate-900">{trainee?.fullName ?? trainee?.email ?? userId}</p>
            <p className="text-sm text-slate-500">{trainee?.email}</p>
            {trainee?.department && (
              <p className="text-xs text-slate-400 mt-0.5">{trainee.department}</p>
            )}
          </div>
          {trainee?.role === 'trainee' && (
            <button
              onClick={() => navigate(`/app/training/manage/trainees/${userId}/programme`)}
              className="ml-auto shrink-0 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Training Programme
            </button>
          )}
        </div>

        {/* Awaiting practical sign-off */}
        {awaitingSignOff.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Awaiting Practical Sign-Off</h2>
            <div className="space-y-3">
              {/* Same rule as the Sign-Off Queue: a plant manager cannot
                  sign off training they assigned themselves. */}
              {awaitingSignOff.map((a) => {
                const permission = canSignOffTraining(a, currentUserRole, currentUserId);
                return permission.allowed ? (
                  <PracticalSignOffCard
                    key={a.id}
                    assignment={a}
                    onSignOff={(data) => handleSignOff(a.id, data)}
                    isLoading={signOffLoading === a.id}
                  />
                ) : (
                  <div key={a.id} className="bg-white rounded-xl border border-slate-200 p-4">
                    <p className="font-medium text-slate-900 text-sm">{a.moduleName}</p>
                    <p className="mt-1 text-sm text-slate-500">{permission.reason}</p>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* All assignments */}
        <section>
          <h2 className="text-sm font-semibold text-slate-700 mb-3">
            All Assignments ({otherAssignments.length})
          </h2>
          {assignments.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">No assignments yet.</p>
          ) : otherAssignments.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">
              No other assignments — see &ldquo;Awaiting Practical Sign-Off&rdquo; above.
            </p>
          ) : (
            <div className="space-y-2">
              {otherAssignments.map((a) => (
                <div key={a.id} className="bg-white rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <p className="font-medium text-slate-900 text-sm line-clamp-1">{a.moduleName || a.moduleId}</p>
                    <TrainingStatusBadge status={a.status} />
                  </div>
                  <TrainingProgressBar progress={a.overallProgress} showLabel />
                  <div className="flex gap-4 mt-2 text-xs text-slate-500">
                    <span>Assigned: {formatTs(a.assignedAt)}</span>
                    {a.dueDate && <span>Due: {formatTs(a.dueDate)}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
