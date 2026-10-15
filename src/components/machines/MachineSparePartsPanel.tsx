import { Link } from 'react-router-dom';
import { AlertTriangle, Package } from 'lucide-react';
import { useCompanyParts } from '../../hooks/inventory/useCompanyParts';
import { sparePartStockStatus, sparePartsOfMachine } from '../../lib/machineSpareParts';

const CHIP: Record<string, string> = {
  out: 'bg-red-100 text-red-700',
  low: 'bg-amber-100 text-amber-700',
  ok: 'bg-emerald-100 text-emerald-700',
};
const LABEL: Record<string, string> = { out: 'Out of stock', low: 'Low stock', ok: 'In stock' };

/** Machine profile: every spare part linked to the machine, with the low-stock ones called out first. */
export function MachineSparePartsPanel({ companyId, machineId }: { companyId: string; machineId: string }) {
  const { parts, loading } = useCompanyParts(companyId);
  const linked = sparePartsOfMachine(parts, machineId);
  const rank = { out: 0, low: 1, ok: 2 } as const;
  const rows = [...linked].sort(
    (a, b) => rank[sparePartStockStatus(a)] - rank[sparePartStockStatus(b)] || a.name.localeCompare(b.name),
  );
  const lowRows = rows.filter((p) => sparePartStockStatus(p) !== 'ok');

  return (
    <div className="bg-white border border-gray-200 rounded-xl mb-5">
      <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 sm:px-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <Package className="h-4 w-4 text-gray-500" /> Spare parts
          <span className="text-xs font-normal text-gray-500">({rows.length})</span>
        </h3>
      </div>

      {lowRows.length > 0 && (
        <div className="mx-4 mt-4 flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 sm:mx-5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div className="min-w-0 text-sm">
            <p className="font-semibold text-amber-900">
              {lowRows.length} spare part{lowRows.length === 1 ? '' : 's'} need restocking
            </p>
            <ul className="mt-1 space-y-0.5 text-amber-800">
              {lowRows.map((p) => (
                <li key={p.id} className="truncate">
                  {p.name} — {p.currentStock} left (min {p.minStockLevel}) {p.unit}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="p-4 sm:p-5">
        {loading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-gray-500">
            No spare parts linked to this machine. Add them from Edit Machine → Spare Parts.
          </p>
        ) : (
          <div className="divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200">
            {rows.map((p) => {
              const status = sparePartStockStatus(p);
              return (
                <Link
                  key={p.id}
                  to={`/app/inventory/catalog/${p.id}`}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm hover:bg-gray-50"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-gray-900">{p.name}</span>
                    <span className="block truncate text-xs text-gray-500">{p.partNumber}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span className="text-xs text-gray-600">
                      {p.currentStock} / min {p.minStockLevel} {p.unit}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${CHIP[status]}`}>{LABEL[status]}</span>
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
