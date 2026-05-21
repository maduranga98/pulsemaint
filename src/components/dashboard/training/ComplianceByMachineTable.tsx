import DashboardWidget from '../shared/DashboardWidget';
import { useTrainingCompliance } from '../../../hooks/dashboard/useTrainingCompliance';
import EmptyState from '../shared/EmptyState';

interface ComplianceByMachineTableProps {
  companyId: string;
}

export default function ComplianceByMachineTable({ companyId }: ComplianceByMachineTableProps) {
  const { byMachine, loading, error } = useTrainingCompliance(companyId);

  return (
    <DashboardWidget title="Compliance by Machine" loading={loading} error={error}>
      {byMachine.length === 0 ? (
        <EmptyState message="No machine compliance data" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[#8BA3BF] border-b border-[#1E3A5F]">
                <th className="pb-2 font-medium">Machine</th>
                <th className="pb-2 font-medium text-right">Required</th>
                <th className="pb-2 font-medium text-right">Certified</th>
                <th className="pb-2 font-medium text-right">Expiring</th>
                <th className="pb-2 font-medium text-right">Expired</th>
                <th className="pb-2 font-medium text-right">%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E3A5F]/50">
              {byMachine.map((m) => (
                <tr key={m.machineName} className="hover:bg-[#1E3A5F]/20">
                  <td className="py-2.5 text-[#F0F4F8] font-medium">{m.machineName}</td>
                  <td className="py-2.5 text-right text-[#8BA3BF]">{m.requiredOperators}</td>
                  <td className="py-2.5 text-right text-[#10B981]">{m.certified}</td>
                  <td className="py-2.5 text-right text-[#F59E0B]">{m.expiring}</td>
                  <td className="py-2.5 text-right text-[#EF4444]">{m.expired}</td>
                  <td className="py-2.5 text-right">
                    <span
                      className={`font-semibold ${
                        m.compliancePercent >= 90 ? 'text-[#10B981]' : m.compliancePercent >= 70 ? 'text-[#F59E0B]' : 'text-[#EF4444]'
                      }`}
                    >
                      {m.compliancePercent}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashboardWidget>
  );
}
