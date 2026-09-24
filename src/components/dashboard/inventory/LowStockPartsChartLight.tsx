import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import LightAnalyticsWidget from './LightAnalyticsWidget';
import LightEmptyState from './LightEmptyState';
import { useLowStockAlerts, type LowStockAlertStatus } from '../../../hooks/dashboard/useLowStockAlerts';
import { formatShortDateTime } from '../../../lib/i18nDate';
import { CHART_COLORS_LIGHT, CHART_DEFAULTS_LIGHT } from '../../../constants/chartThemeLight';
import { useTranslation } from 'react-i18next';

interface LowStockPartsChartLightProps {
  companyId: string;
  /** Period for the low-stock alert history (the page's 7/30/90-day selector). */
  days?: number;
}

const STATUS_STYLE: Record<LowStockAlertStatus, { key: string; fallback: string; className: string }> = {
  out_of_stock: { key: 'outOfStock', fallback: 'Out of stock', className: 'bg-red-50 text-red-700' },
  low_now: { key: 'lowNow', fallback: 'Low now', className: 'bg-amber-50 text-amber-700' },
  restocked: { key: 'restocked', fallback: 'Restocked', className: 'bg-emerald-50 text-emerald-700' },
};

export default function LowStockPartsChartLight({ companyId, days = 30 }: LowStockPartsChartLightProps) {
  const { t } = useTranslation();
  // Every part that hit its minimum in the period (low now or since
  // restocked); the chart shows the ones still below minimum.
  const { rows, loading, error } = useLowStockAlerts(companyId, days);
  const parts = rows
    .filter((r) => r.status !== 'restocked')
    .map((r) => ({ ...r, deficit: Math.max(0, r.minStockLevel - r.currentStock) }))
    .slice(0, 10);

  return (
    <LightAnalyticsWidget title={t('common.widgets.lowStockPartsChartLight.title')} loading={loading} error={error}>
      {rows.length === 0 ? (
        <LightEmptyState message={t('common.widgets.lowStockPartsChartLight.empty')} />
      ) : (
        <div className="space-y-6">
        {parts.length > 0 && (
        <div style={{ height: Math.max(320, parts.length * 52) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={parts} layout="vertical" margin={{ left: 0, right: 24 }} barCategoryGap="35%">
              <CartesianGrid {...CHART_DEFAULTS_LIGHT.cartesianGrid} />
              <XAxis {...CHART_DEFAULTS_LIGHT.xAxis} type="number" allowDecimals={false} />
              <YAxis {...CHART_DEFAULTS_LIGHT.yAxis} dataKey="name" type="category" width={190} />
              <Tooltip
                {...CHART_DEFAULTS_LIGHT.tooltip}
                formatter={(value: number, _name, item) => [
                  t('common.widgets.lowStockPartsChartLight.belowMin', { value, current: item.payload.currentStock, min: item.payload.minStockLevel }),
                  t('common.widgets.lowStockAlertTable.deficit'),
                ]}
              />
              <Bar dataKey="deficit" radius={[0, 4, 4, 0]}>
                {parts.map((p) => (
                  <Cell key={p.partId} fill={p.currentStock === 0 ? CHART_COLORS_LIGHT.danger : CHART_COLORS_LIGHT.warning} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        )}

        <div>
          <p className="text-sm font-semibold text-gray-900 mb-2">
            {t('common.widgets.lowStockPartsChartLight.alertsTitle', 'Low stock alerts in the last {{count}} days', { count: days })}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
                  <th className="py-2 pr-3 font-medium">{t('common.widgets.lowStockAlertTable.part', 'Part')}</th>
                  <th className="py-2 px-3 font-medium text-right">{t('common.widgets.lowStockPartsChartLight.current', 'Current')}</th>
                  <th className="py-2 px-3 font-medium text-right">{t('common.widgets.lowStockAlertTable.min', 'Min')}</th>
                  <th className="py-2 px-3 font-medium text-right">{t('common.widgets.lowStockPartsChartLight.lowest', 'Lowest in period')}</th>
                  <th className="py-2 px-3 font-medium">{t('common.widgets.lowStockPartsChartLight.lastAlert', 'Last alert')}</th>
                  <th className="py-2 pl-3 font-medium">{t('common.widgets.lowStockPartsChartLight.status', 'Status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r) => {
                  const style = STATUS_STYLE[r.status];
                  return (
                    <tr key={r.partId}>
                      <td className="py-2 pr-3">
                        <p className="font-medium text-gray-900">{r.name}</p>
                        <p className="text-xs text-gray-500">{r.partNumber}</p>
                      </td>
                      <td className="py-2 px-3 text-right text-gray-900">{r.currentStock}</td>
                      <td className="py-2 px-3 text-right text-gray-500">{r.minStockLevel}</td>
                      <td className="py-2 px-3 text-right text-red-600">{r.lowestInPeriod}</td>
                      <td className="py-2 px-3 text-gray-500">{r.lastAlertAt ? formatShortDateTime(r.lastAlertAt) : '—'}</td>
                      <td className="py-2 pl-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${style.className}`}>
                          {t(`common.widgets.lowStockPartsChartLight.statuses.${style.key}`, style.fallback)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        </div>
      )}
    </LightAnalyticsWidget>
  );
}
