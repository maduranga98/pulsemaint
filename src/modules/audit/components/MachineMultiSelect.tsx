import { useState, useMemo } from 'react';
import { Search, X, Check } from 'lucide-react';
import type { Machine } from '../../../types/machine';
import type { MachineRef } from '../types/audit.types';

interface Props {
  machines: Machine[];
  selected: MachineRef[];
  onChange: (next: MachineRef[]) => void;
}

/** Searchable, multi-select machine picker linking an audit to specific equipment. */
export function MachineMultiSelect({ machines, selected, onChange }: Props) {
  const [search, setSearch] = useState('');
  const selectedIds = useMemo(() => new Set(selected.map((m) => m.id)), [selected]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return machines.slice(0, 50);
    return machines
      .filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.serialNumber?.toLowerCase().includes(q) ||
          m.department?.toLowerCase().includes(q),
      )
      .slice(0, 50);
  }, [machines, search]);

  const toggle = (m: Machine) => {
    if (selectedIds.has(m.id)) {
      onChange(selected.filter((s) => s.id !== m.id));
    } else {
      onChange([...selected, { id: m.id, name: m.name }]);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-2">
        {selected.map((m) => (
          <span
            key={m.id}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-blue-900/40 border border-blue-700/50 text-blue-200 rounded-full"
          >
            {m.name}
            <button
              type="button"
              onClick={() => onChange(selected.filter((s) => s.id !== m.id))}
              className="hover:text-white"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {selected.length === 0 && (
          <span className="text-xs text-slate-500">No machines linked yet</span>
        )}
      </div>

      <div className="relative mb-2">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search machines by name, serial, department…"
          className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
        />
      </div>

      <div className="max-h-44 overflow-y-auto border border-slate-700 rounded-lg divide-y divide-slate-800">
        {filtered.length === 0 && (
          <p className="px-3 py-3 text-xs text-slate-500">No machines found.</p>
        )}
        {filtered.map((m) => {
          const isSel = selectedIds.has(m.id);
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => toggle(m)}
              className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-slate-800/60"
            >
              <span>
                <span className="text-sm text-white">{m.name}</span>
                <span className="block text-xs text-slate-500">
                  {m.department || '—'} {m.serialNumber ? `· ${m.serialNumber}` : ''}
                </span>
              </span>
              {isSel && <Check className="h-4 w-4 text-blue-400" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
