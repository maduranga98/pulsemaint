import { useState } from 'react';
import { usePMSchedules } from '../../hooks/pm/usePMSchedules';
import { useAuthStore } from '../../store/authStore';
import { TechnicianWorkloadViewComponent } from '../../components/pm/TechnicianWorkloadView';

export default function PMWorkloadPage() {
  const company = useAuthStore((s) => s.company);
  const [range, setRange] = useState<7 | 14 | 30>(30);

  const { schedules, loading } = usePMSchedules({ companyId: company?.id || '' });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Technician Workload</h1>
          <p className="text-sm text-gray-500">Upcoming PM assignments</p>
        </div>
        <div className="flex bg-gray-100 rounded-lg p-0.5">
          {[7, 14, 30].map((r) => (
            <button
              key={r}
              onClick={() => setRange(r as 7 | 14 | 30)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                range === r ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
              }`}
            >
              {r} Days
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-gray-400">Loading workloads...</div>
      ) : (
        <TechnicianWorkloadViewComponent schedules={schedules} rangeDays={range} />
      )}
    </div>
  );
}
