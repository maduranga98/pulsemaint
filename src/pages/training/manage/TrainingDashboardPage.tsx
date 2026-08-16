import { useState, useEffect, useMemo } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
} from 'firebase/firestore';
import { UserPlus, X } from 'lucide-react';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import { createInvitation } from '@/lib/invitations';
import type { TrainingAssignment } from '@/lib/training/trainingTypes';
import type { QueryDocumentSnapshot, Timestamp } from 'firebase/firestore';
import TrainingDashboard from '@/components/training/manager/TrainingDashboard';
import TrainingAssignmentsProgress from '@/components/training/manager/TrainingAssignmentsProgress';

interface DashboardStats {
  totalTrainees: number;
  activeAssignments: number;
  certsThisMonth: number;
  overdue: number;
  retrainingRequired: number;
  modulesCreated: number;
}

export default function TrainingDashboardPage() {
  const userProfile = useAuthStore((s) => s.userProfile);
  const company = useAuthStore((s) => s.company);
  const companyId = userProfile?.companyId;

  const [assignments, setAssignments] = useState<TrainingAssignment[]>([]);
  const [certDocs, setCertDocs] = useState<QueryDocumentSnapshot[]>([]);
  const [moduleCount, setModuleCount] = useState(0);
  const [userDocs, setUserDocs] = useState<QueryDocumentSnapshot[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ fullName: '', email: '', phone: '', department: '', employeeId: '' });
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Live listeners, not one-time reads — these stats used to only refresh
  // on a full page reload/remount, so a quiz completed or a sign-off made
  // elsewhere never showed up here until the admin navigated away and back.
  // Each is independently fault-tolerant: one denied read (e.g. certificates
  // for a role without access) must not blank the whole dashboard.
  useEffect(() => {
    if (!companyId) return;
    setLoading(true);
    const unsubs = [
      onSnapshot(
        query(collection(db, 'trainingAssignments'), where('companyId', '==', companyId)),
        (snap) => {
          setAssignments(snap.docs.map((d) => ({ id: d.id, ...d.data() } as TrainingAssignment)));
          setLoading(false);
        },
        () => setLoading(false)
      ),
      onSnapshot(
        query(collection(db, 'trainingCertificates'), where('companyId', '==', companyId)),
        (snap) => setCertDocs(snap.docs),
        () => setCertDocs([])
      ),
      onSnapshot(
        query(collection(db, 'trainingModules'), where('companyId', '==', companyId)),
        (snap) => setModuleCount(snap.size),
        () => setModuleCount(0)
      ),
      // Profiles live in companies/{id}/users — the top-level `users`
      // role-map is not listable by supervisors/HR, which used to reject
      // the whole Promise.all and leave the dashboard empty.
      onSnapshot(
        collection(db, `companies/${companyId}/users`),
        (snap) => setUserDocs(snap.docs),
        () => setUserDocs(null)
      ),
    ];
    return () => unsubs.forEach((u) => u());
  }, [companyId]);

  const stats: DashboardStats = useMemo(() => {
    const traineeCount = userDocs
      ? userDocs.filter((d) => ['trainee', 'floor_operator'].includes(String(d.data().role))).length
      : new Set(assignments.map((a) => a.traineeId)).size;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const certsThisMonth = certDocs.filter((d) => {
      const ts = d.data().issuedAt as Timestamp | undefined;
      if (!ts) return false;
      return new Date((ts as unknown as { seconds: number }).seconds * 1000) >= monthStart;
    }).length;

    const overdue = assignments.filter((a) => {
      if (!a.dueDate || a.status === 'certified') return false;
      const due = new Date((a.dueDate as unknown as { seconds: number }).seconds * 1000);
      return due < now;
    }).length;

    return {
      totalTrainees: traineeCount,
      activeAssignments: assignments.filter((a) => a.status === 'in_progress').length,
      certsThisMonth,
      overdue,
      retrainingRequired: assignments.filter((a) => a.status === 'retraining_required').length,
      modulesCreated: moduleCount,
    };
  }, [assignments, certDocs, moduleCount, userDocs]);

  // Goes through the same invitation flow as Users > Invite User instead of
  // writing a `companies/{id}/users/{randomId}` doc directly. Writing one
  // directly used to hand the profile a nanoid()-generated document id that
  // had no relationship to the trainee's eventual Firebase Auth uid — so
  // once they actually signed in, `useMyProgramme`/`useMyAssignments`
  // (which query by `request.auth.uid`) could never find anything an HR
  // officer/admin/plant manager had assigned to that placeholder id. The
  // invitation flow only creates the real profile doc, keyed by uid, once
  // the trainee accepts and their Auth account exists.
  async function handleAddTrainee() {
    if (!companyId || !userProfile) return;
    if (!addForm.fullName.trim()) {
      setAddError('Full name is required.');
      return;
    }
    if (!addForm.email.trim()) {
      setAddError('Email is required to send the invitation.');
      return;
    }
    setAddSaving(true);
    setAddError(null);
    try {
      await createInvitation({
        companyId,
        companyName: company?.name ?? '',
        email: addForm.email.trim(),
        role: 'trainee',
        fullName: addForm.fullName.trim(),
        department: addForm.department.trim() || null,
        jobTitle: 'Trainee',
        employeeId: addForm.employeeId.trim() || null,
        phone: addForm.phone.trim() || null,
        invitedBy: userProfile.id,
        invitedByName: userProfile.fullName,
      });
      setAddForm({ fullName: '', email: '', phone: '', department: '', employeeId: '' });
      setAddOpen(false);
    } catch (err) {
      console.error('Invite trainee failed', err);
      setAddError(err instanceof Error ? err.message : 'Failed to invite trainee.');
    } finally {
      setAddSaving(false);
    }
  }

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
          Invite Trainee
        </button>
      </div>
      <TrainingDashboard stats={stats} allAssignments={assignments} />

      <div className="mt-6">
        <TrainingAssignmentsProgress />
      </div>

      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between">
              <h2 className="text-lg font-bold text-slate-950">Invite Trainee</h2>
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
                placeholder="Email *"
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
                {addSaving ? 'Sending…' : 'Send Invitation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
