import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, onSnapshot, updateDoc, Timestamp, serverTimestamp, arrayUnion, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { AlertCircle, ArrowLeft, CheckCircle, UserPlus, HardHat, Pencil, ClipboardPlus } from 'lucide-react';
import { db } from '../../lib/firebase';
import { useAuthStore } from '../../store/authStore';
import type { Breakdown, BreakdownStatus } from '../../types/breakdown';
import { RCAModal } from '../../components/breakdowns/RCAModal';
import { AssignTechnicianModal } from '../../components/breakdowns/AssignTechnicianModal';
import { isRCARequired, canCloseBreakdown } from '../../lib/rcaUtils';
import { notifyUsers } from '../../services/notifications.service';

const CAN_ASSIGN_ROLES = ['supervisor', 'maintenance_supervisor', 'plant_manager', 'admin'];
const CAN_ATTEND_ROLES = ['technician', 'trainee'];

const STATUS_LABEL: Record<BreakdownStatus, string> = {
  reported: 'Reported',
  acknowledged: 'Acknowledged',
  triage_in_progress: 'In Triage',
  assigned: 'Assigned',
  en_route: 'En Route',
  repair_in_progress: 'In Progress',
  on_hold_parts: 'On Hold (Parts)',
  on_hold_approval: 'On Hold (Approval)',
  resolved: 'Resolved',
  closed: 'Closed',
  cancelled: 'Cancelled',
};

const STATUS_COLOR: Record<BreakdownStatus, string> = {
  reported: 'bg-red-50 text-red-700 ring-red-200',
  acknowledged: 'bg-amber-50 text-amber-700 ring-amber-200',
  triage_in_progress: 'bg-amber-50 text-amber-700 ring-amber-200',
  assigned: 'bg-blue-50 text-blue-700 ring-blue-200',
  en_route: 'bg-blue-50 text-blue-700 ring-blue-200',
  repair_in_progress: 'bg-cyan-50 text-cyan-700 ring-cyan-200',
  on_hold_parts: 'bg-orange-50 text-orange-700 ring-orange-200',
  on_hold_approval: 'bg-orange-50 text-orange-700 ring-orange-200',
  resolved: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  closed: 'bg-slate-100 text-slate-600 ring-slate-200',
  cancelled: 'bg-slate-200 text-slate-700 ring-slate-300',
};

const SEVERITY_COLOR: Record<string, string> = {
  critical: 'bg-red-600 text-white',
  high: 'bg-orange-500 text-white',
  medium: 'bg-amber-500 text-white',
  low: 'bg-slate-400 text-white',
};

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
      `/app/workorders?create=1&breakdownId=${breakdown.id}&breakdownTicket=${encodeURIComponent(breakdown.ticketNumber)}&machineId=${breakdown.machineId}&woType=BREAKDOWN`,
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
                disabled={creatingWO}
                onClick={handleCreateWorkOrder}
                className="px-4 py-2 border border-purple-200 bg-purple-50 text-purple-700 font-medium rounded-lg hover:bg-purple-100 text-sm disabled:opacity-50"
              >
                <ClipboardPlus className="w-4 h-4 inline mr-1" />
                {creatingWO ? 'Creating…' : 'Create Work Order'}
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
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            {b.severity ? (
              <span className={`px-2 py-0.5 rounded text-xs font-semibold uppercase ${SEVERITY_COLOR[b.severity]}`}>
                {b.severity}
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-500">Pending assessment</span>
            )}
            <span className={`px-2 py-0.5 rounded text-xs font-medium ring-1 ${STATUS_COLOR[b.status]}`}>
              {STATUS_LABEL[b.status]}
            </span>
            {b.type && <span className="text-xs text-slate-500 capitalize">{b.type}</span>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-slate-500 text-xs font-medium uppercase tracking-wide">Machine</p>
              <p className="text-slate-900 font-medium">{b.machineName}</p>
              {b.machineLocation && <p className="text-slate-500 text-xs">{b.machineLocation}</p>}
              {b.machineDepartment && <p className="text-slate-500 text-xs">{b.machineDepartment}</p>}
            </div>
            <div>
              <p className="text-slate-500 text-xs font-medium uppercase tracking-wide">Reported</p>
              <p className="text-slate-900 font-medium capitalize">{b.source?.replace(/_/g, ' ') || 'Web'}</p>
              <p className="text-slate-500 text-xs">
                {b.reportedAt?.toDate ? b.reportedAt.toDate().toLocaleString() : ''}
              </p>
            </div>
          </div>

          {b.attendedByName && (
            <div>
              <p className="text-slate-500 text-xs font-medium uppercase tracking-wide mb-1">Attended By</p>
              <p className="text-slate-800 text-sm">
                {b.attendedByName}
                {b.attendedAt?.toDate && (
                  <span className="text-slate-500 text-xs ml-2">{b.attendedAt.toDate().toLocaleString()}</span>
                )}
              </p>
            </div>
          )}

          <div>
            <p className="text-slate-500 text-xs font-medium uppercase tracking-wide mb-1">What Happened</p>
            <p className="text-slate-800 text-sm">{b.description || ''}</p>
          </div>

          {b.productionImpact && (
            <div>
              <p className="text-slate-500 text-xs font-medium uppercase tracking-wide mb-1">Production Impact</p>
              <p className="text-slate-800 text-sm">{b.productionImpact}</p>
            </div>
          )}

          {b.attemptedFixes && (
            <div>
              <p className="text-slate-500 text-xs font-medium uppercase tracking-wide mb-1">Attempted Fixes</p>
              <p className="text-slate-800 text-sm">{b.attemptedFixes}</p>
            </div>
          )}

          <div className="flex items-center gap-4 text-sm">
            <span className={`px-2 py-1 rounded text-xs font-medium ${b.machineStillRunning ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {b.machineStillRunning ? 'Machine still running (degraded)' : 'Machine stopped'}
            </span>
          </div>

          {(b.assignedTechnicianNames ?? []).length > 0 && (
            <div>
              <p className="text-slate-500 text-xs font-medium uppercase tracking-wide mb-1">Assigned Technicians</p>
              <p className="text-slate-800 text-sm">{b.assignedTechnicianNames.join(', ')}</p>
            </div>
          )}

          {(b.photos ?? []).length > 0 && (
            <div>
              <p className="text-slate-500 text-xs font-medium uppercase tracking-wide mb-2">Attached Media</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {b.photos.map((url, i) => {
                  const isImage = /\.(jpe?g|png|gif|webp|heic|bmp)(\?|$)/i.test(url);
                  const isVideo = /\.(mp4|mov|avi|webm)(\?|$)/i.test(url);
                  return (
                    <a
                      key={i}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block border border-slate-200 rounded-lg overflow-hidden hover:ring-2 hover:ring-blue-300 transition-shadow"
                    >
                      {isImage ? (
                        <img src={url} alt={`Attachment ${i + 1}`} className="w-full h-24 object-cover" />
                      ) : isVideo ? (
                        <video src={url} className="w-full h-24 object-cover" muted />
                      ) : (
                        <div className="w-full h-24 flex items-center justify-center bg-slate-50 text-slate-400 text-xs">
                          File {i + 1}
                        </div>
                      )}
                    </a>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Status History</p>
          {(b.statusHistory ?? []).length === 0 ? (
            <p className="text-sm text-slate-500">No status changes yet.</p>
          ) : (
            <ol className="space-y-2 text-sm">
              {(b.statusHistory ?? []).map((h: any, idx: number) => (
                <li key={idx} className="flex gap-3 items-start">
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-50 border border-slate-200 whitespace-nowrap">
                    {STATUS_LABEL[h.status as BreakdownStatus] ?? h.status}
                  </span>
                  <div>
                    <span className="text-slate-700">{h.changedByName}</span>
                    <span className="text-slate-400 text-xs ml-2">
                      {h.changedAt?.toDate ? h.changedAt.toDate().toLocaleString() : (typeof h.changedAt === 'string' ? new Date(h.changedAt).toLocaleString() : '')}
                    </span>
                    {h.note && <p className="text-slate-500 text-xs italic mt-0.5">{h.note}</p>}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
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
