import type { ReportCategory } from '../../types/reports.types';

export type ReportCategoryTab = ReportCategory | 'all';

const tabs: { value: ReportCategoryTab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'breakdowns', label: 'Breakdowns' },
  { value: 'work_orders', label: 'Work Orders' },
  { value: 'machines', label: 'Machines' },
  { value: 'inventory', label: 'Inventory' },
  { value: 'people', label: 'People' },
  { value: 'compliance', label: 'Compliance' },
  { value: 'financial', label: 'Financial' },
  { value: 'executive', label: 'Executive' },
];

export default function ReportCategoryTabs({
  active,
  onChange,
}: {
  active: ReportCategoryTab;
  onChange: (value: ReportCategoryTab) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          onClick={() => onChange(tab.value)}
          className={`h-11 shrink-0 rounded-lg border px-4 text-sm font-semibold transition ${
            active === tab.value
              ? 'border-[#00C2FF] bg-[#00C2FF]/10 text-[#F0F4F8]'
              : 'border-[#1E3A5F] bg-[#0F1E35] text-[#8BA3BF] hover:border-[#2E5A8F] hover:text-[#F0F4F8]'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
