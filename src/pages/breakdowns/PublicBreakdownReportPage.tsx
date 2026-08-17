import { useEffect, useRef, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { addDoc, collection, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { AlertCircle, CheckCircle2, QrCode } from 'lucide-react';
import { nanoid } from 'nanoid';
import { auth, db } from '../../lib/firebase';
import { signInAnonymouslyForReport } from '../../lib/auth';

interface MachineInfo {
  id: string;
  name: string;
  department?: string;
  location?: string;
  criticality?: 1 | 2 | 3 | 4 | 5;
  siteId: string;
}

/**
 * Public, unauthenticated breakdown report — reached by scanning a machine's
 * QR code (or the "Report a breakdown" link on the login page). No sign-in
 * or account is required: the page anonymously authenticates just long
 * enough to satisfy Firestore's write rule, then signs back out.
 */
export default function PublicBreakdownReportPage() {
  const [searchParams] = useSearchParams();
  const machineId = searchParams.get('machineId') || '';

  const [machine, setMachine] = useState<MachineInfo | null>(null);
  const [machineError, setMachineError] = useState<string | null>(null);
  const [loadingMachine, setLoadingMachine] = useState(true);
  // Safety net: anonymous sign-in or the machine lookup can hang (weak
  // factory-floor connection, an ad-blocker/extension interfering with
  // Firebase Auth, ...) with no rejection ever firing, which otherwise
  // leaves "Loading machine…" spinning forever with no way out.
  const [loadTimedOut, setLoadTimedOut] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  const [description, setDescription] = useState('');
  const [machineStillRunning, setMachineStillRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ticketNumber, setTicketNumber] = useState<string | null>(null);

  // Whether *this page* created the anonymous session — only that session
  // is ours to sign back out of. Firebase only allows one active user per
  // browser: if someone with a real, already-signed-in account (e.g. a
  // supervisor testing this link, or a technician who left a tab open) ever
  // lands here, blindly calling signInAnonymously() would silently replace
  // their real session, and signing out on unmount would then log them out
  // of the app entirely — surfacing as an unexplained bounce to /login.
  const createdAnonymousSessionRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setLoadTimedOut(false);
    setLoadingMachine(true);
    setMachineError(null);
    const timeoutTimer = setTimeout(() => {
      if (!cancelled) setLoadTimedOut(true);
    }, 10000);
    async function load() {
      if (!machineId) {
        setMachineError('This link is missing a machine — scan the QR code on the machine itself.');
        setLoadingMachine(false);
        return;
      }
      try {
        if (!auth.currentUser) {
          await signInAnonymouslyForReport();
          createdAnonymousSessionRef.current = true;
        }
        const snap = await getDoc(doc(db, 'machines', machineId));
        if (cancelled) return;
        if (!snap.exists()) {
          setMachineError('Machine not found. The QR code may be out of date.');
        } else {
          const data = snap.data() as any;
          setMachine({
            id: snap.id,
            name: data.name || 'Unnamed machine',
            department: data.department,
            location: data.floor || data.bay || data.station,
            criticality: data.criticality,
            siteId: data.siteId,
          });
        }
      } catch (err: any) {
        if (!cancelled) setMachineError(err?.message || 'Failed to load machine.');
      } finally {
        if (!cancelled) setLoadingMachine(false);
      }
    }
    load();
    return () => {
      cancelled = true;
      clearTimeout(timeoutTimer);
    };
  }, [machineId, retryKey]);

  // Anonymous credentials only exist to satisfy the write rule — never leave
  // one lying around once the visitor is done with this page. Only clear
  // the session if *this page* created it (see the ref above) — a visitor
  // who already had a real signed-in session before landing here keeps it.
  useEffect(() => {
    return () => {
      if (createdAnonymousSessionRef.current && auth.currentUser?.isAnonymous) {
        signOut(auth).catch(() => {});
      }
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!machine) {
      setError('Machine information is not loaded yet.');
      return;
    }
    if (description.trim().length < 10) {
      setError('Please describe the breakdown in at least 10 characters.');
      return;
    }
    setSubmitting(true);
    try {
      const number = `BD-${new Date().getFullYear()}-${nanoid(6).toUpperCase()}`;
      await addDoc(collection(db, 'breakdown_tickets'), {
        ticketNumber: number,
        siteId: machine.siteId,
        companyId: machine.siteId,
        machineId: machine.id,
        machineName: machine.name,
        machineDepartment: machine.department || '',
        machineLocation: machine.location || '',
        machineCriticality: machine.criticality || 3,
        severity: null,
        type: null,
        description: description.trim(),
        productionImpact: '',
        currentProductionCount: null,
        attemptedFixes: '',
        machineStillRunning,
        photos: [],
        video: null,
        source: 'qr_scan',
        reportedBy: null,
        reporterName: null,
        reporterRole: null,
        reportedAt: serverTimestamp(),
        status: 'reported',
        statusHistory: [],
        assignedTechnicianIds: [],
        assignedTechnicianNames: [],
        assignedContractorId: null,
        assignedBy: null,
        assignedByName: null,
        attendedBy: null,
        attendedByName: null,
        attendedAt: null,
        acknowledgedAt: null,
        acknowledgedBy: null,
        assignedAt: null,
        enRouteAt: null,
        repairStartedAt: null,
        resolvedAt: null,
        closedAt: null,
        slaDeadline: null,
      });
      setTicketNumber(number);
    } catch (err: any) {
      setError(err?.message || 'Failed to submit breakdown report.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0A1628] to-[#0F1E3A] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6 flex flex-col items-center gap-2">
          <img src="/logo.svg" alt="FirmiCore" className="h-14 w-auto" />
          <div className="text-2xl font-bold" style={{ fontFamily: "'Sora', var(--font-sans)" }}>
            <span className="text-white">Firmi</span>
            <span className="text-[#00C2FF]">Core</span>
          </div>
          <p className="text-slate-300 text-sm">Report a breakdown — no sign-in required</p>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6">
          {ticketNumber ? (
            <div className="text-center py-4 flex flex-col items-center gap-1.5">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-1" />
              <p className="text-lg font-semibold text-slate-900">Breakdown reported</p>
              <p className="text-sm text-slate-500">Ticket <span className="font-mono font-medium">{ticketNumber}</span> has been sent to the maintenance team.</p>
              <p className="text-xs text-slate-400 mt-2">You can close this page.</p>
            </div>
          ) : loadingMachine && loadTimedOut ? (
            <div className="text-center py-4">
              <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
              <p className="text-slate-700 text-sm mb-4">
                This is taking longer than usual. Check your connection and try again.
              </p>
              <button
                type="button"
                onClick={() => setRetryKey((k) => k + 1)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg"
              >
                Retry
              </button>
            </div>
          ) : loadingMachine ? (
            <p className="text-sm text-slate-500 text-center py-6">Loading machine…</p>
          ) : machineError ? (
            <div className="text-center py-4">
              <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
              <p className="text-slate-700 text-sm">{machineError}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex items-center gap-2 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                <QrCode className="w-4 h-4 flex-shrink-0" />
                <span>
                  Reporting on <strong>{machine?.name}</strong>
                  {machine?.location ? ` — ${machine.location}` : ''}
                </span>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 flex gap-2 text-sm">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">What happened? *</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  disabled={submitting}
                  placeholder="Describe the symptoms, error codes, sounds, etc."
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={machineStillRunning}
                  onChange={(e) => setMachineStillRunning(e.target.checked)}
                  disabled={submitting}
                  className="rounded"
                />
                Machine is still running (degraded but operational)
              </label>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-2 rounded-lg transition-colors disabled:opacity-50 h-11 flex items-center justify-center"
              >
                {submitting ? 'Submitting…' : 'Submit Breakdown Report'}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-slate-400 text-xs mt-6">
          Work here?{' '}
          <Link to="/login" className="text-[#00C2FF] hover:underline font-medium">
            Sign in
          </Link>{' '}
          to see the full Breakdowns board.
        </p>
      </div>
    </div>
  );
}
