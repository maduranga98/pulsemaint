import { resolveQuickDateRange } from '../../../utils/reports/dateRangeUtils';
import type { QuickDateRange, ReportConfig } from '../../../types/reports.types';

const ranges: { value: QuickDateRange; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'this_week', label: 'This Week' },
  { value: 'last_week', label: 'Last Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'last_3_months', label: 'Last 3 Months' },
  { value: 'last_6_months', label: 'Last 6 Months' },
  { value: 'this_year', label: 'This Year' },
  { value: 'custom', label: 'Custom' },
];

export default function DateRangeSelector({
  config,
  onChange,
}: {
  config: ReportConfig;
  onChange: (updates: Partial<ReportConfig>) => void;
}) {
  return (
    <section className="space-y-3 border-b border-[#1E3A5F] pb-5">
      <h3 className="font-[Sora] text-sm font-semibold text-[#F0F4F8]">Date Range</h3>
      <div className="flex flex-wrap gap-2">
        {ranges.map((range) => (
          <button
            key={range.value}
            type="button"
            onClick={() => {
              const next = resolveQuickDateRange(range.value);
              onChange({ quickRange: range.value, dateFrom: next.from, dateTo: next.to });
            }}
            className={`min-h-10 rounded-full border px-3 text-xs font-semibold transition ${
              config.quickRange === range.value
                ? 'border-[#00C2FF] bg-[#00C2FF]/10 text-[#F0F4F8]'
                : 'border-[#1E3A5F] text-[#8BA3BF] hover:border-[#2E5A8F]'
            }`}
          >
            {range.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1 text-xs text-[#8BA3BF]">
          From
          <input
            type="date"
            value={config.dateFrom}
            onChange={(event) => onChange({ quickRange: 'custom', dateFrom: event.target.value })}
            className="h-11 w-full rounded-lg border border-[#1E3A5F] bg-[#0A1628] px-3 text-sm text-[#F0F4F8] outline-none focus:border-[#00C2FF]"
          />
        </label>
        <label className="space-y-1 text-xs text-[#8BA3BF]">
          To
          <input
            type="date"
            value={config.dateTo}
            onChange={(event) => onChange({ quickRange: 'custom', dateTo: event.target.value })}
            className="h-11 w-full rounded-lg border border-[#1E3A5F] bg-[#0A1628] px-3 text-sm text-[#F0F4F8] outline-none focus:border-[#00C2FF]"
          />
        </label>
      </div>
    </section>
  );
}
