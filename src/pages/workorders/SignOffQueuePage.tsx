import { useMemo, useState } from 'react';
import { ClipboardCheck, GraduationCap } from 'lucide-react';
import { useCompletedWorkOrdersForSignOff } from '../../hooks/useCompletedWorkOrdersForSignOff';
import { useAuthStore } from '../../store/authStore';
import { useTrainingSignOffQueue } from '../../hooks/training/useTrainingSignOffQueue';
import { WOTypeBadge } from '../../components/workorders/WOTypeBadge';
import { PriorityBadge } from '../../components/workorders/PriorityBadge';
import { WOReviewSignOffPanel } from '../../components/workorders/WOReviewSignOffPanel';
import TrainingSignOffPanel from '../../components/training/manager/TrainingSignOffPanel';
import type { TrainingAssignment } from '../../lib/training/trainingTypes';

/**
 * Completed work orders and trainings awaiting sign-off. A supervisor sees only
 * the work orders they are the supervisor-in-charge of; plant managers and
 * admins (who oversee the whole plant) see all completed work orders. Completed
 * trainings that still need a practical sign-off are surfaced here too, so
 * managers no longer have to open each trainee's profile to certify them.
 */
export default function SignOffQueuePage() {
  const { workOrders, loading, error } = useCompletedWorkOrdersForSignOff();
  const { assignments: trainingQueue, loading: trainingLoading } = useTrainingSignOffQueue();
  const userId = useAuthStore((s) => s.userProfile?.id);
  const role = useAuthStore((s) => s.userProfile?.role);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedTrainingId, setSelectedTrainingId] = useState<string | null>(null);

  // Supervisors: only the WOs they own the sign-off for. Oversight roles see all.
  const visibleWorkOrders = useMemo(() => {
    if (role === 'supervisor') {
      return workOrders.filter((w) => (w as { supervisorInChargeId?: string }).supervisorInChargeId === userId);
    }
    return workOrders;
  }, [workOrders, role, userId]);

  const selectedWO = useMemo(
    () => visibleWorkOrders.find((w) => w.id === selectedId) ?? null,
    [visibleWorkOrders, selectedId],
  );

  const selectedTraining = useMemo(
    () => trainingQueue.find((t) => t.id === selectedTrainingId) ?? null,
    [trainingQueue, selectedTrainingId],
  );

  function fmtDate(ts: TrainingAssignment['quizPassedAt']): string {
    const d = (ts as { toDate?: () => Date } | null | undefined)?.toDate?.();
    return d ? d.toLocaleDateString() : '';
  }

  return (
    <div className="min-h-full bg-gray-50 p-4 sm:p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center gap-2">
          <ClipboardCheck className="h-6 w-6 text-blue-600" />
          <h1 className="text-xl font-bold text-gray-900">Sign-Off Queue</h1>
          {visibleWorkOrders.length > 0 && (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-sm font-semibold text-blue-700">
              {visibleWorkOrders.length}
            </span>
          )}
        </div>

        {loading && <p className="text-sm text-gray-500">Loading completed work orders…</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}

        {!loading && !error && visibleWorkOrders.length === 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-10 text-center">
            <ClipboardCheck className="mx-auto mb-3 h-10 w-10 text-gray-300" />
            <p className="text-sm font-medium text-gray-700">No work orders awaiting your sign-off</p>
            <p className="mt-1 text-xs text-gray-500">
              {role === 'supervisor'
                ? 'Completed work orders you supervise will appear here for review.'
                : 'Completed work orders will appear here for review.'}
            </p>
          </div>
        )}

        {(role === 'supervisor' || role === 'plant_manager' || role === 'admin') && (
          <div className="mb-8">
            <div className="mb-3 flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-emerald-600" />
              <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500">
                Trainings awaiting sign-off
              </h2>
              {trainingQueue.length > 0 && (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                  {trainingQueue.length}
                </span>
              )}
            </div>
            {trainingLoading ? (
              <p className="text-sm text-gray-500">Loading completed trainings…</p>
            ) : trainingQueue.length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
                No trainings awaiting sign-off.
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {trainingQueue.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTrainingId(t.id)}
                    className="rounded-xl border border-gray-200 bg-white p-4 text-left transition-shadow hover:shadow-md"
                  >
                    <p className="font-bold text-gray-900">{t.moduleName}</p>
                    <p className="mt-1 text-sm text-gray-700">{t.traineeName}</p>
                    <div className="mt-2 text-xs text-gray-500">
                      {t.assignedByName && <p>Assigned by {t.assignedByName}</p>}
                      {fmtDate(t.quizPassedAt) && <p>Passed test {fmtDate(t.quizPassedAt)}</p>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visibleWorkOrders.map((wo) => (
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
      </div>

      {selectedWO && <WOReviewSignOffPanel workOrder={selectedWO} onClose={() => setSelectedId(null)} />}
      {selectedTraining && (
        <TrainingSignOffPanel assignment={selectedTraining} onClose={() => setSelectedTrainingId(null)} />
      )}
    </div>
  );
}
