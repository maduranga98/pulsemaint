import { useState } from 'react';
import { VALID_CATEGORIES, CATEGORY_LABELS } from '@/lib/inventory/inventoryTypes';

const CUSTOM_OPTION = '__custom__';

interface CategorySelectProps {
  value: string;
  onChange: (category: string) => void;
  id?: string;
  required?: boolean;
  className?: string;
}

export function CategorySelect({ value, onChange, id, required, className }: CategorySelectProps) {
  const isStandard = (VALID_CATEGORIES as readonly string[]).includes(value);
  const [customMode, setCustomMode] = useState(!isStandard && value.length > 0);

  const selectValue = customMode ? CUSTOM_OPTION : value;

  return (
    <div className="space-y-2">
      <select
        id={id}
        required={required}
        value={selectValue}
        onChange={(e) => {
          if (e.target.value === CUSTOM_OPTION) {
            setCustomMode(true);
            onChange('');
          } else {
            setCustomMode(false);
            onChange(e.target.value);
          }
        }}
        className={className ?? 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'}
      >
        <option value="" disabled>
          Select category…
        </option>
        {VALID_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {CATEGORY_LABELS[c]}
          </option>
        ))}
        <option value={CUSTOM_OPTION}>Other (manually created)…</option>
      </select>
      {customMode && (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter custom category name"
          required={required}
          className={className ?? 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'}
        />
      )}
    </div>
  );
}
