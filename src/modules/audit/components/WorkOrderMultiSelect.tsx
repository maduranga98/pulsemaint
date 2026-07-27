import { useState, useMemo } from 'react';
import { Search, X, Check } from 'lucide-react';
import { useWorkOrders } from '../../../hooks/useWorkOrders';
import type { WorkOrderRef } from '../types/audit.types';

interface Props {
  selected: WorkOrderRef[];
  onChange: (next: WorkOrderRef[]) => void;
}

/** Searchable, multi-select work-order picker for Work-Order-scoped audits. */
export function WorkOrderMultiSelect({ selected, onChange }: Props) {
  const { workOrders } = useWorkOrders();
  const [search, setSearch] = useState('');
  const selectedIds = useMemo(() => new Set(selected.map((w) => w.id)), [selected]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? workOrders.filter(
          (w) =>
            w.woNumber.toLowerCase().includes(q) ||
            (w.machineName ?? '').toLowerCase().includes(q),
        )
      : workOrders;
    return list.slice(0, 50);
  }, [workOrders, search]);

  const toggle = (id: string, woNumber: string, machineName?: string) => {
    if (selectedIds.has(id)) {
      onChange(selected.filter((s) => s.id !== id));
    } else {
      onChange([...selected, { id, woNumber, machineName }]);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-2">
        {selected.map((w) => (
          <span
            key={w.id}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-blue-900/40 border border-blue-700/50 text-blue-200 rounded-full"
          >
            {w.woNumber}
            <button
              type="button"
              onClick={() => onChange(selected.filter((s) => s.id !== w.id))}
              className="hover:text-white"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {selected.length === 0 && (
          <span className="text-xs text-slate-500">No work orders linked yet</span>
        )}
      </div>

      <div className="relative mb-2">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search work orders by number or machine…"
          className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
        />
      </div>

      <div className="max-h-44 overflow-y-auto border border-slate-700 rounded-lg divide-y divide-slate-800">
        {filtered.length === 0 && (
          <p className="px-3 py-3 text-xs text-slate-500">No work orders found.</p>
        )}
        {filtered.map((w) => {
          const isSel = selectedIds.has(w.id);
          return (
            <button
              key={w.id}
              type="button"
              onClick={() => toggle(w.id, w.woNumber, w.machineName)}
              className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-slate-800/60"
            >
              <span>
                <span className="text-sm text-white">{w.woNumber}</span>
                <span className="block text-xs text-slate-500">{w.machineName || ''}</span>
              </span>
              {isSel && <Check className="h-4 w-4 text-blue-400" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
