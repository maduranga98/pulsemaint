import { useNavigate } from 'react-router-dom';
import DashboardWidget from './DashboardWidget';
import EmptyState from './EmptyState';
import { usePendingWOExtensionRequests } from '../../../hooks/useWOExtension';
import { WOExtensionReviewCard } from '../../workorders/WOExtensionReviewCard';

interface Props {
  companyId: string;
}

/** Pending work-order due-date extension requests awaiting a supervisor /
 *  plant manager / admin decision — live so a new request shows up the
 *  moment it's raised. Accepting/editing/rejecting is done right here. */
export default function ExtensionRequestsWidget({ companyId }: Props) {
  const { requests, loading } = usePendingWOExtensionRequests(companyId || null);
  const navigate = useNavigate();

  return (
    <DashboardWidget
      title="Work Order Extension Requests"
      live
      loading={loading}
      action={<span className="text-xs text-[#8BA3BF]">{requests.length} pending</span>}
    >
      {requests.length === 0 ? (
        <EmptyState message="No pending extension requests" />
      ) : (
        <div className="space-y-3">
          {requests.map((req) => (
            <div key={req.id}>
              <button
                type="button"
                onClick={() => navigate(`/app/work-orders?woId=${req.woId}`)}
                className="mb-1 text-left text-sm font-semibold text-[#5B8DEF] hover:underline"
              >
                {req.woNumber} · {req.machineName}
              </button>
              <WOExtensionReviewCard request={req} compact />
            </div>
          ))}
        </div>
      )}
    </DashboardWidget>
  );
}
