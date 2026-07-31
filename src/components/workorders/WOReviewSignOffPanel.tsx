import { useMemo, useState } from 'react';
import { X, Check, ChevronDown, ChevronRight } from 'lucide-react';
import type { WorkOrder, WORootCause } from '../../types/workOrder';
import { WO_ROOT_CAUSE_LABELS } from '../../constants/woConfig';
import { useWORCA, FIVE_WHY_QUESTIONS } from '../../hooks/useWORCA';
import { useAuthStore } from '../../store/authStore';
import { WOTypeBadge } from './WOTypeBadge';
import { PriorityBadge } from './PriorityBadge';
import { WOSignOffForm } from './WOSignOffForm';
import { toast } from 'sonner';

interface Props {
  workOrder: WorkOrder;
  onClose: () => void;
  onDone?: () => void;
}

type Step = 'review' | 'signoff';

const ROLE_LABELS: Record<string, string> = {
  technician: 'Technician', trainee: 'Trainee', supervisor: 'Supervisor',
  plant_manager: 'Plant Manager', store_keeper: 'Store Keeper',
  floor_operator: 'Floor Operator', hr_officer: 'HR Officer',
  safety_officer: 'Safety Officer', admin: 'Admin',
};
function signOffRoleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role.replace(/_/g, ' ');
}

const STEPS: { key: Step; label: string }[] = [
  { key: 'review', label: 'Review' },
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
  const { saveWORCA, createCorrectiveWO } = useWORCA(wo);

  const [step, setStep] = useState<Step>('review');

  // Who may sign off:
  //  - Admins: anything, including their own.
  //  - The supervisor assigned as supervisor-in-charge of this WO: they own it,
  //    so they sign it off — even if they also raised it (raising and assigning
  //    a job to your own team is the normal supervisor flow).
  //  - Any other supervisor / plant manager: may sign off a WO they didn't
  //    raise, keeping the "second set of eyes" on jobs that aren't theirs.
  const isOwnWorkOrder = userProfile?.id != null && wo.createdBy === userProfile.id;
  const isAssignedSupervisor =
    userProfile?.id != null && wo.supervisorInChargeId === userProfile.id;
  const canSignOff =
    userProfile?.role === 'admin' ||
    (userProfile?.role === 'supervisor' && (isAssignedSupervisor || !isOwnWorkOrder)) ||
    (userProfile?.role === 'plant_manager' && !isOwnWorkOrder);

  // Optional root-cause analysis (not required to sign off).
  const [showRCA, setShowRCA] = useState(false);
  const [rootCauseEnum, setRootCauseEnum] = useState<WORootCause>(wo.rootCause ?? 'unknown');
  const [rootCauseText, setRootCauseText] = useState(wo.rootCauseDescription ?? '');
  const [showWhys, setShowWhys] = useState(false);
  const [whys, setWhys] = useState<string[]>(['', '', '', '', '']);
  const [correctiveAction, setCorrectiveAction] = useState('');
  const [makeCorrectiveWO, setMakeCorrectiveWO] = useState(false);
  const [rcaSaving, setRcaSaving] = useState(false);

  const uid = user?.uid ?? '';
  const userName = user?.displayName ?? userProfile?.fullName ?? '';

  const checklistDone = useMemo(() => (wo.checklist ?? []).filter((c) => c.isCompleted).length, [wo.checklist]);
  const evidence = useMemo(() => {
    const docs = (wo.documents ?? []).filter((d) => !d.isCompletionDocument);
    const photos = (wo.finalPhotos ?? []).map((url, i) => ({ id: `fp_${i}`, url, kind: 'image' as const, name: `Final photo ${i + 1}` }));
    const docItems = docs.map((d) => ({ id: d.id, url: d.url, kind: d.fileType === 'video' ? 'video' as const : d.fileType === 'image' ? 'image' as const : 'file' as const, name: d.name }));
    return [...photos, ...docItems];
  }, [wo.documents, wo.finalPhotos]);

  async function handleSaveRCA() {
    if (!rootCauseText.trim()) {
      toast.error('Root cause description is required to save the analysis.');
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
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save RCA');
    } finally {
      setRcaSaving(false);
    }
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
              <Field label="Work done">{wo.workDoneDescription || ''}</Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Machine status after">{wo.machineStatusAfterRepair ? MACHINE_STATUS_LABEL[wo.machineStatusAfterRepair] : ''}</Field>
                <Field label="Test run">{wo.testRunResult ? TEST_RESULT_LABEL[wo.testRunResult] : ''}</Field>
                <Field label="Checklist">{checklistDone}/{wo.checklist?.length ?? 0} complete</Field>
                <Field label="Parts used">{wo.partsUsed?.length ?? 0}</Field>
              </div>
              {wo.testRunNotes && <Field label="Test notes">{wo.testRunNotes}</Field>}

              {/* Work done by each assigned person, with their role — so the
                  supervisor signing off sees exactly who did what. */}
              {(wo.technicianWorkLogs ?? []).length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Work done by team</p>
                  <div className="space-y-2">
                    {(wo.technicianWorkLogs ?? []).map((log, i) => (
                      <div key={log.technicianId || i} className="rounded-lg border border-blue-800 bg-blue-950 px-4 py-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-white">
                            {log.technicianName}
                            {log.technicianRole && <span className="ml-1 text-xs font-normal text-blue-200">({signOffRoleLabel(log.technicianRole)})</span>}
                          </p>
                          <span className="whitespace-nowrap text-xs text-blue-200">{log.hoursWorked.toFixed(2)} hrs</span>
                        </div>
                        {log.tasksDescription ? (
                          <p className="mt-1 whitespace-pre-wrap text-xs text-blue-100">{log.tasksDescription}</p>
                        ) : (
                          <p className="mt-1 text-xs text-blue-300/70">No individual tasks recorded.</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(wo.partsUsed ?? []).length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Parts used</p>
                  <div className="space-y-2">
                    {/* Dark blue card with explicit light text: the previous
                        light emerald card inherited the app's dark-theme text
                        colour, leaving the part name and quantity unreadable. */}
                    {(wo.partsUsed ?? []).map((part, i) => (
                      <div key={i} className="flex items-center gap-3 rounded-lg border border-blue-800 bg-blue-950 px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-white">{part.partName}</p>
                          <p className="text-xs text-blue-200">
                            {part.quantity} {part.unit} · {part.source === 'stock' ? 'From store stock' : 'External purchase'}
                          </p>
                        </div>
                        <span className="whitespace-nowrap text-sm font-semibold text-blue-50">
                          {part.totalCost > 0 ? `LKR ${part.totalCost.toLocaleString()}` : ''}
                        </span>
                      </div>
                    ))}
                    <div className="flex justify-end rounded-lg bg-blue-950 px-4 py-2 text-sm text-blue-200">
                      Total parts cost:&nbsp;
                      <span className="font-semibold text-white">
                        LKR {(wo.partsUsed ?? []).reduce((s, p) => s + (p.totalCost ?? 0), 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              )}

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

              {/* Optional root-cause analysis */}
              {canSignOff && (
                <div className="rounded-lg border border-gray-200">
                  <button
                    onClick={() => setShowRCA((v) => !v)}
                    className="flex w-full items-center justify-between px-3 py-2.5 text-sm font-medium text-gray-700"
                  >
                    <span>Root cause analysis (optional)</span>
                    {showRCA ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>
                  {showRCA && (
                    <div className="space-y-3 border-t border-gray-100 p-3">
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
                        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Root cause description</label>
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
                          5-Whys analysis
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
                        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Corrective action</label>
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
                      <button
                        onClick={handleSaveRCA}
                        disabled={rcaSaving}
                        className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        {rcaSaving ? 'Saving…' : 'Save root cause analysis'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {!canSignOff ? (
                <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-500">
                  {(userProfile?.role === 'plant_manager' || userProfile?.role === 'supervisor') && isOwnWorkOrder
                    ? "You created this work order and aren't its supervisor-in-charge, so you can't sign it off yourself — ask its assigned supervisor, another manager, or an admin."
                    : 'You have view-only access — only a supervisor, plant manager, or admin can sign off this work order.'}
                </p>
              ) : (
                <div className="border-t border-gray-200 pt-4">
                  <button
                    onClick={() => setStep('signoff')}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 font-semibold text-white hover:bg-blue-700"
                  >
                    <Check className="h-4 w-4" /> Continue to sign-off
                  </button>
                </div>
              )}
            </div>
          )}

          {step === 'signoff' && canSignOff && (
            <WOSignOffForm
              workOrder={wo}
              onCancel={() => setStep('review')}
              onDone={() => {
                onDone?.();
                onClose();
              }}
            />
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
