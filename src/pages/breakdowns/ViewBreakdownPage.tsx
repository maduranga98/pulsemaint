import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, updateDoc, Timestamp, arrayUnion } from 'firebase/firestore';
import { AlertCircle, ArrowLeft, X } from 'lucide-react';
import { db } from '../../lib/firebase';
import { useAuthStore } from '../../store/authStore';
import type { Breakdown, BreakdownStatus } from '../../types/breakdown';

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
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

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

  async function handleCancel() {
    if (!id || !userProfile || !cancelReason.trim()) return;
    setCancelling(true);
    try {
      await updateDoc(doc(db, 'breakdown_tickets', id), {
        status: 'closed',
        closedAt: Timestamp.now(),
        statusHistory: arrayUnion({
          status: 'closed',
          changedBy: userProfile.id,
          changedByName: userProfile.fullName,
          changedAt: new Date().toISOString(),
          note: `Cancelled: ${cancelReason.trim()}`,
        }),
      });
      setShowCancelModal(false);
      navigate('/app/breakdowns', { replace: true });
    } catch (err: any) {
      setError(err?.message || 'Failed to cancel breakdown.');
    } finally {
      setCancelling(false);
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
            {!['resolved', 'closed'].includes(b.status) && (
              <button
                type="button"
                onClick={() => setShowCancelModal(true)}
                className="px-4 py-2 border border-red-200 bg-red-50 text-red-700 font-medium rounded-lg hover:bg-red-100 text-sm"
              >
                <X className="w-4 h-4 inline mr-1" />
                Cancel Breakdown
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className={`px-2 py-0.5 rounded text-xs font-semibold uppercase ${SEVERITY_COLOR[b.severity]}`}>
              {b.severity}
            </span>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ring-1 ${STATUS_COLOR[b.status]}`}>
              {STATUS_LABEL[b.status]}
            </span>
            <span className="text-xs text-slate-500 capitalize">{b.type}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-slate-500 text-xs font-medium uppercase tracking-wide">Machine</p>
              <p className="text-slate-900 font-medium">{b.machineName}</p>
              {b.machineLocation && <p className="text-slate-500 text-xs">{b.machineLocation}</p>}
              {b.machineDepartment && <p className="text-slate-500 text-xs">{b.machineDepartment}</p>}
            </div>
            <div>
              <p className="text-slate-500 text-xs font-medium uppercase tracking-wide">Reported By</p>
              <p className="text-slate-900 font-medium">{b.reporterName || '—'}</p>
              <p className="text-slate-500 text-xs capitalize">{b.reporterRole?.replace(/_/g, ' ') || ''}</p>
              <p className="text-slate-500 text-xs">
                {b.reportedAt?.toDate ? b.reportedAt.toDate().toLocaleString() : '—'}
              </p>
            </div>
          </div>

          <div>
            <p className="text-slate-500 text-xs font-medium uppercase tracking-wide mb-1">What Happened</p>
            <p className="text-slate-800 text-sm">{b.description || '—'}</p>
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

      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Cancel Breakdown</h3>
            <p className="text-sm text-slate-600 mb-4">Please provide a reason for cancelling this breakdown.</p>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={3}
              placeholder="Reason for cancellation…"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm"
            />
            <div className="flex gap-3 mt-4">
              <button
                type="button"
                onClick={() => { setShowCancelModal(false); setCancelReason(''); }}
                disabled={cancelling}
                className="flex-1 px-4 py-2 border border-slate-200 bg-white text-slate-700 font-medium rounded-lg hover:bg-slate-50 text-sm"
              >
                Go Back
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={cancelling || !cancelReason.trim()}
                className="flex-1 px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm"
              >
                {cancelling ? 'Cancelling…' : 'Confirm Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
