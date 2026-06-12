import { useState } from 'react';
import type { PMChecklistItem } from '../../types/pm.types';

interface PMChecklistBuilderProps {
  items: PMChecklistItem[];
  onChange: (items: PMChecklistItem[]) => void;
  readOnly?: boolean;
}

export function PMChecklistBuilder({ items: itemsProp, onChange, readOnly = false }: PMChecklistBuilderProps) {
  const items = itemsProp ?? [];
  const [newStep, setNewStep] = useState('');
  const [newTime, setNewTime] = useState('');
  const [photoRequired, setPhotoRequired] = useState(false);
  const [newInputType, setNewInputType] = useState<'checkbox' | 'measurement'>('checkbox');

  function addStep() {
    const trimmed = newStep.trim();
    if (!trimmed) return;
    const newItem: PMChecklistItem = {
      id: `step-${items.length + 1}-${Date.now()}`,
      step: items.length + 1,
      description: trimmed,
      estimatedMinutes: newTime ? Number(newTime) : 15,
      photoRequired,
      inputType: newInputType,
      method: null,
      unit: null,
      acceptableMin: null,
      acceptableMax: null,
    };
    onChange([...items, newItem]);
    setNewStep('');
    setNewTime('');
    setPhotoRequired(false);
    setNewInputType('checkbox');
  }

  function removeStep(index: number) {
    const updated = items
      .filter((_, i) => i !== index)
      .map((item, i) => ({ ...item, step: i + 1 }));
    onChange(updated);
  }

  function moveStep(index: number, direction: 'up' | 'down') {
    const updated = [...items];
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= updated.length) return;
    [updated[index], updated[target]] = [updated[target], updated[index]];
    onChange(updated.map((item, i) => ({ ...item, step: i + 1 })));
  }

  function updateStep(index: number, field: keyof PMChecklistItem, value: string | number | boolean | null) {
    const updated = items.map((item, i) => {
      if (i !== index) return item;
      return { ...item, [field]: value };
    });
    onChange(updated);
  }

  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <p className="text-sm text-gray-400 py-4 text-center">No checklist steps added yet.</p>
      ) : (
        <ol className="space-y-2">
          {items.map((item, index) => {
            const isMeasurement = item.inputType === 'measurement';
            return (
              <li
                key={item.id}
                className="flex items-start gap-2 bg-gray-50 rounded-lg p-3 group"
              >
                <span className="flex-shrink-0 h-6 w-6 flex items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-bold mt-0.5">
                  {item.step}
                </span>

                <div className="flex-1 space-y-2">
                  {readOnly ? (
                    <p className="text-sm text-gray-800">{item.description}</p>
                  ) : (
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => updateStep(index, 'description', e.target.value)}
                      className="w-full text-sm bg-transparent border-b border-gray-200 focus:border-blue-500 outline-none py-0.5"
                      placeholder="Step description"
                    />
                  )}

                  {!readOnly && (
                    <>
                      {/* Type toggle */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-gray-500">Type:</span>
                        <button
                          type="button"
                          onClick={() => updateStep(index, 'inputType', 'checkbox')}
                          className={`px-2 py-0.5 text-xs rounded border transition-colors ${
                            !isMeasurement
                              ? 'bg-blue-50 border-blue-300 text-blue-700'
                              : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                          }`}
                        >
                          Checkbox
                        </button>
                        <button
                          type="button"
                          onClick={() => updateStep(index, 'inputType', 'measurement')}
                          className={`px-2 py-0.5 text-xs rounded border transition-colors ${
                            isMeasurement
                              ? 'bg-purple-50 border-purple-300 text-purple-700'
                              : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                          }`}
                        >
                          Measurement
                        </button>
                      </div>

                      {/* Measurement fields */}
                      {isMeasurement && (
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={item.method ?? ''}
                            onChange={(e) => updateStep(index, 'method', e.target.value || null)}
                            placeholder="Method (e.g. Visual, Micrometer)"
                            className="text-xs rounded border border-gray-200 px-2 py-1 text-gray-600 col-span-2"
                          />
                          <input
                            type="text"
                            value={item.unit ?? ''}
                            onChange={(e) => updateStep(index, 'unit', e.target.value || null)}
                            placeholder="Unit (e.g. mm, °C)"
                            className="text-xs rounded border border-gray-200 px-2 py-1 text-gray-600"
                          />
                          <div className="flex gap-1">
                            <input
                              type="number"
                              step="any"
                              value={item.acceptableMin ?? ''}
                              onChange={(e) => updateStep(index, 'acceptableMin', e.target.value ? Number(e.target.value) : null)}
                              placeholder="Min"
                              className="w-full text-xs rounded border border-gray-200 px-2 py-1 text-gray-600"
                            />
                            <input
                              type="number"
                              step="any"
                              value={item.acceptableMax ?? ''}
                              onChange={(e) => updateStep(index, 'acceptableMax', e.target.value ? Number(e.target.value) : null)}
                              placeholder="Max"
                              className="w-full text-xs rounded border border-gray-200 px-2 py-1 text-gray-600"
                            />
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  <div className="flex items-center gap-3 flex-wrap">
                    {!readOnly && (
                      <input
                        type="number"
                        min={1}
                        value={item.estimatedMinutes}
                        onChange={(e) => updateStep(index, 'estimatedMinutes', Number(e.target.value))}
                        placeholder="Min"
                        className="w-20 text-xs rounded border border-gray-200 px-2 py-1 text-gray-600"
                      />
                    )}
                    <span className="text-xs text-gray-400">{item.estimatedMinutes} min</span>

                    {item.photoRequired && (
                      <span className="text-xs bg-cyan-50 text-cyan-700 px-2 py-0.5 rounded-full">
                        📷 Photo required
                      </span>
                    )}

                    {isMeasurement && (
                      <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full">
                        Measurement
                        {item.unit ? ` (${item.unit})` : ''}
                      </span>
                    )}

                    {!readOnly && (
                      <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={item.photoRequired}
                          onChange={(e) => updateStep(index, 'photoRequired', e.target.checked)}
                          className="rounded border-gray-300"
                        />
                        Photo
                      </label>
                    )}
                  </div>
                </div>

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
            );
          })}
        </ol>
      )}

      {!readOnly && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={newStep}
              onChange={(e) => setNewStep(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addStep())}
              placeholder="Add a checklist step..."
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="number"
              min={1}
              value={newTime}
              onChange={(e) => setNewTime(e.target.value)}
              placeholder="Min"
              className="w-20 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={addStep}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Add
            </button>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={photoRequired}
                onChange={(e) => setPhotoRequired(e.target.checked)}
                className="rounded border-gray-300"
              />
              Photo required for this step
            </label>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500">New step type:</span>
              <button
                type="button"
                onClick={() => setNewInputType('checkbox')}
                className={`px-2 py-0.5 text-xs rounded border transition-colors ${
                  newInputType === 'checkbox'
                    ? 'bg-blue-50 border-blue-300 text-blue-700'
                    : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                }`}
              >
                Checkbox
              </button>
              <button
                type="button"
                onClick={() => setNewInputType('measurement')}
                className={`px-2 py-0.5 text-xs rounded border transition-colors ${
                  newInputType === 'measurement'
                    ? 'bg-purple-50 border-purple-300 text-purple-700'
                    : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                }`}
              >
                Measurement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
