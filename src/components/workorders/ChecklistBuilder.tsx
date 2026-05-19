import { useState } from 'react';
import type { ChecklistItem } from '../../types/workOrder';
import { WO_COPY } from '../../constants/copy';

interface ChecklistBuilderProps {
  items: Omit<ChecklistItem, 'isCompleted' | 'completedBy' | 'completedByName' | 'completedAt'>[];
  onChange: (items: Omit<ChecklistItem, 'isCompleted' | 'completedBy' | 'completedByName' | 'completedAt'>[]) => void;
  technicianOptions?: { id: string; name: string }[];
  readOnly?: boolean;
}

export function ChecklistBuilder({
  items,
  onChange,
  technicianOptions = [],
  readOnly = false,
}: ChecklistBuilderProps) {
  const [newStep, setNewStep] = useState('');

  function addStep() {
    const trimmed = newStep.trim();
    if (!trimmed) return;
    onChange([
      ...items,
      {
        stepNumber: items.length + 1,
        stepDescription: trimmed,
        assignedTechnicianId: null,
        assignedTechnicianName: null,
        estimatedMinutes: null,
      },
    ]);
    setNewStep('');
  }

  function removeStep(index: number) {
    const updated = items
      .filter((_, i) => i !== index)
      .map((item, i) => ({ ...item, stepNumber: i + 1 }));
    onChange(updated);
  }

  function moveStep(index: number, direction: 'up' | 'down') {
    const updated = [...items];
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= updated.length) return;
    [updated[index], updated[target]] = [updated[target], updated[index]];
    onChange(updated.map((item, i) => ({ ...item, stepNumber: i + 1 })));
  }

  function updateStep(
    index: number,
    field: 'stepDescription' | 'estimatedMinutes' | 'assignedTechnicianId',
    value: string | number | null,
  ) {
    const updated = items.map((item, i) => {
      if (i !== index) return item;
      if (field === 'assignedTechnicianId') {
        const tech = technicianOptions.find((t) => t.id === value);
        return {
          ...item,
          assignedTechnicianId: value as string | null,
          assignedTechnicianName: tech?.name ?? null,
        };
      }
      return { ...item, [field]: value };
    });
    onChange(updated);
  }

  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <p className="text-sm text-gray-400 py-4 text-center">{WO_COPY.noChecklist}</p>
      ) : (
        <ol className="space-y-2">
          {items.map((item, index) => (
            <li
              key={index}
              className="flex items-start gap-2 bg-gray-50 rounded-lg p-3 group"
            >
              {/* Step number */}
              <span className="flex-shrink-0 h-6 w-6 flex items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-bold mt-0.5">
                {item.stepNumber}
              </span>

              {/* Content */}
              <div className="flex-1 space-y-2">
                {readOnly ? (
                  <p className="text-sm text-gray-800">{item.stepDescription}</p>
                ) : (
                  <input
                    type="text"
                    value={item.stepDescription}
                    onChange={(e) => updateStep(index, 'stepDescription', e.target.value)}
                    className="w-full text-sm bg-transparent border-b border-gray-200 focus:border-blue-500 outline-none py-0.5"
                    placeholder={WO_COPY.stepPlaceholder}
                  />
                )}

                {!readOnly && (
                  <div className="flex items-center gap-3">
                    {technicianOptions.length > 0 && (
                      <select
                        value={item.assignedTechnicianId ?? ''}
                        onChange={(e) => updateStep(index, 'assignedTechnicianId', e.target.value || null)}
                        className="text-xs rounded border border-gray-200 px-2 py-1 text-gray-600"
                      >
                        <option value="">{WO_COPY.stepAssigneeLabel}</option>
                        {technicianOptions.map((t) => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    )}
                    <input
                      type="number"
                      min={1}
                      value={item.estimatedMinutes ?? ''}
                      onChange={(e) =>
                        updateStep(index, 'estimatedMinutes', e.target.value ? Number(e.target.value) : null)
                      }
                      placeholder={WO_COPY.stepTimeLabel}
                      className="w-20 text-xs rounded border border-gray-200 px-2 py-1 text-gray-600"
                    />
                    <span className="text-xs text-gray-400">min</span>
                  </div>
                )}
              </div>

              {/* Controls */}
              {!readOnly && (
                <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={() => moveStep(index, 'up')}
                    disabled={index === 0}
                    className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                    aria-label="Move up"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveStep(index, 'down')}
                    disabled={index === items.length - 1}
                    className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                    aria-label="Move down"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => removeStep(index)}
                    className="p-1 text-red-400 hover:text-red-600"
                    aria-label="Remove step"
                  >
                    ×
                  </button>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}

      {!readOnly && (
        <div className="flex gap-2">
          <input
            type="text"
            value={newStep}
            onChange={(e) => setNewStep(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addStep())}
            placeholder={WO_COPY.stepPlaceholder}
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={addStep}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            {WO_COPY.addStepButton}
          </button>
        </div>
      )}

      {/* Template stub */}
      {!readOnly && (
        <button
          type="button"
          className="text-xs text-gray-400 hover:text-gray-600 underline"
          onClick={() => {
            // Phase 2: Load from WO templates collection
          }}
        >
          {WO_COPY.importTemplateButton}
        </button>
      )}
    </div>
  );
}
