import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePMSchedules } from '../../hooks/pm/usePMSchedules';
import { useAuthStore } from '../../store/authStore';
import { TechnicianWorkloadViewComponent } from '../../components/pm/TechnicianWorkloadView';
import { PageHeader, SegmentedControl, SkeletonList, EmptyState } from '../../components/ui';

export default function PMWorkloadPage() {
  const { t } = useTranslation();
  const company = useAuthStore((s) => s.company);
  const [range, setRange] = useState<7 | 14 | 30>(30);

  const { schedules, loading, error } = usePMSchedules({ companyId: company?.id || '' });

  return (
    <div>
      <PageHeader
        title={t('common.pmSchedules.workloadPage.title')}
        description={t('common.pmSchedules.workloadPage.description')}
        actions={
          <SegmentedControl<7 | 14 | 30>
            value={range}
            onChange={setRange}
            ariaLabel={t('common.pmSchedules.workloadPage.dateRangeLabel')}
            options={[
              { value: 7, label: t('common.pmSchedules.workloadPage.range_7') },
              { value: 14, label: t('common.pmSchedules.workloadPage.range_14') },
              { value: 30, label: t('common.pmSchedules.workloadPage.range_30') },
            ]}
          />
        }
      />

      {loading ? (
        <SkeletonList rows={5} rowClassName="h-28" />
      ) : error ? (
        <EmptyState title={t('common.pmSchedules.workloadPage.loadErrorTitle')} description={error} />
      ) : (
        <TechnicianWorkloadViewComponent schedules={schedules} rangeDays={range} />
      )}
    </div>
  );
}
