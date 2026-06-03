import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
} from 'recharts';
import { TrendingUp, Clock, Target, DollarSign, Lock } from 'lucide-react';
import { useKaizenStats, useKaizenTrend } from '../hooks/useKaizen';
import {
  KAIZEN_STATUS_META,
  KAIZEN_CATEGORY_META,
} from '../types/kaizen.types';
import type { KaizenStatus, KaizenCategory } from '../types/kaizen.types';

interface Props {
  isProPlan?: boolean;
}

export function KaizenStats({ isProPlan = false }: Props) {
  const { stats, loading } = useKaizenStats();
  const { trend } = useKaizenTrend(12);

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 animate-pulse">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-20 bg-gray-100 rounded-xl" />
        ))}
      </div>
    );
  }

  if (!stats) return null;

  // Pie chart data
  const pieData = (Object.entries(stats.byStatus) as [KaizenStatus, number][])
    .filter(([, v]) => v > 0)
    .map(([status, value]) => ({
      name: KAIZEN_STATUS_META[status].label,
      value,
      color: KAIZEN_STATUS_META[status].color,
    }));

  // Bar chart data
  const barData = (Object.entries(stats.byCategory) as [KaizenCategory, number][]).map(
    ([cat, count]) => ({
      name: KAIZEN_CATEGORY_META[cat].label,
      count,
      color: KAIZEN_CATEGORY_META[cat].color,
    })
  );

  // Trend data
  const trendData = trend.map((t) => ({
    month: t.month.slice(5), // MM
    total: t.total,
  }));

  const kpis = [
    {
      label: 'Total Cards',
      value: stats.total,
      icon: <Target size={18} className="text-blue-500" />,
      color: 'blue',
    },
    {
      label: 'Implementation Rate',
      value: `${stats.implementationRate}%`,
      icon: <TrendingUp size={18} className="text-emerald-500" />,
      color: 'emerald',
    },
    {
      label: 'Avg Days to Implement',
      value: stats.avgTimeToImplement || '—',
      icon: <Clock size={18} className="text-amber-500" />,
      color: 'amber',
    },
    {
      label: 'Total Annual Benefit',
      value:
        stats.totalActualBenefit > 0
          ? `LKR ${(stats.totalActualBenefit * 12).toLocaleString()}`
          : '—',
      icon: <DollarSign size={18} className="text-purple-500" />,
      color: 'purple',
    },
  ];

  return (
    <div className="space-y-5">
      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3"
          >
            <div className="flex-shrink-0">{kpi.icon}</div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500 truncate">{kpi.label}</p>
              <p className="text-xl font-bold text-gray-900">{kpi.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Status donut */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">By Status</h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={75}
                dataKey="value"
              >
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => [v, 'Cards']} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
            {pieData.map((e) => (
              <span key={e.name} className="flex items-center gap-1 text-xs text-gray-600">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: e.color }} />
                {e.name} ({e.value})
              </span>
            ))}
          </div>
        </div>

        {/* Category bar */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">By Category</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={barData} layout="vertical" margin={{ left: 0, right: 8 }}>
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={70} />
              <Tooltip />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {barData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Leaderboard */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Top Contributors</h3>
          {stats.topContributors.length === 0 ? (
            <p className="text-xs text-gray-400 italic">No data yet</p>
          ) : (
            <div className="space-y-2">
              {stats.topContributors.map((c, i) => (
                <div key={c.userId} className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{c.name}</p>
                    <div
                      className="h-1.5 rounded-full bg-blue-200 mt-0.5"
                      style={{
                        width: `${(c.count / (stats.topContributors[0]?.count ?? 1)) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="text-xs font-bold text-blue-700 flex-shrink-0">{c.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Trend line */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Monthly Kaizen Trend (12 months)</h3>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
            <XAxis dataKey="month" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="total"
              stroke="#1A56DB"
              strokeWidth={2}
              dot={{ fill: '#1A56DB', r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Factory Pro additions */}
      {isProPlan ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* ROI distribution */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">ROI Payback Distribution</h3>
            <p className="text-xs text-gray-400 italic">
              (Requires actual cost + benefit data on verified cards)
            </p>
          </div>

          {/* Benefit comparison */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Estimated vs Actual Benefit</h3>
            <ResponsiveContainer width="100%" height={120}>
              <BarChart
                data={[
                  { name: 'Estimated', value: stats.totalEstimatedBenefit },
                  { name: 'Actual', value: stats.totalActualBenefit },
                ]}
              >
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => [`LKR ${v.toLocaleString()}`, 'Monthly']} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  <Cell fill="#1A56DB" />
                  <Cell fill="#10B981" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 flex items-center gap-4">
          <Lock size={20} className="text-gray-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-gray-700">ROI Analytics — Factory Pro</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Upgrade to Factory Pro to unlock ROI distribution, payback analysis, and benefit tracking.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
