import { useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import type { WorkOrder, ChecklistItem } from '../../types/workOrder';
import { computeChecklistItemResult } from '../../lib/lotoGate';
import { serverTimestamp } from 'firebase/firestore';

interface ChecklistExecutorProps {
  workOrder: WorkOrder;
  onUpdate: (checklist: ChecklistItem[]) => void;
  readOnly?: boolean;
}

export function ChecklistExecutor({ workOrder, onUpdate, readOnly = false }: ChecklistExecutorProps) {
  const user = useAuthStore((s) => s.user);
  const userProfile = useAuthStore((s) => s.userProfile);
  const [localValues, setLocalValues] = useState<Record<number, string>>({});
  const [repairNotes, setRepairNotes] = useState<Record<number, string>>({});

  const uid = user?.uid ?? '';
  const userName = user?.displayName ?? userProfile?.id ?? '';

  function handleCheckboxToggle(index: number, item: ChecklistItem) {
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
        completedAt: serverTimestamp() as any,
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
        completedAt: numVal !== null ? (serverTimestamp() as any) : null,
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

  const completedCount = workOrder.checklist.filter((i) => i.isCompleted).length;
  const total = workOrder.checklist.length;

  return (
    <div className="space-y-4">
      {/* Progress */}
      {total > 0 && (
        <div className="space-y-1">
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all"
              style={{ width: `${total > 0 ? (completedCount / total) * 100 : 0}%` }}
            />
          </div>
          <p className="text-xs text-gray-500">{completedCount} / {total} completed</p>
        </div>
      )}

      {total === 0 && (
        <p className="text-sm text-gray-400 py-6 text-center">No checklist steps defined.</p>
      )}

      <ol className="space-y-3">
        {workOrder.checklist.map((item, index) => {
          const isMeasurement = item.inputType === 'measurement';
          const currentRawValue = localValues[index] ?? (item.actualValue !== null ? String(item.actualValue) : '');
          const currentResult = item.result;
          const repairNote = repairNotes[index] ?? item.repairNote ?? '';

          return (
            <li
              key={index}
              className={`rounded-xl border px-4 py-3 space-y-2 ${
                item.isCompleted
                  ? item.result === 'fail'
                    ? 'bg-red-50 border-red-200'
                    : 'bg-emerald-50 border-emerald-200'
                  : 'bg-gray-50 border-gray-200'
              }`}
            >
              {/* Step header */}
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 h-6 w-6 flex items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-bold mt-0.5">
                  {item.stepNumber}
                </span>
                <div className="flex-1">
                  <p className={`text-sm font-medium ${item.isCompleted && item.result !== 'fail' ? 'text-gray-500 line-through' : 'text-gray-800'}`}>
                    {item.stepDescription}
                  </p>
                  {item.assignedTechnicianName && (
                    <p className="text-xs text-gray-400 mt-0.5">Assigned: {item.assignedTechnicianName}</p>
                  )}
                </div>

                {/* Result badge */}
                {currentResult === 'pass' && (
                  <span className="flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                    PASS
                  </span>
                )}
                {currentResult === 'fail' && (
                  <span className="flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                    FAIL
                  </span>
                )}
              </div>

              {/* Checkbox type */}
              {!isMeasurement && !readOnly && (
                <div className="ml-9">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={item.isCompleted}
                      onChange={() => handleCheckboxToggle(index, item)}
                      className="rounded border-gray-300 text-emerald-600"
                    />
                    <span className="text-sm text-gray-600">Mark as complete</span>
                  </label>
                  {item.isCompleted && item.completedByName && (
                    <p className="text-xs text-emerald-600 mt-1">
                      Completed by {item.completedByName}
                    </p>
                  )}
                </div>
              )}

              {!isMeasurement && readOnly && item.isCompleted && (
                <div className="ml-9">
                  <p className="text-xs text-emerald-600">Completed by {item.completedByName}</p>
                </div>
              )}

              {/* Measurement type */}
              {isMeasurement && (
                <div className="ml-9 space-y-2">
                  {/* Labels */}
                  <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                    {item.method && (
                      <span className="bg-gray-100 px-2 py-0.5 rounded">Method: {item.method}</span>
                    )}
                    {item.unit && (
                      <span className="bg-gray-100 px-2 py-0.5 rounded">Unit: {item.unit}</span>
                    )}
                    {item.acceptableMin !== null && item.acceptableMax !== null && (
                      <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                        Acceptable: {item.acceptableMin} – {item.acceptableMax} {item.unit}
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
                        placeholder={`Enter value${item.unit ? ` (${item.unit})` : ''}`}
                        className="w-40 text-sm rounded-lg border border-gray-300 px-3 py-1.5 focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                      {item.unit && (
                        <span className="text-sm text-gray-500">{item.unit}</span>
                      )}
                    </div>
                  )}

                  {readOnly && item.actualValue !== null && (
                    <p className="text-sm text-gray-700">
                      Recorded: <span className="font-semibold">{item.actualValue} {item.unit}</span>
                    </p>
                  )}

                  {/* Repair note on fail */}
                  {currentResult === 'fail' && !readOnly && (
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-red-700">
                        Repair note (required for FAIL):
                      </label>
                      <textarea
                        rows={2}
                        value={repairNote}
                        onChange={(e) => handleRepairNote(index, e.target.value)}
                        placeholder="Describe the issue and action taken..."
                        className="w-full text-sm rounded-lg border border-red-200 px-3 py-2 resize-none focus:ring-2 focus:ring-red-400 outline-none"
                      />
                    </div>
                  )}

                  {readOnly && item.repairNote && (
                    <div className="bg-red-50 rounded-lg px-3 py-2">
                      <p className="text-xs font-medium text-red-700 mb-0.5">Repair Note:</p>
                      <p className="text-xs text-red-800">{item.repairNote}</p>
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
