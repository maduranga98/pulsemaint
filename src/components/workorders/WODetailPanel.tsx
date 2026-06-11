import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import type { WorkOrder } from '../../types/workOrder';
import type { IsolationPoint } from '../../types/machine';
import { WO_COPY } from '../../constants/copy';
import { WOTypeBadge } from './WOTypeBadge';
import { PriorityBadge } from './PriorityBadge';
import { WOStatusBadge } from './WOStatusBadge';
import { SLACountdownTimer } from './SLACountdownTimer';
import { WOCompletionForm } from './WOCompletionForm';
import { SignatureCanvas } from './SignatureCanvas';
import { LotoGate } from './LotoGate';
import { useUpdateWorkOrder } from '../../hooks/useUpdateWorkOrder';
import { useSignOff } from '../../hooks/useSignOff';
import { useAuthStore } from '../../store/authStore';
import { db } from '../../lib/firebase';
import { CommentThread } from '../comments/CommentThread';

type TabKey = 'overview' | 'checklist' | 'documents' | 'parts' | 'history' | 'permits' | 'comments';

interface WODetailPanelProps {
  workOrder: WorkOrder;
  onClose: () => void;
  fullPage?: boolean;
}

export function WODetailPanel({ workOrder, onClose, fullPage = false }: WODetailPanelProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [showCompletionForm, setShowCompletionForm] = useState(false);
  const [showSignOff, setShowSignOff] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [signOffNotes, setSignOffNotes] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [machineIsolationPoints, setMachineIsolationPoints] = useState<IsolationPoint[]>([]);

  const { updateStatus, loading: statusLoading } = useUpdateWorkOrder();
  const { signOff, loading: signOffLoading } = useSignOff();
  const user = useAuthStore((s) => s.user);
  const userProfile = useAuthStore((s) => s.userProfile);
  const role = (userProfile?.role ?? '') as string;

  const isSupervisor = ['supervisor', 'maintenance_supervisor', 'plant_manager', 'admin'].includes(role);
  const isTechnician = role === 'technician';
  // Assignment may be stored under the Firebase Auth uid or the user profile id.
  const myIds = [user?.uid, userProfile?.id].filter(Boolean) as string[];
  const isAssigned = workOrder.assignedTechnicianIds.some((id) => myIds.includes(id));

  // Fetch machine isolation points when permits tab is active
  useEffect(() => {
    if (activeTab !== 'permits' || !workOrder.machineId) return;
    getDoc(doc(db, 'machines', workOrder.machineId))
      .then((snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setMachineIsolationPoints((data.isolationPoints as IsolationPoint[]) ?? []);
        }
      })
      .catch((err) => console.error('Failed to load machine isolation points', err));
  }, [activeTab, workOrder.machineId]);

  const TABS: { key: TabKey; label: string }[] = [
    { key: 'overview', label: WO_COPY.tabOverview },
    { key: 'checklist', label: WO_COPY.tabChecklist },
    { key: 'documents', label: WO_COPY.tabDocuments },
    { key: 'parts', label: WO_COPY.tabParts },
    { key: 'history', label: WO_COPY.tabHistory },
    { key: 'permits', label: 'LOTO/PTW' },
    { key: 'comments', label: 'Comments' },
  ];

  async function handleSignOff() {
    if (!signature) return;
    await signOff(workOrder.id, workOrder.siteId, { signature, notes: signOffNotes });
    setShowSignOff(false);
  }

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
              <h1 className="font-bold text-xl text-gray-900">{workOrder.woNumber || '—'}</h1>
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
                </div>
              </section>

              {/* Completion info (if completed) */}
              {workOrder.workDoneDescription && (
                <section className="bg-emerald-50 rounded-xl p-4 space-y-2">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Completion</h3>
                  <p className="text-sm text-gray-800">{workOrder.workDoneDescription}</p>
                  {workOrder.testRunResult && (
                    <p className="text-sm">
                      Test run:
                      <span className={`ml-1 font-semibold ${
                        workOrder.testRunResult === 'pass' ? 'text-emerald-600' :
                        workOrder.testRunResult === 'fail' ? 'text-red-600' : 'text-amber-600'
                      }`}>
                        {workOrder.testRunResult}
                      </span>
                    </p>
                  )}
                  {workOrder.machineStatusAfterRepair && (
                    <p className="text-sm text-gray-700">
                      Machine: <span className="font-medium">{workOrder.machineStatusAfterRepair.replace(/_/g, ' ')}</span>
                    </p>
                  )}
                </section>
              )}
            </div>
          )}

          {/* ── Checklist ── */}
          {activeTab === 'checklist' && (
            <div className="space-y-3">
              {workOrder.checklist.length === 0 ? (
                <p className="text-sm text-gray-400 py-6 text-center">No checklist steps defined.</p>
              ) : (
                <>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 transition-all"
                      style={{
                        width: `${
                          workOrder.checklist.length > 0
                            ? (workOrder.checklist.filter((i) => i.isCompleted).length /
                              workOrder.checklist.length) *
                              100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-gray-500">
                    {workOrder.checklist.filter((i) => i.isCompleted).length} / {workOrder.checklist.length} completed
                  </p>
                  <ol className="space-y-2">
                    {workOrder.checklist.map((item, i) => (
                      <li key={i} className="flex items-start gap-3 bg-gray-50 rounded-lg px-4 py-3">
                        <span className="flex-shrink-0 h-6 w-6 flex items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-bold mt-0.5">
                          {item.stepNumber}
                        </span>
                        <div className="flex-1">
                          <p className={`text-sm ${item.isCompleted ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                            {item.stepDescription}
                          </p>
                          {item.assignedTechnicianName && (
                            <p className="text-xs text-gray-400 mt-0.5">→ {item.assignedTechnicianName}</p>
                          )}
                          {item.isCompleted && item.completedByName && (
                            <p className="text-xs text-emerald-600 mt-0.5">✓ {item.completedByName}</p>
                          )}
                        </div>
                        {item.isCompleted && (
                          <span className="text-emerald-500 text-lg flex-shrink-0">✓</span>
                        )}
                      </li>
                    ))}
                  </ol>
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
              {workOrder.partsRequests.length === 0 ? (
                <p className="text-sm text-gray-400 py-6 text-center">No parts requested.</p>
              ) : (
                <div className="space-y-2">
                  {workOrder.partsRequests.map((req) => (
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

          {/* ── LOTO/PTW Permits ── */}
          {activeTab === 'permits' && (
            <LotoGate workOrder={workOrder} machineIsolationPoints={machineIsolationPoints} />
          )}

          {activeTab === 'comments' && (
            <CommentThread
              parentType="workOrders"
              parentId={workOrder.id}
              parentLink={`/app/work-orders?woId=${workOrder.id}`}
              parentLabel={workOrder.woNumber || 'Work Order'}
            />
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
              <h3 className="font-semibold text-gray-900">{WO_COPY.signOffTitle}</h3>
              <p className="text-sm text-gray-600">{WO_COPY.signOffInstructions}</p>
              <SignatureCanvas onSave={(dataUrl) => setSignature(dataUrl)} />
              {signature && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Preview:</p>
                  <img src={signature} alt="Signature preview" className="h-20 border border-gray-200 rounded" />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{WO_COPY.signOffNotesLabel}</label>
                <textarea
                  rows={2}
                  value={signOffNotes}
                  onChange={(e) => setSignOffNotes(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowSignOff(false)}
                  className="flex-1 py-2 text-sm text-gray-600 hover:text-gray-900"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSignOff}
                  disabled={!signature || signOffLoading}
                  className="flex-1 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                >
                  {signOffLoading ? 'Signing…' : WO_COPY.confirmSignOffButton}
                </button>
              </div>
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
              {workOrder.status === 'COMPLETED' && (
                <button
                  type="button"
                  onClick={() => setShowSignOff(true)}
                  className="flex-1 px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700"
                >
                  {WO_COPY.signOffButton}
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
              {workOrder.status === 'ASSIGNED' && (
                <button
                  type="button"
                  onClick={() => updateStatus(workOrder.id, 'IN_PROGRESS')}
                  disabled={statusLoading}
                  className="flex-1 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {WO_COPY.checkInButton}
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
