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

function formatTs(ts: Timestamp | null | undefined): string {
  if (!ts) return '—';
  const d = new Date((ts as unknown as { seconds: number }).seconds * 1000);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function TraineeProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const companyId = useAuthStore((s) => s.userProfile?.companyId);
  const currentUserId = useAuthStore((s) => s.userProfile?.id);

  const [trainee, setTrainee] = useState<UserProfile | null>(null);
  const [assignments, setAssignments] = useState<TrainingAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [signOffLoading, setSignOffLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!userId || !companyId) return;

    const loadTrainee = async () => {
      const snap = await getDoc(doc(db, 'users', userId));
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
    <div className="min-h-screen bg-slate-50">
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
            <p className="font-semibold text-slate-900">{trainee?.displayName ?? trainee?.email ?? userId}</p>
            <p className="text-sm text-slate-500">{trainee?.email}</p>
            {trainee?.department && (
              <p className="text-xs text-slate-400 mt-0.5">{trainee.department}</p>
            )}
          </div>
        </div>

        {/* Awaiting practical sign-off */}
        {awaitingSignOff.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Awaiting Practical Sign-Off</h2>
            <div className="space-y-3">
              {awaitingSignOff.map((a) => (
                <PracticalSignOffCard
                  key={a.id}
                  assignment={a}
                  onSignOff={(data) => handleSignOff(a.id, data)}
                  isLoading={signOffLoading === a.id}
                />
              ))}
            </div>
          </section>
        )}

        {/* All assignments */}
        <section>
          <h2 className="text-sm font-semibold text-slate-700 mb-3">
            All Assignments ({assignments.length})
          </h2>
          {assignments.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">No assignments yet.</p>
          ) : (
            <div className="space-y-2">
              {otherAssignments.map((a) => (
                <div key={a.id} className="bg-white rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <p className="font-medium text-slate-900 text-sm line-clamp-1">{a.moduleId}</p>
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
