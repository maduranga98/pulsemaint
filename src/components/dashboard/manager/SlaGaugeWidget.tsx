import SegmentedGauge from '../../charts/SegmentedGauge';
import DashboardWidget from '../shared/DashboardWidget';
import { useDashboardStore } from '../../../store/dashboard.store';
import { CHART_COLORS } from '../../../constants/chartTheme';
import EmptyState from '../shared/EmptyState';
import { useTranslation } from 'react-i18next';

interface SlaGaugeWidgetProps {
  companyId: string;
}

export default function SlaGaugeWidget({}: SlaGaugeWidgetProps) {
  const { t } = useTranslation();
  const monthly = useDashboardStore((s) => s.monthlyAnalytics);
  const loading = useDashboardStore((s) => s.analyticsLoading);

  const rate = monthly?.overallSlaCompliance ?? 0;
  const total = monthly?.totalBreakdowns ?? 0;
  const within = Math.round((total * rate) / 100);
  const breached = total - within;

  return (
    <DashboardWidget title={t('common.widgets.slaGaugeWidget.title')} loading={loading}>
      {total === 0 ? (
        <EmptyState message={t('common.widgets.slaGaugeWidget.empty')} />
      ) : (
        <div className="flex flex-col items-center">
          <SegmentedGauge value={rate} color={CHART_COLORS.success} />

          <div className="w-full mt-3 pt-3 border-t border-[#1E3A5F]/50 space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-[#8BA3BF]">{t('common.widgets.slaGaugeWidget.withinSla')}</span>
              <span className="text-[#10B981] font-medium">{within} ({Math.round(rate)}%)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#8BA3BF]">{t('common.widgets.slaGaugeWidget.breached')}</span>
              <span className="text-[#EF4444] font-medium">{breached}</span>
            </div>
          </div>
        </div>
      )}
    </DashboardWidget>
  );
}
