import DashboardWidget from '../shared/DashboardWidget';
import { usePendingPartsRequests } from '../../../hooks/dashboard/usePendingPartsRequests';
import EmptyState from '../shared/EmptyState';

interface PendingRequestsTableProps {
  companyId: string;
}

export default function PendingRequestsTable({ companyId }: PendingRequestsTableProps) {
  const { requests, loading, error } = usePendingPartsRequests(companyId);

  return (
    <DashboardWidget title="Pending Parts Requests" loading={loading} error={error}>
      {requests.length === 0 ? (
        <EmptyState message="No pending requests" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[#8BA3BF] border-b border-[#1E3A5F]">
                <th className="pb-2 font-medium">Part</th>
                <th className="pb-2 font-medium">Requested By</th>
                <th className="pb-2 font-medium text-right">Qty</th>
                <th className="pb-2 font-medium text-right">Value</th>
                <th className="pb-2 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E3A5F]/50">
              {requests.map((req) => (
                <tr key={req.id} className="hover:bg-[#1E3A5F]/20">
                  <td className="py-2.5">
                    <p className="text-[#F0F4F8] font-medium">{req.partName}</p>
                    <p className="text-[10px] text-[#8BA3BF]">{req.partNumber}</p>
                  </td>
                  <td className="py-2.5 text-[#8BA3BF]">{req.requestedByName}</td>
                  <td className="py-2.5 text-right text-[#F0F4F8]">{req.quantity}</td>
                  <td className="py-2.5 text-right text-[#F0F4F8]">
                    LKR {(req.quantity * 1000).toLocaleString()}
                  </td>
                  <td className="py-2.5 text-right">
                    <div className="flex gap-1.5 justify-end">
                      <button className="px-2 py-1 bg-[#10B981] text-white text-[10px] font-medium rounded hover:bg-[#10B981]/90 transition-colors">
                        Approve
                      </button>
                      <button className="px-2 py-1 bg-[#EF4444] text-white text-[10px] font-medium rounded hover:bg-[#EF4444]/90 transition-colors">
                        Reject
                      </button>
                    </div>
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
