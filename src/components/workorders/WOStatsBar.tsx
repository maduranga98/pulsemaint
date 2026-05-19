import { useWOStats } from '../../hooks/useWOStats';
import { WO_COPY } from '../../constants/copy';

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function WOStatsBar() {
  const { stats, loading } = useWOStats();

  const statItems = [
    {
      label: WO_COPY.openWOs,
      value: stats?.openCount ?? '—',
      color: 'text-blue-600',
    },
    {
      label: WO_COPY.overdueWOs,
      value: stats?.overdueCount ?? '—',
      color: 'text-red-600',
    },
    {
      label: WO_COPY.avgCompletionTime,
      value: stats ? formatDuration(stats.avgCompletionTimeMinutes) : '—',
      color: 'text-gray-700',
    },
    {
      label: WO_COPY.completedThisWeek,
      value: stats?.completedThisWeek ?? '—',
      color: 'text-emerald-600',
    },
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 bg-gray-100 animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {statItems.map((item) => (
        <div
          key={item.label}
          className="bg-white rounded-lg border border-gray-100 shadow-sm p-4 flex flex-col"
        >
          <span className={`text-2xl font-bold ${item.color}`}>{item.value}</span>
          <span className="text-xs text-gray-500 mt-0.5">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
