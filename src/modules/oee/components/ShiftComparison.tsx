import { useState } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ReferenceLine,
} from 'recharts';
import { useShiftComparison } from '../hooks/useOEE';
import { CHART_DEFAULTS } from '../../../constants/chartTheme';
import type { OEEShift } from '../types/oee.types';

const SHIFT_LABELS: Record<OEEShift, string> = {
  day: 'Day Shift',
  evening: 'Evening Shift',
  night: 'Night Shift',
};

const SHIFT_COLORS: Record<OEEShift, string> = {
  day: '#F59E0B',
  evening: '#8B5CF6',
  night: '#1A56DB',
};

interface ShiftComparisonProps {
  machineId: string;
  machineName?: string;
}

export function ShiftComparison({ machineId, machineName = 'Machine' }: ShiftComparisonProps) {
  const [months, setMonths] = useState(3);
  const { data, loading, error } = useShiftComparison(machineId, months);

  const chartData = data.map((d) => ({
    name: SHIFT_LABELS[d.shift],
    shift: d.shift,
    OEE: d.avgOEE,
    Availability: d.avgAvailability,
    Performance: d.avgPerformance,
    Quality: d.avgQuality,
    Records: d.recordCount,
  }));

  const sorted = [...data].sort((a, b) => b.avgOEE - a.avgOEE);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  const delta = best && worst ? Math.round((best.avgOEE - worst.avgOEE) * 10) / 10 : 0;

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div>
          <p className="text-sm font-medium text-white">{machineName}</p>
          <p className="text-xs text-slate-400">Shift performance comparison</p>
        </div>
        <div className="flex items-center gap-1.5">
          {[1, 3, 6].map((m) => (
            <button
              key={m}
              onClick={() => setMonths(m)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                months === m ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {m}m
            </button>
          ))}
        </div>
      </div>

      {/* Best/worst badges */}
      {best && worst && (
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 px-3 py-2 bg-emerald-900/20 border border-emerald-800/40 rounded-xl text-xs">
            <span className="text-emerald-400 font-semibold">Best:</span>
            <span className="text-white">{SHIFT_LABELS[best.shift]}</span>
            <span className="text-emerald-400 font-bold">{best.avgOEE}%</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 bg-red-900/20 border border-red-800/40 rounded-xl text-xs">
            <span className="text-red-400 font-semibold">Worst:</span>
            <span className="text-white">{SHIFT_LABELS[worst.shift]}</span>
            <span className="text-red-400 font-bold">{worst.avgOEE}%</span>
          </div>
          {delta > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs">
              <span className="text-slate-400">Gap:</span>
              <span className="text-amber-400 font-bold">Δ {delta}%</span>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="h-64 bg-slate-800/30 rounded-2xl animate-pulse" />
      ) : error ? (
        <p className="text-red-400 text-sm">{error}</p>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
              <CartesianGrid {...CHART_DEFAULTS.cartesianGrid} vertical={false} />
              <XAxis dataKey="name" {...CHART_DEFAULTS.xAxis} />
              <YAxis domain={[0, 100]} {...CHART_DEFAULTS.yAxis} tickFormatter={(v) => `${v}%`} />
              <Tooltip
                {...CHART_DEFAULTS.tooltip}
                formatter={(v: number, name: string) => [`${v}%`, name]}
              />
              <ReferenceLine y={85} stroke="#F59E0B" strokeDasharray="5 4" />
              <Legend {...CHART_DEFAULTS.legend} />
              <Bar dataKey="OEE" fill="#00C2FF" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Availability" fill="#10B981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Performance" fill="#1A56DB" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Quality" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Records count */}
      {!loading && chartData.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {chartData.map((d) => (
            <div key={d.shift} className="text-xs text-slate-500">
              {d.name}: <span className="text-slate-400">{d.Records} records</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
