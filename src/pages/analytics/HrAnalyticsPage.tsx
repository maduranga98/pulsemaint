import { useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import TopPerformersWidget from '../../components/dashboard/training/TopPerformersWidget';
import StaffByRoleChart from '../../components/dashboard/training/StaffByRoleChart';
import CategoryCountChart from '../../components/dashboard/training/CategoryCountChart';
import {
  fetchTrainingCategoryCompletion,
  fetchAuditsByCategory,
  fetchEvaluationsByCategory,
} from '../../services/teamPerformance.service';

type TabId = 'top-performers' | 'staff-headcount' | 'training-categories' | 'audits' | 'evaluations';

const TABS: { id: TabId; label: string }[] = [
  { id: 'top-performers', label: 'Top 10 Performers' },
  { id: 'staff-headcount', label: 'Staff Headcount by Role' },
  { id: 'training-categories', label: 'Training Categories' },
  { id: 'audits', label: 'Audits by Category' },
  { id: 'evaluations', label: 'Evaluations by Category' },
];

// HR officer's Analytics tab — restructured into on-demand tabs so only the
// selected report is fetched/rendered at a time.
export default function HrAnalyticsPage() {
  const companyId = useAuthStore((s) => s.userProfile?.companyId) ?? '';
  const [activeTab, setActiveTab] = useState<TabId | null>(null);

  return (
    <div className="min-h-full bg-[#0A1628] text-[#F0F4F8]">
      <div className="px-4 py-4 sm:px-6 lg:px-8">
        <h1 className="text-xl font-bold text-[#F0F4F8] font-[Sora]">HR Analytics</h1>
        <p className="text-sm text-[#8BA3BF] mt-0.5">
          Select a report below to view it.
        </p>
      </div>

      <div className="px-4 pb-8 sm:px-6 lg:px-8 space-y-6">
        <div className="flex flex-wrap gap-2 border-b border-[#1E3A5F] pb-3">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab((current) => (current === tab.id ? null : tab.id))}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-[#1A56DB] text-white'
                  : 'bg-[#0F1E35] text-[#8BA3BF] border border-[#1E3A5F] hover:text-[#F0F4F8] hover:border-[#2E5A8F]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === null && (
          <p className="text-sm text-[#8BA3BF]">Click a tab above to load that report.</p>
        )}

        {activeTab === 'top-performers' && <TopPerformersWidget companyId={companyId} />}

        {activeTab === 'staff-headcount' && <StaffByRoleChart companyId={companyId} />}

        {activeTab === 'training-categories' && (
          <CategoryCountChart
            companyId={companyId}
            title="Training Programme Categories vs. Completed"
            emptyMessage="No completed training data"
            barName="Completed"
            fetcher={fetchTrainingCategoryCompletion}
          />
        )}

        {activeTab === 'audits' && (
          <CategoryCountChart
            companyId={companyId}
            title="Audits by Category"
            emptyMessage="No submitted audits yet"
            barName="Audits"
            fetcher={fetchAuditsByCategory}
          />
        )}

        {activeTab === 'evaluations' && (
          <CategoryCountChart
            companyId={companyId}
            title="Evaluations by Category"
            emptyMessage="No submitted evaluations yet"
            barName="Evaluations"
            fetcher={fetchEvaluationsByCategory}
          />
        )}
      </div>
    </div>
  );
}
