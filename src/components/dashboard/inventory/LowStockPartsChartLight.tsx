import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from 'recharts';
import LightAnalyticsWidget from './LightAnalyticsWidget';
import LightEmptyState from './LightEmptyState';
import {
  useLowStockAlerts,
  type LowStockAlertRow,
  type LowStockAlertStatus,
} from '../../../hooks/dashboard/useLowStockAlerts';
import { formatShortDateTime } from '../../../lib/i18nDate';
import { CHART_DEFAULTS_LIGHT } from '../../../constants/chartThemeLight';
import { useTranslation } from 'react-i18next';

interface LowStockPartsChartLightProps {
  companyId: string;
  /** Period for the low-stock alert history (the page's 7/30/90-day selector). */
  days?: number;
}

// Status colors (reserved for state), always paired with a text label in the
// legend and tooltip — never color alone. Validated for color-vision
// deficiency and contrast on both the dark (#0F1E35) and light card surfaces;
// a plain red/amber pair is indistinguishable for deuteranopes, so "out of
// stock" uses a magenta-red.
const STATUS: Record<LowStockAlertStatus, { key: string; fallback: string; color: string }> = {
  out_of_stock: { key: 'outOfStock', fallback: 'Out of stock', color: '#D9467F' },
  low_now: { key: 'lowNow', fallback: 'Low now', color: '#C2850C' },
  restocked: { key: 'restocked', fallback: 'Restocked', color: '#2F9E6E' },
};
const STATUS_ORDER: LowStockAlertStatus[] = ['out_of_stock', 'low_now', 'restocked'];
const MAX_PARTS = 15;

/**
 * Which parts went low in the selected period and how often: one bar per
 * part, length = number of low-stock alerts (drops to or below its minimum),
 * colored by where the part stands now.
 */
export default function LowStockPartsChartLight({ companyId, days = 30 }: LowStockPartsChartLightProps) {
  const { t } = useTranslation();
  const { rows, loading, error } = useLowStockAlerts(companyId, days);
  const data = rows.slice(0, MAX_PARTS);
  const statusLabel = (s: LowStockAlertStatus) => t(`common.widgets.lowStockPartsChartLight.statuses.${STATUS[s].key}`, STATUS[s].fallback);
  const counts = STATUS_ORDER.map((s) => ({ status: s, count: rows.filter((r) => r.status === s).length }));

  return (
    <LightAnalyticsWidget title={t('common.widgets.lowStockPartsChartLight.title')} loading={loading} error={error}>
      {rows.length === 0 ? (
        <LightEmptyState message={t('common.widgets.lowStockPartsChartLight.emptyPeriod', 'No part went low in the last {{count}} days', { count: days })} />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-gray-600">
              {t('common.widgets.lowStockPartsChartLight.alertsSummary', '{{parts}} parts went low · {{alerts}} alerts in the last {{count}} days', {
                parts: rows.length,
                alerts: rows.reduce((n, r) => n + r.alertCount, 0),
                count: days,
              })}
            </p>
            {/* Legend — always present; identity never by color alone. */}
            <div className="flex flex-wrap items-center gap-4">
              {counts.map(({ status, count }) => (
                <span key={status} className="inline-flex items-center gap-1.5 text-xs text-gray-600">
                  <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: STATUS[status].color }} />
                  {statusLabel(status)} ({count})
                </span>
              ))}
            </div>
          </div>

          <div style={{ height: Math.max(240, data.length * 44 + 40) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} layout="vertical" margin={{ left: 0, right: 40 }} barCategoryGap="30%">
                <CartesianGrid {...CHART_DEFAULTS_LIGHT.cartesianGrid} horizontal={false} />
                <XAxis
                  {...CHART_DEFAULTS_LIGHT.xAxis}
                  type="number"
                  allowDecimals={false}
                  label={{
                    value: t('common.widgets.lowStockPartsChartLight.alertsAxis', 'Low-stock alerts'),
                    position: 'insideBottom',
                    offset: -2,
                    fill: '#64748B',
                    fontSize: 12,
                  }}
                  height={44}
                />
                <YAxis {...CHART_DEFAULTS_LIGHT.yAxis} dataKey="name" type="category" width={190} />
                <Tooltip
                  {...CHART_DEFAULTS_LIGHT.tooltip}
                  content={({ active, payload }) => {
                    const r = active && payload?.[0] ? (payload[0].payload as LowStockAlertRow) : null;
                    if (!r) return null;
                    return (
                      <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-md space-y-0.5">
                        <p className="font-semibold text-gray-900">{r.name}</p>
                        <p className="text-gray-500">{r.partNumber}</p>
                        <p className="text-gray-700">
                          {t('common.widgets.lowStockPartsChartLight.tooltipAlerts', 'Alerts: {{count}}', { count: r.alertCount })}
                        </p>
                        <p className="text-gray-700">
                          {t('common.widgets.lowStockPartsChartLight.tooltipStock', 'Stock {{current}} / min {{min}} · lowest {{lowest}}', {
                            current: r.currentStock,
                            min: r.minStockLevel,
                            lowest: r.lowestInPeriod,
                          })}
                        </p>
                        {r.lastAlertAt && (
                          <p className="text-gray-700">
                            {t('common.widgets.lowStockPartsChartLight.tooltipLast', 'Last alert: {{date}}', { date: formatShortDateTime(r.lastAlertAt) })}
                          </p>
                        )}
                        <p className="font-medium" style={{ color: STATUS[r.status].color }}>{statusLabel(r.status)}</p>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="alertCount" radius={[0, 4, 4, 0]} maxBarSize={22}>
                  {data.map((r) => (
                    <Cell key={r.partId} fill={STATUS[r.status].color} />
                  ))}
                  <LabelList dataKey="alertCount" position="right" fill="#334155" fontSize={12} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {rows.length > MAX_PARTS && (
            <p className="text-xs text-gray-500">
              {t('common.widgets.lowStockPartsChartLight.moreParts', 'Showing the {{shown}} most-alerted of {{total}} parts', { shown: MAX_PARTS, total: rows.length })}
            </p>
          )}
        </div>
      )}
    </LightAnalyticsWidget>
  );
}
