import {
  SPECIALIZATION_LABELS,
  type ContractorSpecializationTag,
} from '@/lib/contractors/contractorTypes';

interface ContractorSpecializationTagsProps {
  tags: ContractorSpecializationTag[];
  limit?: number;
}

const TAG_STYLES: Record<ContractorSpecializationTag, string> = {
  electrical: 'bg-blue-50 text-blue-700 border-blue-200',
  mechanical: 'bg-slate-100 text-slate-700 border-slate-200',
  hydraulic: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  pneumatic: 'bg-sky-50 text-sky-700 border-sky-200',
  welding: 'bg-orange-50 text-orange-700 border-orange-200',
  plc_automation: 'bg-violet-50 text-violet-700 border-violet-200',
  hvac: 'bg-teal-50 text-teal-700 border-teal-200',
  civil: 'bg-stone-100 text-stone-700 border-stone-200',
  oem_authorized: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  calibration: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  inspection: 'bg-amber-50 text-amber-700 border-amber-200',
  pressure_vessel: 'bg-red-50 text-red-700 border-red-200',
  elevator: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200',
  fire_safety: 'bg-rose-50 text-rose-700 border-rose-200',
  other: 'bg-gray-100 text-gray-700 border-gray-200',
};

export function ContractorSpecializationTags({ tags, limit }: ContractorSpecializationTagsProps) {
  const visibleTags = typeof limit === 'number' ? tags.slice(0, limit) : tags;
  const remaining = typeof limit === 'number' ? tags.length - visibleTags.length : 0;

  return (
    <div className="flex gap-1.5 overflow-x-auto">
      {visibleTags.map((tag) => (
        <span key={tag} className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${TAG_STYLES[tag]}`}>
          {SPECIALIZATION_LABELS[tag]}
        </span>
      ))}
      {remaining > 0 && (
        <span className="shrink-0 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-500">
          +{remaining} more
        </span>
      )}
    </div>
  );
}

export default ContractorSpecializationTags;
