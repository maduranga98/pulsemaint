import { Cog } from 'lucide-react';

/** "Spare part · Machine A, Machine B" tag for a part linked to machines. Renders nothing otherwise. */
export function SparePartForMachines({ machineIds, machineNames }: { machineIds?: string[] | null; machineNames: Map<string, string> }) {
  if (!machineIds || machineIds.length === 0) return null;
  return (
    <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
      <span className="rounded bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-700">Spare part</span>
      <Cog className="h-3 w-3 text-gray-400" />
      <span className="text-gray-600">{machineIds.map((id) => machineNames.get(id) ?? 'Machine').join(', ')}</span>
    </p>
  );
}
