import { useNavigate } from 'react-router-dom';
import DashboardWidget from '../shared/DashboardWidget';
import { usePendingPartsRequests } from '../../../hooks/dashboard/usePendingPartsRequests';
import EmptyState from '../shared/EmptyState';

interface PendingRequestsTableProps {
  companyId: string;
}

export default function PendingRequestsTable({ companyId }: PendingRequestsTableProps) {
  const { requests, loading, error } = usePendingPartsRequests(companyId);
  const navigate = useNavigate();

  return (
    <DashboardWidget title="Pending Parts Requests" loading={loading} error={error}>
      {requests.length === 0 ? (
        <EmptyState message="No pending requests" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[#8BA3BF] border-b border-[#1E3A5F]">
                <th className="pb-2 font-medium">Parts</th>
                <th className="pb-2 font-medium">Requested By</th>
                <th className="pb-2 font-medium text-right">Items</th>
                <th className="pb-2 font-medium text-right">Est. Value</th>
                <th className="pb-2 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E3A5F]/50">
              {requests.map((req) => (
                <tr key={req.id} className="hover:bg-[#1E3A5F]/20">
                  <td className="py-2.5">
                    <p className="text-[#F0F4F8] font-medium">
                      {req.items[0]?.partName ?? 'Unknown part'}
                      {req.items.length > 1 ? ` +${req.items.length - 1} more` : ''}
                    </p>
                    <p className="text-[10px] text-[#8BA3BF]">{req.requestNumber}</p>
                  </td>
                  <td className="py-2.5 text-[#8BA3BF]">{req.requestedByName}</td>
                  <td className="py-2.5 text-right text-[#F0F4F8]">{req.items.length}</td>
                  <td className="py-2.5 text-right text-[#F0F4F8]">
                    LKR {req.totalEstimatedCost.toLocaleString()}
                  </td>
                  <td className="py-2.5 text-right">
                    <button
                      onClick={() => navigate(`/app/inventory/requests/${req.id}`)}
                      className="px-2 py-1 bg-[#1A56DB] text-white text-[10px] font-medium rounded hover:bg-[#1A56DB]/90 transition-colors"
                    >
                      Review
                    </button>
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
