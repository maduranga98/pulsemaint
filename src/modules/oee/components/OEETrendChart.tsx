import { useState, useEffect } from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine, Legend,
} from 'recharts';
import { Download } from 'lucide-react';
import { useAuthStore } from '../../../store/authStore';
import { fetchOEEMonthlyTrend } from '../services/oee.service';
import type { OEEMonthlyAggregate } from '../types/oee.types';
import { CHART_DEFAULTS } from '../../../constants/chartTheme';

interface OEETrendChartProps {
  machineId: string;
  machineName?: string;
}

type MetricKey = 'avgOEE' | 'avgAvailability' | 'avgPerformance' | 'avgQuality';

const METRICS: { key: MetricKey; label: string; color: string; dash?: string }[] = [
  { key: 'avgOEE', label: 'OEE', color: '#00C2FF' },
  { key: 'avgAvailability', label: 'Availability', color: '#10B981', dash: '6 3' },
  { key: 'avgPerformance', label: 'Performance', color: '#1A56DB', dash: '2 3' },
  { key: 'avgQuality', label: 'Quality', color: '#8B5CF6', dash: '6 2 2 2' },
];

function exportToExcel(data: OEEMonthlyAggregate[], machineName: string) {
  import('xlsx').then(({ utils, writeFile }) => {
    const rows = data.map((d) => ({
      Month: d.month,
      'OEE (%)': d.avgOEE,
      'Availability (%)': d.avgAvailability,
      'Performance (%)': d.avgPerformance,
      'Quality (%)': d.avgQuality,
      'Records': d.recordCount,
    }));
    const ws = utils.json_to_sheet(rows);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, 'OEE Trend');
    writeFile(wb, `OEE_Trend_${machineName}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  });
}

export function OEETrendChart({ machineId, machineName = 'Machine' }: OEETrendChartProps) {
  const plantId = useAuthStore((s) => s.userProfile?.companyId);
  const [data, setData] = useState<OEEMonthlyAggregate[]>([]);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState<Record<MetricKey, boolean>>({
    avgOEE: true,
    avgAvailability: true,
    avgPerformance: true,
    avgQuality: true,
  });

  useEffect(() => {
    if (!plantId || !machineId) return;
    setLoading(true);
    fetchOEEMonthlyTrend(plantId, machineId, 12)
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [plantId, machineId]);

  const chartData = data.map((d) => ({ ...d, month: d.month.slice(2) }));

  if (loading) {
    return <div className="h-72 bg-slate-800/30 rounded-2xl animate-pulse" />;
  }

  if (data.length === 0) {
    return (
      <div className="h-72 flex items-center justify-center text-slate-500 text-sm">
        No monthly trend data yet for this machine.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex flex-wrap gap-2">
          {METRICS.map(({ key, label, color }) => (
            <button
              key={key}
              onClick={() => setVisible((v) => ({ ...v, [key]: !v[key] }))}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-colors border ${
                visible[key] ? 'border-transparent text-white' : 'border-slate-700 text-slate-500 bg-transparent'
              }`}
              style={visible[key] ? { backgroundColor: `${color}25`, color, borderColor: `${color}50` } : {}}
            >
              <span className="w-3 h-0.5 rounded" style={{ backgroundColor: visible[key] ? color : '#4b5563' }} />
              {label}
            </button>
          ))}
        </div>
        <button
          onClick={() => exportToExcel(data, machineName)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl border border-slate-700 transition-colors"
        >
          <Download className="h-3.5 w-3.5" />
          Export Excel
        </button>
      </div>

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
            <CartesianGrid {...CHART_DEFAULTS.cartesianGrid} vertical={false} />
            <XAxis dataKey="month" {...CHART_DEFAULTS.xAxis} />
            <YAxis domain={[0, 100]} {...CHART_DEFAULTS.yAxis} tickFormatter={(v) => `${v}%`} />
            <Tooltip
              {...CHART_DEFAULTS.tooltip}
              formatter={(v, name) => [`${v}%`, String(name)] as [string, string]}
            />
            <ReferenceLine
              y={85}
              stroke="#F59E0B"
              strokeDasharray="5 4"
              label={{ value: 'World Class 85%', position: 'insideTopRight', fill: '#F59E0B', fontSize: 10 }}
            />
            {METRICS.map(({ key, label, color, dash }) =>
              visible[key] ? (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  name={label}
                  stroke={color}
                  strokeWidth={2}
                  strokeDasharray={dash}
                  dot={{ fill: color, r: 3 }}
                  activeDot={{ r: 5 }}
                />
              ) : null
            )}
            <Legend {...CHART_DEFAULTS.legend} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
