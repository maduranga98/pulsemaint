import { useRef, useState } from 'react';
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
  const [importError, setImportError] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  function downloadTemplate() {
    const csv = 'Step Description,Estimated Minutes\nInspect machine for visible damage,15\nReplace worn bearings,45\nLubricate moving parts,10\n';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'wo-checklist-template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function parseCsvLine(line: string): string[] {
    const cells: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          cur += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        cells.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
    cells.push(cur);
    return cells.map((c) => c.trim());
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    setImportError(null);
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length === 0) {
        setImportError('File is empty.');
        return;
      }
      // Detect header
      const first = parseCsvLine(lines[0]);
      const hasHeader = first[0]?.toLowerCase().includes('step') || first[0]?.toLowerCase().includes('description');
      const dataLines = hasHeader ? lines.slice(1) : lines;
      const imported: typeof items = [];
      dataLines.forEach((line, idx) => {
        const cells = parseCsvLine(line);
        const description = cells[0]?.trim();
        if (!description) return;
        const minutes = cells[1] ? Number(cells[1]) : null;
        imported.push({
          stepNumber: items.length + imported.length + 1,
          stepDescription: description,
          assignedTechnicianId: null,
          assignedTechnicianName: null,
          estimatedMinutes: Number.isFinite(minutes) && minutes !== null ? minutes : null,
        });
        if (idx > 500) return;
      });
      if (imported.length === 0) {
        setImportError('No valid rows found. Expected at least one row with a step description.');
        return;
      }
      onChange([...items, ...imported]);
    } catch (err) {
      console.error(err);
      setImportError('Failed to read file. Please upload a CSV file.');
    }
  }

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

      {!readOnly && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3 text-xs">
            <input
              ref={importInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleImportFile}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => importInputRef.current?.click()}
              className="text-blue-600 hover:text-blue-800 underline"
            >
              {WO_COPY.importTemplateButton}
            </button>
            <span className="text-gray-300">|</span>
            <button
              type="button"
              onClick={downloadTemplate}
              className="text-gray-500 hover:text-gray-700 underline"
            >
              Download template
            </button>
          </div>
          {importError && <p className="text-xs text-red-500">{importError}</p>}
          <p className="text-xs text-gray-400">
            CSV format: first column = step description, second column = estimated minutes (optional).
          </p>
        </div>
      )}
    </div>
  );
}
