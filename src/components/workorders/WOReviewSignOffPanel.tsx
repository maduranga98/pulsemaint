import { useMemo, useState } from 'react';
import { X, Check, RotateCcw, ChevronDown, ChevronRight } from 'lucide-react';
import type { WorkOrder, WORootCause } from '../../types/workOrder';
import { WO_ROOT_CAUSE_LABELS } from '../../constants/woConfig';
import { useUpdateWorkOrder } from '../../hooks/useUpdateWorkOrder';
import { useWORCA, FIVE_WHY_QUESTIONS } from '../../hooks/useWORCA';
import { useSignOff } from '../../hooks/useSignOff';
import { useAuthStore } from '../../store/authStore';
import { SignatureCanvas } from './SignatureCanvas';
import { WOTypeBadge } from './WOTypeBadge';
import { PriorityBadge } from './PriorityBadge';
import { toast } from 'sonner';

interface Props {
  workOrder: WorkOrder;
  onClose: () => void;
  onDone?: () => void;
}

type Step = 'review' | 'rca' | 'signoff';

const STEPS: { key: Step; label: string }[] = [
  { key: 'review', label: 'Review' },
  { key: 'rca', label: 'Root Cause' },
  { key: 'signoff', label: 'Sign-off' },
];

const TEST_RESULT_LABEL: Record<string, string> = {
  pass: 'Pass',
  fail: 'Fail',
  partial: 'Partial',
};

const MACHINE_STATUS_LABEL: Record<string, string> = {
  operational: 'Operational',
  partially_operational: 'Partially operational',
  still_down: 'Still down',
};

export function WOReviewSignOffPanel({ workOrder, onClose, onDone }: Props) {
  const wo = workOrder;
  const user = useAuthStore((s) => s.user);
  const userProfile = useAuthStore((s) => s.userProfile);
  const { updateStatus, loading: statusLoading } = useUpdateWorkOrder();
  const { saveWORCA, createCorrectiveWO } = useWORCA(wo);
  const { signOff, loading: signLoading } = useSignOff();

  const [step, setStep] = useState<Step>('review');

  // Review
  const [sendBackReason, setSendBackReason] = useState('');
  const [showSendBack, setShowSendBack] = useState(false);

  // RCA
  const [rootCauseEnum, setRootCauseEnum] = useState<WORootCause>(wo.rootCause ?? 'unknown');
  const [rootCauseText, setRootCauseText] = useState(wo.rootCauseDescription ?? '');
  const [showWhys, setShowWhys] = useState(false);
  const [whys, setWhys] = useState<string[]>(['', '', '', '', '']);
  const [correctiveAction, setCorrectiveAction] = useState('');
  const [makeCorrectiveWO, setMakeCorrectiveWO] = useState(false);
  const [rcaSaving, setRcaSaving] = useState(false);

  // Sign-off
  const [signature, setSignature] = useState('');
  const [signNotes, setSignNotes] = useState('');

  const uid = user?.uid ?? '';
  const userName = user?.displayName ?? userProfile?.fullName ?? '';
  const siteId = wo.siteId;

  const checklistDone = useMemo(() => (wo.checklist ?? []).filter((c) => c.isCompleted).length, [wo.checklist]);
  const evidence = useMemo(() => {
    const docs = (wo.documents ?? []).filter((d) => !d.isCompletionDocument);
    const photos = (wo.finalPhotos ?? []).map((url, i) => ({ id: `fp_${i}`, url, kind: 'image' as const, name: `Final photo ${i + 1}` }));
    const docItems = docs.map((d) => ({ id: d.id, url: d.url, kind: d.fileType === 'video' ? 'video' as const : d.fileType === 'image' ? 'image' as const : 'file' as const, name: d.name }));
    return [...photos, ...docItems];
  }, [wo.documents, wo.finalPhotos]);

  async function handleSendBack() {
    if (!sendBackReason.trim()) {
      toast.error('Please provide a reason for sending the work order back.');
      return;
    }
    const ok = await updateStatus(wo.id, 'IN_PROGRESS', `Sent back: ${sendBackReason.trim()}`);
    if (ok) {
      onDone?.();
      onClose();
    }
  }

  async function handleSaveRCA() {
    if (!rootCauseText.trim()) {
      toast.error('Root cause description is required.');
      return;
    }
    setRcaSaving(true);
    try {
      await saveWORCA(
        { problem: wo.description, whys, rootCauseEnum, rootCauseText: rootCauseText.trim(), correctiveAction: correctiveAction.trim() || undefined, completed: true },
        uid,
        userName,
      );
      if (makeCorrectiveWO && correctiveAction.trim()) {
        await createCorrectiveWO(correctiveAction.trim(), uid, userName);
        toast.success('Corrective work order created.');
      }
      toast.success('Root cause analysis saved.');
      setStep('signoff');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save RCA');
    } finally {
      setRcaSaving(false);
    }
  }

  async function handleSignOff(alsoClose: boolean) {
    if (!signature) {
      toast.error('Please capture a signature.');
      return;
    }
    const ok = await signOff(wo.id, siteId, { signature, notes: signNotes });
    if (!ok) return;
    if (alsoClose) {
      await updateStatus(wo.id, 'CLOSED');
    }
    onDone?.();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-xl flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="border-b border-gray-200 p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-lg font-bold text-gray-900">{wo.woNumber}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <WOTypeBadge woType={wo.woType} size="sm" />
                <PriorityBadge priority={wo.priority} size="sm" />
                <span className="text-xs text-gray-500">{wo.machineName}</span>
              </div>
            </div>
            <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Stepper */}
          <div className="mt-4 flex items-center gap-2">
            {STEPS.map((s, i) => {
              const active = s.key === step;
              const idx = STEPS.findIndex((x) => x.key === step);
              const done = i < idx;
              return (
                <div key={s.key} className="flex flex-1 items-center gap-2">
                  <div
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                      active ? 'bg-blue-600 text-white' : done ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                  </div>
                  <span className={`text-xs font-medium ${active ? 'text-blue-600' : 'text-gray-500'}`}>{s.label}</span>
                  {i < STEPS.length - 1 && <div className="h-px flex-1 bg-gray-200" />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {step === 'review' && (
            <div className="space-y-4">
              <Field label="Work done">{wo.workDoneDescription || '—'}</Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Machine status after">{wo.machineStatusAfterRepair ? MACHINE_STATUS_LABEL[wo.machineStatusAfterRepair] : '—'}</Field>
                <Field label="Test run">{wo.testRunResult ? TEST_RESULT_LABEL[wo.testRunResult] : '—'}</Field>
                <Field label="Checklist">{checklistDone}/{wo.checklist?.length ?? 0} complete</Field>
                <Field label="Parts used">{wo.partsUsed?.length ?? 0}</Field>
              </div>
              {wo.testRunNotes && <Field label="Test notes">{wo.testRunNotes}</Field>}

              {evidence.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Evidence</p>
                  <div className="grid grid-cols-3 gap-2">
                    {evidence.map((e) => (
                      <a
                        key={e.id}
                        href={e.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block aspect-square overflow-hidden rounded-lg border border-gray-200 bg-gray-50"
                      >
                        {e.kind === 'image' ? (
                          <img src={e.url} alt={e.name} className="h-full w-full object-cover" />
                        ) : e.kind === 'video' ? (
                          <video src={e.url} muted className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-1 text-center">
                            <span className="text-2xl">📄</span>
                            <span className="w-full truncate text-[9px] text-gray-500">{e.name}</span>
                          </div>
                        )}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2 border-t border-gray-200 pt-4">
                <button
                  onClick={() => setStep('rca')}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 font-semibold text-white hover:bg-blue-700"
                >
                  <Check className="h-4 w-4" /> Approve completion
                </button>

                {!showSendBack ? (
                  <button
                    onClick={() => setShowSendBack(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 font-medium text-gray-700 hover:bg-gray-50"
                  >
                    <RotateCcw className="h-4 w-4" /> Send back
                  </button>
                ) : (
                  <div className="space-y-2 rounded-lg border border-gray-200 p-3">
                    <textarea
                      value={sendBackReason}
                      onChange={(e) => setSendBackReason(e.target.value)}
                      placeholder="Reason for sending back to technician…"
                      rows={3}
                      className="w-full rounded-lg border border-gray-300 p-2 text-sm focus:border-blue-500 focus:outline-none"
                    />
                    <button
                      onClick={handleSendBack}
                      disabled={statusLoading}
                      className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                    >
                      <RotateCcw className="h-4 w-4" /> Confirm send back → In Progress
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 'rca' && (
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Root cause category</label>
                <select
                  value={rootCauseEnum}
                  onChange={(e) => setRootCauseEnum(e.target.value as WORootCause)}
                  className="w-full rounded-lg border border-gray-300 p-2 text-sm focus:border-blue-500 focus:outline-none"
                >
                  {Object.entries(WO_ROOT_CAUSE_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Root cause description *</label>
                <textarea
                  value={rootCauseText}
                  onChange={(e) => setRootCauseText(e.target.value)}
                  rows={3}
                  placeholder="Describe the underlying root cause…"
                  className="w-full rounded-lg border border-gray-300 p-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <button
                  onClick={() => setShowWhys((v) => !v)}
                  className="flex items-center gap-1 text-sm font-medium text-blue-600"
                >
                  {showWhys ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  5-Whys analysis (optional)
                </button>
                {showWhys && (
                  <div className="mt-2 space-y-2">
                    {FIVE_WHY_QUESTIONS.map((q, i) => (
                      <div key={i}>
                        <label className="mb-0.5 block text-[11px] text-gray-500">{q}</label>
                        <input
                          value={whys[i]}
                          onChange={(e) => setWhys((prev) => prev.map((w, j) => (j === i ? e.target.value : w)))}
                          className="w-full rounded-lg border border-gray-300 p-2 text-sm focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Corrective action (optional)</label>
                <textarea
                  value={correctiveAction}
                  onChange={(e) => setCorrectiveAction(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 p-2 text-sm focus:border-blue-500 focus:outline-none"
                />
                <label className="mt-2 flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={makeCorrectiveWO}
                    onChange={(e) => setMakeCorrectiveWO(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  Create a corrective work order from this action
                </label>
              </div>

              <div className="flex gap-2 border-t border-gray-200 pt-4">
                <button onClick={() => setStep('review')} className="rounded-lg border border-gray-300 px-4 py-2.5 font-medium text-gray-700 hover:bg-gray-50">
                  Back
                </button>
                <button
                  onClick={handleSaveRCA}
                  disabled={rcaSaving}
                  className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  Save RCA &amp; continue
                </button>
              </div>
            </div>
          )}

          {step === 'signoff' && (
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Signature</label>
                <SignatureCanvas onSave={setSignature} />
                {signature && <p className="mt-1 text-xs text-green-600">Signature captured.</p>}
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Sign-off notes (optional)</label>
                <textarea
                  value={signNotes}
                  onChange={(e) => setSignNotes(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 p-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="space-y-2 border-t border-gray-200 pt-4">
                <button
                  onClick={() => handleSignOff(false)}
                  disabled={signLoading}
                  className="w-full rounded-lg border border-blue-600 px-4 py-2.5 font-semibold text-blue-600 hover:bg-blue-50 disabled:opacity-50"
                >
                  Sign off
                </button>
                <button
                  onClick={() => handleSignOff(true)}
                  disabled={signLoading}
                  className="w-full rounded-lg bg-blue-600 px-4 py-2.5 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  Sign off &amp; close
                </button>
                <button onClick={() => setStep('rca')} className="w-full py-1 text-sm text-gray-500">
                  Back to root cause
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-0.5 text-sm text-gray-900">{children}</p>
    </div>
  );
}
