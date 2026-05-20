import type { TriageChecklistItem } from '../../../types/triage';
import { nanoid } from 'nanoid';

interface Props {
  items: TriageChecklistItem[];
  onChange: (items: TriageChecklistItem[]) => void;
}

export default function TriageChecklistEditor({ items, onChange }: Props) {
  const add = () =>
    onChange([...items, { id: nanoid(), text: '', required: false }]);

  const update = (index: number, patch: Partial<TriageChecklistItem>) =>
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  const remove = (index: number) => onChange(items.filter((_, i) => i !== index));

  return (
    <div>
      <div className="flex flex-col gap-2">
        {items.map((item, i) => (
          <div key={item.id} className="flex gap-2 items-center">
            <input
              type="text"
              value={item.text}
              onChange={(e) => update(i, { text: e.target.value })}
              placeholder="Checklist item"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A56DB]"
            />
            <label className="flex items-center gap-1 text-xs whitespace-nowrap cursor-pointer">
              <input
                type="checkbox"
                checked={item.required}
                onChange={(e) => update(i, { required: e.target.checked })}
                className="accent-red-500"
              />
              Required
            </label>
            <button
              onClick={() => remove(i)}
              className="text-red-400 hover:text-red-600 text-lg"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <button onClick={add} className="mt-2 text-sm text-[#1A56DB] hover:underline">
        + Add item
      </button>
    </div>
  );
}
