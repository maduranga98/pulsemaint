import { Building2 } from 'lucide-react';

/** Small "which plant is this from" chip shown on dashboard rows in the All Plants view. */
export default function PlantBadge({ name }: { name?: string | null }) {
  if (!name) return null;
  return (
    <span
      title={name}
      className="inline-flex max-w-[140px] shrink-0 items-center gap-1 rounded-full border border-[#1E3A5F] bg-[#142849] px-2 py-0.5 text-[10px] font-medium text-[#9DB6D3]"
    >
      <Building2 className="h-3 w-3 shrink-0 text-[#5B8DEF]" />
      <span className="truncate">{name}</span>
    </span>
  );
}
