import { useMemo, useState } from 'react';
import { useMachineOptions } from '../../../hooks/inventory/useMachineOptions';
import type { MoeDateRange } from '../types/moe.types';

export type DatePreset = '7d' | '30d' | 'quarter' | 'year' | 'custom';

function buildRange(preset: DatePreset, customStart?: string, customEnd?: string): MoeDateRange {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  switch (preset) {
    case '7d':
      start.setDate(start.getDate() - 6);
      return { start, end, label: 'Last 7 days' };
    case '30d':
      start.setDate(start.getDate() - 29);
      return { start, end, label: 'Last 30 days' };
    case 'quarter':
      start.setMonth(start.getMonth() - 3);
      return { start, end, label: 'Last quarter' };
    case 'year':
      start.setFullYear(start.getFullYear() - 1);
      return { start, end, label: 'Last year' };
    case 'custom': {
      const s = customStart ? new Date(customStart) : start;
      const e = customEnd ? new Date(customEnd) : end;
      e.setHours(23, 59, 59, 999);
      return { start: s, end: e, label: 'Custom range' };
    }
    default:
      return { start, end, label: 'Last 30 days' };
  }
}

interface MoeMachineFilterProps {
  machineId: string | null;
  onMachineChange: (machineId: string | null) => void;
  onRangeChange: (range: MoeDateRange) => void;
  showMachinePicker?: boolean;
}

export function MoeMachineFilter({
  machineId,
  onMachineChange,
  onRangeChange,
  showMachinePicker = true,
}: MoeMachineFilterProps) {
  const { machines, loading } = useMachineOptions();
  const [preset, setPreset] = useState<DatePreset>('30d');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const sortedMachines = useMemo(
    () => [...machines].sort((a, b) => a.name.localeCompare(b.name)),
    [machines],
  );

  const applyPreset = (p: DatePreset) => {
    setPreset(p);
    if (p !== 'custom') {
      onRangeChange(buildRange(p));
    }
  };

  const applyCustom = (start: string, end: string) => {
    setCustomStart(start);
    setCustomEnd(end);
    if (start && end) onRangeChange(buildRange('custom', start, end));
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      {showMachinePicker && (
        <select
          className="bg-[#0F1E35] border border-[#1E3A5F] rounded-lg px-3 py-2 text-sm text-white min-w-[200px]"
          value={machineId ?? ''}
          onChange={(e) => onMachineChange(e.target.value || null)}
          disabled={loading}
        >
          <option value="">All machines</option>
          {sortedMachines.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} — {m.department}
            </option>
          ))}
        </select>
      )}

      <div className="flex gap-1 bg-[#0F1E35] border border-[#1E3A5F] rounded-lg p-1">
        {(
          [
            ['7d', '7D'],
            ['30d', '30D'],
            ['quarter', 'Quarter'],
            ['year', 'Year'],
            ['custom', 'Custom'],
          ] as [DatePreset, string][]
        ).map(([p, label]) => (
          <button
            key={p}
            type="button"
            onClick={() => applyPreset(p)}
            className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${
              preset === p ? 'bg-[#00C2FF] text-[#0A1628]' : 'text-[#8BA3BF] hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {preset === 'custom' && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={customStart}
            onChange={(e) => applyCustom(e.target.value, customEnd)}
            className="bg-[#0F1E35] border border-[#1E3A5F] rounded-lg px-2 py-1.5 text-sm text-white"
          />
          <span className="text-[#8BA3BF] text-xs">to</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => applyCustom(customStart, e.target.value)}
            className="bg-[#0F1E35] border border-[#1E3A5F] rounded-lg px-2 py-1.5 text-sm text-white"
          />
        </div>
      )}
    </div>
  );
}

export { buildRange };
