import { useEffect, useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import { X, Play, Pause, PackageX, ClipboardCheck, CheckCircle2 } from 'lucide-react';
import type { WorkOrder, ChecklistItem } from '../../../types/workOrder';
import { useUpdateWorkOrder } from '../../../hooks/useUpdateWorkOrder';
import { WOTypeBadge } from '../WOTypeBadge';
import { WOStatusBadge } from '../WOStatusBadge';
import { PriorityBadge } from '../PriorityBadge';
import { SLACountdownTimer } from '../SLACountdownTimer';
import { ChecklistExecutor } from '../ChecklistExecutor';
import { WOCompletionForm } from '../WOCompletionForm';
import { MediaCaptureBar } from './MediaCaptureBar';

interface Props {
  workOrder: WorkOrder;
  onClose: () => void;
}

function formatElapsed(ms: number): string {
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const s = Math.floor((ms % 60000) / 1000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s}s`;
}

export function TechnicianWOExecutionSheet({ workOrder, onClose }: Props) {
  const wo = workOrder;
  const { updateWO, updateStatus, loading } = useUpdateWorkOrder();
  const [showCompletion, setShowCompletion] = useState(false);
  const [now, setNow] = useState(Date.now());

  const isInProgress = wo.status === 'IN_PROGRESS';
  const isOnHold = wo.status === 'ON_HOLD_PARTS' || wo.status === 'ON_HOLD_APPROVAL';
  const canStart = wo.status === 'ASSIGNED' || wo.status === 'OPEN';

  useEffect(() => {
    if (!isInProgress || !wo.actualStartTime) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [isInProgress, wo.actualStartTime]);

  async function handleStart() {
    const ok = await updateStatus(wo.id, 'IN_PROGRESS');
    if (ok && !wo.actualStartTime) {
      await updateWO(wo.id, { actualStartTime: Timestamp.now() });
    }
  }

  function handleChecklistUpdate(checklist: ChecklistItem[]) {
    updateWO(wo.id, { checklist });
  }

  const elapsed = wo.actualStartTime ? now - wo.actualStartTime.toDate().getTime() : 0;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ fontFamily: 'Sora, sans-serif' }}>
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-lg flex-col bg-[#0A1628] text-[#F0F4F8] shadow-2xl">
        {/* Header */}
        <div className="border-b border-[#1E3A5F] p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-lg font-bold">{wo.woNumber}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <WOTypeBadge woType={wo.woType} size="sm" />
                <PriorityBadge priority={wo.priority} size="sm" />
                <WOStatusBadge status={wo.status} size="sm" />
              </div>
            </div>
            <button onClick={onClose} className="rounded-lg p-1.5 text-[#8BA3BF] hover:bg-[#0F1E35]">
              <X className="h-5 w-5" />
            </button>
          </div>
          <p className="mt-3 text-sm text-[#F0F4F8]">{wo.machineName}</p>
          <p className="text-xs text-[#8BA3BF]">{wo.machineLocation}</p>
          <div className="mt-2 flex items-center justify-between">
            <SLACountdownTimer slaDeadline={wo.slaDeadline} status={wo.status} />
            <span className="text-xs text-[#8BA3BF]">Supervisor: {wo.supervisorInChargeName}</span>
          </div>
          {wo.description && <p className="mt-2 text-xs text-[#8BA3BF]">{wo.description}</p>}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {showCompletion ? (
            <WOCompletionForm
              workOrder={wo}
              onCompleted={onClose}
              onCancel={() => setShowCompletion(false)}
            />
          ) : (
            <div className="space-y-5">
              {canStart && (
                <div className="space-y-3">
                  <button
                    onClick={handleStart}
                    disabled={loading}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#1A56DB] px-4 py-3 font-semibold text-white hover:bg-[#1648b8] disabled:opacity-50"
                  >
                    <Play className="h-5 w-5" /> Start Work
                  </button>
                  <p className="text-center text-[11px] text-[#8BA3BF]">
                    Starting work runs the LOTO / PTW safety check. You can&apos;t start until isolation is verified.
                  </p>
                </div>
              )}

              {isOnHold && (
                <div className="space-y-3">
                  <div className="rounded-lg border border-orange-500/40 bg-orange-500/10 p-3">
                    <p className="text-sm font-semibold text-orange-300">
                      Paused — {wo.status === 'ON_HOLD_PARTS' ? 'waiting for parts' : 'waiting for approval'}
                    </p>
                  </div>
                  <button
                    onClick={() => updateStatus(wo.id, 'IN_PROGRESS')}
                    disabled={loading}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#1A56DB] px-4 py-3 font-semibold text-white hover:bg-[#1648b8] disabled:opacity-50"
                  >
                    <Play className="h-5 w-5" /> Resume
                  </button>
                </div>
              )}

              {(isInProgress || isOnHold) && (
                <>
                  {isInProgress && (
                    <div className="rounded-lg border border-[#1E3A5F] bg-[#0F1E35] p-3 text-center">
                      <p className="text-xs uppercase tracking-wide text-[#8BA3BF]">Time on job</p>
                      <p className="font-mono text-2xl font-bold text-[#00C2FF]">{formatElapsed(elapsed)}</p>
                    </div>
                  )}

                  <div>
                    <h3 className="mb-2 text-sm font-semibold text-[#F0F4F8]">Checklist</h3>
                    <ChecklistExecutor workOrder={wo} onUpdate={handleChecklistUpdate} readOnly={isOnHold} />
                  </div>

                  {isInProgress && (
                    <>
                      <div>
                        <h3 className="mb-2 text-sm font-semibold text-[#F0F4F8]">Field Media</h3>
                        <MediaCaptureBar workOrder={wo} siteId={wo.siteId} />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => updateStatus(wo.id, 'ON_HOLD_PARTS', 'Waiting for parts')}
                          disabled={loading}
                          className="flex items-center justify-center gap-1.5 rounded-lg border border-[#1E3A5F] bg-[#0F1E35] px-3 py-2.5 text-sm font-medium text-[#F0F4F8] hover:border-orange-500 disabled:opacity-50"
                        >
                          <PackageX className="h-4 w-4 text-orange-400" /> Hold · Parts
                        </button>
                        <button
                          onClick={() => updateStatus(wo.id, 'ON_HOLD_APPROVAL', 'Waiting for approval')}
                          disabled={loading}
                          className="flex items-center justify-center gap-1.5 rounded-lg border border-[#1E3A5F] bg-[#0F1E35] px-3 py-2.5 text-sm font-medium text-[#F0F4F8] hover:border-red-500 disabled:opacity-50"
                        >
                          <Pause className="h-4 w-4 text-red-400" /> Hold · Approval
                        </button>
                      </div>

                      <button
                        onClick={() => setShowCompletion(true)}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 font-semibold text-white hover:bg-emerald-700"
                      >
                        <CheckCircle2 className="h-5 w-5" /> Complete Job
                      </button>
                    </>
                  )}
                </>
              )}

              {!canStart && !isInProgress && !isOnHold && (
                <div className="flex flex-col items-center gap-2 py-10 text-center text-[#8BA3BF]">
                  <ClipboardCheck className="h-8 w-8" />
                  <p className="text-sm">This work order is {wo.status.replace(/_/g, ' ').toLowerCase()}.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
