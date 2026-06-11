import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import DashboardWidget from '../shared/DashboardWidget';
import { useBacklog } from '../../../hooks/useBacklog';
import { isHighRiskCritical, HIGH_RISK_THRESHOLD } from '../../../types/backlog';

export default function BacklogRiskWidget() {
  const navigate = useNavigate();
  const { items, loading, error } = useBacklog();

  const highRisk = useMemo(
    () =>
      items
        .filter((i) => i.status !== 'closed' && isHighRiskCritical(i))
        .sort((a, b) => b.riskScore - a.riskScore),
    [items],
  );

  return (
    <DashboardWidget
      title="High-Risk Backlog"
      live
      loading={loading}
      error={error}
      action={
        <span className="inline-flex items-center gap-1 text-[11px] text-[#EF4444] font-medium">
          <AlertTriangle className="w-3.5 h-3.5" />
          {highRisk.length}
        </span>
      }
    >
      {highRisk.length === 0 ? (
        <p className="text-sm text-[#8BA3BF] py-4 text-center">
          No high-risk deferred maintenance on critical machines.
        </p>
      ) : (
        <ul className="divide-y divide-[#1E3A5F]">
          {highRisk.slice(0, 6).map((item) => (
            <li
              key={item.id}
              onClick={() => navigate('/app/work-orders?tab=backlog')}
              className="flex items-center gap-3 py-2.5 cursor-pointer hover:bg-[#13243F] -mx-2 px-2 rounded"
            >
              <span className="flex-shrink-0 min-w-8 px-2 py-1 rounded bg-red-600 text-white text-xs font-bold text-center">
                {item.riskScore}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[#F0F4F8] truncate">{item.machineName}</p>
                <p className="text-xs text-[#8BA3BF] truncate">{item.description}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-[11px] text-[#56708F]">
        Risk score ≥ {HIGH_RISK_THRESHOLD} on a critical machine.
      </p>
    </DashboardWidget>
  );
}
