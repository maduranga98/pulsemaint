import { useNavigate } from 'react-router-dom';
import { useAssignedTasks } from '../../../hooks/dashboard/useAssignedTasks';
import DashboardWidget from '../shared/DashboardWidget';
import EmptyState from '../shared/EmptyState';

export default function AssignedTasksWidget() {
  const { trainings, evaluations, audits, workOrders, loading } = useAssignedTasks();
  const navigate = useNavigate();

  const total = trainings.length + evaluations.length + audits.length + workOrders.length;

  // Breakdown-repair and Preventive WOs live on their own dedicated pages,
  // not the general Work Orders list — route to whichever tab actually
  // shows this WO. Everything else deep-links straight to it via ?woId=.
  function openWorkOrder(w: { id: string; woType: string }) {
    if (w.woType === 'BREAKDOWN') {
      navigate('/app/breakdowns');
    } else if (w.woType === 'PREVENTIVE') {
      navigate('/app/pm-schedules');
    } else {
      navigate(`/app/work-orders?woId=${w.id}`);
    }
  }

  return (
    <DashboardWidget
      title="Assigned to Me"
      live
      loading={loading}
      action={<span className="text-xs text-[#8BA3BF]">{total} pending</span>}
    >
      {total === 0 ? (
        <EmptyState message="Nothing assigned" subMessage="Work orders, audits, evaluations, and trainings will appear here." />
      ) : (
        <div className="space-y-4">
          {workOrders.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8BA3BF] mb-1.5">
                Work Orders ({workOrders.length})
              </p>
              <div className="space-y-1">
                {workOrders.slice(0, 5).map((w) => (
                  <button
                    key={w.id}
                    onClick={() => openWorkOrder(w)}
                    className="w-full text-left px-3 py-2 rounded-md bg-[#0A1628] hover:bg-[#1E3A5F]/40 text-sm text-[#F0F4F8] truncate"
                  >
                    {w.woNumber} · {w.machineName}{w.woType ? ` · ${w.woType.replace(/_/g, ' ')}` : ''}
                  </button>
                ))}
              </div>
            </div>
          )}

          {audits.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8BA3BF] mb-1.5">
                Audits ({audits.length})
              </p>
              <div className="space-y-1">
                {audits.slice(0, 4).map((a) => (
                  <button
                    key={a.id}
                    onClick={() => navigate('/app/audit')}
                    className="w-full text-left px-3 py-2 rounded-md bg-[#0A1628] hover:bg-[#1E3A5F]/40 text-sm text-[#F0F4F8] truncate"
                  >
                    {a.templateName || 'Audit'} · {a.auditDate}
                  </button>
                ))}
              </div>
            </div>
          )}

          {evaluations.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8BA3BF] mb-1.5">
                Evaluations ({evaluations.length})
              </p>
              <div className="space-y-1">
                {evaluations.slice(0, 4).map((e) => (
                  <button
                    key={e.id}
                    onClick={() => navigate('/app/evaluations')}
                    className="w-full text-left px-3 py-2 rounded-md bg-[#0A1628] hover:bg-[#1E3A5F]/40 text-sm text-[#F0F4F8] truncate"
                  >
                    {e.evaluateeName} · {e.evaluationDate}
                  </button>
                ))}
              </div>
            </div>
          )}

          {trainings.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8BA3BF] mb-1.5">
                Trainings ({trainings.length})
              </p>
              <div className="space-y-1">
                {trainings.slice(0, 4).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => navigate('/app/training/my-modules')}
                    className="w-full text-left px-3 py-2 rounded-md bg-[#0A1628] hover:bg-[#1E3A5F]/40 text-sm text-[#F0F4F8] truncate"
                  >
                    {t.moduleName ?? 'Training module'}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </DashboardWidget>
  );
}
