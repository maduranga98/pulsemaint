import { useEffect, useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import { X, Play, Pause, PackageX, PackagePlus, ClipboardCheck, CheckCircle2, ShieldCheck, MapPin, FileText } from 'lucide-react';
import type { WorkOrder, ChecklistItem } from '../../../types/workOrder';
import { useUpdateWorkOrder } from '../../../hooks/useUpdateWorkOrder';
import { useWorkOrderPermit } from '../../../hooks/safety/useSafety';
import { useMyWorkCompletion, allAssigneesCompleted } from '../../../hooks/useMyWorkCompletion';
import { buildTechnicianWorkLogs } from '../../../lib/workorders/technicianWorkLogs';
import { WorkPermitDetails } from '../WorkPermitDetails';
import { CreatePartsRequestModal } from '../../inventory/requests/CreatePartsRequestModal';
import { useAuthStore } from '../../../store/authStore';
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
  const [showPartsRequest, setShowPartsRequest] = useState(false);
  const [safetyPreview, setSafetyPreview] = useState(false);
  const [now, setNow] = useState(Date.now());
  // Manual confirmation that the technician has completed the safety
  // precautions (LOTO / PTW) — replaces the machine isolation-point checklist
  // so the gate no longer depends on isolation points being defined on the
  // machine profile.
  const [safetyConfirmed, setSafetyConfirmed] = useState(false);
  const user = useAuthStore((s) => s.user);
  const userProfile = useAuthStore((s) => s.userProfile);

  // Safety Work Permit gate — a WO flagged `requiresWorkPermit` can't start
  // until its linked Permit-to-Work is active.
  const { permit: workPermit } = useWorkOrderPermit(
    wo.requiresWorkPermit ? wo.id : undefined,
    wo.requiresWorkPermit ? wo.workPermitId : undefined,
  );
  const workPermitActive = !wo.requiresWorkPermit || workPermit?.status === 'active';

  const isInProgress = wo.status === 'IN_PROGRESS';
  const isOnHold = wo.status === 'ON_HOLD_PARTS' || wo.status === 'ON_HOLD_APPROVAL';
  const canStart = wo.status === 'ASSIGNED' || wo.status === 'OPEN';

  // Per-assignee completion. Each assigned person completes only their own
  // work; the WO can't be finalised until everyone has. A person only ever
  // sees/edits their own work-done — teammates' details are not shown here.
  const myId = user?.uid ?? userProfile?.id ?? '';
  const myName = userProfile?.fullName ?? user?.displayName ?? 'You';
  const isAssignee = wo.assignedTechnicianIds?.includes(myId) ?? false;
  const myCompletion = (wo.assigneeCompletions ?? []).find((c) => c.technicianId === myId) ?? null;
  const completedIds = new Set((wo.assigneeCompletions ?? []).map((c) => c.technicianId));
  const assigneeRows = (wo.assignedTechnicianIds ?? []).map((id, i) => ({
    id,
    name: wo.assignedTechnicianNames?.[i] ?? id,
    done: completedIds.has(id),
  }));
  const completedCount = assigneeRows.filter((a) => a.done).length;
  const everyoneDone = allAssigneesCompleted(wo);
  const { submitMyWork, loading: myWorkLoading } = useMyWorkCompletion();
  const [showMyWorkForm, setShowMyWorkForm] = useState(false);
  const [myWorkDone, setMyWorkDone] = useState('');

  // The checklist steps this person personally ticked off, compiled the same
  // way the finalisation form does — shown to them as their recorded work.
  const myCompletedSteps = myId
    ? buildTechnicianWorkLogs([{ technicianId: myId, technicianName: myName }], wo.checklist, {}, 0)[0]?.tasksDescription ?? ''
    : '';

  async function handleSubmitMyWork() {
    const ok = await submitMyWork(wo.id, {
      technicianId: myId,
      technicianName: myName,
      technicianRole: userProfile?.role ?? '',
      workDoneDescription: myWorkDone.trim(),
      completedStepsDescription: myCompletedSteps,
      hoursWorked: wo.actualStartTime
        ? Math.round(((Date.now() - wo.actualStartTime.toDate().getTime()) / 3600000) * 100) / 100
        : 0,
    });
    if (ok) {
      setShowMyWorkForm(false);
      setMyWorkDone('');
    }
  }

  // The supervisor/assigner's own attachments — kept distinct from the
  // technician's own field media, which is captured separately below via
  // MediaCaptureBar (storagePath `field-media/`).
  const assignerDocuments = (wo.documents ?? []).filter(
    (d) => !d.isCompletionDocument && !d.storagePath.includes('/field-media/'),
  );

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
    return ok;
  }

  // Manual check-in — record arrival at the machine, then start work.
  async function handleCheckInAndStart() {
    await updateWO(wo.id, {
      checkedInAt: Timestamp.now(),
      checkedInBy: user?.uid ?? null,
      checkedInByName: userProfile?.fullName ?? user?.displayName ?? '',
    });
    await handleStart();
  }

  function handleChecklistUpdate(checklist: ChecklistItem[]) {
    updateWO(wo.id, { checklist });
  }

  function handleStartWOClick() {
    setSafetyPreview(true);
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
              {canStart && !safetyPreview && (
                <div className="space-y-3">
                  {/* Work Permit gate — surfaced before the WO can be started. */}
                  {wo.requiresWorkPermit && (
                    <div className={`rounded-lg border p-3 ${workPermitActive ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-orange-500/40 bg-orange-500/10'}`}>
                      {workPermit ? (
                        <WorkPermitDetails permit={workPermit} variant="dark" />
                      ) : (
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="h-4 w-4 text-orange-300" />
                          <p className="text-xs text-orange-300">No work permit found. A Work Permit must be created before this job can start.</p>
                        </div>
                      )}
                    </div>
                  )}
                  <button
                    onClick={handleStartWOClick}
                    disabled={loading || !workPermitActive}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#1A56DB] px-4 py-3 font-semibold text-white hover:bg-[#1648b8] disabled:opacity-50"
                  >
                    <Play className="h-5 w-5" /> Start WO
                  </button>
                  <p className="text-center text-[11px] text-[#8BA3BF]">
                    {!workPermitActive
                      ? 'This job needs an active Work Permit before it can start.'
                      : 'You will confirm the safety precautions before work begins.'}
                  </p>

                  {/* Assignment briefing — the details the assigner entered, so
                      the technician knows exactly what they've been asked to do
                      before starting. Shows their attachments and a read-only
                      view of the checklist steps assigned to them. */}
                  {assignerDocuments.length > 0 && (
                    <div>
                      <h3 className="mb-2 text-sm font-semibold text-[#F0F4F8]">Documents from assigner</h3>
                      <div className="space-y-2">
                        {assignerDocuments.map((d) => (
                          <a
                            key={d.id}
                            href={d.url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-2 rounded-lg border border-[#1E3A5F] bg-[#0F1E35] px-3 py-2.5 text-sm text-[#F0F4F8] hover:border-[#1A56DB]"
                          >
                            <FileText className="h-4 w-4 shrink-0 text-[#00C2FF]" />
                            <span className="min-w-0 flex-1 truncate">{d.name}</span>
                            <span className="shrink-0 text-xs text-[#8BA3BF]">{d.format}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {wo.checklist.length > 0 && (
                    <div>
                      <h3 className="mb-2 text-sm font-semibold text-[#F0F4F8]">Your tasks</h3>
                      {wo.specialToolsRequired && (
                        <div className="mb-3 rounded-lg border border-[#1E3A5F] bg-[#0F1E35] px-3 py-2.5">
                          <p className="text-xs font-semibold uppercase tracking-wide text-[#8BA3BF]">Special Tools Required</p>
                          <p className="mt-0.5 text-sm text-[#F0F4F8]">{wo.specialToolsRequired}</p>
                        </div>
                      )}
                      <div className="rounded-lg bg-white p-4">
                        <ChecklistExecutor workOrder={wo} onUpdate={handleChecklistUpdate} readOnly />
                      </div>
                      <p className="mt-1.5 text-center text-[11px] text-[#8BA3BF]">
                        Start the work order to tick off tasks and record measurements.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {canStart && safetyPreview && (
                <div className="space-y-3">
                  <div className="rounded-lg bg-white p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-emerald-600" />
                      <h3 className="text-sm font-semibold text-gray-900">Safety Precautions (LOTO / PTW)</h3>
                    </div>
                    <p className="mb-3 text-sm text-gray-600">
                      Make sure all required Lock-Out/Tag-Out and Permit-to-Work safety precautions
                      have been completed for this job, then confirm below to start work.
                    </p>
                    {wo.ptwCategory && (
                      <p className="mb-3 text-xs text-gray-500">
                        Permit category: <span className="font-medium text-gray-700">{wo.ptwCategory}</span>
                      </p>
                    )}
                    <label className="flex cursor-pointer items-start gap-2">
                      <input
                        type="checkbox"
                        checked={safetyConfirmed}
                        onChange={(e) => setSafetyConfirmed(e.target.checked)}
                        className="mt-0.5 rounded border-gray-300 text-emerald-600"
                      />
                      <span className="text-sm font-medium text-gray-800">
                        I confirm all safety precautions (LOTO / PTW) have been completed.
                      </span>
                    </label>
                  </div>
                  <button
                    onClick={handleCheckInAndStart}
                    disabled={loading || !safetyConfirmed}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#1A56DB] px-4 py-3 font-semibold text-white hover:bg-[#1648b8] disabled:opacity-50"
                  >
                    <MapPin className="h-5 w-5" /> Confirm Safety Checks &amp; Start Work
                  </button>
                  <button
                    onClick={() => {
                      setSafetyPreview(false);
                      setSafetyConfirmed(false);
                    }}
                    disabled={loading}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#1E3A5F] bg-[#0F1E35] px-4 py-2.5 text-sm font-medium text-[#F0F4F8] hover:border-[#1A56DB] disabled:opacity-50"
                  >
                    Back
                  </button>
                  {!safetyConfirmed && (
                    <p className="text-center text-[11px] text-[#8BA3BF]">
                      Select the confirmation above before starting work.
                    </p>
                  )}
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

              {/* Attached documents — the supervisor/assigner's own attachments,
                  kept separate from the technician's field media (below).
                  Revealed once the WO has been started, after the safety-step
                  gate has been cleared. */}
              {(isInProgress || isOnHold) && assignerDocuments.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-[#F0F4F8]">Documents</h3>
                  <div className="space-y-2">
                    {assignerDocuments.map((d) => (
                      <a
                        key={d.id}
                        href={d.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 rounded-lg border border-[#1E3A5F] bg-[#0F1E35] px-3 py-2.5 text-sm text-[#F0F4F8] hover:border-[#1A56DB]"
                      >
                        <FileText className="h-4 w-4 shrink-0 text-[#00C2FF]" />
                        <span className="min-w-0 flex-1 truncate">{d.name}</span>
                        <span className="shrink-0 text-xs text-[#8BA3BF]">{d.format}</span>
                      </a>
                    ))}
                  </div>
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
                    {wo.specialToolsRequired && (
                      <div className="mb-3 rounded-lg border border-[#1E3A5F] bg-[#0F1E35] px-3 py-2.5">
                        <p className="text-xs font-semibold uppercase tracking-wide text-[#8BA3BF]">Special Tools Required</p>
                        <p className="mt-0.5 text-sm text-[#F0F4F8]">{wo.specialToolsRequired}</p>
                      </div>
                    )}
                    <div className="rounded-lg bg-white p-4">
                      <ChecklistExecutor workOrder={wo} onUpdate={handleChecklistUpdate} readOnly={isOnHold} />
                    </div>
                  </div>

                  {isInProgress && (
                    <>
                      <div>
                        <h3 className="mb-2 text-sm font-semibold text-[#F0F4F8]">Field Media</h3>
                        <MediaCaptureBar workOrder={wo} siteId={wo.siteId} />
                      </div>

                      <button
                        onClick={() => setShowPartsRequest(true)}
                        className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#1E3A5F] bg-[#0F1E35] px-4 py-2.5 text-sm font-medium text-[#F0F4F8] hover:border-[#00C2FF]"
                      >
                        <PackagePlus className="h-4 w-4 text-[#00C2FF]" /> Request Inventory Items
                      </button>

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

                      {/* Team progress — each assignee's own completion state
                          plus the supervisor's sign-off status. No teammate's
                          work-done details are shown here. */}
                      {assigneeRows.length > 1 && (
                        <div className="rounded-lg border border-[#1E3A5F] bg-[#0F1E35] p-3">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#8BA3BF]">
                            Team progress · {completedCount}/{assigneeRows.length} completed
                          </p>
                          <div className="space-y-1.5">
                            {assigneeRows.map((a) => (
                              <div key={a.id} className="flex items-center justify-between text-sm">
                                <span className={a.id === myId ? 'font-semibold text-[#F0F4F8]' : 'text-[#F0F4F8]'}>
                                  {a.name}{a.id === myId ? ' (you)' : ''}
                                </span>
                                <span className={`text-xs ${a.done ? 'text-emerald-400' : 'text-[#8BA3BF]'}`}>
                                  {a.done ? '✓ Completed' : 'In progress'}
                                </span>
                              </div>
                            ))}
                            <div className="flex items-center justify-between border-t border-[#1E3A5F] pt-1.5 text-sm">
                              <span className="text-[#8BA3BF]">Supervisor sign-off</span>
                              <span className={`text-xs ${wo.supervisorSignOffAt ? 'text-emerald-400' : 'text-[#8BA3BF]'}`}>
                                {wo.supervisorSignOffAt ? '✓ Signed off' : 'Pending'}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Each assignee completes only their own work first. */}
                      {isAssignee && (
                        myCompletion ? (
                          <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3">
                            <p className="flex items-center gap-2 text-sm font-semibold text-emerald-300">
                              <CheckCircle2 className="h-4 w-4" /> You’ve completed your work
                            </p>
                            {myCompletion.workDoneDescription && (
                              <p className="mt-1 text-xs text-[#8BA3BF] whitespace-pre-line">{myCompletion.workDoneDescription}</p>
                            )}
                          </div>
                        ) : showMyWorkForm ? (
                          <div className="rounded-lg border border-[#1E3A5F] bg-[#0F1E35] p-3 space-y-2">
                            <p className="text-sm font-semibold text-[#F0F4F8]">Complete my work</p>
                            {myCompletedSteps && (
                              <p className="whitespace-pre-line rounded-md bg-[#0A1628] px-3 py-2 text-xs text-[#8BA3BF]">{myCompletedSteps}</p>
                            )}
                            <textarea
                              rows={3}
                              value={myWorkDone}
                              onChange={(e) => setMyWorkDone(e.target.value)}
                              placeholder="Describe the work you did on this job"
                              className="w-full rounded-lg border border-[#1E3A5F] bg-[#0A1628] px-3 py-2 text-sm text-[#F0F4F8] placeholder-[#8BA3BF]"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={handleSubmitMyWork}
                                disabled={myWorkLoading || !myWorkDone.trim()}
                                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                              >
                                <CheckCircle2 className="h-4 w-4" /> Submit my work
                              </button>
                              <button
                                onClick={() => setShowMyWorkForm(false)}
                                className="rounded-lg border border-[#1E3A5F] bg-[#0A1628] px-4 py-2.5 text-sm text-[#F0F4F8]"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => setShowMyWorkForm(true)}
                            className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 font-semibold text-white hover:bg-emerald-700"
                          >
                            <CheckCircle2 className="h-5 w-5" /> Complete My Work
                          </button>
                        )
                      )}

                      {/* Finalise the whole WO — only once every assignee has
                          completed their own work. */}
                      {everyoneDone ? (
                        <button
                          onClick={() => setShowCompletion(true)}
                          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#1A56DB] px-4 py-3 font-semibold text-white hover:bg-[#1648b8]"
                        >
                          <CheckCircle2 className="h-5 w-5" /> Complete &amp; Submit Work Order
                        </button>
                      ) : (
                        <p className="text-center text-[11px] text-[#8BA3BF]">
                          The work order can be submitted for sign-off once all assigned team members
                          have completed their own work ({completedCount}/{assigneeRows.length}).
                        </p>
                      )}
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

        {showPartsRequest && (
          <CreatePartsRequestModal
            onClose={() => setShowPartsRequest(false)}
            workOrder={{
              id: wo.id,
              woNumber: wo.woNumber,
              woType: wo.woType,
              machineId: wo.machineId,
              machineName: wo.machineName,
              isContractorJob: wo.woType === 'CONTRACTOR',
              contractorCompany: wo.contractorCompanyName ?? null,
            }}
          />
        )}
      </div>
    </div>
  );
}
