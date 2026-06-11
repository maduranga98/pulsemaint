import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { AlertTriangle, DollarSign, Wrench, Package } from 'lucide-react';
import type { Machine } from '../../types/machine';
import { useMachineTco, REPLACEMENT_RECOMMENDATION_RATIO } from '../../hooks/useMachineTco';

export function formatMoney(amount: number | null | undefined): string {
  if (amount == null) return '—';
  return `LKR ${Math.round(amount).toLocaleString('en-LK')}`;
}

interface TcoTabProps {
  machine: Machine;
}

export function TcoTab({ machine }: TcoTabProps) {
  const { summary, trend, loading } = useMachineTco(machine.id, {
    name: machine.name,
    purchasePrice: machine.purchasePrice ?? null,
    replacementValue: machine.replacementValue ?? null,
  });

  if (loading) {
    return <p className="text-sm text-gray-500">Loading cost of ownership…</p>;
  }

  const ratioPct =
    summary.spendRatio != null ? Math.round(summary.spendRatio * 100) : null;

  return (
    <div className="space-y-6">
      {/* Replacement recommendation banner */}
      {summary.replacementRecommended && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-800">Replacement recommended</p>
            <p className="text-xs text-red-700">
              Cumulative repairs ({formatMoney(summary.cumulativeMaintenanceSpend)}) have reached{' '}
              {ratioPct}% of the replacement value ({formatMoney(summary.replacementValue)}),
              exceeding the {Math.round(REPLACEMENT_RECOMMENDATION_RATIO * 100)}% threshold.
            </p>
          </div>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={<DollarSign className="w-4 h-4" />}
          label="Purchase Price"
          value={formatMoney(summary.purchasePrice)}
        />
        <KpiCard
          icon={<Wrench className="w-4 h-4" />}
          label="Cumulative Maintenance"
          value={formatMoney(summary.cumulativeMaintenanceSpend)}
          sub={`${summary.workOrderCount} completed WOs`}
        />
        <KpiCard
          icon={<Package className="w-4 h-4" />}
          label="Replacement Value"
          value={formatMoney(summary.replacementValue)}
        />
        <KpiCard
          icon={<AlertTriangle className="w-4 h-4" />}
          label="Repairs vs Replacement"
          value={ratioPct != null ? `${ratioPct}%` : '—'}
          accent={summary.replacementRecommended ? 'red' : 'default'}
        />
      </div>

      {/* Spend breakdown */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-3">Spend Breakdown</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex justify-between border-b border-gray-100 pb-2">
            <span className="text-gray-500">Parts</span>
            <span className="font-medium text-gray-900">{formatMoney(summary.partsSpend)}</span>
          </div>
          <div className="flex justify-between border-b border-gray-100 pb-2">
            <span className="text-gray-500">Labour</span>
            <span className="font-medium text-gray-900">{formatMoney(summary.labourSpend)}</span>
          </div>
        </div>
        {summary.replacementValue != null && (
          <div className="mt-4">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Repairs to date</span>
              <span>{ratioPct}% of replacement</span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-gray-100 overflow-hidden">
              <div
                className={`h-full rounded-full ${summary.replacementRecommended ? 'bg-red-500' : 'bg-blue-500'}`}
                style={{ width: `${Math.min(100, ratioPct ?? 0)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Repair-cost trend */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Repair-Cost Trend</h3>
        {trend.length === 0 ? (
          <p className="text-sm text-gray-500">No completed maintenance spend recorded yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={trend} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} width={70} />
              <Tooltip
                formatter={(value: any) => [formatMoney(Number(value)), 'Repair cost']}
              />
              <Bar dataKey="cost" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  sub,
  accent = 'default',
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent?: 'default' | 'red';
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${accent === 'red' ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'}`}
    >
      <div className="flex items-center gap-2 text-gray-500 text-xs font-medium uppercase tracking-wide">
        {icon}
        {label}
      </div>
      <p className={`mt-2 text-xl font-bold ${accent === 'red' ? 'text-red-700' : 'text-gray-900'}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}
