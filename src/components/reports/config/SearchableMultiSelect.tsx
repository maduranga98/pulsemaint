import { useMemo, useRef, useState, useEffect } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  hint?: string;
}

/**
 * Searchable multi-select used by the report filter panel. Options are
 * real records (machines, departments, …) instead of free-typed text so the
 * selected values actually match what is stored in Firestore.
 */
export default function SearchableMultiSelect({
  label,
  options,
  values,
  onChange,
  placeholder = 'Search…',
  loading = false,
}: {
  label: string;
  options: SelectOption[];
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  loading?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(term) ||
        (o.hint ?? '').toLowerCase().includes(term),
    );
  }, [options, search]);

  const toggle = (value: string) => {
    onChange(values.includes(value) ? values.filter((v) => v !== value) : [...values, value]);
  };

  const labelFor = (value: string) => options.find((o) => o.value === value)?.label ?? value;

  return (
    <div ref={rootRef} className="space-y-1 text-xs text-[#8BA3BF]">
      {label}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border border-[#1E3A5F] bg-[#0A1628] px-3 text-left text-sm text-[#F0F4F8] outline-none focus:border-[#00C2FF]"
      >
        <span className={values.length === 0 ? 'text-[#8BA3BF]' : ''}>
          {values.length === 0
            ? `All (no ${label.toLowerCase()} filter)`
            : `${values.length} selected`}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-[#8BA3BF]" />
      </button>

      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {values.map((value) => (
            <span
              key={value}
              className="inline-flex items-center gap-1 rounded-full border border-[#1E3A5F] bg-[#142849] px-2 py-1 text-xs text-[#F0F4F8]"
            >
              {labelFor(value)}
              <button
                type="button"
                onClick={() => toggle(value)}
                aria-label={`Remove ${labelFor(value)}`}
                className="text-[#8BA3BF] hover:text-red-400"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {open && (
        <div className="relative">
          <div className="absolute z-20 mt-1 w-full rounded-lg border border-[#1E3A5F] bg-[#0F1E35] shadow-xl">
            <div className="relative border-b border-[#1E3A5F] p-2">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8BA3BF]" />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={placeholder}
                className="min-h-10 w-full rounded-md border border-[#1E3A5F] bg-[#0A1628] pl-8 pr-3 text-sm text-[#F0F4F8] outline-none focus:border-[#00C2FF]"
              />
            </div>
            <ul className="max-h-56 overflow-y-auto p-1">
              {loading && <li className="px-3 py-2 text-sm text-[#8BA3BF]">Loading…</li>}
              {!loading && filtered.length === 0 && (
                <li className="px-3 py-2 text-sm text-[#8BA3BF]">No matches found.</li>
              )}
              {!loading &&
                filtered.map((option) => {
                  const checked = values.includes(option.value);
                  return (
                    <li key={option.value}>
                      <label className="flex min-h-10 cursor-pointer items-center gap-2 rounded-md px-3 text-sm text-[#F0F4F8] hover:bg-[#142849]">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(option.value)}
                          className="h-4 w-4 accent-[#1A56DB]"
                        />
                        <span className="flex-1 truncate">{option.label}</span>
                        {option.hint && (
                          <span className="truncate text-xs text-[#8BA3BF]">{option.hint}</span>
                        )}
                      </label>
                    </li>
                  );
                })}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
