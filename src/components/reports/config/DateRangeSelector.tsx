import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { resolveQuickDateRange } from '../../../utils/reports/dateRangeUtils';
import type { QuickDateRange, ReportConfig } from '../../../types/reports.types';

function buildRanges(t: TFunction): { value: QuickDateRange; label: string }[] {
  return [
    { value: 'today', label: t('common.reports.config.dateRangeSelector.ranges.today') },
    { value: 'yesterday', label: t('common.reports.config.dateRangeSelector.ranges.yesterday') },
    { value: 'this_week', label: t('common.reports.config.dateRangeSelector.ranges.this_week') },
    { value: 'last_week', label: t('common.reports.config.dateRangeSelector.ranges.last_week') },
    { value: 'this_month', label: t('common.reports.config.dateRangeSelector.ranges.this_month') },
    { value: 'last_month', label: t('common.reports.config.dateRangeSelector.ranges.last_month') },
    { value: 'last_3_months', label: t('common.reports.config.dateRangeSelector.ranges.last_3_months') },
    { value: 'last_6_months', label: t('common.reports.config.dateRangeSelector.ranges.last_6_months') },
    { value: 'this_year', label: t('common.reports.config.dateRangeSelector.ranges.this_year') },
    { value: 'custom', label: t('common.reports.config.dateRangeSelector.ranges.custom') },
  ];
}

export default function DateRangeSelector({
  config,
  onChange,
}: {
  config: ReportConfig;
  onChange: (updates: Partial<ReportConfig>) => void;
}) {
  const { t } = useTranslation();
  const ranges = buildRanges(t);
  return (
    <section className="space-y-3 border-b border-[#1E3A5F] pb-5">
      <h3 className=" text-sm font-semibold text-[#F0F4F8]">{t('common.reports.config.dateRangeSelector.title')}</h3>
      <div className="flex flex-wrap gap-2">
        {ranges.map((range) => (
          <button
            key={range.value}
            type="button"
            onClick={() => {
              const next = resolveQuickDateRange(range.value);
              onChange({ quickRange: range.value, dateFrom: next.from, dateTo: next.to });
            }}
            className={`min-h-10 rounded-full border px-3 text-xs font-semibold transition ${
              config.quickRange === range.value
                ? 'border-[#00C2FF] bg-[#00C2FF]/10 text-[#F0F4F8]'
                : 'border-[#1E3A5F] text-[#8BA3BF] hover:border-[#2E5A8F]'
            }`}
          >
            {range.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1 text-xs text-[#8BA3BF]">
          {t('common.reports.config.dateRangeSelector.from')}
          <input
            type="date"
            value={config.dateFrom}
            onChange={(event) => onChange({ quickRange: 'custom', dateFrom: event.target.value })}
            className="h-11 w-full rounded-lg border border-[#1E3A5F] bg-[#0A1628] px-3 text-sm text-[#F0F4F8] outline-none focus:border-[#00C2FF]"
          />
        </label>
        <label className="space-y-1 text-xs text-[#8BA3BF]">
          {t('common.reports.config.dateRangeSelector.to')}
          <input
            type="date"
            value={config.dateTo}
            onChange={(event) => onChange({ quickRange: 'custom', dateTo: event.target.value })}
            className="h-11 w-full rounded-lg border border-[#1E3A5F] bg-[#0A1628] px-3 text-sm text-[#F0F4F8] outline-none focus:border-[#00C2FF]"
          />
        </label>
      </div>
    </section>
  );
}
