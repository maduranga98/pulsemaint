import type { ReactNode } from 'react';

interface Option<T extends string | number> {
  value: T;
  label: ReactNode;
}

interface SegmentedControlProps<T extends string | number> {
  value: T;
  onChange: (value: T) => void;
  options: Option<T>[];
  size?: 'sm' | 'md';
  ariaLabel?: string;
}

export function SegmentedControl<T extends string | number>({
  value,
  onChange,
  options,
  size = 'md',
  ariaLabel,
}: SegmentedControlProps<T>) {
  const cls = size === 'sm' ? 'h-7 px-2 text-[11px]' : 'h-8 px-3 text-[12px]';
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="inline-flex bg-slate-100 rounded-md p-0.5 border border-slate-200"
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={String(opt.value)}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={`${cls} font-medium rounded-[5px] transition-colors ${
              active
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
