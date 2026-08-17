import DashboardWidget from '../shared/DashboardWidget';
import { useTrainingCompliance } from '../../../hooks/dashboard/useTrainingCompliance';
import EmptyState from '../shared/EmptyState';
import { useTranslation } from 'react-i18next';

interface OperatorTrainingTableProps {
  companyId: string;
}

export default function OperatorTrainingTable({ companyId }: OperatorTrainingTableProps) {
  const { t } = useTranslation();
  const { operators, loading, error } = useTrainingCompliance(companyId);

  const STATUS_STYLES: Record<string, string> = {
    fully_compliant: 'bg-[#10B981]/20 text-[#10B981]',
    action_required: 'bg-[#F59E0B]/20 text-[#F59E0B]',
    expired: 'bg-[#EF4444]/20 text-[#EF4444]',
  };

  return (
    <DashboardWidget title={t('common.widgets.operatorTrainingTable.title')} loading={loading} error={error}>
      {operators.length === 0 ? (
        <EmptyState message={t('common.widgets.operatorTrainingTable.empty')} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[#8BA3BF] border-b border-[#1E3A5F]">
                <th className="pb-2 font-medium">{t('common.widgets.operatorTrainingTable.operator')}</th>
                <th className="pb-2 font-medium">{t('common.widgets.operatorTrainingTable.role')}</th>
                <th className="pb-2 font-medium text-right">{t('common.widgets.operatorTrainingTable.certified')}</th>
                <th className="pb-2 font-medium text-right">{t('common.widgets.operatorTrainingTable.expiring')}</th>
                <th className="pb-2 font-medium">{t('common.widgets.operatorTrainingTable.status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E3A5F]/50">
              {operators.map((op) => (
                <tr key={op.operatorName} className="hover:bg-[#1E3A5F]/20">
                  <td className="py-2.5 text-[#F0F4F8] font-medium">{op.operatorName}</td>
                  <td className="py-2.5 text-[#8BA3BF]">{op.role}</td>
                  <td className="py-2.5 text-right text-[#10B981]">{op.machinesCertified}</td>
                  <td className="py-2.5 text-right text-[#F59E0B]">{op.expiringSoon}</td>
                  <td className="py-2.5">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${STATUS_STYLES[op.status]}`}>
                      {op.status.replace('_', ' ')}
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
