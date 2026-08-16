import type { DateRange } from '../../../services/teamPerformance.service';

interface DateRangeFilterProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

const PRESETS: { label: string; range: () => DateRange }[] = [
  { label: 'All Time', range: () => ({ from: null, to: null }) },
  {
    label: 'Last 30 Days',
    range: () => {
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - 29);
      return { from: toDateInputValue(from), to: toDateInputValue(to) };
    },
  },
  {
    label: 'This Month',
    range: () => {
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: toDateInputValue(from), to: toDateInputValue(now) };
    },
  },
  {
    label: 'Last Month',
    range: () => {
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const to = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: toDateInputValue(from), to: toDateInputValue(to) };
    },
  },
  {
    label: 'This Year',
    range: () => {
      const now = new Date();
      const from = new Date(now.getFullYear(), 0, 1);
      return { from: toDateInputValue(from), to: toDateInputValue(now) };
    },
  },
];

// Shared date-range control for every HR Analytics tab — a preset picker
// plus custom From/To inputs, all driving the same DateRange passed down
// into whichever report is currently active.
export default function DateRangeFilter({ value, onChange }: DateRangeFilterProps) {
  const isPresetActive = (range: DateRange) => value.from === range.from && value.to === range.to;

  return (
    <div className="flex flex-wrap items-center gap-3 bg-[#0F1E35] border border-[#1E3A5F] rounded-lg px-4 py-3">
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((preset) => {
          const range = preset.range();
          return (
            <button
              key={preset.label}
              onClick={() => onChange(range)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                isPresetActive(range)
                  ? 'bg-[#1A56DB] text-white'
                  : 'bg-transparent text-[#8BA3BF] border border-[#1E3A5F] hover:text-[#F0F4F8] hover:border-[#2E5A8F]'
              }`}
            >
              {preset.label}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-2 ml-auto">
        <label className="flex items-center gap-1.5 text-xs text-[#8BA3BF]">
          From
          <input
            type="date"
            value={value.from ?? ''}
            max={value.to ?? undefined}
            onChange={(e) => onChange({ ...value, from: e.target.value || null })}
            className="bg-[#0A1628] border border-[#1E3A5F] rounded px-2 py-1 text-xs text-[#F0F4F8]"
          />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-[#8BA3BF]">
          To
          <input
            type="date"
            value={value.to ?? ''}
            min={value.from ?? undefined}
            onChange={(e) => onChange({ ...value, to: e.target.value || null })}
            className="bg-[#0A1628] border border-[#1E3A5F] rounded px-2 py-1 text-xs text-[#F0F4F8]"
          />
        </label>
      </div>
    </div>
  );
}
