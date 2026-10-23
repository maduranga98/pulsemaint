import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Trash2, PackagePlus } from 'lucide-react';
import { useCompanyParts } from '../../hooks/inventory/useCompanyParts';
import { sparePartStockStatus, sparePartsOfMachine, type SparePartEntry } from '../../lib/machineSpareParts';
import { VALID_CATEGORIES, VALID_UNITS, CATEGORY_LABELS } from '../../lib/inventory/inventoryTypes';

interface Props {
  companyId: string;
  /** Set when editing — its already-linked inventory parts are loaded as the starting list. */
  machineId?: string;
  /** null until the editor has loaded the starting list. */
  value: SparePartEntry[] | null;
  onChange: (next: SparePartEntry[]) => void;
}

const blankNew = { name: '', category: 'mechanical', unit: 'pcs', currentStock: 0, minStockLevel: 0, unitCost: 0 };

const CHIP: Record<string, string> = {
  out: 'bg-red-100 text-red-700',
  low: 'bg-amber-100 text-amber-700',
  ok: 'bg-emerald-100 text-emerald-700',
};

export function MachineSparePartsEditor({ companyId, machineId, value, onChange }: Props) {
  const { parts, loading } = useCompanyParts(companyId);
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState(blankNew);
  const [showNew, setShowNew] = useState(false);

  // Start from the parts already linked to this machine.
  useEffect(() => {
    if (value !== null || loading) return;
    const linked = machineId ? sparePartsOfMachine(parts, machineId) : [];
    onChange(
      linked.map((p) => ({
        partId: p.id,
        name: p.name,
        partNumber: p.partNumber,
        category: String(p.category ?? ''),
        unit: String(p.unit ?? 'pcs'),
        currentStock: p.currentStock ?? 0,
        minStockLevel: p.minStockLevel ?? 0,
        unitCost: p.unitCost ?? 0,
      })),
    );
  }, [value, loading, parts, machineId, onChange]);

  const entries = value ?? [];
  const pickedIds = useMemo(() => new Set(entries.map((e) => e.partId).filter(Boolean)), [entries]);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return parts
      .filter((p) => !pickedIds.has(p.id) && `${p.name} ${p.partNumber} ${p.brand ?? ''}`.toLowerCase().includes(q))
      .slice(0, 8);
  }, [parts, search, pickedIds]);

  const addExisting = (id: string) => {
    const p = parts.find((x) => x.id === id);
    if (!p) return;
    onChange([
      ...entries,
      {
        partId: p.id,
        name: p.name,
        partNumber: p.partNumber,
        category: String(p.category ?? ''),
        unit: String(p.unit ?? 'pcs'),
        currentStock: p.currentStock ?? 0,
        minStockLevel: p.minStockLevel ?? 0,
        unitCost: p.unitCost ?? 0,
      },
    ]);
    setSearch('');
  };

  const addNew = () => {
    if (!draft.name.trim()) return;
    onChange([...entries, { partId: null, partNumber: '', ...draft, name: draft.name.trim() }]);
    setDraft(blankNew);
    setShowNew(false);
  };

  const input = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm';

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Pick parts that already exist in Inventory, or add a new one here — new parts are created in Inventory automatically
        and linked to this machine. When one runs low it is flagged on this machine and on the store keeper dashboard.
      </p>

      {/* Existing inventory search */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={loading ? 'Loading inventory…' : 'Search inventory by name or part number'}
          className={`${input} pl-9`}
        />
        {matches.length > 0 && (
          <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
            {matches.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => addExisting(p.id)}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-blue-50"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-gray-900">{p.name}</span>
                  <span className="block truncate text-xs text-gray-500">{p.partNumber}</span>
                </span>
                <span className="shrink-0 text-xs text-gray-500">{p.currentStock} in stock</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Current list */}
      {entries.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-500">
          No spare parts yet.
        </p>
      ) : (
        <div className="divide-y divide-gray-100 rounded-lg border border-gray-200">
          {entries.map((e, i) => {
            const status = sparePartStockStatus(e);
            return (
              <div key={e.partId ?? `new-${i}`} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">{e.name}</p>
                  <p className="truncate text-xs text-gray-500">
                    {e.partId ? e.partNumber : 'New — will be added to Inventory'} · {e.currentStock} in stock · min {e.minStockLevel}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {status !== 'ok' && (
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${CHIP[status]}`}>
                      {status === 'out' ? 'Out of stock' : 'Low stock'}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => onChange(entries.filter((_, idx) => idx !== i))}
                    className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                    aria-label={`Remove ${e.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* New part */}
      {showNew ? (
        <div className="space-y-3 rounded-lg border border-[#1E3A5F] bg-[#0F1E35] p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-[#F0F4F8]">
            <PackagePlus className="h-4 w-4 text-blue-400" /> New inventory part
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-[#8BA3BF]">Part name *</label>
              <input className={input} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Bearing 6204" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#8BA3BF]">Category</label>
              <select className={input} value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
                {VALID_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#8BA3BF]">Unit</label>
              <select className={input} value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })}>
                {VALID_UNITS.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#8BA3BF]">Current stock</label>
              <input type="number" min={0} className={input} value={draft.currentStock} onChange={(e) => setDraft({ ...draft, currentStock: Number(e.target.value) })} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#8BA3BF]">Minimum stock (alert level)</label>
              <input type="number" min={0} className={input} value={draft.minStockLevel} onChange={(e) => setDraft({ ...draft, minStockLevel: Number(e.target.value) })} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#8BA3BF]">Unit cost</label>
              <input type="number" min={0} className={input} value={draft.unitCost} onChange={(e) => setDraft({ ...draft, unitCost: Number(e.target.value) })} />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={addNew} disabled={!draft.name.trim()} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              Add part
            </button>
            <button type="button" onClick={() => { setShowNew(false); setDraft(blankNew); }} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setShowNew(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          <Plus className="h-4 w-4" /> Create a new part
        </button>
      )}
    </div>
  );
}
