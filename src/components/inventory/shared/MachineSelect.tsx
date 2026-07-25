import { useMemo, useRef, useState, useEffect } from 'react';
import { ChevronDown, Search, X, Cpu } from 'lucide-react';
import { useMachineOptions } from '@/hooks/inventory/useMachineOptions';

interface MachineSelectProps {
  values: string[];
  onChange: (values: string[]) => void;
  className?: string;
}

// Compatible-machines picker backed by the real Machine Registry, so a
// part's compatibleMachineIds are always actual machine doc IDs instead of
// free-typed strings unrelated to any real machine.
export function MachineSelect({ values, onChange, className = '' }: MachineSelectProps) {
  const { machines, loading } = useMachineOptions();
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
    if (!term) return machines;
    return machines.filter(
      (m) => m.name.toLowerCase().includes(term) || m.department.toLowerCase().includes(term),
    );
  }, [machines, search]);

  const toggle = (id: string) => {
    onChange(values.includes(id) ? values.filter((v) => v !== id) : [...values, id]);
  };

  const nameFor = (id: string) => machines.find((m) => m.id === id)?.name ?? id;

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm flex items-center justify-between gap-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <span className={values.length === 0 ? 'text-gray-400' : 'text-gray-900'}>
          {values.length === 0 ? 'Select compatible machines…' : `${values.length} machine(s) selected`}
        </span>
        <ChevronDown className="w-4 h-4 shrink-0 text-gray-400" />
      </button>

      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {values.map((id) => (
            <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs">
              <Cpu className="w-3 h-3" />
              {nameFor(id)}
              <button type="button" onClick={() => toggle(id)} aria-label={`Remove ${nameFor(id)}`} className="text-slate-400 hover:text-red-600">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
          <div className="relative border-b border-gray-100 p-2">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search machines…"
              className="w-full rounded-md border border-gray-200 pl-8 pr-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </div>
          <ul className="max-h-56 overflow-y-auto p-1">
            {loading && <li className="px-3 py-2 text-sm text-gray-400">Loading…</li>}
            {!loading && filtered.length === 0 && (
              <li className="px-3 py-2 text-sm text-gray-400">No machines found.</li>
            )}
            {!loading &&
              filtered.map((m) => {
                const checked = values.includes(m.id);
                return (
                  <li key={m.id}>
                    <label className="flex items-center gap-2 rounded-md px-3 py-2 text-sm cursor-pointer hover:bg-gray-50">
                      <input type="checkbox" checked={checked} onChange={() => toggle(m.id)} className="h-4 w-4" />
                      <span className="flex-1 truncate text-gray-900">{m.name}</span>
                      {m.department && <span className="truncate text-xs text-gray-400">{m.department}</span>}
                    </label>
                  </li>
                );
              })}
          </ul>
        </div>
      )}
    </div>
  );
}
