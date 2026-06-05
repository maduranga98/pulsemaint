import { useState } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Cell,
} from 'recharts';
import { useBigLosses } from '../hooks/useOEE';
import type { BigLoss } from '../types/oee.types';

interface BigLossesWaterfallProps {
  month: string; // YYYY-MM
  lkrPerHour?: number;
  isProPlan?: boolean;
}

function LossBadge({ loss }: { loss: BigLoss }) {
  return (
    <div className="flex items-center justify-between p-3 bg-slate-800/60 rounded-xl border border-slate-700/50 hover:border-slate-600 transition-colors cursor-pointer">
      <div className="flex items-center gap-3">
        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: loss.color }} />
        <div>
          <p className="text-sm font-medium text-white">{loss.label}</p>
          <p className="text-xs text-slate-500">{loss.percentage}% of planned time</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-sm font-bold" style={{ color: loss.color }}>{loss.hours}h</p>
        {loss.lkrCost > 0 && (
          <p className="text-xs text-slate-500">LKR {loss.lkrCost.toLocaleString()}</p>
        )}
      </div>
    </div>
  );
}

export function BigLossesWaterfall({ month, lkrPerHour = 0, isProPlan }: BigLossesWaterfallProps) {
  const { losses, totalLostHours, loading, error } = useBigLosses(month, lkrPerHour);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const totalLkrCost = losses.reduce((s, l) => s + l.lkrCost, 0);

  const chartData = losses.map((l) => ({
    name: l.label.replace(' Losses', '').replace(' & ', '\n& ').replace(' Rejects', '\nRejects'),
    hours: l.hours,
    color: l.color,
    category: l.category,
    percentage: l.percentage,
  }));

  if (loading) {
    return <div className="h-72 bg-slate-800/30 rounded-2xl animate-pulse" />;
  }

  if (error) {
    return <p className="text-red-400 text-sm">{error}</p>;
  }

  return (
    <div className="space-y-6">
      {/* Summary bar */}
      <div className="flex flex-wrap gap-4">
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-3">
          <p className="text-xs text-slate-400">Total Lost Hours</p>
          <p className="text-2xl font-bold text-white font-sora">{totalLostHours.toFixed(1)}h</p>
        </div>
        {isProPlan && lkrPerHour > 0 && (
          <div className="bg-red-900/20 border border-red-800/40 rounded-xl px-4 py-3">
            <p className="text-xs text-slate-400">Total Loss Cost</p>
            <p className="text-2xl font-bold text-red-400 font-sora">LKR {totalLkrCost.toLocaleString()}</p>
          </div>
        )}
        {!isProPlan && lkrPerHour === 0 && (
          <div className="bg-blue-900/10 border border-blue-800/30 rounded-xl px-4 py-3 flex items-center gap-2">
            <p className="text-xs text-blue-400">Configure LKR/hour in Loss Calculator to see cost</p>
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 20, left: -10 }}>
            <CartesianGrid stroke="#1E3A5F" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fill: '#8BA3BF', fontSize: 10, fontFamily: 'DM Sans' }}
              axisLine={{ stroke: '#1E3A5F' }}
              tickLine={false}
              interval={0}
            />
            <YAxis
              tick={{ fill: '#8BA3BF', fontSize: 11, fontFamily: 'DM Sans' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v}h`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#0F1E35',
                border: '1px solid #1E3A5F',
                borderRadius: '8px',
                fontFamily: 'DM Sans',
              }}
              labelStyle={{ color: '#F0F4F8' }}
              formatter={(v, _name, props: any) => [
                `${v}h (${props.payload.percentage}%)`,
                'Lost Hours',
              ] as [string, string]}
            />
            <Bar
              dataKey="hours"
              radius={[4, 4, 0, 0]}
              onClick={(data: any) => setSelectedCategory(
                selectedCategory === data.category ? null : data.category
              )}
              cursor="pointer"
            >
              {chartData.map((entry, i) => (
                <Cell
                  key={i}
                  fill={entry.color}
                  opacity={selectedCategory && selectedCategory !== entry.category ? 0.35 : 1}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Loss list */}
      <div className="space-y-2">
        {losses.map((loss) => (
          <LossBadge key={loss.category} loss={loss} />
        ))}
      </div>

      {/* Effective OEE */}
      <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4 text-center">
        <p className="text-xs text-slate-400 mb-1">Effective OEE (all losses applied)</p>
        <p className="text-3xl font-bold text-white font-sora">
          {losses.length > 0
            ? Math.max(0, 100 - losses.reduce((s, l) => s + l.percentage, 0)).toFixed(1)
            : '—'}
          %
        </p>
      </div>
    </div>
  );
}
