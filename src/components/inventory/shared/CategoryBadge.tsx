import type { PartCategory } from '@/types/inventory';

interface CategoryBadgeProps {
  category: PartCategory;
  size?: 'sm' | 'md' | 'lg';
}

const categoryConfig: Record<PartCategory, { label: string; color: string; bg: string }> = {
  bearings: { label: 'Bearings', color: 'text-slate-700', bg: 'bg-slate-100' },
  belts_chains: { label: 'Belts & Chains', color: 'text-purple-700', bg: 'bg-purple-50' },
  bolts_fasteners: { label: 'Bolts & Fasteners', color: 'text-zinc-700', bg: 'bg-zinc-100' },
  electrical: { label: 'Electrical', color: 'text-blue-700', bg: 'bg-blue-50' },
  filters: { label: 'Filters', color: 'text-teal-700', bg: 'bg-teal-50' },
  gaskets_seals: { label: 'Gaskets & Seals', color: 'text-indigo-700', bg: 'bg-indigo-50' },
  gears_sprockets: { label: 'Gears & Sprockets', color: 'text-violet-700', bg: 'bg-violet-50' },
  hydraulic: { label: 'Hydraulic', color: 'text-cyan-700', bg: 'bg-cyan-50' },
  lubricants_oils: { label: 'Lubricants & Oils', color: 'text-lime-700', bg: 'bg-lime-50' },
  motors_drives: { label: 'Motors & Drives', color: 'text-sky-700', bg: 'bg-sky-50' },
  pneumatic: { label: 'Pneumatic', color: 'text-blue-600', bg: 'bg-blue-100' },
  pumps_valves: { label: 'Pumps & Valves', color: 'text-emerald-700', bg: 'bg-emerald-50' },
  safety_equipment: { label: 'Safety', color: 'text-red-700', bg: 'bg-red-50' },
  sensors_instrumentation: { label: 'Sensors', color: 'text-orange-700', bg: 'bg-orange-50' },
  welding_supplies: { label: 'Welding', color: 'text-yellow-700', bg: 'bg-yellow-50' },
  other: { label: 'Other', color: 'text-gray-600', bg: 'bg-gray-100' },
};

const sizeClasses = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
  lg: 'px-3 py-1.5 text-base',
};

export function CategoryBadge({ category, size = 'sm' }: CategoryBadgeProps) {
  const config = categoryConfig[category];

  return (
    <span
      className={`inline-flex items-center rounded-md font-medium ${config.bg} ${config.color} ${sizeClasses[size]}`}
    >
      {config.label}
    </span>
  );
}
