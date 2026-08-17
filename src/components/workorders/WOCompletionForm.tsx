import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { WO_ROOT_CAUSE_LABELS } from '../../constants/woConfig';
import { useWOCompletion } from '../../hooks/useWOCompletion';
import { useAuthStore } from '../../store/authStore';
import { useCompanyUsers } from '../../hooks/useCompanyUsers';
import { PartSearchInput } from '../inventory/shared/PartSearchInput';
import type { WorkOrder, PartUsed, PostRepairChecklistItem } from '../../types/workOrder';
import { buildTechnicianWorkLogs } from '../../lib/workorders/technicianWorkLogs';

interface WOCompletionFormProps {
  workOrder: WorkOrder;
  onCompleted: () => void;
  onCancel: () => void;
}

const ROLE_LABEL_KEYS: Record<string, string> = {
  technician: 'common.workorders.completionForm.roleLabels.technician',
  trainee: 'common.workorders.completionForm.roleLabels.trainee',
  supervisor: 'common.workorders.completionForm.roleLabels.supervisor',
  plant_manager: 'common.workorders.completionForm.roleLabels.plant_manager',
  store_keeper: 'common.workorders.completionForm.roleLabels.store_keeper',
  floor_operator: 'common.workorders.completionForm.roleLabels.floor_operator',
  hr_officer: 'common.workorders.completionForm.roleLabels.hr_officer',
  safety_officer: 'common.workorders.completionForm.roleLabels.safety_officer',
  admin: 'common.workorders.completionForm.roleLabels.admin',
};

export function WOCompletionForm({ workOrder, onCompleted, onCancel }: WOCompletionFormProps) {
  const { t } = useTranslation();
  const roleLabel = (role: string): string => (ROLE_LABEL_KEYS[role] ? t(ROLE_LABEL_KEYS[role]) : role.replace(/_/g, ' '));
  const STEPS = [
    t('common.workorders.completionForm.steps.step1'),
    t('common.workorders.completionForm.steps.step2'),
    t('common.workorders.completionForm.steps.step3'),
    t('common.workorders.completionForm.steps.step4'),
    t('common.workorders.completionForm.steps.step5'),
    t('common.workorders.completionForm.steps.step6'),
    t('common.workorders.completionForm.steps.step7'),
  ];
  const [step, setStep] = useState(0);
  const [partsUsed, setPartsUsed] = useState<PartUsed[]>(workOrder.partsUsed ?? []);

  // Parts the technician requested and the store keeper actually issued
  // (collected) during this WO weren't showing up here — the completion
  // form only ever seeded from `partsUsed`, never from `partsRequests`, so a
  // collected part had to be re-entered by hand. Auto-add any issued request
  // not already represented, looking up its catalog unit cost the same way
  // manually-picked parts get theirs (see PartSearchInput's onSelect above).
  useEffect(() => {
    const issued = (workOrder.partsRequests ?? []).filter((r) => r.status === 'issued' && r.partId);
    if (issued.length === 0) return;
    setPartsUsed((prev) => {
      const haveIds = new Set(prev.map((p) => p.partId).filter(Boolean));
      const missing = issued.filter((r) => !haveIds.has(r.partId));
      if (missing.length === 0) return prev;
      return [
        ...prev,
        ...missing.map((r) => ({
          partId: r.partId,
          partName: r.partName,
          quantity: r.quantity,
          unit: r.unit,
          source: 'stock' as const,
          unitCost: 0,
          totalCost: 0,
          warrantyMonths: null,
        })),
      ];
    });
    // Fill in catalog unit cost for the parts just added, without blocking
    // the initial render on the network round trip.
    (async () => {
      for (const r of issued) {
        try {
          const snap = await getDoc(doc(db, 'inventoryParts', r.partId));
          if (!snap.exists()) continue;
          const unitCost = (snap.data() as { unitCost?: number }).unitCost ?? 0;
          setPartsUsed((prev) =>
            prev.map((p) =>
              p.partId === r.partId && p.unitCost === 0
                ? { ...p, unitCost, totalCost: unitCost * p.quantity }
                : p,
            ),
          );
        } catch {
          // best-effort — leave unit cost at 0 if the lookup fails
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workOrder.id]);
  // Each assignee's own "work done" text — kept separate per person so a team
  // work order records who did what instead of one description for everyone.
  // Seeded from each person's own self-completion (assigneeCompletions) so the
  // finaliser never re-types (or overwrites) someone else's words.
  const submittedWorkDone = useMemo(() => {
    const m: Record<string, string> = {};
    for (const c of workOrder.assigneeCompletions ?? []) {
      if (c.workDoneDescription?.trim()) m[c.technicianId] = c.workDoneDescription.trim();
    }
    return m;
  }, [workOrder.assigneeCompletions]);
  const [perTechWorkDone, setPerTechWorkDone] = useState<Record<string, string>>(submittedWorkDone);

  // Roles/designations for the assigned people, so each work log shows the
  // person's role and the sign-off/detail views can display "Name (Role)".
  const companyId = useAuthStore((s) => s.userProfile?.companyId) ?? '';
  const { users: companyUsers } = useCompanyUsers(companyId);
  const roleById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const u of companyUsers) m[u.id] = u.role;
    return m;
  }, [companyUsers]);
  // Build one work-log row per assigned person. Pair ids with names by index,
  // but drive off whichever array is longer so nobody is dropped if the two
  // arrays are out of sync (an assignee with a name but no id — or vice versa —
  // must still get a log row, otherwise their work goes uncaptured).
  // Assignees, paired with their ids by index but driven off whichever array
  // is longer so nobody is dropped when the two are out of sync (an assignee
  // with a name but no id — or vice versa — must still get a log row).
  const assignees = useMemo(() => {
    const count = Math.max(
      workOrder.assignedTechnicianIds.length,
      workOrder.assignedTechnicianNames.length,
    );
    return Array.from({ length: count }, (_, i) => {
      const technicianId = workOrder.assignedTechnicianIds[i] ?? '';
      return {
        technicianId,
        technicianName:
          workOrder.assignedTechnicianNames[i] ?? workOrder.assignedTechnicianIds[i] ?? `Technician ${i + 1}`,
        technicianRole: roleById[technicianId] ?? '',
      };
    });
  }, [workOrder.assignedTechnicianIds, workOrder.assignedTechnicianNames, roleById]);

  const [postRepairChecklist, setPostRepairChecklist] = useState<PostRepairChecklistItem[]>(
    workOrder.checklist.map((item) => ({
      stepDescription: item.stepDescription,
      isCompleted: false,
      completedBy: null,
      completedAt: null,
      result: null,
      notes: null,
    })),
  );
  const [finalPhotos, setFinalPhotos] = useState<File[]>([]);
  const [updatedCAD, setUpdatedCAD] = useState<File[]>([]);
  const [warrantyDocs, setWarrantyDocs] = useState<File[]>([]);

  const { submitCompletion, loading } = useWOCompletion();

  // Actual start time was auto-stamped the moment the technician tapped
  // Start; actual end time auto-stamps to the moment completion is submitted.
  // Neither is manually editable — that's what caused these timestamps (and
  // the hours-worked calculation derived from them) to go uncaptured.
  const actualStartTime = workOrder.actualStartTime?.toDate() ?? new Date();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const form = useForm<any>({
    defaultValues: {
      workDoneDescription: '',
      rootCause: 'unknown',
      rootCauseDescription: '',
      testRunResult: 'pass',
      testRunNotes: '',
      machineStatusAfterRepair: 'operational',
    },
  });

  const { register, watch, setValue: formSetValue } = form;
  const machineStatus = watch('machineStatusAfterRepair');
  const rootCause = watch('rootCause');
  const testRunResult = watch('testRunResult');

  // Live preview of hours worked so far — the final value is recomputed from
  // the real actual end time at submission.
  const [previewNow, setPreviewNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setPreviewNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);
  const previewHoursWorked = Math.round(((previewNow - actualStartTime.getTime()) / 3600000) * 100) / 100;

  // Same builder the submission uses, so what the form shows is exactly what
  // gets written.
  // The auto-compiled checklist steps a given person ticked off — computed via
  // the same builder used at submit (with no work-done text) so the preview is
  // exactly what gets stored for that person's steps.
  function completedStepsFor(technicianId: string): string {
    if (!technicianId) return '';
    const [log] = buildTechnicianWorkLogs(
      [{ technicianId, technicianName: '' }],
      workOrder.checklist,
      {},
      previewHoursWorked,
    );
    return log?.tasksDescription ?? '';
  }

  async function handleSubmit() {
    const values = form.getValues();
    const actualEndTime = new Date();
    const hoursWorked = Math.round(((actualEndTime.getTime() - actualStartTime.getTime()) / 3600000) * 100) / 100;
    const finalTechLogs = buildTechnicianWorkLogs(
      assignees,
      workOrder.checklist,
      perTechWorkDone,
      hoursWorked,
    );

    const ok = await submitCompletion(workOrder.id, workOrder.siteId, {
      actualStartTime,
      actualEndTime,
      workDoneDescription: values.workDoneDescription ?? '',
      rootCause: values.rootCause ?? 'unknown',
      rootCauseDescription: values.rootCauseDescription ?? '',
      partsUsed,
      technicianWorkLogs: finalTechLogs,
      contractorHoursLog: workOrder.woType === 'CONTRACTOR' ? {
        hoursOnSite: 0,
        hoursBilled: 0,
        technicianNames: workOrder.contractorTechnicianNames,
        notes: '',
      } : null,
      postRepairChecklist,
      testRunResult: values.testRunResult ?? 'pass',
      testRunNotes: values.testRunNotes ?? '',
      finalPhotos,
      machineStatusAfterRepair: values.machineStatusAfterRepair ?? 'operational',
      updatedCADFiles: updatedCAD,
      warrantyDocuments: warrantyDocs,
    });

    if (ok) onCompleted();
  }

  function togglePostRepair(i: number) {
    setPostRepairChecklist((prev) =>
      prev.map((item, idx) =>
        idx === i ? { ...item, isCompleted: !item.isCompleted, result: !item.isCompleted ? 'pass' : null } : item,
      ),
    );
  }

  const allPostRepairDone = postRepairChecklist.every((i) => i.isCompleted);

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
      {/* Step header */}
      <div className="px-6 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900">{t('common.workorders.completionForm.title')}</h3>
          <button type="button" onClick={onCancel} className="text-sm text-gray-400 hover:text-gray-600">
            {t('common.workorders.completionForm.cancel')}
          </button>
        </div>
        <div className="flex gap-1">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full ${
                i === step ? 'bg-blue-600' : i < step ? 'bg-blue-300' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-2">
          {t('common.workorders.completionForm.stepIndicator', { step: step + 1, total: STEPS.length, label: STEPS[step] })}
        </p>
      </div>

      <div className="px-6 py-5 space-y-5">
        {/* Step 0: Work Details */}
        {step === 0 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{t('common.workorders.completionForm.actualStart')}</label>
                <p className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                  {actualStartTime.toLocaleString()}
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{t('common.workorders.completionForm.actualEnd')}</label>
                <p className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500">
                  {t('common.workorders.completionForm.recordedAutomatically')}
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t('common.workorders.completionForm.workDone')} *</label>
              <textarea
                {...register('workDoneDescription')}
                rows={4}
                placeholder={t('common.workorders.completionForm.workDonePlaceholder')}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t('common.workorders.completionForm.rootCause')} *</label>
              <select
                {...register('rootCause')}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
              >
                {Object.entries(WO_ROOT_CAUSE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>

            {rootCause !== 'unknown' && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{t('common.workorders.completionForm.rootCauseDescription')} *</label>
                <textarea
                  {...register('rootCauseDescription')}
                  rows={3}
                  placeholder={t('common.workorders.completionForm.rootCauseDescriptionPlaceholder')}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 resize-none"
                />
              </div>
            )}
          </div>
        )}

        {/* Step 1: Parts Used */}
        {step === 1 && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-700">{t('common.workorders.completionForm.partsUsed')}</p>

            {/* Pick from the inventory catalog — prefills name/unit/cost. */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t('common.workorders.completionForm.addFromStock')}</label>
              <PartSearchInput
                onSelect={(part) =>
                  setPartsUsed((p) => [...p, {
                    partId: part.id,
                    partName: part.name,
                    quantity: 1,
                    unit: part.unit || 'pcs',
                    source: 'stock',
                    unitCost: part.unitCost || 0,
                    totalCost: part.unitCost || 0,
                    warrantyMonths: null,
                  }])
                }
              />
            </div>

            {partsUsed.map((part, i) => {
              const update = (patch: Partial<PartUsed>) =>
                setPartsUsed((p) => p.map((row, idx) => {
                  if (idx !== i) return row;
                  const next = { ...row, ...patch };
                  next.totalCost = (next.quantity || 0) * (next.unitCost || 0);
                  return next;
                }));
              return (
                <div key={i} className="bg-gray-50 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={part.partName}
                      onChange={(e) => update({ partName: e.target.value })}
                      placeholder={t('common.workorders.completionForm.partNamePlaceholder')}
                      readOnly={part.partId !== null}
                      className={`flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm ${part.partId ? 'bg-gray-100 text-gray-600' : 'bg-white text-gray-900'}`}
                    />
                    <button
                      type="button"
                      onClick={() => setPartsUsed((p) => p.filter((_, idx) => idx !== i))}
                      className="text-red-400 hover:text-red-600 text-lg leading-none px-1"
                      aria-label={t('common.workorders.completionForm.removePart')}
                    >×</button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[11px] text-gray-500 mb-0.5">{t('common.workorders.completionForm.qty')}</label>
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={part.quantity}
                        onChange={(e) => update({ quantity: Number(e.target.value) || 0 })}
                        className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-gray-500 mb-0.5">{t('common.workorders.completionForm.unit')}</label>
                      <input
                        type="text"
                        value={part.unit}
                        onChange={(e) => update({ unit: e.target.value })}
                        className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-gray-500 mb-0.5">{t('common.workorders.completionForm.unitCost')}</label>
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={part.unitCost}
                        onChange={(e) => update({ unitCost: Number(e.target.value) || 0 })}
                        // Catalog-sourced parts carry a fixed catalog price —
                        // only manually-entered external/purchased parts (no
                        // partId) can have their unit cost typed in.
                        readOnly={part.partId !== null}
                        title={part.partId !== null ? t('common.workorders.completionForm.catalogPriceNotEditable') : undefined}
                        className={`w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm ${
                          part.partId !== null ? 'bg-gray-100 text-gray-600' : 'bg-white text-gray-900'
                        }`}
                      />
                    </div>
                  </div>
                  <p className="text-right text-xs text-gray-500">
                    {t('common.workorders.completionForm.total')} <span className="font-semibold text-gray-800">LKR {part.totalCost.toLocaleString()}</span>
                  </p>
                </div>
              );
            })}

            <button
              type="button"
              onClick={() => setPartsUsed((p) => [...p, {
                partId: null,
                partName: '',
                quantity: 1,
                unit: 'pcs',
                source: 'external',
                unitCost: 0,
                totalCost: 0,
                warrantyMonths: null,
              }])}
              className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
            >
              {t('common.workorders.completionForm.addExternalPart')}
            </button>

            {partsUsed.length > 0 && (
              <p className="text-right text-sm text-gray-600">
                {t('common.workorders.completionForm.totalPartsCost')}&nbsp;
                <span className="font-semibold text-gray-900">
                  LKR {partsUsed.reduce((s, p) => s + (p.totalCost || 0), 0).toLocaleString()}
                </span>
              </p>
            )}

            {workOrder.partsRequests.length > 0 && (
              <p className="text-xs text-gray-400">
                {t('common.workorders.completionForm.preRequestedParts', { parts: workOrder.partsRequests.map((p) => p.partName).join(', ') })}
              </p>
            )}
          </div>
        )}

        {/* Step 2: Technician Logs — one card per assigned person, capturing
            what that person did (not one shared description for the team). */}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm font-medium text-gray-700">{t('common.workorders.completionForm.techLogs')}</p>
            <p className="text-xs text-gray-400">
              {t('common.workorders.completionForm.techLogsHint')}
            </p>
            {assignees.length === 0 && (
              <p className="text-sm text-gray-400">{t('common.workorders.completionForm.noTechniciansAssigned')}</p>
            )}
            {assignees.map((a, i) => {
              const steps = completedStepsFor(a.technicianId);
              return (
                <div key={a.technicianId || i} className="bg-gray-50 rounded-xl p-4 space-y-3">
                  <p className="text-sm font-semibold text-gray-800">
                    {a.technicianName}
                    {a.technicianRole && <span className="ml-1 text-xs font-normal text-gray-500">({roleLabel(a.technicianRole)})</span>}
                  </p>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">{t('common.workorders.completionForm.hoursWorked')}</label>
                    <p className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
                      {previewHoursWorked.toFixed(2)} hrs
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">{t('common.workorders.completionForm.completedChecklistSteps')}</label>
                    {steps ? (
                      <p className="w-full whitespace-pre-wrap rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">{steps}</p>
                    ) : (
                      <p className="w-full rounded-lg border border-dashed border-gray-200 bg-white px-3 py-2 text-sm text-gray-400">
                        {t('common.workorders.completionForm.noStepsCompletedByPerson')}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">{t('common.workorders.completionForm.workDoneBy', { name: a.technicianName })}</label>
                    {submittedWorkDone[a.technicianId] != null ? (
                      // The person recorded their own work — shown read-only so
                      // the finaliser can review it but not rewrite it.
                      <p className="w-full whitespace-pre-wrap rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
                        {submittedWorkDone[a.technicianId]}
                      </p>
                    ) : (
                      <textarea
                        rows={2}
                        value={perTechWorkDone[a.technicianId] ?? ''}
                        onChange={(e) => setPerTechWorkDone((prev) => ({ ...prev, [a.technicianId]: e.target.value }))}
                        placeholder={t('common.workorders.completionForm.workDoneByPlaceholder', { name: a.technicianName })}
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 resize-none"
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Step 3: Post-Repair Checklist */}
        {step === 3 && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-700">{t('common.workorders.completionForm.postRepairChecklist')}</p>
            {postRepairChecklist.length === 0 ? (
              <p className="text-sm text-gray-400">{t('common.workorders.completionForm.noChecklistSteps')}</p>
            ) : (
              <ol className="space-y-2">
                {postRepairChecklist.map((item, i) => (
                  <li key={i} className="flex items-center gap-3 bg-gray-50 rounded-lg px-4 py-3">
                    <button
                      type="button"
                      onClick={() => togglePostRepair(i)}
                      className={`h-6 w-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${
                        item.isCompleted ? 'border-emerald-500 bg-emerald-500' : 'border-gray-300'
                      }`}
                    >
                      {item.isCompleted && <span className="text-white text-xs">✓</span>}
                    </button>
                    <span className={`text-sm flex-1 ${item.isCompleted ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                      {item.stepDescription}
                    </span>
                    {item.isCompleted && (
                      <span className="text-xs text-emerald-600 font-medium">{t('common.workorders.completionForm.pass')}</span>
                    )}
                  </li>
                ))}
              </ol>
            )}
            {!allPostRepairDone && postRepairChecklist.length > 0 && (
              <p className="text-xs text-amber-600">{t('common.workorders.completionForm.allStepsMustPass')}</p>
            )}
          </div>
        )}

        {/* Step 4: Test Run */}
        {step === 4 && (
          <div className="space-y-4">
            <p className="text-sm font-medium text-gray-700">{t('common.workorders.completionForm.testRun')}</p>
            <div className="flex gap-3">
              {(['pass', 'fail', 'partial'] as const).map((result) => (
                <button
                  key={result}
                  type="button"
                  onClick={() => form.setValue('testRunResult', result)}
                  className={`flex-1 py-3 rounded-xl text-sm font-semibold border-2 capitalize transition-all ${
                    testRunResult === result
                      ? result === 'pass'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : result === 'fail'
                        ? 'border-red-500 bg-red-50 text-red-700'
                        : 'border-amber-500 bg-amber-50 text-amber-700'
                      : 'border-gray-100 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  {result === 'pass' ? t('common.workorders.reviewSignOff.testResult.pass') : result === 'fail' ? t('common.workorders.reviewSignOff.testResult.fail') : t('common.workorders.reviewSignOff.testResult.partial')}
                </button>
              ))}
            </div>
            {(testRunResult === 'fail' || testRunResult === 'partial') && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  {t('common.workorders.completionForm.testRunNotes')} * <span className="text-gray-400">{t('common.workorders.completionForm.testRunNotesRequired')}</span>
                </label>
                <textarea
                  {...register('testRunNotes')}
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 resize-none"
                />
              </div>
            )}
          </div>
        )}

        {/* Step 5: Final Photos */}
        {step === 5 && (
          <div className="space-y-4">
            <p className="text-sm font-medium text-gray-700">{t('common.workorders.completionForm.finalPhotos')}</p>
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl p-8 cursor-pointer hover:border-blue-400">
              <span className="text-4xl mb-2">📷</span>
              <span className="text-sm text-gray-600">{t('common.workorders.completionForm.addPhoto')}</span>
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.heic"
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  setFinalPhotos((prev) => [...prev, ...files]);
                }}
              />
            </label>
            {finalPhotos.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {finalPhotos.map((f, i) => (
                  <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
                    <img
                      src={URL.createObjectURL(f)}
                      alt={f.name}
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setFinalPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                      className="absolute top-1 right-1 bg-black/50 text-white rounded-full h-5 w-5 text-xs flex items-center justify-center"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            {finalPhotos.length === 0 && (
              <p className="text-xs text-gray-400">{t('common.workorders.completionForm.photosOptionalHint')}</p>
            )}
          </div>
        )}

        {/* Step 6: Machine Status + optional uploads */}
        {step === 6 && (
          <div className="space-y-5">
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">{t('common.workorders.completionForm.machineStatus')}</p>
              <div className="space-y-2">
                {(['operational', 'partially_operational', 'still_down'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => formSetValue('machineStatusAfterRepair', s)}
                    className={`w-full text-left px-4 py-3 rounded-xl border-2 text-sm transition-all ${
                      machineStatus === s
                        ? s === 'operational'
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                          : s === 'partially_operational'
                          ? 'border-amber-500 bg-amber-50 text-amber-700'
                          : 'border-red-500 bg-red-50 text-red-700'
                        : 'border-gray-100 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {s === 'operational' && t('common.workorders.completionForm.statusOperational')}
                    {s === 'partially_operational' && t('common.workorders.completionForm.statusPartiallyOperational')}
                    {s === 'still_down' && t('common.workorders.completionForm.statusStillDown')}
                  </button>
                ))}
              </div>
            </div>

            {workOrder.woType === 'MODIFICATION' && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">{t('common.workorders.completionForm.updatedCAD')}</p>
                <label className="block border-2 border-dashed border-gray-300 rounded-xl p-4 cursor-pointer hover:border-blue-400 text-sm text-gray-500 text-center">
                  {t('common.workorders.completionForm.uploadUpdatedCAD')}
                  <input
                    type="file"
                    multiple
                    accept=".dwg,.dxf,.step,.stp,.iges,.igs,.stl"
                    className="hidden"
                    onChange={(e) => setUpdatedCAD(Array.from(e.target.files ?? []))}
                  />
                </label>
                {updatedCAD.length > 0 && (
                  <p className="text-xs text-emerald-600 mt-1">{t('common.workorders.completionForm.filesSelected', { count: updatedCAD.length })}</p>
                )}
              </div>
            )}

            {partsUsed.some((p) => p.warrantyMonths) && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">{t('common.workorders.completionForm.warrantyDocs')}</p>
                <label className="block border-2 border-dashed border-gray-300 rounded-xl p-4 cursor-pointer hover:border-blue-400 text-sm text-gray-500 text-center">
                  {t('common.workorders.completionForm.uploadWarrantyDocs')}
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="hidden"
                    onChange={(e) => setWarrantyDocs(Array.from(e.target.files ?? []))}
                  />
                </label>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-gray-100 flex justify-between gap-3">
        <button
          type="button"
          onClick={step === 0 ? onCancel : () => setStep((s) => s - 1)}
          className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
        >
          {step === 0 ? t('common.workorders.completionForm.cancel') : t('common.workorders.completionForm.back')}
        </button>

        {step < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={() => setStep((s) => s + 1)}
            disabled={step === 3 && !allPostRepairDone && postRepairChecklist.length > 0}
            className="px-6 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {t('common.workorders.completionForm.next')}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="px-6 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            {loading ? t('common.workorders.completionForm.submitting') : t('common.workorders.completionForm.submitCompletion')}
          </button>
        )}
      </div>
    </div>
  );
}
