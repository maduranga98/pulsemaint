import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { WO_ROOT_CAUSE_LABELS } from '../../constants/woConfig';
import { WO_COPY } from '../../constants/copy';
import { useWOCompletion } from '../../hooks/useWOCompletion';
import { PartSearchInput } from '../inventory/shared/PartSearchInput';
import type { WorkOrder, PartUsed, TechnicianWorkLog, PostRepairChecklistItem } from '../../types/workOrder';

interface WOCompletionFormProps {
  workOrder: WorkOrder;
  onCompleted: () => void;
  onCancel: () => void;
}

const STEPS = [
  WO_COPY.completionStep1,
  WO_COPY.completionStep2,
  WO_COPY.completionStep3,
  WO_COPY.completionStep4,
  WO_COPY.completionStep5,
  WO_COPY.completionStep6,
  WO_COPY.completionStep7,
];

export function WOCompletionForm({ workOrder, onCompleted, onCancel }: WOCompletionFormProps) {
  const [step, setStep] = useState(0);
  const [partsUsed, setPartsUsed] = useState<PartUsed[]>(workOrder.partsUsed ?? []);
  // Build one work-log row per assigned person. Pair ids with names by index,
  // but drive off whichever array is longer so nobody is dropped if the two
  // arrays are out of sync (an assignee with a name but no id — or vice versa —
  // must still get a log row, otherwise their work goes uncaptured).
  const [techLogs, setTechLogs] = useState<TechnicianWorkLog[]>(() => {
    const count = Math.max(
      workOrder.assignedTechnicianIds.length,
      workOrder.assignedTechnicianNames.length,
    );
    return Array.from({ length: count }, (_, i) => ({
      technicianId: workOrder.assignedTechnicianIds[i] ?? '',
      technicianName:
        workOrder.assignedTechnicianNames[i] ?? workOrder.assignedTechnicianIds[i] ?? `Technician ${i + 1}`,
      hoursWorked: 0,
      tasksDescription: '',
    }));
  });
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

  async function handleSubmit() {
    const values = form.getValues();
    const actualEndTime = new Date();
    const hoursWorked = Math.round(((actualEndTime.getTime() - actualStartTime.getTime()) / 3600000) * 100) / 100;
    const finalTechLogs = techLogs.map((log) => ({ ...log, hoursWorked }));

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
          <h3 className="font-semibold text-gray-900">{WO_COPY.completionTitle}</h3>
          <button type="button" onClick={onCancel} className="text-sm text-gray-400 hover:text-gray-600">
            Cancel
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
          {step + 1}/{STEPS.length} — <span className="font-medium">{STEPS[step]}</span>
        </p>
      </div>

      <div className="px-6 py-5 space-y-5">
        {/* Step 0: Work Details */}
        {step === 0 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{WO_COPY.actualStartLabel}</label>
                <p className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                  {actualStartTime.toLocaleString()}
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{WO_COPY.actualEndLabel}</label>
                <p className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500">
                  Recorded automatically on submit
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{WO_COPY.workDoneLabel} *</label>
              <textarea
                {...register('workDoneDescription')}
                rows={4}
                placeholder={WO_COPY.workDonePlaceholder}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{WO_COPY.rootCauseLabel} *</label>
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
                <label className="block text-xs font-medium text-gray-600 mb-1">{WO_COPY.rootCauseDescLabel} *</label>
                <textarea
                  {...register('rootCauseDescription')}
                  rows={3}
                  placeholder={WO_COPY.rootCauseDescPlaceholder}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 resize-none"
                />
              </div>
            )}
          </div>
        )}

        {/* Step 1: Parts Used */}
        {step === 1 && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-700">{WO_COPY.partsUsedLabel}</p>

            {/* Pick from the inventory catalog — prefills name/unit/cost. */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Add from store stock</label>
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
                      placeholder="Part name"
                      readOnly={part.partId !== null}
                      className={`flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm ${part.partId ? 'bg-gray-100 text-gray-600' : 'bg-white text-gray-900'}`}
                    />
                    <button
                      type="button"
                      onClick={() => setPartsUsed((p) => p.filter((_, idx) => idx !== i))}
                      className="text-red-400 hover:text-red-600 text-lg leading-none px-1"
                      aria-label="Remove part"
                    >×</button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[11px] text-gray-500 mb-0.5">Qty</label>
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
                      <label className="block text-[11px] text-gray-500 mb-0.5">Unit</label>
                      <input
                        type="text"
                        value={part.unit}
                        onChange={(e) => update({ unit: e.target.value })}
                        className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-gray-500 mb-0.5">Unit cost (LKR)</label>
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={part.unitCost}
                        onChange={(e) => update({ unitCost: Number(e.target.value) || 0 })}
                        className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
                      />
                    </div>
                  </div>
                  <p className="text-right text-xs text-gray-500">
                    Total: <span className="font-semibold text-gray-800">LKR {part.totalCost.toLocaleString()}</span>
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
              + Add external / purchased part
            </button>

            {partsUsed.length > 0 && (
              <p className="text-right text-sm text-gray-600">
                Total parts cost:&nbsp;
                <span className="font-semibold text-gray-900">
                  LKR {partsUsed.reduce((s, p) => s + (p.totalCost || 0), 0).toLocaleString()}
                </span>
              </p>
            )}

            {workOrder.partsRequests.length > 0 && (
              <p className="text-xs text-gray-400">
                Pre-requested parts: {workOrder.partsRequests.map((p) => p.partName).join(', ')}
              </p>
            )}
          </div>
        )}

        {/* Step 2: Technician Logs */}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm font-medium text-gray-700">{WO_COPY.techLogsLabel}</p>
            <p className="text-xs text-gray-400">
              Hours worked are calculated automatically from the WO's actual start and end times.
            </p>
            {techLogs.length === 0 && (
              <p className="text-sm text-gray-400">No technicians are assigned to this work order.</p>
            )}
            {techLogs.map((log, i) => (
              <div key={log.technicianId || i} className="bg-gray-50 rounded-xl p-4 space-y-3">
                <p className="text-sm font-semibold text-gray-800">{log.technicianName}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">{WO_COPY.hoursWorkedLabel}</label>
                    <p className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
                      {previewHoursWorked.toFixed(2)} hrs
                    </p>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">{WO_COPY.tasksDescLabel}</label>
                  <textarea
                    rows={2}
                    value={log.tasksDescription}
                    onChange={(e) => setTechLogs((prev) =>
                      prev.map((l, idx) => idx === i ? { ...l, tasksDescription: e.target.value } : l),
                    )}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 resize-none"
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Step 3: Post-Repair Checklist */}
        {step === 3 && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-700">{WO_COPY.postRepairChecklistLabel}</p>
            {postRepairChecklist.length === 0 ? (
              <p className="text-sm text-gray-400">No checklist steps were defined for this WO.</p>
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
                      <span className="text-xs text-emerald-600 font-medium">Pass</span>
                    )}
                  </li>
                ))}
              </ol>
            )}
            {!allPostRepairDone && postRepairChecklist.length > 0 && (
              <p className="text-xs text-amber-600">{WO_COPY.allStepsMustPass}</p>
            )}
          </div>
        )}

        {/* Step 4: Test Run */}
        {step === 4 && (
          <div className="space-y-4">
            <p className="text-sm font-medium text-gray-700">{WO_COPY.testRunLabel}</p>
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
                  {result}
                </button>
              ))}
            </div>
            {(testRunResult === 'fail' || testRunResult === 'partial') && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  {WO_COPY.testRunNotesLabel} * <span className="text-gray-400">{WO_COPY.testRunNotesRequired}</span>
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
            <p className="text-sm font-medium text-gray-700">{WO_COPY.finalPhotosLabel}</p>
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl p-8 cursor-pointer hover:border-blue-400">
              <span className="text-4xl mb-2">📷</span>
              <span className="text-sm text-gray-600">{WO_COPY.addPhotoButton}</span>
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
              <p className="text-xs text-red-500">At least 1 photo is required.</p>
            )}
          </div>
        )}

        {/* Step 6: Machine Status + optional uploads */}
        {step === 6 && (
          <div className="space-y-5">
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">{WO_COPY.machineStatusLabel}</p>
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
                    {s === 'operational' && '✅ Operational'}
                    {s === 'partially_operational' && '⚠️ Partially Operational'}
                    {s === 'still_down' && '🔴 Still Down'}
                  </button>
                ))}
              </div>
            </div>

            {workOrder.woType === 'MODIFICATION' && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">{WO_COPY.updatedCADLabel}</p>
                <label className="block border-2 border-dashed border-gray-300 rounded-xl p-4 cursor-pointer hover:border-blue-400 text-sm text-gray-500 text-center">
                  Upload updated CAD files
                  <input
                    type="file"
                    multiple
                    accept=".dwg,.dxf,.step,.stp,.iges,.igs,.stl"
                    className="hidden"
                    onChange={(e) => setUpdatedCAD(Array.from(e.target.files ?? []))}
                  />
                </label>
                {updatedCAD.length > 0 && (
                  <p className="text-xs text-emerald-600 mt-1">{updatedCAD.length} file(s) selected</p>
                )}
              </div>
            )}

            {partsUsed.some((p) => p.warrantyMonths) && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">{WO_COPY.warrantyDocsLabel}</p>
                <label className="block border-2 border-dashed border-gray-300 rounded-xl p-4 cursor-pointer hover:border-blue-400 text-sm text-gray-500 text-center">
                  Upload warranty documents
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
          {step === 0 ? 'Cancel' : '← Back'}
        </button>

        {step < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={() => setStep((s) => s + 1)}
            disabled={step === 3 && !allPostRepairDone && postRepairChecklist.length > 0}
            className="px-6 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            Next →
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || finalPhotos.length === 0}
            className="px-6 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Submitting…' : WO_COPY.submitCompletionButton}
          </button>
        )}
      </div>
    </div>
  );
}
