import KpiCard from '../shared/KpiCard';
import { useTrainingCompliance } from '../../../hooks/dashboard/useTrainingCompliance';

interface TrainingComplianceStripProps {
  companyId: string;
}

export default function TrainingComplianceStrip({ companyId }: TrainingComplianceStripProps) {
  const { stats, loading } = useTrainingCompliance(companyId);

  const cards = [
    { label: 'Compliance Rate', value: Math.round(stats.overallComplianceRate), unit: '%', color: (stats.overallComplianceRate >= 90 ? 'green' : stats.overallComplianceRate >= 70 ? 'amber' : 'red') as 'green' | 'amber' | 'red' },
    { label: 'Expiring (30d)', value: stats.certificationsExpiring30Days, color: (stats.certificationsExpiring30Days > 0 ? 'amber' : 'green') as 'amber' | 'green' },
    { label: 'Expired', value: stats.certificationsExpired, color: (stats.certificationsExpired > 0 ? 'red' : 'green') as 'red' | 'green' },
    { label: 'In Progress', value: stats.traineesInProgress, color: 'blue' as const },
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-[#0F1E35] border border-[#1E3A5F] rounded-xl p-5 animate-pulse h-24" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, idx) => (
        <KpiCard key={idx} data={card} />
      ))}
    </div>
  );
}
