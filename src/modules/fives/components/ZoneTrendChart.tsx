import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';

interface MonthlyScore {
  month: string;
  overallScore: number;
  sort: number;
  set_in_order: number;
  shine: number;
  standardize: number;
  sustain: number;
}

const PILLAR_LINES = [
  { key: 'sort', color: '#EF4444', label: 'Sort' },
  { key: 'set_in_order', color: '#F59E0B', label: 'Set in Order' },
  { key: 'shine', color: '#00C2FF', label: 'Shine' },
  { key: 'standardize', color: '#8B5CF6', label: 'Standardize' },
  { key: 'sustain', color: '#10B981', label: 'Sustain' },
];

function formatMonth(month: string): string {
  const [y, m] = month.split('-');
  const d = new Date(Number(y), Number(m) - 1);
  return d.toLocaleString('default', { month: 'short', year: '2-digit' });
}

// Convert pillar avg (0-4) to 0-100 for display
function pillarToPercent(v: number) {
  return Math.round((v / 4) * 100);
}

interface ZoneTrendChartProps {
  trend: MonthlyScore[];
  zoneName?: string;
  onPointClick?: (month: string) => void;
}

export function ZoneTrendChart({ trend, zoneName, onPointClick }: ZoneTrendChartProps) {
  const chartData = trend.map((t) => ({
    month: formatMonth(t.month),
    rawMonth: t.month,
    overall: t.overallScore,
    sort: pillarToPercent(t.sort),
    set_in_order: pillarToPercent(t.set_in_order),
    shine: pillarToPercent(t.shine),
    standardize: pillarToPercent(t.standardize),
    sustain: pillarToPercent(t.sustain),
  }));

  if (trend.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-slate-500 text-sm">
        Not enough audit data for trend chart
      </div>
    );
  }

  return (
    <div className="bg-[#0F1E35] border border-[#1E3A5F] rounded-2xl p-5 space-y-3">
      {zoneName && (
        <p className="text-sm font-semibold text-white">{zoneName} — Score Trend</p>
      )}
      <ResponsiveContainer width="100%" height={280}>
        <LineChart
          data={chartData}
          margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
          onClick={(e: any) => {
            if (e?.activePayload?.[0] && onPointClick) {
              const raw = (e.activePayload[0].payload as { rawMonth: string }).rawMonth;
              onPointClick(raw);
            }
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#1E3A5F" />
          <XAxis
            dataKey="month"
            tick={{ fill: '#8BA3BF', fontSize: 11 }}
            axisLine={{ stroke: '#1E3A5F' }}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: '#8BA3BF', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip
            contentStyle={{ background: '#0F1E35', border: '1px solid #1E3A5F', borderRadius: 12 }}
            labelStyle={{ color: '#F0F4F8', fontWeight: 600, marginBottom: 4 }}
            formatter={(value) => [`${value}%`] as [string]}
          />
          <Legend
            wrapperStyle={{ fontSize: 11, color: '#8BA3BF', paddingTop: 8 }}
          />
          <ReferenceLine y={80} stroke="#1A56DB" strokeDasharray="4 4" label={{ value: 'Target 80%', fill: '#1A56DB', fontSize: 10 }} />

          {PILLAR_LINES.map((pl) => (
            <Line
              key={pl.key}
              type="monotone"
              dataKey={pl.key}
              name={pl.label}
              stroke={pl.color}
              strokeWidth={1.5}
              dot={{ r: 3, fill: pl.color }}
              activeDot={{ r: 5, cursor: 'pointer' }}
            />
          ))}

          <Line
            type="monotone"
            dataKey="overall"
            name="Overall"
            stroke="#FFFFFF"
            strokeWidth={2.5}
            dot={{ r: 4, fill: '#FFFFFF' }}
            activeDot={{ r: 6, cursor: 'pointer' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
