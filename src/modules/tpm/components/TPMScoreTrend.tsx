import { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from 'recharts';
import { useTPMTrend } from '../hooks/useTPM';
import type { TPMPillarId } from '../types/tpm.types';
import { PILLAR_META } from '../types/tpm.types';

// ─── Pillar colours for chart lines ──────────────────────────────────────────

const PILLAR_LINE_COLORS: Record<TPMPillarId, string> = {
  AM: '#00C2FF',
  PM: '#1A56DB',
  QM: '#10B981',
  FI: '#F59E0B',
  EEM: '#8B5CF6',
  TE: '#EC4899',
  SHE: '#EF4444',
  OTPM: '#64748b',
};

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

interface TooltipPayload {
  name: string;
  value: number;
  color: string;
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-3 shadow-xl text-xs">
      <p className="text-slate-400 font-medium mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 mb-1">
          <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
          <span className="text-slate-300">{p.name}:</span>
          <span className="font-bold text-white">{p.value ?? '—'}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Days Badge ───────────────────────────────────────────────────────────────

function DaysBadge({ days }: { days: number | null }) {
  if (days === null) return null;
  const tone =
    days <= 7 ? 'bg-emerald-900/50 text-emerald-400 border-emerald-800' :
    days <= 30 ? 'bg-amber-900/50 text-amber-400 border-amber-800' :
    'bg-red-900/50 text-red-400 border-red-800';
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border ${tone}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      Updated {days === 0 ? 'today' : `${days}d ago`}
    </span>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function TrendSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-8 w-48 bg-slate-700 rounded" />
      <div className="h-64 bg-slate-800/60 rounded-xl" />
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function TPMScoreTrend() {
  const { data, loading, error, daysSinceUpdate } = useTPMTrend(12);
  const [visiblePillars, setVisiblePillars] = useState<Set<TPMPillarId>>(new Set());

  const togglePillar = (id: TPMPillarId) => {
    setVisiblePillars((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (loading) return <TrendSkeleton />;

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-800/50 rounded-xl p-6 text-red-400 text-sm">
        Failed to load trend data: {error}
      </div>
    );
  }

  const chartData = data.map((d) => ({
    month: d.month,
    'TPM Score': d.composite,
    ...Object.fromEntries(
      (Object.keys(PILLAR_META) as TPMPillarId[]).map((id) => [
        PILLAR_META[id].name.split(' ')[0], // Short name
        d.pillars?.[id] ?? null,
      ])
    ),
  }));

  const pillarIds = Object.keys(PILLAR_META) as TPMPillarId[];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-white font-sora">TPM Score Trend</h3>
          <p className="text-xs text-slate-400 mt-0.5">Last 12 months composite + pillar scores</p>
        </div>
        <DaysBadge days={daysSinceUpdate} />
      </div>

      {/* Pillar Toggle Chips */}
      <div className="flex flex-wrap gap-2">
        {pillarIds.map((id) => {
          const active = visiblePillars.has(id);
          return (
            <button
              key={id}
              onClick={() => togglePillar(id)}
              className={`flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border transition-all ${
                active
                  ? 'border-transparent text-white'
                  : 'bg-transparent border-slate-700 text-slate-400 hover:border-slate-500'
              }`}
              style={active ? { background: PILLAR_LINE_COLORS[id] + '33', borderColor: PILLAR_LINE_COLORS[id] } : {}}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: PILLAR_LINE_COLORS[id] }}
              />
              {PILLAR_META[id].icon} {id}
            </button>
          );
        })}
      </div>

      {/* Chart */}
      {data.length === 0 ? (
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-12 flex flex-col items-center text-center gap-3">
          <span className="text-4xl">📈</span>
          <p className="text-sm font-medium text-slate-300">No trend data yet</p>
          <p className="text-xs text-slate-500">Monthly TPM scores will appear here once recorded</p>
        </div>
      ) : (
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: string) => v.slice(5)} // Show MM only
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine
                y={85}
                stroke="#10B981"
                strokeDasharray="6 3"
                label={{ value: 'World Class 85', fill: '#10B981', fontSize: 10, position: 'right' }}
              />

              {/* Main TPM composite line */}
              <Line
                type="monotone"
                dataKey="TPM Score"
                stroke="#00C2FF"
                strokeWidth={2.5}
                dot={{ fill: '#00C2FF', r: 3 }}
                activeDot={{ r: 5 }}
              />

              {/* Per-pillar lines (only when toggled) */}
              {pillarIds
                .filter((id) => visiblePillars.has(id))
                .map((id) => (
                  <Line
                    key={id}
                    type="monotone"
                    dataKey={PILLAR_META[id].name.split(' ')[0]}
                    stroke={PILLAR_LINE_COLORS[id]}
                    strokeWidth={1.5}
                    strokeDasharray="4 2"
                    dot={false}
                    connectNulls
                  />
                ))}
            </LineChart>
          </ResponsiveContainer>

          {/* Benchmark note */}
          <div className="flex items-center gap-2 mt-3 justify-end">
            <span className="h-px w-6 bg-emerald-500 opacity-60" style={{ borderTop: '1px dashed' }} />
            <span className="text-[11px] text-slate-500">85 = World Class benchmark</span>
          </div>
        </div>
      )}
    </div>
  );
}
