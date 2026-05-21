import type { ChartDateRange } from '../../../types/analytics.types';

const RANGES: { label: string; value: ChartDateRange }[] = [
  { label: '7D', value: '7D' },
  { label: '30D', value: '30D' },
  { label: '3M', value: '3M' },
  { label: '6M', value: '6M' },
  { label: '12M', value: '12M' },
];

interface ChartDateRangeSelectorProps {
  value: ChartDateRange;
  onChange: (range: ChartDateRange) => void;
}

export default function ChartDateRangeSelector({ value, onChange }: ChartDateRangeSelectorProps) {
  return (
    <div className="inline-flex bg-[#0A1628] rounded-lg border border-[#1E3A5F] p-0.5">
      {RANGES.map((r) => (
        <button
          key={r.value}
          onClick={() => onChange(r.value)}
          className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
            value === r.value
              ? 'bg-[#1A56DB] text-white'
              : 'text-[#8BA3BF] hover:text-[#F0F4F8]'
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
