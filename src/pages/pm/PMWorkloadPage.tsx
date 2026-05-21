import { useState } from 'react';
import { usePMSchedules } from '../../hooks/pm/usePMSchedules';
import { useAuthStore } from '../../store/authStore';
import { TechnicianWorkloadViewComponent } from '../../components/pm/TechnicianWorkloadView';
import { PageHeader, SegmentedControl, SkeletonList, EmptyState } from '../../components/ui';

export default function PMWorkloadPage() {
  const company = useAuthStore((s) => s.company);
  const [range, setRange] = useState<7 | 14 | 30>(30);

  const { schedules, loading, error } = usePMSchedules({ companyId: company?.id || '' });

  return (
    <div>
      <PageHeader
        title="Technician Workload"
        description="Upcoming PM assignments by technician"
        actions={
          <SegmentedControl<7 | 14 | 30>
            value={range}
            onChange={setRange}
            ariaLabel="Date range"
            options={[
              { value: 7, label: '7 days' },
              { value: 14, label: '14 days' },
              { value: 30, label: '30 days' },
            ]}
          />
        }
      />

      {loading ? (
        <SkeletonList rows={5} rowClassName="h-28" />
      ) : error ? (
        <EmptyState title="Couldn't load workloads" description={error} />
      ) : (
        <TechnicianWorkloadViewComponent schedules={schedules} rangeDays={range} />
      )}
    </div>
  );
}
