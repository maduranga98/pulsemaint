import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, onSnapshot, updateDoc, Timestamp, serverTimestamp, arrayUnion, collection, query, where, orderBy, limit, getDocs, documentId } from 'firebase/firestore';
import { AlertCircle, ArrowLeft, CheckCircle, UserPlus, HardHat, Pencil, ClipboardPlus } from 'lucide-react';
import { db } from '../../lib/firebase';
import { useAuthStore } from '../../store/authStore';
import type { Breakdown } from '../../types/breakdown';
import { RCAModal } from '../../components/breakdowns/RCAModal';
import { AssignTechnicianModal } from '../../components/breakdowns/AssignTechnicianModal';
import { BreakdownDetailCard } from '../../components/breakdowns/BreakdownDetailCard';
import { isRCARequired, canCloseBreakdown } from '../../lib/rcaUtils';
import { notifyUsers } from '../../services/notifications.service';
import { markMachineActiveIfNoOpenWork, markMachineUnderMaintenance } from '../../lib/machineOperationalStatus';

const CAN_ASSIGN_ROLES = ['supervisor', 'maintenance_supervisor', 'plant_manager', 'admin'];
const CAN_ATTEND_ROLES = ['technician', 'trainee'];

export default function ViewBreakdownPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const userProfile = useAuthStore((s) => s.userProfile);

  const [breakdown, setBreakdown] = useState<Breakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRCAModal, setShowRCAModal] = useState(false);
  const [pendingClose, setPendingClose] = useState(false);
  const [rcaDoc, setRcaDoc] = useState<{ status: string; rootCause: string } | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignBusy, setAssignBusy] = useState(false);
  const [attendBusy, setAttendBusy] = useState(false);
  const [actorRoles, setActorRoles] = useState<Record<string, string>>({});

  const role = userProfile?.role ?? '';
  const isSupervisorRole = CAN_ASSIGN_ROLES.includes(role);
  const canAttend = CAN_ATTEND_ROLES.includes(role);

  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(
      doc(db, 'breakdown_tickets', id),
      (snap) => {
        if (snap.exists()) {
          setBreakdown({ ...snap.data(), id: snap.id } as Breakdown);
        } else {
          setError('Breakdown not found.');
        }
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
    return () => unsub();
  }, [id]);

  // Resolve every actor's current role (attended-by, assigned technicians,
  // and everyone in the status history) so names can be shown with their
  // role, e.g. "Asitha (Technician)" — Firestore's `in` filter caps at 30 ids.
  useEffect(() => {
    if (!breakdown) return;
    const ids = Array.from(
      new Set(
        [
          breakdown.attendedBy,
          ...(breakdown.assignedTechnicianIds ?? []),
          ...(breakdown.statusHistory ?? []).map((h: any) => h.changedBy),
        ].filter((id): id is string => !!id),
      ),
    ).slice(0, 30);
    if (ids.length === 0) return;
    getDocs(query(collection(db, 'users'), where(documentId(), 'in', ids)))
      .then((snap) => {
        const roles: Record<string, string> = {};
        snap.docs.forEach((d) => {
          roles[d.id] = (d.data() as any).role ?? '';
        });
        setActorRoles(roles);
      })
      .catch(() => {}); // silently ignore permission errors
  }, [breakdown?.id, breakdown?.attendedBy, breakdown?.assignedTechnicianIds, breakdown?.statusHistory]);

  // Load RCA doc for this breakdown
  useEffect(() => {
    if (!id) return;
    const q = query(
      collection(db, 'rca'),
      where('breakdownId', '==', id),
      orderBy('createdAt', 'desc'),
      limit(1),
    );
    getDocs(q).then((snap) => {
      if (!snap.empty) {
        const data = snap.docs[0].data();
        setRcaDoc({ status: data.status, rootCause: data.rootCause ?? '' });
      }
    }).catch(() => {}); // silently ignore permission errors
  }, [id]);

  async function handleClose() {
    if (!id || !userProfile) return;
    try {
      await updateDoc(doc(db, 'breakdown_tickets', id), {
        status: 'closed',
        closedAt: Timestamp.now(),
        statusHistory: arrayUnion({
          status: 'closed',
          changedBy: userProfile.id,
          changedByName: userProfile.fullName,
          changedAt: new Date().toISOString(),
          note: 'Breakdown closed after resolution and RCA.',
        }),
      });
      void markMachineActiveIfNoOpenWork(breakdown?.machineId);
      navigate('/app/breakdowns', { replace: true });
    } catch (err: any) {
      setError(err?.message || 'Failed to close breakdown.');
    }
  }

  async function handleAssign(candidate: { id: string; fullName: string; role: string }) {
    // A technician who already attended this ticket themselves owns it —
    // don't let a supervisor's assignment silently reassign them away.
    if (!id || !userProfile || breakdown?.attendedBy) return;
    setAssignBusy(true);
    try {
      await updateDoc(doc(db, 'breakdown_tickets', id), {
        assignedTechnicianIds: [candidate.id],
        assignedTechnicianNames: [candidate.fullName],
        assignedBy: userProfile.id,
        assignedByName: userProfile.fullName,
        assignedAt: serverTimestamp(),
        attendedBy: candidate.id,
        attendedByName: candidate.fullName,
        attendedAt: serverTimestamp(),
        status: 'assigned',
        statusHistory: arrayUnion({
          status: 'assigned',
          changedBy: userProfile.id,
          changedByName: userProfile.fullName,
          changedAt: Timestamp.now(),
          note: `Assigned to ${candidate.fullName} by ${userProfile.fullName}`,
        }),
      });
      void markMachineUnderMaintenance(breakdown?.machineId);
      void notifyUsers(userProfile.companyId, [candidate.id], {
        type: 'breakdown',
        message: `You've been assigned to breakdown ${breakdown?.ticketNumber} on ${breakdown?.machineName}`,
        oversightMessage: `assigned ${candidate.fullName} to breakdown ${breakdown?.ticketNumber}`,
        actorName: userProfile.fullName ?? '',
        actorRole: userProfile.role,
        actorUserId: userProfile.id,
        linkTo: `/app/breakdowns/${id}`,
      });
      setShowAssignModal(false);
    } catch (err: any) {
      setError(err?.message || 'Failed to assign.');
    } finally {
      setAssignBusy(false);
    }
  }

  async function handleSelfAttend() {
    if (!id || !userProfile) return;
    setAttendBusy(true);
    try {
      await updateDoc(doc(db, 'breakdown_tickets', id), {
        assignedTechnicianIds: [userProfile.id],
        assignedTechnicianNames: [userProfile.fullName],
        attendedBy: userProfile.id,
        attendedByName: userProfile.fullName,
        attendedAt: serverTimestamp(),
        status: 'assigned',
        statusHistory: arrayUnion({
          status: 'assigned',
          changedBy: userProfile.id,
          changedByName: userProfile.fullName,
          changedAt: Timestamp.now(),
          note: `Self-attended by ${userProfile.fullName}`,
        }),
      });
      void markMachineUnderMaintenance(breakdown?.machineId);
      navigate(`/app/breakdowns/attend?ids=${id}`);
    } catch (err: any) {
      setError(err?.message || 'Failed to attend.');
    } finally {
      setAttendBusy(false);
    }
  }

  // Hands off to the same Create Work Order drawer used from the WOs tab
  // (prefilled with this breakdown) instead of creating one directly here,
  // so the creation flow — checklist, team/contractor assignment, work
  // permit, documents — is identical either way.
  function handleCreateWorkOrder() {
    if (!breakdown) return;
    navigate(
      `/app/work-orders?create=1&breakdownId=${breakdown.id}&breakdownTicket=${encodeURIComponent(breakdown.ticketNumber)}&machineId=${breakdown.machineId}&woType=BREAKDOWN`,
    );
  }

  function handleInitiateClose() {
    if (!breakdown) return;
    if (
      isRCARequired(breakdown.severity) &&
      !canCloseBreakdown(breakdown.severity, rcaDoc, isSupervisorRole)
    ) {
      setPendingClose(true);
      setShowRCAModal(true);
    } else {
      handleClose();
    }
  }

  function handleRCASaved(_rcaId: string, completed: boolean) {
    setShowRCAModal(false);
    if (pendingClose && (completed || isSupervisorRole)) {
      handleClose();
    }
    setPendingClose(false);
    // Update local rcaDoc to prevent re-blocking
    if (completed) {
      setRcaDoc({ status: 'completed', rootCause: 'see rca record' });
    }
  }

  if (loading) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <p className="text-slate-500">Loading breakdown…</p>
      </div>
    );
  }

  if (error || !breakdown) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <p className="text-slate-700">{error || 'Breakdown not found.'}</p>
          <button
            onClick={() => navigate('/app/breakdowns')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            Back to Breakdowns
          </button>
        </div>
      </div>
    );
  }

  const b = breakdown;

  return (
    <div className="min-h-full">
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <button
              type="button"
              onClick={() => navigate('/app/breakdowns')}
              className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 mb-1"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Breakdowns
            </button>
            <h1 className="text-2xl font-bold text-slate-900">{b.ticketNumber}</h1>
            <p className="text-sm text-slate-500">{b.machineName}</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => navigate('/app/breakdowns')}
              className="px-4 py-2 border border-slate-200 bg-white text-slate-700 font-medium rounded-lg hover:bg-slate-50 text-sm"
            >
              <ArrowLeft className="w-4 h-4 inline mr-1" />
              Back
            </button>
            {b.status === 'reported' && !b.attendedBy && isSupervisorRole && (
              <button
                type="button"
                onClick={() => setShowAssignModal(true)}
                className="px-4 py-2 border border-indigo-200 bg-indigo-50 text-indigo-700 font-medium rounded-lg hover:bg-indigo-100 text-sm"
              >
                <UserPlus className="w-4 h-4 inline mr-1" />
                Assign Technician
              </button>
            )}
            {b.status === 'reported' && canAttend && (
              <button
                type="button"
                disabled={attendBusy}
                onClick={handleSelfAttend}
                className="px-4 py-2 border border-emerald-200 bg-emerald-50 text-emerald-700 font-medium rounded-lg hover:bg-emerald-100 text-sm disabled:opacity-50"
              >
                <HardHat className="w-4 h-4 inline mr-1" />
                {attendBusy ? 'Attending…' : 'Attend'}
              </button>
            )}
            {b.status !== 'reported' && !b.severity && (b.assignedTechnicianIds ?? []).includes(userProfile?.id ?? '') && (
              <Link
                to={`/app/breakdowns/attend?ids=${b.id}`}
                className="px-4 py-2 border border-blue-200 bg-blue-50 text-blue-700 font-medium rounded-lg hover:bg-blue-100 text-sm"
              >
                <Pencil className="w-4 h-4 inline mr-1" />
                Fill Breakdown Report
              </Link>
            )}
            {isSupervisorRole && b.status !== 'reported' && !b.linkedWOId && (
              <button
                type="button"
                onClick={handleCreateWorkOrder}
                className="px-4 py-2 border border-purple-200 bg-purple-50 text-purple-700 font-medium rounded-lg hover:bg-purple-100 text-sm"
              >
                <ClipboardPlus className="w-4 h-4 inline mr-1" />
                Create Work Order
              </button>
            )}
            {b.status === 'resolved' && (
              <button
                type="button"
                onClick={handleInitiateClose}
                className="px-4 py-2 border border-emerald-200 bg-emerald-50 text-emerald-700 font-medium rounded-lg hover:bg-emerald-100 text-sm"
              >
                <CheckCircle className="w-4 h-4 inline mr-1" />
                Close Breakdown
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">
        <BreakdownDetailCard breakdown={b} actorRoles={actorRoles} />
      </div>

      {showRCAModal && breakdown && (
        <RCAModal
          breakdown={breakdown}
          onClose={() => { setShowRCAModal(false); setPendingClose(false); }}
          onSaved={handleRCASaved}
        />
      )}

      {showAssignModal && userProfile && (
        <AssignTechnicianModal
          companyId={userProfile.companyId}
          assigning={assignBusy}
          onClose={() => setShowAssignModal(false)}
          onAssign={handleAssign}
        />
      )}
    </div>
  );
}
