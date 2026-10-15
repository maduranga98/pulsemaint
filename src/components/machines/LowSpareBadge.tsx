import { AlertTriangle } from 'lucide-react';
import type { LowSparePart } from '../../lib/machineSpareParts';

/** "Low spare parts" flag for the registry; hover lists exactly which items. */
export function LowSpareBadge({ parts }: { parts?: LowSparePart[] }) {
  if (!parts || parts.length === 0) return null;
  const out = parts.some((p) => p.status === 'out');
  const title = parts.map((p) => `${p.name}: ${p.currentStock}/${p.minStockLevel} ${p.unit}`).join('\n');
  return (
    <span
      title={title}
      className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        out ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
      }`}
    >
      <AlertTriangle className="h-3 w-3" />
      {out ? 'Spare parts out of stock' : 'Low on spare parts'} ({parts.length})
    </span>
  );
}
