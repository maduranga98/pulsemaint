import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import type { TrainingAssignment } from '@/lib/training/trainingTypes';
import type { Timestamp } from 'firebase/firestore';
import TrainingDashboard from '@/components/training/manager/TrainingDashboard';

interface DashboardStats {
  totalTrainees: number;
  activeAssignments: number;
  certsThisMonth: number;
  overdue: number;
  retrainingRequired: number;
  modulesCreated: number;
}

export default function TrainingDashboardPage() {
  const companyId = useAuthStore((s) => s.userProfile?.companyId);
  const userId = useAuthStore((s) => s.userProfile?.id);

  const [stats, setStats] = useState<DashboardStats>({
    totalTrainees: 0,
    activeAssignments: 0,
    certsThisMonth: 0,
    overdue: 0,
    retrainingRequired: 0,
    modulesCreated: 0,
  });
  const [awaitingSignOff, setAwaitingSignOff] = useState<TrainingAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) return;

    const load = async () => {
      try {
        const [assignSnap, certSnap, moduleSnap, usersSnap] = await Promise.all([
          getDocs(query(collection(db, 'trainingAssignments'), where('companyId', '==', companyId))),
          getDocs(query(collection(db, 'trainingCertificates'), where('companyId', '==', companyId))),
          getDocs(query(collection(db, 'trainingModules'), where('companyId', '==', companyId))),
          getDocs(query(collection(db, 'users'), where('companyId', '==', companyId), where('role', 'in', ['trainee', 'floor_operator']))),
        ]);

        const assignments = assignSnap.docs.map((d) => ({ id: d.id, ...d.data() } as TrainingAssignment));
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        const certsThisMonth = certSnap.docs.filter((d) => {
          const ts = d.data().issuedAt as Timestamp | undefined;
          if (!ts) return false;
          return new Date((ts as unknown as { seconds: number }).seconds * 1000) >= monthStart;
        }).length;

        const overdue = assignments.filter((a) => {
          if (!a.dueDate || a.status === 'certified') return false;
          const due = new Date((a.dueDate as unknown as { seconds: number }).seconds * 1000);
          return due < now && a.status !== 'certified';
        }).length;

        const awaiting = assignments.filter((a) => a.status === 'awaiting_practical');

        setStats({
          totalTrainees: usersSnap.size,
          activeAssignments: assignments.filter((a) => a.status === 'in_progress').length,
          certsThisMonth,
          overdue,
          retrainingRequired: assignments.filter((a) => a.status === 'retraining_required').length,
          modulesCreated: moduleSnap.size,
        });
        setAwaitingSignOff(awaiting);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [companyId]);

  const handleSignOff = async (assignmentId: string) => {
    if (!userId) return;
    await updateDoc(doc(db, 'trainingAssignments', assignmentId), {
      status: 'certified',
      'practicalSignOff.passed': true,
      'practicalSignOff.signedOffBy': userId,
      'practicalSignOff.signedOffAt': serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setAwaitingSignOff((prev) => prev.filter((a) => a.id !== assignmentId));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <h1 className="text-xl font-bold text-slate-900 mb-6">Training Dashboard</h1>
      <TrainingDashboard
        stats={stats}
        awaitingSignOff={awaitingSignOff}
        onSignOff={(id) => void handleSignOff(id)}
      />
    </div>
  );
}
