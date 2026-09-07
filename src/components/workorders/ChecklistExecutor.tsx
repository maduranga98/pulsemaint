import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';
import type { WorkOrder, ChecklistItem } from '../../types/workOrder';
import { computeChecklistItemResult } from '../../lib/lotoGate';
import { Timestamp } from 'firebase/firestore';

interface ChecklistExecutorProps {
  workOrder: WorkOrder;
  onUpdate: (checklist: ChecklistItem[]) => void;
  readOnly?: boolean;
  // The technician's WO execution sheet embeds this on a dark panel; the
  // supervisor's WODetailPanel embeds it on a light one — pick the matching
  // palette instead of hard-coding light-only colors that clash either way.
  dark?: boolean;
}

export function ChecklistExecutor({ workOrder, onUpdate, readOnly = false, dark = false }: ChecklistExecutorProps) {
  const { t } = useTranslation();
  // Picks the dark-panel class string when `dark` is set, else the light one.
  const cls = (light: string, darkCls: string) => (dark ? darkCls : light);
  const user = useAuthStore((s) => s.user);
  const userProfile = useAuthStore((s) => s.userProfile);
  const [localValues, setLocalValues] = useState<Record<number, string>>({});
  const [repairNotes, setRepairNotes] = useState<Record<number, string>>({});
  const [completionNotes, setCompletionNotes] = useState<Record<number, string>>({});

  const uid = user?.uid ?? '';
  const userName = userProfile?.fullName ?? user?.displayName ?? '';
  const role = userProfile?.role;

  // Assignment may be stored under the Firebase Auth uid or the user profile id
  // — match on either so a technician reliably sees their own steps.
  const myIds = [user?.uid, userProfile?.id].filter(Boolean) as string[];

  // Oversight roles (and the WO creator) see the whole checklist; an assigned
  // worker only sees the steps assigned to them (or unassigned/general steps),
  // not steps that belong to someone else.
  const isOversight =
    role === 'admin' ||
    role === 'plant_manager' ||
    role === 'supervisor' ||
    (!!workOrder.createdBy && myIds.includes(workOrder.createdBy));

  const isAssignedToMe = (item: ChecklistItem): boolean => {
    const ids = [
      ...(item.assignedTechnicianIds ?? []),
      ...(item.assignedTechnicianId ? [item.assignedTechnicianId] : []),
    ];
    // Unassigned/general steps are visible to everyone.
    if (ids.length === 0) return true;
    return ids.some((id) => myIds.includes(id));
  };

  // Keep the original index so completion handlers still target the right row
  // after filtering.
  const visibleRows = workOrder.checklist
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => isOversight || isAssignedToMe(item));

  function handleCheckboxToggle(index: number) {
    if (readOnly) return;
    const updated = workOrder.checklist.map((c, i) => {
      if (i !== index) return c;
      if (c.isCompleted) {
        return { ...c, isCompleted: false, completedBy: null, completedByName: null, completedAt: null };
      }
      return {
        ...c,
        isCompleted: true,
        completedBy: uid,
        completedByName: userName,
        // serverTimestamp() is rejected inside array elements — the whole
        // workOrders update fails. Use a client timestamp instead.
        completedAt: Timestamp.now(),
      };
    });
    onUpdate(updated);
  }

  function handleMeasurementInput(index: number, rawValue: string) {
    setLocalValues((prev) => ({ ...prev, [index]: rawValue }));
    const numVal = rawValue === '' ? null : Number(rawValue);
    const item = workOrder.checklist[index];
    const result = computeChecklistItemResult(numVal, item.acceptableMin, item.acceptableMax);
    const updated = workOrder.checklist.map((c, i) => {
      if (i !== index) return c;
      return {
        ...c,
        actualValue: numVal,
        result,
        isCompleted: numVal !== null,
        completedBy: numVal !== null ? uid : null,
        completedByName: numVal !== null ? userName : null,
        completedAt: numVal !== null ? Timestamp.now() : null,
      };
    });
    onUpdate(updated);
  }

  function handleRepairNote(index: number, note: string) {
    setRepairNotes((prev) => ({ ...prev, [index]: note }));
    const updated = workOrder.checklist.map((c, i) => {
      if (i !== index) return c;
      return { ...c, repairNote: note };
    });
    onUpdate(updated);
  }

  function handleCompletionNote(index: number, note: string) {
    setCompletionNotes((prev) => ({ ...prev, [index]: note }));
    const updated = workOrder.checklist.map((c, i) => {
      if (i !== index) return c;
      return { ...c, completionNote: note };
    });
    onUpdate(updated);
  }

  const completedCount = visibleRows.filter(({ item }) => item.isCompleted).length;
  const total = visibleRows.length;

  return (
    <div className="space-y-4">
      {/* Special tools / instructions captured by the WO creator. */}
      {workOrder.specialToolsRequired?.trim() && (
        <div className={`rounded-lg border px-3 py-2 ${cls('border-amber-200 bg-amber-50', 'border-amber-500/40 bg-amber-500/10')}`}>
          <p className={`text-xs font-semibold ${cls('text-amber-800', 'text-amber-300')}`}>
            {t('common.workOrders.checklistExecutor.specialToolsTitle')}
          </p>
          <p className={`text-sm whitespace-pre-line ${cls('text-amber-900', 'text-amber-200')}`}>{workOrder.specialToolsRequired}</p>
        </div>
      )}

      {/* Progress */}
      {total > 0 && (
        <div className="space-y-1">
          <div className={`h-2 rounded-full overflow-hidden ${cls('bg-gray-100', 'bg-[#0F1E35]')}`}>
            <div
              className="h-full bg-blue-500 transition-all"
              style={{ width: `${total > 0 ? (completedCount / total) * 100 : 0}%` }}
            />
          </div>
          <p className={`text-xs ${cls('text-gray-500', 'text-[#8BA3BF]')}`}>
            {t('common.workOrders.checklistExecutor.completedCountLabel', { completed: completedCount, total })}
          </p>
        </div>
      )}

      {total === 0 && (
        <p className={`text-sm py-6 text-center ${cls('text-gray-400', 'text-[#8BA3BF]')}`}>
          {workOrder.checklist.length === 0
            ? t('common.workOrders.checklistExecutor.noStepsDefined')
            : t('common.workOrders.checklistExecutor.noStepsAssigned')}
        </p>
      )}

      <ol className="space-y-3">
        {visibleRows.map(({ item, index }) => {
          // Treat a step as a measurement if it's typed as one OR carries any
          // measurement config the creator entered — so the value input and
          // acceptable range always show even if inputType wasn't persisted.
          const isMeasurement =
            item.inputType === 'measurement' ||
            item.acceptableMin != null ||
            item.acceptableMax != null ||
            !!item.method ||
            !!item.unit;
          const currentRawValue = localValues[index] ?? (item.actualValue !== null ? String(item.actualValue) : '');
          const currentResult = item.result;
          const repairNote = repairNotes[index] ?? item.repairNote ?? '';
          const completionNote = completionNotes[index] ?? item.completionNote ?? '';

          return (
            <li
              key={index}
              className={`rounded-xl border px-4 py-3 space-y-2 ${
                item.isCompleted
                  ? item.result === 'fail'
                    ? cls('bg-red-50 border-red-200', 'bg-red-500/10 border-red-500/40')
                    : cls('bg-emerald-50 border-emerald-200', 'bg-emerald-500/10 border-emerald-500/40')
                  : cls('bg-gray-50 border-gray-200', 'bg-[#0F1E35] border-[#1E3A5F]')
              }`}
            >
              {/* Step header */}
              <div className="flex items-start gap-3">
                <span className={`flex-shrink-0 h-6 w-6 flex items-center justify-center rounded-full text-xs font-bold mt-0.5 ${cls('bg-blue-100 text-blue-700', 'bg-blue-500/20 text-blue-300')}`}>
                  {item.stepNumber}
                </span>
                <div className="flex-1">
                  <p className={`text-sm font-medium ${
                    item.isCompleted && item.result !== 'fail'
                      ? cls('text-gray-500 line-through', 'text-[#8BA3BF] line-through')
                      : cls('text-gray-800', 'text-[#F0F4F8]')
                  }`}>
                    {item.stepDescription}
                  </p>
                  {(item.assignedTechnicianNames?.length || item.assignedTechnicianName) && (
                    <p className={`text-xs mt-0.5 ${cls('text-gray-400', 'text-[#8BA3BF]')}`}>
                      {t('common.workOrders.checklistExecutor.assignedLabel', {
                        names: item.assignedTechnicianNames?.length
                          ? item.assignedTechnicianNames.join(', ')
                          : item.assignedTechnicianName,
                      })}
                    </p>
                  )}
                  {item.estimatedMinutes !== null && (
                    <p className={`text-xs mt-0.5 ${cls('text-gray-400', 'text-[#8BA3BF]')}`}>
                      {t('common.workOrders.checklistExecutor.timelineLabel', {
                        minutes: item.estimatedMinutes,
                        unit: item.estimatedDurationUnit,
                      })}
                    </p>
                  )}
                </div>

                {/* Result badge */}
                {currentResult === 'pass' && (
                  <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold ${cls('bg-emerald-100 text-emerald-700', 'bg-emerald-500/20 text-emerald-300')}`}>
                    {t('common.workOrders.checklistExecutor.passBadge')}
                  </span>
                )}
                {currentResult === 'fail' && (
                  <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold ${cls('bg-red-100 text-red-700', 'bg-red-500/20 text-red-300')}`}>
                    {t('common.workOrders.checklistExecutor.failBadge')}
                  </span>
                )}
              </div>

              {/* Checkbox type */}
              {!isMeasurement && !readOnly && (
                <div className="ml-9 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={item.isCompleted}
                      onChange={() => handleCheckboxToggle(index)}
                      className={`rounded text-emerald-600 ${cls('border-gray-300', 'border-[#1E3A5F]')}`}
                    />
                    <span className={`text-sm ${cls('text-gray-600', 'text-[#F0F4F8]')}`}>
                      {t('common.workOrders.checklistExecutor.markAsComplete')}
                    </span>
                  </label>
                  {item.isCompleted && item.completedByName && (
                    <p className={cls('text-xs text-emerald-600', 'text-xs text-emerald-400')}>
                      {t('common.workOrders.checklistExecutor.completedBy', { name: item.completedByName })}
                    </p>
                  )}
                  {item.isCompleted && (
                    <div className="space-y-1">
                      <label className={`text-xs font-medium ${cls('text-gray-500', 'text-[#8BA3BF]')}`}>
                        {t('common.workOrders.checklistExecutor.taskNoteLabel')}
                      </label>
                      <textarea
                        rows={2}
                        value={completionNote}
                        onChange={(e) => handleCompletionNote(index, e.target.value)}
                        placeholder={t('common.workOrders.checklistExecutor.taskNotePlaceholder')}
                        className={`w-full text-sm rounded-lg border px-3 py-2 resize-none focus:ring-2 focus:ring-blue-400 outline-none ${cls('border-gray-300', 'border-[#1E3A5F] bg-[#0A1628] text-[#F0F4F8] placeholder-[#8BA3BF]')}`}
                      />
                    </div>
                  )}
                </div>
              )}

              {!isMeasurement && readOnly && item.isCompleted && (
                <div className="ml-9 space-y-1">
                  <p className={cls('text-xs text-emerald-600', 'text-xs text-emerald-400')}>
                    {item.completedAt?.toDate
                      ? t('common.workOrders.checklistExecutor.completedByAt', {
                          name: item.completedByName,
                          date: item.completedAt.toDate().toLocaleString(),
                        })
                      : t('common.workOrders.checklistExecutor.completedBy', { name: item.completedByName })}
                  </p>
                  {item.completionNote && (
                    <div className={`rounded-lg px-3 py-2 border ${cls('bg-white border-gray-200', 'bg-[#0A1628] border-[#1E3A5F]')}`}>
                      <p className={`text-xs font-medium mb-0.5 ${cls('text-gray-500', 'text-[#8BA3BF]')}`}>
                        {t('common.workOrders.checklistExecutor.taskNoteTitle')}
                      </p>
                      <p className={`text-xs ${cls('text-gray-700', 'text-[#F0F4F8]')}`}>{item.completionNote}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Measurement type */}
              {isMeasurement && (
                <div className="ml-9 space-y-2">
                  {/* Spec set by the supervisor when the checklist was built */}
                  <div className={`flex items-center gap-3 text-xs flex-wrap ${cls('text-gray-500', 'text-[#8BA3BF]')}`}>
                    <span className={cls('text-gray-400', 'text-[#8BA3BF]')}>{t('common.workOrders.checklistExecutor.specLabel')}</span>
                    {item.method && (
                      <span className={`px-2 py-0.5 rounded ${cls('bg-gray-100', 'bg-[#0F1E35] text-[#F0F4F8]')}`}>
                        {t('common.workOrders.checklistExecutor.methodLabel', { method: item.method })}
                      </span>
                    )}
                    {item.unit && (
                      <span className={`px-2 py-0.5 rounded ${cls('bg-gray-100', 'bg-[#0F1E35] text-[#F0F4F8]')}`}>
                        {t('common.workOrders.checklistExecutor.unitLabel', { unit: item.unit })}
                      </span>
                    )}
                    {item.acceptableMin !== null && item.acceptableMax !== null && (
                      <span className={`px-2 py-0.5 rounded ${cls('bg-blue-50 text-blue-700', 'bg-blue-500/20 text-blue-300')}`}>
                        {t('common.workOrders.checklistExecutor.acceptableLabel', {
                          min: item.acceptableMin,
                          max: item.acceptableMax,
                          unit: item.unit,
                        })}
                      </span>
                    )}
                  </div>

                  {/* Value input */}
                  {!readOnly && (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="any"
                        value={currentRawValue}
                        onChange={(e) => handleMeasurementInput(index, e.target.value)}
                        placeholder={
                          item.unit
                            ? t('common.workOrders.checklistExecutor.valuePlaceholderWithUnit', { unit: item.unit })
                            : t('common.workOrders.checklistExecutor.valuePlaceholder')
                        }
                        className={`w-40 text-sm rounded-lg border px-3 py-1.5 focus:ring-2 focus:ring-blue-500 outline-none ${cls('border-gray-300', 'border-[#1E3A5F] bg-[#0A1628] text-[#F0F4F8] placeholder-[#8BA3BF]')}`}
                      />
                      {item.unit && (
                        <span className={`text-sm ${cls('text-gray-500', 'text-[#8BA3BF]')}`}>{item.unit}</span>
                      )}
                    </div>
                  )}

                  {readOnly && item.actualValue !== null && (
                    <p className={`text-sm ${cls('text-gray-700', 'text-[#F0F4F8]')}`}>
                      {t('common.workOrders.checklistExecutor.actualValueLabel', {
                        name: item.completedByName || t('common.workOrders.checklistExecutor.defaultTechnician'),
                      })}{' '}
                      <span className="font-semibold">{item.actualValue} {item.unit}</span>
                    </p>
                  )}

                  {readOnly && item.isCompleted && (
                    <p className={cls('text-xs text-emerald-600', 'text-xs text-emerald-400')}>
                      {item.completedAt?.toDate
                        ? t('common.workOrders.checklistExecutor.completedByAt', {
                            name: item.completedByName,
                            date: item.completedAt.toDate().toLocaleString(),
                          })
                        : t('common.workOrders.checklistExecutor.completedBy', { name: item.completedByName })}
                    </p>
                  )}

                  {readOnly && item.completionNote && (
                    <div className={`rounded-lg px-3 py-2 border ${cls('bg-white border-gray-200', 'bg-[#0A1628] border-[#1E3A5F]')}`}>
                      <p className={`text-xs font-medium mb-0.5 ${cls('text-gray-500', 'text-[#8BA3BF]')}`}>
                        {t('common.workOrders.checklistExecutor.taskNoteTitle')}
                      </p>
                      <p className={`text-xs ${cls('text-gray-700', 'text-[#F0F4F8]')}`}>{item.completionNote}</p>
                    </div>
                  )}

                  {/* Repair note on fail */}
                  {currentResult === 'fail' && !readOnly && (
                    <div className="space-y-1">
                      <label className={cls('text-xs font-medium text-red-700', 'text-xs font-medium text-red-300')}>
                        {t('common.workOrders.checklistExecutor.repairNoteRequiredLabel')}
                      </label>
                      <textarea
                        rows={2}
                        value={repairNote}
                        onChange={(e) => handleRepairNote(index, e.target.value)}
                        placeholder={t('common.workOrders.checklistExecutor.repairNotePlaceholder')}
                        className={`w-full text-sm rounded-lg border px-3 py-2 resize-none focus:ring-2 focus:ring-red-400 outline-none ${cls('border-red-200', 'border-red-500/40 bg-[#0A1628] text-[#F0F4F8] placeholder-[#8BA3BF]')}`}
                      />
                    </div>
                  )}

                  {readOnly && item.repairNote && (
                    <div className={`rounded-lg px-3 py-2 ${cls('bg-red-50', 'bg-red-500/10')}`}>
                      <p className={cls('text-xs font-medium text-red-700 mb-0.5', 'text-xs font-medium text-red-300 mb-0.5')}>
                        {t('common.workOrders.checklistExecutor.repairNoteTitle')}
                      </p>
                      <p className={cls('text-xs text-red-800', 'text-xs text-red-200')}>{item.repairNote}</p>
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
