import { useNavigate } from 'react-router-dom';
import DashboardWidget from '../shared/DashboardWidget';
import { usePendingPartsReturns } from '../../../hooks/dashboard/usePendingPartsReturns';
import EmptyState from '../shared/EmptyState';
import { useTranslation } from 'react-i18next';

interface PendingReturnsWidgetProps {
  companyId: string;
}

export default function PendingReturnsWidget({ companyId }: PendingReturnsWidgetProps) {
  const { t } = useTranslation();
  const { requests, loading, error } = usePendingPartsReturns(companyId);
  const navigate = useNavigate();

  return (
    <DashboardWidget title={t('common.widgets.pendingReturnsWidget.title')} loading={loading} error={error}>
      {requests.length === 0 ? (
        <EmptyState message={t('common.widgets.pendingReturnsWidget.empty')} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[#8BA3BF] border-b border-[#1E3A5F]">
                <th className="pb-2 font-medium">{t('common.widgets.pendingRequestsTable.parts')}</th>
                <th className="pb-2 font-medium">{t('common.widgets.pendingReturnsWidget.takenBy')}</th>
                <th className="pb-2 font-medium text-right">{t('common.widgets.pendingReceiptPOsWidget.items')}</th>
                <th className="pb-2 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E3A5F]/50">
              {requests.map((req) => {
                const outstanding = req.items.filter((i) => i.isReturnable && !i.isReturned);
                return (
                  <tr key={req.id} className="hover:bg-[#1E3A5F]/20">
                    <td className="py-2.5">
                      <p className="text-[#F0F4F8] font-medium">
                        {outstanding[0]?.partName ?? t('common.widgets.pendingRequestsTable.unknownPart')}
                        {outstanding.length > 1 ? ` ${t('common.widgets.pendingRequestsTable.more', { count: outstanding.length - 1 })}` : ''}
                      </p>
                      <p className="text-[10px] text-[#8BA3BF]">{req.requestNumber}</p>
                    </td>
                    <td className="py-2.5 text-[#8BA3BF]">{req.requestedByName}</td>
                    <td className="py-2.5 text-right text-[#F0F4F8]">{outstanding.length}</td>
                    <td className="py-2.5 text-right">
                      <button
                        onClick={() => navigate('/app/inventory/returns')}
                        className="px-2 py-1 bg-[#1A56DB] text-white text-[10px] font-medium rounded hover:bg-[#1A56DB]/90 transition-colors"
                      >
                        {t('common.widgets.pendingRequestsTable.review')}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </DashboardWidget>
  );
}
