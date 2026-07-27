import { useState, useMemo } from 'react';
import { Search, X, Check } from 'lucide-react';
import { useInventoryParts } from '../../../hooks/inventory/useInventoryParts';
import type { InventoryItemRef } from '../types/audit.types';

interface Props {
  selected: InventoryItemRef[];
  onChange: (next: InventoryItemRef[]) => void;
}

/** Searchable, multi-select inventory-part picker for Inventory-scoped audits. */
export function InventoryMultiSelect({ selected, onChange }: Props) {
  const { parts } = useInventoryParts();
  const [search, setSearch] = useState('');
  const selectedIds = useMemo(() => new Set(selected.map((p) => p.id)), [selected]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? parts.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.partNumber.toLowerCase().includes(q),
        )
      : parts;
    return list.slice(0, 50);
  }, [parts, search]);

  const toggle = (id: string, name: string, partNumber: string) => {
    if (selectedIds.has(id)) {
      onChange(selected.filter((s) => s.id !== id));
    } else {
      onChange([...selected, { id, name, partNumber }]);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-2">
        {selected.map((p) => (
          <span
            key={p.id}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-blue-900/40 border border-blue-700/50 text-blue-200 rounded-full"
          >
            {p.name}
            <button
              type="button"
              onClick={() => onChange(selected.filter((s) => s.id !== p.id))}
              className="hover:text-white"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {selected.length === 0 && (
          <span className="text-xs text-slate-500">No parts linked yet</span>
        )}
      </div>

      <div className="relative mb-2">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search parts by name or part number…"
          className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
        />
      </div>

      <div className="max-h-44 overflow-y-auto border border-slate-700 rounded-lg divide-y divide-slate-800">
        {filtered.length === 0 && (
          <p className="px-3 py-3 text-xs text-slate-500">No parts found.</p>
        )}
        {filtered.map((p) => {
          const isSel = selectedIds.has(p.id);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => toggle(p.id, p.name, p.partNumber)}
              className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-slate-800/60"
            >
              <span>
                <span className="text-sm text-white">{p.name}</span>
                <span className="block text-xs text-slate-500">{p.partNumber}</span>
              </span>
              {isSel && <Check className="h-4 w-4 text-blue-400" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
