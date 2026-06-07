import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { nanoid } from 'nanoid';
import { UserPlus, X } from 'lucide-react';
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
  const [allAssignments, setAllAssignments] = useState<TrainingAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ fullName: '', email: '', phone: '', department: '', employeeId: '' });
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!companyId) return;
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
        return due < now;
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
      setAllAssignments(assignments);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  async function handleAddTrainee() {
    if (!companyId) return;
    if (!addForm.fullName.trim()) {
      setAddError('Full name is required.');
      return;
    }
    setAddSaving(true);
    setAddError(null);
    try {
      const id = nanoid();
      await setDoc(doc(db, `companies/${companyId}/users/${id}`), {
        id,
        companyId,
        siteIds: [],
        role: 'trainee',
        fullName: addForm.fullName.trim(),
        email: addForm.email.trim() || null,
        phone: addForm.phone.trim() || null,
        employeeId: addForm.employeeId.trim() || null,
        department: addForm.department.trim() || null,
        jobTitle: 'Trainee',
        status: 'pending',
        loginMethod: 'email',
        hasPin: false,
        mustChangePinOnLogin: false,
        profilePhoto: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastLoginAt: null,
        invitedBy: userId ?? null,
      });
      setAddForm({ fullName: '', email: '', phone: '', department: '', employeeId: '' });
      setAddOpen(false);
      await load();
    } catch (err) {
      console.error('Add trainee failed', err);
      setAddError(err instanceof Error ? err.message : 'Failed to add trainee.');
    } finally {
      setAddSaving(false);
    }
  }

  useEffect(() => {
    void load();
  }, [load]);

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
    setAllAssignments((prev) =>
      prev.map((a) => (a.id === assignmentId ? { ...a, status: 'certified' } : a))
    );
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
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900">Training Dashboard</h1>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          <UserPlus className="h-4 w-4" />
          Add Trainee
        </button>
      </div>
      <TrainingDashboard
        stats={stats}
        awaitingSignOff={awaitingSignOff}
        allAssignments={allAssignments}
        onSignOff={(id) => void handleSignOff(id)}
      />

      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between">
              <h2 className="text-lg font-bold text-slate-950">Add Trainee</h2>
              <button
                type="button"
                onClick={() => setAddOpen(false)}
                className="text-slate-400 hover:text-slate-700"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-4 grid gap-3">
              <input
                value={addForm.fullName}
                onChange={(e) => setAddForm((f) => ({ ...f, fullName: e.target.value }))}
                placeholder="Full Name *"
                className="min-h-11 rounded-md border border-slate-200 px-3 text-sm"
              />
              <input
                value={addForm.email}
                onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="Email"
                type="email"
                className="min-h-11 rounded-md border border-slate-200 px-3 text-sm"
              />
              <input
                value={addForm.phone}
                onChange={(e) => setAddForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="Phone"
                className="min-h-11 rounded-md border border-slate-200 px-3 text-sm"
              />
              <input
                value={addForm.department}
                onChange={(e) => setAddForm((f) => ({ ...f, department: e.target.value }))}
                placeholder="Department"
                className="min-h-11 rounded-md border border-slate-200 px-3 text-sm"
              />
              <input
                value={addForm.employeeId}
                onChange={(e) => setAddForm((f) => ({ ...f, employeeId: e.target.value }))}
                placeholder="Employee ID"
                className="min-h-11 rounded-md border border-slate-200 px-3 text-sm"
              />
              {addError && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{addError}</div>
              )}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAddOpen(false)}
                className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleAddTrainee()}
                disabled={addSaving}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {addSaving ? 'Saving…' : 'Add Trainee'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
