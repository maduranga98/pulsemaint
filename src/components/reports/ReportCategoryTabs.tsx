import {
  LayoutGrid,
  AlertTriangle,
  ClipboardList,
  Factory,
  Package,
  UsersRound,
  ShieldCheck,
  CircleDollarSign,
  Presentation,
  type LucideIcon,
} from 'lucide-react';
import type { ReportCategory } from '../../types/reports.types';

export type ReportCategoryTab = ReportCategory | 'all';

const tabs: { value: ReportCategoryTab; label: string; icon: LucideIcon }[] = [
  { value: 'all', label: 'All', icon: LayoutGrid },
  { value: 'breakdowns', label: 'Breakdowns', icon: AlertTriangle },
  { value: 'work_orders', label: 'Work Orders', icon: ClipboardList },
  { value: 'machines', label: 'Machines', icon: Factory },
  { value: 'inventory', label: 'Inventory', icon: Package },
  { value: 'people', label: 'People', icon: UsersRound },
  { value: 'compliance', label: 'Compliance', icon: ShieldCheck },
  { value: 'financial', label: 'Financial', icon: CircleDollarSign },
  { value: 'executive', label: 'Executive', icon: Presentation },
];

export default function ReportCategoryTabs({
  active,
  onChange,
  availableCategories,
}: {
  active: ReportCategoryTab;
  onChange: (value: ReportCategoryTab) => void;
  /** Restrict the tab bar to 'all' plus these categories — the ones the
   *  current role actually has reports in — instead of every category that
   *  exists in the hub overall. Omit to show the full fixed list. */
  availableCategories?: ReportCategory[];
}) {
  const visibleTabs = availableCategories
    ? tabs.filter((t) => t.value === 'all' || availableCategories.includes(t.value as ReportCategory))
    : tabs;
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1">
      {visibleTabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = active === tab.value;
        return (
          <button
            key={tab.value}
            type="button"
            onClick={() => onChange(tab.value)}
            className={`flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-medium transition ${
              isActive
                ? 'border-[#00C2FF] bg-[#00C2FF]/10 text-[#F0F4F8]'
                : 'border-[#1E3A5F] bg-[#0F1E35] text-[#8BA3BF] hover:border-[#2E5A8F] hover:text-[#F0F4F8]'
            }`}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
