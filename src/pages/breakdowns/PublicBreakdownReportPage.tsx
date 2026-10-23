import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { signOut } from 'firebase/auth';
import { AlertCircle, CheckCircle2, QrCode } from 'lucide-react';
import { auth, functions } from '../../lib/firebase';
import { formatMachineLocation } from '../../lib/machineLocation';
import { VoiceDictationButton } from '../../components/ui';

import { useTranslation } from 'react-i18next';
interface MachineInfo {
  id: string;
  name: string;
  department?: string;
  location?: string;
}

interface PublicMachine {
  id: string;
  name: string;
  department: string;
  floor: string | null;
  bay: string | null;
  station: string | null;
}

// Guards against the same blank report form reappearing (and inviting a
// duplicate report) if this page gets reloaded right after a successful
// submit — e.g. the phone's camera/QR app resumes the webview and reloads
// the URL, or the user taps the same QR code again moments later. The last
// ticket filed for a given machine is remembered for a short window so a
// reload shows the confirmation instead of a fresh empty form.
const LAST_TICKET_TTL_MS = 15 * 60 * 1000;

function lastTicketStorageKey(machineId: string): string {
  return `pm.lastBreakdownTicket:${machineId}`;
}

function readRecentTicket(machineId: string): string | null {
  try {
    const raw = sessionStorage.getItem(lastTicketStorageKey(machineId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { ticketNumber: string; ts: number };
    if (!parsed?.ticketNumber || Date.now() - parsed.ts > LAST_TICKET_TTL_MS) return null;
    return parsed.ticketNumber;
  } catch {
    return null;
  }
}

function saveRecentTicket(machineId: string, ticketNumber: string): void {
  try {
    sessionStorage.setItem(lastTicketStorageKey(machineId), JSON.stringify({ ticketNumber, ts: Date.now() }));
  } catch {
    // Storage unavailable — the confirmation still shows for this page load.
  }
}

function clearRecentTicket(machineId: string): void {
  try {
    sessionStorage.removeItem(lastTicketStorageKey(machineId));
  } catch {
    // ignore
  }
}

/**
 * Public, unauthenticated breakdown report — reached by scanning a machine's
 * QR code (or the "Report a breakdown" link on the login page). No sign-in
 * or account is required, and no Firebase Auth user is created: the machine
 * details come from the getPublicMachine callable and the report is filed by
 * the submitPublicBreakdown callable (rate-limited server-side).
 */
export default function PublicBreakdownReportPage() {
  const { t } = useTranslation();
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
  const [ticketNumber, setTicketNumber] = useState<string | null>(() =>
    machineId ? readRecentTicket(machineId) : null
  );

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
        // Browsers that scanned a QR code before this change may still hold a
        // leftover anonymous session — drop it. A real signed-in user is kept.
        if (auth.currentUser?.isAnonymous) await signOut(auth).catch(() => {});
        // Only the public fields come back — visitors can't read the machine
        // document itself (firestore.rules).
        const getPublicMachine = httpsCallable<{ machineId: string }, PublicMachine>(functions, 'getPublicMachine');
        const { data } = await getPublicMachine({ machineId });
        if (cancelled) return;
        setMachine({
          id: data.id,
          name: data.name || 'Unnamed machine',
          department: data.department,
          location: formatMachineLocation(data.floor, data.bay, data.station),
        });
      } catch (err: any) {
        if (cancelled) return;
        if (err?.code === 'functions/not-found') {
          setMachineError('Machine not found. The QR code may be out of date.');
        } else {
          setMachineError(err?.message || 'Failed to load machine.');
        }
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!machine) {
      setError(t('common.ui2.breakdowns.publicBreakdownReportPage.machineInformationIsNotLoaded'));
      return;
    }
    if (description.trim().length < 10) {
      setError(t('common.ui2.breakdowns.publicBreakdownReportPage.pleaseDescribeTheBreakdownIn'));
      return;
    }
    setSubmitting(true);
    try {
      const submit = httpsCallable<
        { machineId: string; description: string; machineStillRunning: boolean },
        { ticketNumber: string }
      >(functions, 'submitPublicBreakdown');
      const { data } = await submit({
        machineId: machine.id,
        description: description.trim(),
        machineStillRunning,
      });
      const number = data.ticketNumber;
      setTicketNumber(number);
      saveRecentTicket(machine.id, number);
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
          <img src="/logo.svg" alt={t('common.ui2.breakdowns.publicBreakdownReportPage.firmicore')} className="h-14 w-auto" />
          <div className="text-2xl font-bold">
            <span className="text-white">{t('common.ui2.breakdowns.publicBreakdownReportPage.firmi')}</span>
            <span className="text-[#00C2FF]">{t('common.ui2.breakdowns.publicBreakdownReportPage.core')}</span>
          </div>
          <p className="text-slate-300 text-sm">{t('common.ui2.breakdowns.publicBreakdownReportPage.reportABreakdownNoSign')}</p>
        </div>

        <div className="bg-[#0F1E35] border border-[#1E3A5F] rounded-lg shadow-lg p-6">
          {ticketNumber ? (
            <div className="text-center py-4 flex flex-col items-center gap-1.5">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-1" />
              <p className="text-lg font-semibold text-[#F0F4F8]">{t('common.ui2.breakdowns.publicBreakdownReportPage.breakdownReported')}</p>
              <p className="text-sm text-[#8BA3BF]">{t('common.ui2.breakdowns.publicBreakdownReportPage.ticket')} <span className="font-mono font-medium">{ticketNumber}</span> {t('common.ui2.breakdowns.publicBreakdownReportPage.hasBeenSentToThe')}</p>
              <p className="text-xs text-[#6B7F9A] mt-2">{t('common.ui2.breakdowns.publicBreakdownReportPage.youCanCloseThisPage')}</p>
              <button
                type="button"
                onClick={() => {
                  if (machineId) clearRecentTicket(machineId);
                  setTicketNumber(null);
                  setDescription('');
                  setMachineStillRunning(false);
                  setError(null);
                }}
                className="mt-3 text-sm text-[#60A5FA] hover:text-[#93C5FD] font-medium hover:underline"
              >
                Report another breakdown on this machine
              </button>
            </div>
          ) : loadingMachine && loadTimedOut ? (
            <div className="text-center py-4">
              <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
              <p className="text-[#D5DEEA] text-sm mb-4">
                {t('common.ui2.breakdowns.publicBreakdownReportPage.thisIsTakingLongerThan')}
              </p>
              <button
                type="button"
                onClick={() => setRetryKey((k) => k + 1)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg"
              >
                {t('common.ui2.breakdowns.publicBreakdownReportPage.retry')}
              </button>
            </div>
          ) : loadingMachine ? (
            <p className="text-sm text-[#8BA3BF] text-center py-6">{t('common.ui2.breakdowns.publicBreakdownReportPage.loadingMachine')}</p>
          ) : machineError ? (
            <div className="text-center py-4">
              <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
              <p className="text-[#D5DEEA] text-sm">{machineError}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex items-center gap-2 text-xs text-[#93C5FD] bg-[#0A1628] border border-[#1E3A5F] rounded-lg px-3 py-2">
                <QrCode className="w-4 h-4 flex-shrink-0" />
                <span>
                  {t('common.ui2.breakdowns.publicBreakdownReportPage.reportingOn')} <strong>{machine?.name}</strong>
                  {machine?.department ? ` — ${machine.department}` : ''}
                  {machine?.location ? ` · ${machine.location}` : ''}
                </span>
              </div>

              {error && (
                <div className="bg-[#2A1215] border border-[#7F1D1D] text-[#FCA5A5] rounded-lg p-3 flex gap-2 text-sm">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-[#D5DEEA]">{t('common.ui2.breakdowns.publicBreakdownReportPage.whatHappened')}</label>
                  <VoiceDictationButton
                    disabled={submitting}
                    className="w-8 h-8"
                    tone="dark"
                    onTranscript={(text) =>
                      setDescription((prev) => (prev ? `${prev} ${text}` : text))
                    }
                  />
                </div>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  disabled={submitting}
                  placeholder={t('common.ui2.breakdowns.publicBreakdownReportPage.describeTheSymptomsErrorCodes')}
                  className="w-full px-4 py-2 bg-[#0A1628] text-[#F0F4F8] placeholder:text-[#6B7F9A] border border-[#1E3A5F] rounded-lg focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/30 outline-none transition-all"
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-[#D5DEEA]">
                <input
                  type="checkbox"
                  checked={machineStillRunning}
                  onChange={(e) => setMachineStillRunning(e.target.checked)}
                  disabled={submitting}
                  className="rounded"
                />
                {t('common.ui2.breakdowns.publicBreakdownReportPage.machineIsStillRunningDegraded')}
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
            {t('common.ui2.breakdowns.publicBreakdownReportPage.signIn')}
          </Link>{' '}
          to see the full Breakdowns board.
        </p>
      </div>
    </div>
  );
}
