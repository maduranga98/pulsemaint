import type { TriageStepOption } from '../../../types/triage';
import { nanoid } from 'nanoid';

interface Props {
  options: TriageStepOption[];
  allStepIds: string[];
  onChange: (options: TriageStepOption[]) => void;
}

export default function TriageOptionEditor({ options, allStepIds, onChange }: Props) {
  const addOption = () => {
    onChange([
      ...options,
      { id: nanoid(), label: '', nextStepId: null, isEscalate: false, isSafe: false },
    ]);
  };

  const updateOption = (index: number, patch: Partial<TriageStepOption>) => {
    onChange(options.map((o, i) => (i === index ? { ...o, ...patch } : o)));
  };

  const removeOption = (index: number) => {
    onChange(options.filter((_, i) => i !== index));
  };

  return (
    <div>
      <div className="flex flex-col gap-3">
        {options.map((opt, i) => (
          <div key={opt.id} className="border border-gray-200 rounded-xl p-3 flex flex-col gap-2 bg-gray-50">
            <div className="flex gap-2 items-center">
              <input
                type="text"
                value={opt.label}
                onChange={(e) => updateOption(i, { label: e.target.value })}
                placeholder="Option label"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A56DB]"
              />
              <button
                onClick={() => removeOption(i)}
                className="text-red-400 hover:text-red-600 text-lg"
              >
                ×
              </button>
            </div>
            <div className="flex gap-3 items-center flex-wrap">
              <label className="flex items-center gap-1 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={opt.isEscalate}
                  onChange={(e) => updateOption(i, { isEscalate: e.target.checked })}
                  className="accent-red-500"
                />
                Escalate
              </label>
              <label className="flex items-center gap-1 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={opt.isSafe}
                  onChange={(e) => updateOption(i, { isSafe: e.target.checked })}
                  className="accent-green-500"
                />
                Safe
              </label>
              <select
                value={opt.nextStepId ?? ''}
                onChange={(e) => updateOption(i, { nextStepId: e.target.value || null })}
                className="border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none"
              >
                <option value="">Next step</option>
                {allStepIds.map((id) => (
                  <option key={id} value={id}>{id.slice(0, 8)}</option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </div>
      <button
        onClick={addOption}
        className="mt-2 text-sm text-[#1A56DB] hover:underline"
      >
        + Add option
      </button>
    </div>
  );
}
