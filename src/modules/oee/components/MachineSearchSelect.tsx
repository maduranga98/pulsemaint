import { useState, useMemo, useRef, useEffect } from 'react';
import { ChevronDown, Search } from 'lucide-react';

export interface MachineOption {
  id: string;
  name: string;
  department?: string | null;
  floor?: string | null;
  bay?: string | null;
}

interface Props {
  machines: MachineOption[];
  selectedId: string;
  selectedName: string;
  onSelect: (m: MachineOption) => void;
  placeholder?: string;
}

/** Searchable machine selector — matches by name, ID, or department (PM-087, PM-125). */
export function MachineSearchSelect({ machines, selectedId, selectedName, onSelect, placeholder }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return machines;
    return machines.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q) ||
        (m.department ?? '').toLowerCase().includes(q),
    );
  }, [machines, search]);

  const inputCls = 'w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-600 transition-colors';

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={inputCls + ' flex items-center justify-between text-left'}
      >
        <span className={selectedId ? 'text-white' : 'text-slate-600'}>
          {selectedId ? selectedName : (placeholder ?? 'Search and select a machine…')}
        </span>
        <ChevronDown className="h-4 w-4 text-slate-500 shrink-0" />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 shadow-xl">
          <div className="flex items-center gap-2 border-b border-slate-700 px-3 py-2">
            <Search className="h-4 w-4 text-slate-500" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Type name or ID to search…"
              className="flex-1 bg-transparent text-sm text-white placeholder-slate-600 outline-none"
            />
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-3 text-xs text-slate-500">No machines found.</p>
            ) : (
              filtered.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    onSelect(m);
                    setOpen(false);
                    setSearch('');
                  }}
                  className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-slate-800"
                >
                  <span className="text-sm text-white">{m.name}</span>
                  <span className="text-xs text-slate-500">
                    {[m.department, m.floor, m.bay].filter(Boolean).join(' · ') || 'No location'}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
