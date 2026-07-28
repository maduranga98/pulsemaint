import { useMemo, useState } from 'react';
import { ClipboardCheck, GraduationCap } from 'lucide-react';
import { useWorkOrders } from '../../hooks/useWorkOrders';
import { useTrainingSignOffQueue } from '../../hooks/training/useTrainingSignOffQueue';
import { WOTypeBadge } from '../../components/workorders/WOTypeBadge';
import { PriorityBadge } from '../../components/workorders/PriorityBadge';
import { WOReviewSignOffPanel } from '../../components/workorders/WOReviewSignOffPanel';
import TrainingSignOffPanel from '../../components/training/manager/TrainingSignOffPanel';

type Tab = 'work_orders' | 'trainings';

/**
 * Everything awaiting a sign-off in one place: completed work orders and
 * completed trainings whose practical assessment still needs certifying.
 * Reachable by supervisors, plant managers, and admins.
 */
export default function SignOffQueuePage() {
  const { workOrders, loading, error } = useWorkOrders({ status: ['COMPLETED'] });
  const { assignments, loading: trainingsLoading } = useTrainingSignOffQueue();
  const [tab, setTab] = useState<Tab>('work_orders');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);

  const selectedWO = useMemo(
    () => workOrders.find((w) => w.id === selectedId) ?? null,
    [workOrders, selectedId],
  );
  const selectedAssignment = useMemo(
    () => assignments.find((a) => a.id === selectedAssignmentId) ?? null,
    [assignments, selectedAssignmentId],
  );

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'work_orders', label: 'Work Orders', count: workOrders.length },
    { key: 'trainings', label: 'Trainings', count: assignments.length },
  ];

  return (
    <div className="min-h-full bg-gray-50 p-4 sm:p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 flex items-center gap-2">
          <ClipboardCheck className="h-6 w-6 text-blue-600" />
          <h1 className="text-xl font-bold text-gray-900">Sign-Off Queue</h1>
          {workOrders.length + assignments.length > 0 && (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-sm font-semibold text-blue-700">
              {workOrders.length + assignments.length}
            </span>
          )}
        </div>

        <div className="mb-6 flex gap-2">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                tab === t.key ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {t.label}
              {t.count > 0 && (
                <span
                  className={`ml-2 rounded-full px-1.5 py-0.5 text-xs font-semibold ${
                    tab === t.key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {tab === 'work_orders' && (
          <>
            {loading && <p className="text-sm text-gray-500">Loading completed work orders…</p>}
            {error && <p className="text-sm text-red-500">{error}</p>}

            {!loading && !error && workOrders.length === 0 && (
              <div className="rounded-xl border border-gray-200 bg-white p-10 text-center">
                <ClipboardCheck className="mx-auto mb-3 h-10 w-10 text-gray-300" />
                <p className="text-sm font-medium text-gray-700">No work orders awaiting sign-off</p>
                <p className="mt-1 text-xs text-gray-500">Completed work orders will appear here for review.</p>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {workOrders.map((wo) => (
                <button
                  key={wo.id}
                  onClick={() => setSelectedId(wo.id)}
                  className="rounded-xl border border-gray-200 bg-white p-4 text-left transition-shadow hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-bold text-gray-900">{wo.woNumber}</p>
                  </div>
                  <p className="mt-1 text-sm text-gray-700">{wo.machineName}</p>
                  <p className="text-xs text-gray-500">{wo.machineLocation}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <WOTypeBadge woType={wo.woType} size="sm" />
                    <PriorityBadge priority={wo.priority} size="sm" />
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    <p>{wo.assignedTechnicianNames?.join(', ') || 'Unassigned'}</p>
                    {wo.actualEndTime && <p>Completed {wo.actualEndTime.toDate().toLocaleDateString()}</p>}
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {tab === 'trainings' && (
          <>
            {trainingsLoading && <p className="text-sm text-gray-500">Loading completed trainings…</p>}

            {!trainingsLoading && assignments.length === 0 && (
              <div className="rounded-xl border border-gray-200 bg-white p-10 text-center">
                <GraduationCap className="mx-auto mb-3 h-10 w-10 text-gray-300" />
                <p className="text-sm font-medium text-gray-700">No trainings awaiting sign-off</p>
                <p className="mt-1 text-xs text-gray-500">
                  Trainings appear here once the learner has passed the final test.
                </p>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {assignments.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setSelectedAssignmentId(a.id)}
                  className="rounded-xl border border-gray-200 bg-white p-4 text-left transition-shadow hover:shadow-md"
                >
                  <p className="font-bold text-gray-900">{a.traineeName}</p>
                  <p className="mt-1 text-sm text-gray-700">{a.moduleName}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                      Awaiting sign-off
                    </span>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      {a.bestScore ?? 0}%
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    <p>Assigned by {a.assignedByName || 'Unknown'}</p>
                    {a.quizPassedAt && <p>Passed {a.quizPassedAt.toDate().toLocaleDateString()}</p>}
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {selectedWO && <WOReviewSignOffPanel workOrder={selectedWO} onClose={() => setSelectedId(null)} />}
      {selectedAssignment && (
        <TrainingSignOffPanel assignment={selectedAssignment} onClose={() => setSelectedAssignmentId(null)} />
      )}
    </div>
  );
}
