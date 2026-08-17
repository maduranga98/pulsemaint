import { useMemo, useState } from 'react';
import { X, Check, ChevronDown, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
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

const ROLE_LABEL_KEYS: Record<string, string> = {
  technician: 'common.workorders.reviewSignOff.roleLabels.technician',
  trainee: 'common.workorders.reviewSignOff.roleLabels.trainee',
  supervisor: 'common.workorders.reviewSignOff.roleLabels.supervisor',
  plant_manager: 'common.workorders.reviewSignOff.roleLabels.plant_manager',
  store_keeper: 'common.workorders.reviewSignOff.roleLabels.store_keeper',
  floor_operator: 'common.workorders.reviewSignOff.roleLabels.floor_operator',
  hr_officer: 'common.workorders.reviewSignOff.roleLabels.hr_officer',
  safety_officer: 'common.workorders.reviewSignOff.roleLabels.safety_officer',
  admin: 'common.workorders.reviewSignOff.roleLabels.admin',
};

const TEST_RESULT_LABEL_KEYS: Record<string, string> = {
  pass: 'common.workorders.reviewSignOff.testResult.pass',
  fail: 'common.workorders.reviewSignOff.testResult.fail',
  partial: 'common.workorders.reviewSignOff.testResult.partial',
};

const MACHINE_STATUS_LABEL_KEYS: Record<string, string> = {
  operational: 'common.workorders.reviewSignOff.machineStatus.operational',
  partially_operational: 'common.workorders.reviewSignOff.machineStatus.partially_operational',
  still_down: 'common.workorders.reviewSignOff.machineStatus.still_down',
};

export function WOReviewSignOffPanel({ workOrder, onClose, onDone }: Props) {
  const { t } = useTranslation();
  const wo = workOrder;
  const signOffRoleLabel = (role: string): string => (ROLE_LABEL_KEYS[role] ? t(ROLE_LABEL_KEYS[role]) : role.replace(/_/g, ' '));
  const STEPS: { key: Step; label: string }[] = [
    { key: 'review', label: t('common.workorders.reviewSignOff.stepReview') },
    { key: 'signoff', label: t('common.workorders.reviewSignOff.stepSignoff') },
  ];
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
  const userName = userProfile?.fullName || user?.displayName || '';

  const checklistDone = useMemo(() => (wo.checklist ?? []).filter((c) => c.isCompleted).length, [wo.checklist]);
  const evidence = useMemo(() => {
    const docs = (wo.documents ?? []).filter((d) => !d.isCompletionDocument);
    const photos = (wo.finalPhotos ?? []).map((url, i) => ({ id: `fp_${i}`, url, kind: 'image' as const, name: `Final photo ${i + 1}` }));
    const docItems = docs.map((d) => ({ id: d.id, url: d.url, kind: d.fileType === 'video' ? 'video' as const : d.fileType === 'image' ? 'image' as const : 'file' as const, name: d.name }));
    return [...photos, ...docItems];
  }, [wo.documents, wo.finalPhotos]);

  async function handleSaveRCA() {
    if (!rootCauseText.trim()) {
      toast.error(t('common.workorders.reviewSignOff.rootCauseDescriptionRequired'));
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
        toast.success(t('common.workorders.reviewSignOff.correctiveWOCreated'));
      }
      toast.success(t('common.workorders.reviewSignOff.rcaSaved'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('common.workorders.reviewSignOff.rcaSaveFailed'));
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
              <Field label={t('common.workorders.reviewSignOff.fieldWorkDone')}>{wo.workDoneDescription || ''}</Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t('common.workorders.reviewSignOff.fieldMachineStatusAfter')}>{wo.machineStatusAfterRepair ? t(MACHINE_STATUS_LABEL_KEYS[wo.machineStatusAfterRepair]) : ''}</Field>
                <Field label={t('common.workorders.reviewSignOff.fieldTestRun')}>{wo.testRunResult ? t(TEST_RESULT_LABEL_KEYS[wo.testRunResult]) : ''}</Field>
                <Field label={t('common.workorders.reviewSignOff.fieldChecklist')}>{t('common.workorders.reviewSignOff.checklistComplete', { done: checklistDone, total: wo.checklist?.length ?? 0 })}</Field>
                <Field label={t('common.workorders.reviewSignOff.fieldPartsUsed')}>{wo.partsUsed?.length ?? 0}</Field>
              </div>
              {wo.testRunNotes && <Field label={t('common.workorders.reviewSignOff.fieldTestNotes')}>{wo.testRunNotes}</Field>}

              {/* Work done by each assigned person, with their role — so the
                  supervisor signing off sees exactly who did what. */}
              {(wo.technicianWorkLogs ?? []).length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{t('common.workorders.reviewSignOff.workDoneByTeam')}</p>
                  <div className="space-y-2">
                    {(wo.technicianWorkLogs ?? []).map((log, i) => (
                      <div key={log.technicianId || i} className="rounded-lg border border-blue-800 bg-blue-950 px-4 py-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-white">
                            {log.technicianName}
                            {log.technicianRole && <span className="ml-1 text-xs font-normal text-blue-200">({signOffRoleLabel(log.technicianRole)})</span>}
                          </p>
                          <span className="whitespace-nowrap text-xs text-blue-200">{t('common.workorders.reviewSignOff.hoursWorked', { hours: log.hoursWorked.toFixed(2) })}</span>
                        </div>
                        {log.tasksDescription ? (
                          <p className="mt-1 whitespace-pre-wrap text-xs text-blue-100">{log.tasksDescription}</p>
                        ) : (
                          <p className="mt-1 text-xs text-blue-300/70">{t('common.workorders.reviewSignOff.noIndividualTasks')}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(wo.partsUsed ?? []).length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{t('common.workorders.reviewSignOff.partsUsedTitle')}</p>
                  <div className="space-y-2">
                    {/* Dark blue card with explicit light text: the previous
                        light emerald card inherited the app's dark-theme text
                        colour, leaving the part name and quantity unreadable. */}
                    {(wo.partsUsed ?? []).map((part, i) => (
                      <div key={i} className="flex items-center gap-3 rounded-lg border border-blue-800 bg-blue-950 px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-white">{part.partName}</p>
                          <p className="text-xs text-blue-200">
                            {part.quantity} {part.unit} · {part.source === 'stock' ? t('common.workorders.reviewSignOff.fromStock') : t('common.workorders.reviewSignOff.externalPurchase')}
                          </p>
                        </div>
                        <span className="whitespace-nowrap text-sm font-semibold text-blue-50">
                          {part.totalCost > 0 ? `LKR ${part.totalCost.toLocaleString()}` : ''}
                        </span>
                      </div>
                    ))}
                    <div className="flex justify-end rounded-lg bg-blue-950 px-4 py-2 text-sm text-blue-200">
                      {t('common.workorders.reviewSignOff.totalPartsCost')}&nbsp;
                      <span className="font-semibold text-white">
                        LKR {(wo.partsUsed ?? []).reduce((s, p) => s + (p.totalCost ?? 0), 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {evidence.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{t('common.workorders.reviewSignOff.evidence')}</p>
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
                    <span>{t('common.workorders.reviewSignOff.rcaSectionTitle')}</span>
                    {showRCA ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>
                  {showRCA && (
                    <div className="space-y-3 border-t border-gray-100 p-3">
                      <div>
                        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">{t('common.workorders.reviewSignOff.rootCauseCategory')}</label>
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
                        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">{t('common.workorders.reviewSignOff.rootCauseDescriptionLabel')}</label>
                        <textarea
                          value={rootCauseText}
                          onChange={(e) => setRootCauseText(e.target.value)}
                          rows={3}
                          placeholder={t('common.workorders.reviewSignOff.rootCauseDescriptionPlaceholder')}
                          className="w-full rounded-lg border border-gray-300 p-2 text-sm focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <button
                          onClick={() => setShowWhys((v) => !v)}
                          className="flex items-center gap-1 text-sm font-medium text-blue-600"
                        >
                          {showWhys ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          {t('common.workorders.reviewSignOff.fiveWhys')}
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
                        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">{t('common.workorders.reviewSignOff.correctiveAction')}</label>
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
                          {t('common.workorders.reviewSignOff.createCorrectiveWO')}
                        </label>
                      </div>
                      <button
                        onClick={handleSaveRCA}
                        disabled={rcaSaving}
                        className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        {rcaSaving ? t('common.workorders.reviewSignOff.saving') : t('common.workorders.reviewSignOff.saveRCA')}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {!canSignOff ? (
                <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-500">
                  {(userProfile?.role === 'plant_manager' || userProfile?.role === 'supervisor') && isOwnWorkOrder
                    ? t('common.workorders.reviewSignOff.notSupervisorOwnWO')
                    : t('common.workorders.reviewSignOff.viewOnly')}
                </p>
              ) : (
                <div className="border-t border-gray-200 pt-4">
                  <button
                    onClick={() => setStep('signoff')}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 font-semibold text-white hover:bg-blue-700"
                  >
                    <Check className="h-4 w-4" /> {t('common.workorders.reviewSignOff.continueToSignOff')}
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
