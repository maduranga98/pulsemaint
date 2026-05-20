import { useAuthStore } from '../../store/authStore';
import { usePMComplianceStats } from '../../hooks/pm/usePMComplianceStats';
import { PMComplianceDashboardComponent } from '../../components/pm/PMComplianceDashboard';

export default function PMCompliancePage() {
  const company = useAuthStore((s) => s.company);
  const { stats, loading } = usePMComplianceStats({ companyId: company?.id || '' });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">PM Compliance Dashboard</h1>
        <p className="text-sm text-gray-500">Track preventive maintenance adherence and trends</p>
      </div>

      <PMComplianceDashboardComponent stats={stats} loading={loading} />
    </div>
  );
}
