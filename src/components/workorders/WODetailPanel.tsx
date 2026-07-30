import { useEffect, useState } from 'react';
import { Timestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { WorkOrder } from '../../types/workOrder';
import type { IsolationPoint } from '../../types/machine';
import { WO_COPY } from '../../constants/copy';
import { WOTypeBadge } from './WOTypeBadge';
import { PriorityBadge } from './PriorityBadge';
import { WOStatusBadge } from './WOStatusBadge';
import { SLACountdownTimer } from './SLACountdownTimer';
import { WOCompletionForm } from './WOCompletionForm';
import { WOSignOffForm } from './WOSignOffForm';
import { ChecklistExecutor } from './ChecklistExecutor';
import { LotoGate } from './LotoGate';
import { useUpdateWorkOrder } from '../../hooks/useUpdateWorkOrder';
import { useAuthStore } from '../../store/authStore';

type TabKey = 'overview' | 'checklist' | 'documents' | 'parts' | 'history';

interface WODetailPanelProps {
  workOrder: WorkOrder;
  onClose: () => void;
  fullPage?: boolean;
}

const WORK_LOG_ROLE_LABELS: Record<string, string> = {
  technician: 'Technician', trainee: 'Trainee', supervisor: 'Supervisor',
  plant_manager: 'Plant Manager', store_keeper: 'Store Keeper',
  floor_operator: 'Floor Operator', hr_officer: 'HR Officer',
  safety_officer: 'Safety Officer', admin: 'Admin',
};
function detailRoleLabel(role: string): string {
  return WORK_LOG_ROLE_LABELS[role] ?? role.replace(/_/g, ' ');
}

export function WODetailPanel({ workOrder, onClose, fullPage = false }: WODetailPanelProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [showCompletionForm, setShowCompletionForm] = useState(false);
  const [showSignOff, setShowSignOff] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [isolationPoints, setIsolationPoints] = useState<IsolationPoint[] | null>(null);

  const { updateWO, updateStatus, loading: statusLoading } = useUpdateWorkOrder();
  const user = useAuthStore((s) => s.user);
  const userProfile = useAuthStore((s) => s.userProfile);
  const role = (userProfile?.role ?? '') as string;

  const isSupervisor = ['supervisor', 'maintenance_supervisor', 'plant_manager', 'admin'].includes(role);
  const isTechnician = role === 'technician';
  // Assignment may be stored under the Firebase Auth uid or the user profile id.
  const myIds = [user?.uid, userProfile?.id].filter(Boolean) as string[];
  const isAssigned = workOrder.assignedTechnicianIds.some((id) => myIds.includes(id));

  // Time consumed is derived from the start/complete timestamps (no manual
  // wrench-time entry).
  const durationMinutes = workOrder.actualStartTime && workOrder.actualEndTime
    ? Math.max(0, Math.round(
        (workOrder.actualEndTime.toDate().getTime() - workOrder.actualStartTime.toDate().getTime()) / 60000,
      ))
    : workOrder.totalDurationMinutes ?? null;
  const timeConsumed = durationMinutes != null
    ? `${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}m`
    : null;

  // Live checklist progress — reflects task completions as they happen.
  const checklistTotal = workOrder.checklist.length;
  const checklistDone = workOrder.checklist.filter((i) => i.isCompleted).length;
  const checklistPct = checklistTotal > 0 ? Math.round((checklistDone / checklistTotal) * 100) : 0;

  const TABS: { key: TabKey; label: string }[] = [
    { key: 'overview', label: WO_COPY.tabOverview },
    { key: 'checklist', label: WO_COPY.tabChecklist },
    { key: 'documents', label: WO_COPY.tabDocuments },
    { key: 'parts', label: WO_COPY.tabParts },
    { key: 'history', label: WO_COPY.tabHistory },
  ];

  // Load the machine's isolation points so the LOTO/PTW safety gate can be
  // completed here before check-in (supervisors don't get the technician
  // execution sheet, so without this they couldn't satisfy the gate).
  useEffect(() => {
    let cancelled = false;
    getDoc(doc(db, 'machines', workOrder.machineId))
      .then((snap) => {
        if (!cancelled) {
          setIsolationPoints((snap.data()?.isolationPoints ?? []) as IsolationPoint[]);
        }
      })
      .catch(() => {
        if (!cancelled) setIsolationPoints([]);
      });
    return () => {
      cancelled = true;
    };
  }, [workOrder.machineId]);

  const safetyGateVisible =
    ['OPEN', 'ASSIGNED'].includes(workOrder.status) &&
    (isSupervisor || (isTechnician && isAssigned)) &&
    isolationPoints !== null &&
    (isolationPoints.length > 0 || !!workOrder.ptwCategory);

  // Manual check-in — records arrival on the WO, then moves it to
  // IN_PROGRESS. Available to the assigned technician and to
  // supervisor / plant manager / admin (manual start).
  async function handleCheckInAndStart() {
    await updateWO(workOrder.id, {
      checkedInAt: Timestamp.now(),
      checkedInBy: user?.uid ?? null,
      checkedInByName: userProfile?.fullName ?? user?.displayName ?? '',
    });
    await updateStatus(workOrder.id, 'IN_PROGRESS', 'Checked in / started manually');
  }

  // Supervisors in charge (and any supervisor/manager/admin) can execute
  // checklist tasks while the WO is in progress — needed for contractor jobs
  // where no internal technician is assigned.
  const canExecuteChecklist =
    ['IN_PROGRESS', 'ON_HOLD_PARTS', 'ON_HOLD_APPROVAL'].includes(workOrder.status) &&
    (isSupervisor || (isTechnician && isAssigned));

  const containerClass = fullPage
    ? 'min-h-screen bg-gray-50'
    : 'fixed inset-0 bg-black/40 z-40 flex items-end sm:items-start sm:justify-end';

  const panelClass = fullPage
    ? 'w-full'
    : 'w-full sm:max-w-2xl sm:h-full bg-white overflow-y-auto';

  return (
    <div className={containerClass}>
      <div className={`${panelClass} bg-white flex flex-col`}>
        {/* Header */}
        <div className="sticky top-0 bg-white z-10 border-b border-gray-100 px-6 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <WOTypeBadge woType={workOrder.woType} size="sm" />
                <PriorityBadge priority={workOrder.priority} size="sm" />
                <WOStatusBadge status={workOrder.status} size="sm" />
              </div>
              <h1 className="font-bold text-xl text-gray-900">{workOrder.woNumber || ''}</h1>
              <p className="text-sm text-gray-600 truncate">{workOrder.machineName} · {workOrder.machineLocation}</p>
              <div className="mt-1">
                <SLACountdownTimer slaDeadline={workOrder.slaDeadline} status={workOrder.status} />
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-700 p-1 flex-shrink-0"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-4 overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
                  activeTab === tab.key
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* ── Overview ── */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Live progress — status + checklist completion, updates as the
                  assigned team completes tasks. */}
              <section className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Progress</h3>
                  <WOStatusBadge status={workOrder.status} size="sm" />
                </div>
                {checklistTotal > 0 ? (
                  <>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 transition-all"
                        style={{ width: `${checklistPct}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500">
                      {checklistDone} / {checklistTotal} checklist steps completed ({checklistPct}%)
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-gray-400">No checklist steps defined.</p>
                )}
              </section>

              {/* Safety gate (LOTO/PTW) — must pass before check-in */}
              {safetyGateVisible && (
                <section className="bg-white border border-gray-200 rounded-xl p-4">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                    Safety Precautions (LOTO / PTW)
                  </h3>
                  <LotoGate workOrder={workOrder} machineIsolationPoints={isolationPoints ?? []} />
                </section>
              )}

              {/* Job details — special tools, safety category, estimate, links */}
              {(workOrder.specialToolsRequired?.trim() ||
                workOrder.ptwCategory ||
                workOrder.linkedBreakdownTicketNumber) && (
                <section>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Job Details</h3>
                  <div className="space-y-1.5 text-sm">
                    {workOrder.specialToolsRequired?.trim() && (
                      <div className="flex items-start gap-2">
                        <span className="text-gray-500 w-32 flex-shrink-0">Special tools:</span>
                        <span className="text-gray-800 whitespace-pre-line">{workOrder.specialToolsRequired}</span>
                      </div>
                    )}
                    {workOrder.ptwCategory && (
                      <div className="flex items-start gap-2">
                        <span className="text-gray-500 w-32 flex-shrink-0">Permit category:</span>
                        <span className="text-gray-800">{workOrder.ptwCategory}</span>
                      </div>
                    )}
                    {workOrder.linkedBreakdownTicketNumber && (
                      <div className="flex items-start gap-2">
                        <span className="text-gray-500 w-32 flex-shrink-0">Linked breakdown:</span>
                        <span className="text-gray-800">{workOrder.linkedBreakdownTicketNumber}</span>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* Description */}
              <section>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Description</h3>
                <p className="text-sm text-gray-800 whitespace-pre-line">{workOrder.description}</p>
              </section>

              {/* Machine */}
              <section className="bg-blue-50 rounded-xl p-4 space-y-2">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Machine</h3>
                <p className="font-semibold text-gray-900">{workOrder.machineName}</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-gray-600">
                  <span>Location: {workOrder.machineLocation}</span>
                  <span>Type: {workOrder.machineType}</span>
                  <span>Dept: {workOrder.machineDepartment}</span>
                  <span>Criticality: {workOrder.machineCriticality}/5</span>
                </div>
              </section>

              {/* Team */}
              <section>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Team</h3>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-500 w-28 flex-shrink-0">Supervisor:</span>
                    <span className="font-medium">{workOrder.supervisorInChargeName}</span>
                  </div>
                  {workOrder.woType !== 'CONTRACTOR' && workOrder.assignedTechnicianNames.length > 0 && (
                    <div className="flex items-start gap-2 text-sm">
                      <span className="text-gray-500 w-28 flex-shrink-0">Technicians:</span>
                      <div className="flex flex-wrap gap-1">
                        {workOrder.assignedTechnicianNames.map((n, i) => (
                          <span key={i} className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full text-xs">
                            {n}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {workOrder.woType === 'CONTRACTOR' && workOrder.contractorCompanyName && (
                    <div className="mt-2 bg-indigo-50 rounded-xl p-3 space-y-1 text-sm">
                      <div className="flex items-center gap-1">
                        <span className="text-lg">🤝</span>
                        <span className="font-semibold">{workOrder.contractorCompanyName}</span>
                        {workOrder.isManualContractor && (
                          <span className="text-xs text-amber-600">⚠️ Unregistered</span>
                        )}
                      </div>
                      {workOrder.contractorContactPerson && (
                        <p className="text-gray-600">Contact: {workOrder.contractorContactPerson} · {workOrder.contractorContactNumber}</p>
                      )}
                      {workOrder.contractorTechnicianNames.length > 0 && (
                        <p className="text-gray-500 text-xs">On-site: {workOrder.contractorTechnicianNames.join(', ')}</p>
                      )}
                    </div>
                  )}
                </div>
              </section>

              {/* Technician work logs (recorded at completion) — one entry per
                  assigned person, so a team WO shows all tasks by everyone. */}
              {(workOrder.technicianWorkLogs ?? []).length > 0 && (
                <section>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Work Done by Team</h3>
                  <div className="space-y-2">
                    {workOrder.technicianWorkLogs.map((log, i) => (
                      <div key={i} className="bg-gray-50 rounded-lg px-3 py-2 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-gray-800">
                            {log.technicianName}
                            {log.technicianRole && <span className="ml-1 text-xs font-normal text-gray-500">({detailRoleLabel(log.technicianRole)})</span>}
                          </span>
                          <span className="text-xs text-gray-500">{log.hoursWorked}h</span>
                        </div>
                        {log.tasksDescription && (
                          <p className="text-xs text-gray-600 mt-0.5 whitespace-pre-line">{log.tasksDescription}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Dates */}
              <section>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Dates</h3>
                <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                  <span>Created: {workOrder.createdAt?.toDate().toLocaleDateString()}</span>
                  {workOrder.scheduledStart && (
                    <span>Scheduled: {workOrder.scheduledStart.toDate().toLocaleDateString()}</span>
                  )}
                  <span>Due: {workOrder.dueDate?.toDate().toLocaleDateString()}</span>
                  <span>Est. Duration: {workOrder.estimatedDuration} {workOrder.estimatedDurationUnit}</span>
                  {workOrder.checkedInAt && (
                    <span>
                      Checked in: {workOrder.checkedInAt.toDate().toLocaleString()}
                      {workOrder.checkedInByName ? ` (${workOrder.checkedInByName})` : ''}
                    </span>
                  )}
                  {workOrder.actualStartTime && (
                    <span>Started: {workOrder.actualStartTime.toDate().toLocaleString()}</span>
                  )}
                  {workOrder.actualEndTime && (
                    <span>Completed: {workOrder.actualEndTime.toDate().toLocaleString()}</span>
                  )}
                  {timeConsumed && (
                    <span className="font-medium text-gray-900">Time Consumed: {timeConsumed}</span>
                  )}
                </div>
              </section>

              {/* Completion info (if completed) */}
              {workOrder.workDoneDescription && (
                <section className="bg-blue-50 rounded-xl p-4 space-y-2">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Completion</h3>
                  <p className="text-sm text-gray-800 whitespace-pre-line">{workOrder.workDoneDescription}</p>
                  {workOrder.rootCause && (
                    <p className="text-sm text-gray-900">
                      Root cause: <span className="font-semibold">{workOrder.rootCause.replace(/_/g, ' ')}</span>
                    </p>
                  )}
                  {workOrder.rootCauseDescription && (
                    <p className="text-sm text-gray-700 italic whitespace-pre-line">{workOrder.rootCauseDescription}</p>
                  )}
                  {workOrder.testRunResult && (
                    <p className="text-sm text-gray-900">
                      Test run:
                      <span className={`ml-1 font-semibold ${
                        workOrder.testRunResult === 'pass' ? 'text-emerald-800' :
                        workOrder.testRunResult === 'fail' ? 'text-red-800' : 'text-amber-800'
                      }`}>
                        {workOrder.testRunResult}
                      </span>
                    </p>
                  )}
                  {workOrder.testRunNotes && (
                    <p className="text-sm text-gray-700 whitespace-pre-line">{workOrder.testRunNotes}</p>
                  )}
                  {workOrder.machineStatusAfterRepair && (
                    <p className="text-sm text-gray-900">
                      Machine: <span className="font-semibold">{workOrder.machineStatusAfterRepair.replace(/_/g, ' ')}</span>
                    </p>
                  )}
                </section>
              )}

              {/* Post-repair checklist (recorded at completion) */}
              {(workOrder.postRepairChecklist ?? []).length > 0 && (
                <section>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Post-Repair Checks</h3>
                  <ul className="space-y-1.5">
                    {workOrder.postRepairChecklist.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm bg-gray-50 rounded-lg px-3 py-2">
                        <span className={`flex-shrink-0 ${item.result === 'fail' ? 'text-red-500' : 'text-emerald-500'}`}>
                          {item.result === 'fail' ? '✕' : '✓'}
                        </span>
                        <div className="flex-1">
                          <p className="text-gray-800">{item.stepDescription}</p>
                          {item.notes && <p className="text-xs text-gray-500 italic mt-0.5">{item.notes}</p>}
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Sign-off record — auto-captured when a supervisor/manager
                  signs off and closes the WO. */}
              {workOrder.supervisorSignOffAt && (
                <section className="bg-gray-50 rounded-xl p-4 space-y-1.5">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Sign-Off</h3>
                  {workOrder.signOffOutcome && (
                    <p className="text-sm">
                      Outcome:{' '}
                      <span className={`font-semibold ${
                        workOrder.signOffOutcome === 'complete' ? 'text-emerald-600' :
                        workOrder.signOffOutcome === 'failed' ? 'text-red-600' : 'text-amber-600'
                      }`}>
                        {workOrder.signOffOutcome === 'complete' ? 'Complete' :
                         workOrder.signOffOutcome === 'failed' ? 'Failed' : 'Not complete'}
                      </span>
                    </p>
                  )}
                  {workOrder.signOffOutcomeReason && (
                    <p className="text-sm text-gray-700">Reason: {workOrder.signOffOutcomeReason}</p>
                  )}
                  {workOrder.supervisorSignOffNotes && (
                    <p className="text-sm text-gray-700 italic">"{workOrder.supervisorSignOffNotes}"</p>
                  )}
                  <p className="text-xs text-gray-500">
                    Signed off by {workOrder.supervisorSignOffByName || workOrder.closedByName || ''}
                    {workOrder.supervisorSignOffAt?.toDate
                      ? ` · ${workOrder.supervisorSignOffAt.toDate().toLocaleString()}`
                      : ''}
                  </p>
                </section>
              )}
            </div>
          )}

          {/* ── Checklist ── */}
          {activeTab === 'checklist' && (
            <div className="space-y-3">
              {workOrder.checklist.length === 0 ? (
                <p className="text-sm text-gray-400 py-6 text-center">No checklist steps defined.</p>
              ) : canExecuteChecklist ? (
                <ChecklistExecutor
                  workOrder={workOrder}
                  onUpdate={(checklist) => updateWO(workOrder.id, { checklist })}
                  readOnly={workOrder.status !== 'IN_PROGRESS'}
                />
              ) : (
                <>
                  {(() => {
                    // Oversight roles (and the WO creator) see the whole
                    // checklist; anyone else — e.g. a technician viewing
                    // their WO before it's started, who doesn't hit the
                    // ChecklistExecutor branch above — should only see the
                    // steps assigned to them (or unassigned/general steps).
                    const isOversightViewer =
                      isSupervisor || (!!workOrder.createdBy && myIds.includes(workOrder.createdBy));
                    const isStepAssignedToMe = (item: (typeof workOrder.checklist)[number]) => {
                      const ids = [
                        ...(item.assignedTechnicianIds ?? []),
                        ...(item.assignedTechnicianId ? [item.assignedTechnicianId] : []),
                      ];
                      if (ids.length === 0) return true;
                      return ids.some((id) => myIds.includes(id));
                    };
                    const visibleItems = workOrder.checklist.filter(
                      (item) => isOversightViewer || isStepAssignedToMe(item),
                    );
                    return (
                      <>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 transition-all"
                            style={{
                              width: `${
                                visibleItems.length > 0
                                  ? (visibleItems.filter((i) => i.isCompleted).length /
                                    visibleItems.length) *
                                    100
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                        <p className="text-xs text-gray-500">
                          {visibleItems.filter((i) => i.isCompleted).length} / {visibleItems.length} completed
                        </p>
                        <ol className="space-y-2">
                          {visibleItems.map((item, i) => (
                            <li key={i} className="flex items-start gap-3 bg-gray-50 rounded-lg px-4 py-3">
                              <span className="flex-shrink-0 h-6 w-6 flex items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-bold mt-0.5">
                                {item.stepNumber}
                              </span>
                              <div className="flex-1">
                                <p className={`text-sm ${item.isCompleted ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                                  {item.stepDescription}
                                </p>
                                <p className="text-xs text-gray-400 mt-0.5">
                                  {item.assignedTechnicianName && <>→ {item.assignedTechnicianName} · </>}
                                  {item.estimatedMinutes != null && (
                                    <>Est. {item.estimatedMinutes} {item.estimatedDurationUnit}</>
                                  )}
                                </p>
                                {item.inputType === 'measurement' && (
                                  <div className="mt-1 space-y-0.5">
                                    {(item.method || item.acceptableMin != null || item.acceptableMax != null) && (
                                      <p className="text-xs text-gray-500">
                                        Spec (set by supervisor):{' '}
                                        {item.method && <>{item.method} · </>}
                                        {(item.acceptableMin != null || item.acceptableMax != null) && (
                                          <>Acceptable {item.acceptableMin ?? ''}–{item.acceptableMax ?? ''}{item.unit ? ` ${item.unit}` : ''}</>
                                        )}
                                      </p>
                                    )}
                                    {item.actualValue != null ? (
                                      <p className="text-xs text-gray-700">
                                        Actual value:{' '}
                                        <span className="font-semibold">{item.actualValue}{item.unit ? ` ${item.unit}` : ''}</span>
                                        {item.result && (
                                          <span className={`ml-1 font-semibold ${item.result === 'pass' ? 'text-emerald-600' : 'text-red-600'}`}>
                                            ({item.result})
                                          </span>
                                        )}
                                        {item.completedByName && <> · by {item.completedByName}</>}
                                      </p>
                                    ) : (
                                      <p className="text-xs text-gray-400 italic">No reading recorded yet.</p>
                                    )}
                                  </div>
                                )}
                                {item.repairNote && (
                                  <p className="text-xs text-gray-600 mt-0.5 italic">Repair note: {item.repairNote}</p>
                                )}
                                {item.isCompleted && (
                                  <p className="text-xs text-emerald-600 mt-0.5">
                                    ✓ {item.completedByName || ''}
                                    {item.completedAt?.toDate && ` · ${item.completedAt.toDate().toLocaleString()}`}
                                  </p>
                                )}
                                {item.completionNote && (
                                  <p className="text-xs text-gray-600 mt-0.5 italic">Note: {item.completionNote}</p>
                                )}
                              </div>
                              {item.isCompleted && (
                                <span className="text-emerald-500 text-lg flex-shrink-0">✓</span>
                              )}
                            </li>
                          ))}
                        </ol>
                      </>
                    );
                  })()}
                </>
              )}
            </div>
          )}

          {/* ── Documents ── */}
          {activeTab === 'documents' && (
            <div className="space-y-4">
              {workOrder.documents.length === 0 ? (
                <p className="text-sm text-gray-400 py-6 text-center">No documents uploaded.</p>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {workOrder.documents.map((doc) => (
                    <a
                      key={doc.id}
                      href={doc.url}
                      target="_blank"
                      rel="noreferrer"
                      className="group bg-gray-50 rounded-xl p-4 flex flex-col items-center gap-2 hover:bg-blue-50 transition-colors border border-gray-100"
                    >
                      <span className="text-3xl">
                        {doc.fileType === 'image' ? '🖼️' :
                         doc.fileType === 'cad' ? '📐' :
                         doc.fileType === 'video' ? '🎬' :
                         doc.fileType === 'compressed' ? '🗜️' : '📄'}
                      </span>
                      <span className="text-xs text-gray-700 text-center truncate w-full">{doc.name}</span>
                      <span className="text-xs text-gray-400">{doc.format}</span>
                    </a>
                  ))}
                </div>
              )}
              {workOrder.finalPhotos.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Completion Photos</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {workOrder.finalPhotos.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noreferrer">
                        <img
                          src={url}
                          alt={`Final photo ${i + 1}`}
                          className="aspect-square rounded-lg object-cover w-full hover:opacity-90"
                        />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Parts ── */}
          {activeTab === 'parts' && (
            <div className="space-y-4">
              {/* Inventory items used during the WO (recorded at completion) */}
              {(workOrder.partsUsed ?? []).length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                    Parts Used During This WO
                  </h3>
                  <div className="space-y-2">
                    {workOrder.partsUsed.map((part, i) => (
                      <div key={i} className="flex items-center gap-3 bg-green-50 border border-green-100 rounded-lg px-4 py-3">
                        <div className="flex-1 min-w-0">
                          {/* Explicit dark green text — the light bg-green-50 card
                              sits on the app's dark theme, which would otherwise
                              force this (gray) text light and unreadable. */}
                          <p className="text-sm font-medium text-green-950 truncate">{part.partName}</p>
                          <p className="text-xs text-green-700">
                            {part.quantity} {part.unit} · {part.source === 'stock' ? 'From store stock' : 'External purchase'}
                            {part.warrantyMonths ? ` · ${part.warrantyMonths}mo warranty` : ''}
                          </p>
                        </div>
                        <span className="text-sm font-semibold text-green-900 whitespace-nowrap">
                          {part.totalCost > 0 ? `LKR ${part.totalCost.toLocaleString()}` : ''}
                        </span>
                      </div>
                    ))}
                    <div className="flex justify-end text-sm text-green-800">
                      Total parts cost:&nbsp;
                      <span className="font-semibold text-green-950">
                        LKR {workOrder.partsUsed.reduce((s, p) => s + (p.totalCost ?? 0), 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {(workOrder.partsRequests ?? []).length === 0 && (workOrder.partsUsed ?? []).length === 0 ? (
                <p className="text-sm text-gray-400 py-6 text-center">No parts requested.</p>
              ) : (workOrder.partsRequests ?? []).length === 0 ? null : (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    Pre-Requested Parts
                  </h3>
                  {(workOrder.partsRequests ?? []).map((req) => (
                    <div key={req.id} className="flex items-center gap-3 bg-gray-50 rounded-lg px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{req.partName}</p>
                        <p className="text-xs text-gray-400">{req.partNumber} · {req.quantity} {req.unit}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        req.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                        req.status === 'rejected' ? 'bg-red-100 text-red-700' :
                        req.status === 'issued' ? 'bg-blue-100 text-blue-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {req.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── History ── */}
          {activeTab === 'history' && (
            <div className="space-y-0">
              {workOrder.statusHistory.length === 0 ? (
                <p className="text-sm text-gray-400 py-6 text-center">No status history.</p>
              ) : (
                <ol className="relative border-l-2 border-gray-200 ml-3 space-y-6">
                  {workOrder.statusHistory.map((entry, i) => (
                    <li key={i} className="ml-4">
                      <div className="absolute -left-2 h-4 w-4 rounded-full bg-blue-500 ring-2 ring-white" />
                      <WOStatusBadge status={entry.status} size="sm" />
                      <p className="text-xs text-gray-500 mt-1">
                        {entry.changedByName} ·{' '}
                        {entry.changedAt?.toDate?.().toLocaleString() ?? ''}
                      </p>
                      {entry.note && (
                        <p className="text-xs text-gray-600 mt-0.5 italic">"{entry.note}"</p>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}

          {/* Completion form (inline) */}
          {showCompletionForm && (
            <WOCompletionForm
              workOrder={workOrder}
              onCompleted={() => setShowCompletionForm(false)}
              onCancel={() => setShowCompletionForm(false)}
            />
          )}

          {/* Sign-off panel */}
          {showSignOff && (
            <div className="bg-white border-2 border-blue-100 rounded-xl p-5 space-y-4">
              <div>
                <h3 className="font-semibold text-gray-900">{WO_COPY.signOffTitle}</h3>
                <p className="text-sm text-gray-600">{WO_COPY.signOffInstructions}</p>
              </div>
              <WOSignOffForm
                workOrder={workOrder}
                onCancel={() => setShowSignOff(false)}
                onDone={() => {
                  setShowSignOff(false);
                  onClose();
                }}
              />
            </div>
          )}

          {/* Cancel confirm */}
          {showCancelConfirm && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
              <p className="text-sm font-medium text-red-800">Cancel this work order?</p>
              <textarea
                rows={2}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder={WO_COPY.cancelReasonPlaceholder}
                className="w-full rounded-lg border border-red-200 px-3 py-2 text-sm resize-none"
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowCancelConfirm(false)}
                  className="flex-1 py-2 text-sm text-gray-600"
                >
                  Keep WO
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await updateStatus(workOrder.id, 'CANCELLED', cancelReason);
                    setShowCancelConfirm(false);
                  }}
                  disabled={statusLoading}
                  className="flex-1 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  Confirm Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Action bar */}
        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4">
          {isSupervisor && !showCompletionForm && !showSignOff && (
            <div className="flex flex-wrap gap-2">
              {/* Edit drawer not yet wired — button hidden to avoid no-op. */}
              {['OPEN', 'ASSIGNED'].includes(workOrder.status) && (
                <button
                  type="button"
                  onClick={handleCheckInAndStart}
                  disabled={statusLoading}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {WO_COPY.checkInButton}
                </button>
              )}
              {['ON_HOLD_PARTS', 'ON_HOLD_APPROVAL'].includes(workOrder.status) && (
                <button
                  type="button"
                  onClick={() => updateStatus(workOrder.id, 'IN_PROGRESS')}
                  disabled={statusLoading}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  Resume Work
                </button>
              )}
              {workOrder.status === 'COMPLETED' && (
                <button
                  type="button"
                  onClick={() => setShowSignOff(true)}
                  className="flex-1 px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700"
                >
                  Sign Off &amp; Close
                </button>
              )}
              {['IN_PROGRESS', 'ON_HOLD_PARTS', 'ON_HOLD_APPROVAL'].includes(workOrder.status) && (
                <button
                  type="button"
                  onClick={() => setShowCompletionForm(true)}
                  className="flex-1 px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700"
                >
                  {WO_COPY.completeButton}
                </button>
              )}
              {!['CLOSED', 'CANCELLED', 'SIGNED_OFF'].includes(workOrder.status) && (
                <button
                  type="button"
                  onClick={() => setShowCancelConfirm(true)}
                  className="flex-1 min-w-fit px-3 py-2 text-sm border border-red-200 text-red-600 rounded-lg hover:bg-red-50"
                >
                  {WO_COPY.cancelWOButton}
                </button>
              )}
            </div>
          )}

          {isTechnician && isAssigned && !showCompletionForm && (
            <div className="flex flex-wrap gap-2">
              {['OPEN', 'ASSIGNED'].includes(workOrder.status) && (
                <button
                  type="button"
                  onClick={handleCheckInAndStart}
                  disabled={statusLoading}
                  className="flex-1 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {WO_COPY.checkInButton}
                </button>
              )}
              {['ON_HOLD_PARTS', 'ON_HOLD_APPROVAL'].includes(workOrder.status) && (
                <button
                  type="button"
                  onClick={() => updateStatus(workOrder.id, 'IN_PROGRESS')}
                  disabled={statusLoading}
                  className="flex-1 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  Resume Work
                </button>
              )}
              {workOrder.status === 'IN_PROGRESS' && (
                <>
                  <button
                    type="button"
                    onClick={() => updateStatus(workOrder.id, 'ON_HOLD_PARTS')}
                    className="flex-1 py-2 border border-amber-300 text-amber-700 text-sm rounded-lg hover:bg-amber-50"
                  >
                    Parts Needed
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCompletionForm(true)}
                    className="flex-1 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700"
                  >
                    {WO_COPY.completeButton}
                  </button>
                </>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
