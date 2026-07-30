import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X, ClipboardList, Calendar, TrendingUp, Download,
  GraduationCap, ArrowUpCircle, ArrowDownCircle, Settings2, Clock,
  HardHat, Wrench, ShieldCheck, Building2, GraduationCap as CapIcon, Users, Layers,
  UserCog, ShieldAlert,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useDepartments } from '@/hooks/useDepartments';
import EvaluationForm, { type FormData } from '../components/EvaluationForm';
import EvaluationTemplateBuilder from '../components/EvaluationTemplateBuilder';
import {
  fetchEvaluations,
  subscribeEvaluations,
  submitEvaluation,
  saveDraftEvaluation,
  updateEvaluation,
  logEvaluationAction,
  updateEvaluateePosition,
} from '../services/evaluation.service';
import { downloadEvaluationPdf } from '../utils/evaluationPdf';
import type { EvaluationSession, EvaluationActionType, EvaluationRole, EvaluationTargetType } from '../types/evaluation.types';
import { EVALUATION_ROLE_LABELS } from '../types/evaluation.types';

const CAN_MANAGE_TEMPLATES_ROLES = ['plant_manager', 'admin', 'hr_officer'];
const CAN_ASSIGN_TRAINING_ROLES = ['supervisor', 'plant_manager', 'admin', 'hr_officer'];

type StatusFilter = 'submitted' | 'draft';
type ViewMode = 'role' | 'department';

/** Human label for an evaluation row/detail header, department-aware. */
function evaluateeSubtitle(s: EvaluationSession): string {
  if ((s.targetType ?? 'individual') === 'department') return 'Department Evaluation';
  return EVALUATION_ROLE_LABELS[s.evaluateeRole] ?? s.evaluateeRole;
}

const ROLE_ORDER: EvaluationRole[] = ['operator', 'technician', 'supervisor', 'plant_manager', 'hr_officer', 'safety_officer', 'trainee', 'other'];
const ROLE_ICON: Record<EvaluationRole, typeof HardHat> = {
  operator: HardHat,
  technician: Wrench,
  supervisor: ShieldCheck,
  plant_manager: Building2,
  hr_officer: UserCog,
  safety_officer: ShieldAlert,
  trainee: CapIcon,
  other: Users,
};

export default function EvaluationsPage() {
  const navigate = useNavigate();
  const userProfile = useAuthStore((s) => s.userProfile);
  const companyId = userProfile?.companyId ?? '';
  const role = userProfile?.role;
  const canManageTemplates = !!role && CAN_MANAGE_TEMPLATES_ROLES.includes(role);
  const canAssignTraining = !!role && CAN_ASSIGN_TRAINING_ROLES.includes(role);
  // Plant managers don't evaluate (or get listed as evaluatees in) the
  // "Plant Manager" category — no self-evaluation for that role.
  const visibleRoleOrder = role === 'plant_manager' ? ROLE_ORDER.filter((r) => r !== 'plant_manager') : ROLE_ORDER;
  const { departments } = useDepartments(companyId);

  const [sessions, setSessions] = useState<EvaluationSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newEvalTarget, setNewEvalTarget] = useState<EvaluationTargetType>('individual');
  const [showTemplateBuilder, setShowTemplateBuilder] = useState(false);
  const [selected, setSelected] = useState<EvaluationSession | null>(null);
  const [editingSession, setEditingSession] = useState<EvaluationSession | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('submitted');
  const [viewMode, setViewMode] = useState<ViewMode>('role');
  const [roleFilter, setRoleFilter] = useState<EvaluationRole | null>(null);
  const [deptFilter, setDeptFilter] = useState<string | null>(null);
  const [positionNote, setPositionNote] = useState('');
  const [actionBusy, setActionBusy] = useState<EvaluationActionType | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [loadError, setLoadError] = useState<string | null>(null);

  async function load() {
    if (!companyId) return;
    try {
      setLoadError(null);
      setSessions(await fetchEvaluations(companyId));
    } catch (err) {
      // Surface the failure — a silently swallowed error here made finished
      // evaluations look like they were never saved.
      setLoadError(err instanceof Error ? err.message : 'Failed to load evaluations.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!companyId) return;
    setLoadError(null);
    // Live list so submitted/updated evaluations appear immediately.
    const unsub = subscribeEvaluations(
      companyId,
      (rows) => { setSessions(rows); setLoading(false); },
      (message) => { setLoadError(message); setLoading(false); },
    );
    return () => unsub();
  }, [companyId]);

  function buildSessionPayload(data: FormData) {
    return {
      companyId,
      targetType: data.targetType,
      evaluateeId: data.evaluateeId,
      evaluateeName: data.evaluateeName,
      evaluateeRole: data.evaluateeRole,
      evaluateeJobTitle: data.evaluateeJobTitle,
      evaluateeEmployeeId: data.evaluateeEmployeeId || null,
      evaluateeCustomRole: data.evaluateeCustomRole || null,
      evaluatorId: userProfile?.id ?? '',
      evaluatorName: userProfile?.fullName ?? '',
      criteria: data.criteria,
      overallScore: data.overallScore,
      overallComments: data.overallComments,
      developmentPlan: data.developmentPlan,
      attachments: data.attachments,
      templateId: data.templateId,
      templateName: data.templateName,
      actionLog: editingSession?.actionLog ?? [],
      evaluationDate: data.evaluationDate,
    };
  }

  async function handleSubmit(data: FormData) {
    const payload = buildSessionPayload(data);
    if (editingSession) {
      await updateEvaluation(editingSession.id, payload, 'submitted');
    } else {
      await submitEvaluation({ ...payload, status: 'submitted' });
    }
    setShowForm(false);
    setEditingSession(null);
    setStatusFilter('submitted');
    void load();
  }

  async function handleSaveDraft(data: FormData) {
    const payload = buildSessionPayload(data);
    if (editingSession) {
      await updateEvaluation(editingSession.id, payload, 'draft');
    } else {
      await saveDraftEvaluation({ ...payload, status: 'draft' });
    }
    setShowForm(false);
    setEditingSession(null);
    setStatusFilter('draft');
    void load();
  }

  async function handleAssignTraining() {
    if (!selected) return;
    setActionBusy('training_assigned');
    setActionError(null);
    try {
      await logEvaluationAction(selected.id, {
        type: 'training_assigned',
        note: `Training assignment initiated from evaluation dated ${selected.evaluationDate}.`,
        actorId: userProfile?.id ?? '',
        actorName: userProfile?.fullName ?? '',
      });
      navigate(`/app/training/manage/assign?traineeId=${selected.evaluateeId}`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to log action.');
    } finally {
      setActionBusy(null);
    }
  }

  async function handlePositionAction(direction: 'position_upgraded' | 'position_degraded') {
    if (!selected || !positionNote.trim()) {
      setActionError('Enter the new position / job title first.');
      return;
    }
    setActionBusy(direction);
    setActionError(null);
    try {
      await updateEvaluateePosition(companyId, selected.evaluateeId, positionNote.trim());
      const note = `${direction === 'position_upgraded' ? 'Upgraded' : 'Degraded'} to "${positionNote.trim()}" (was "${selected.evaluateeJobTitle || 'unset'}").`;
      await logEvaluationAction(selected.id, {
        type: direction,
        note,
        actorId: userProfile?.id ?? '',
        actorName: userProfile?.fullName ?? '',
      });
      setPositionNote('');
      await load();
      const refreshed = await fetchEvaluations(companyId);
      setSelected(refreshed.find((s) => s.id === selected.id) ?? null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update position.');
    } finally {
      setActionBusy(null);
    }
  }

  const scoreColor = (score: number) =>
    score >= 80 ? 'text-emerald-600' : score >= 60 ? 'text-blue-600' : score >= 40 ? 'text-amber-600' : 'text-red-600';
  const scoreBg = (score: number) =>
    score >= 80 ? 'bg-emerald-50 border-emerald-200' : score >= 60 ? 'bg-blue-50 border-blue-200' : score >= 40 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200';

  function matchesView(s: EvaluationSession): boolean {
    const isDept = (s.targetType ?? 'individual') === 'department';
    if (viewMode === 'department') return isDept && (!deptFilter || s.evaluateeName === deptFilter);
    return !isDept && (!roleFilter || s.evaluateeRole === roleFilter);
  }

  const filteredSessions = sessions.filter((s) => s.status === statusFilter && matchesView(s));

  const [formKey, setFormKey] = useState(0);

  function openIndividualEval(r: EvaluationRole) {
    setRoleFilter(r);
    setNewEvalTarget('individual');
    setSelected(null);
    setShowForm(true);
    setFormKey((k) => k + 1);
  }

  function openDepartmentEval(d: string) {
    setDeptFilter(d);
    setNewEvalTarget('department');
    setSelected(null);
    setShowForm(true);
    setFormKey((k) => k + 1);
  }

  function handleRowClick(session: EvaluationSession) {
    if (session.status === 'draft') {
      // Resume the paused draft instead of opening the read-only detail view.
      setEditingSession(session);
      setNewEvalTarget(session.targetType ?? 'individual');
      setSelected(null);
      setShowForm(true);
      setFormKey((k) => k + 1);
    } else {
      setSelected(session);
    }
  }

  function closeForm() {
    setShowForm(false);
    setEditingSession(null);
  }

  const ACTION_LABEL: Record<EvaluationActionType, string> = {
    training_assigned: 'Training Assigned',
    position_upgraded: 'Position Upgraded',
    position_degraded: 'Position Degraded',
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Performance Evaluations</h1>
          <p className="text-sm text-slate-500 mt-0.5">Conduct formal performance assessments for all roles.</p>
        </div>
        <div className="flex items-center gap-2">
          {canManageTemplates && (
            <button
              type="button"
              onClick={() => setShowTemplateBuilder(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              <Settings2 className="h-4 w-4" />
              Custom Forms
            </button>
          )}
        </div>
      </div>
      <p className="mb-4 -mt-4 text-xs text-gray-400">
        Click a category below to start an evaluation for it.
      </p>

      {/* Category view toggle */}
      <div className="mb-3 flex items-center gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {([
          { id: 'role' as const, label: 'By Role' },
          { id: 'department' as const, label: 'By Department' },
        ]).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => { setViewMode(tab.id); closeForm(); }}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              viewMode === tab.id ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Categories */}
      {viewMode === 'role' ? (
        <div key="role-grid" className="mb-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <button
            type="button"
            onClick={() => { setRoleFilter(null); closeForm(); }}
            className={`rounded-xl border p-3 text-left transition-colors ${
              roleFilter === null ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white hover:border-blue-200'
            }`}
          >
            <ClipboardList className={`h-5 w-5 mb-2 ${roleFilter === null ? 'text-blue-600' : 'text-gray-400'}`} />
            <p className="text-sm font-semibold text-gray-900">All</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {sessions.filter((s) => (s.targetType ?? 'individual') !== 'department').length} evaluation
              {sessions.length !== 1 ? 's' : ''}
            </p>
          </button>
          {visibleRoleOrder.map((r) => {
            const RoleIcon = ROLE_ICON[r];
            const count = sessions.filter(
              (s) => (s.targetType ?? 'individual') !== 'department' && s.evaluateeRole === r,
            ).length;
            const active = roleFilter === r;
            return (
              <button
                key={r}
                type="button"
                onClick={() => {
                  if (active) { setRoleFilter(null); closeForm(); } else { openIndividualEval(r); }
                }}
                className={`rounded-xl border p-3 text-left transition-colors ${
                  active ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white hover:border-blue-200'
                }`}
              >
                <RoleIcon className={`h-5 w-5 mb-2 ${active ? 'text-blue-600' : 'text-gray-400'}`} />
                <p className="text-sm font-semibold text-gray-900">{EVALUATION_ROLE_LABELS[r]}</p>
                <p className="text-xs text-gray-500 mt-0.5">{count} evaluation{count !== 1 ? 's' : ''}</p>
              </button>
            );
          })}
        </div>
      ) : (
        <div key="department-grid" className="mb-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <button
            type="button"
            onClick={() => { setDeptFilter(null); closeForm(); }}
            className={`rounded-xl border p-3 text-left transition-colors ${
              deptFilter === null ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white hover:border-blue-200'
            }`}
          >
            <Layers className={`h-5 w-5 mb-2 ${deptFilter === null ? 'text-blue-600' : 'text-gray-400'}`} />
            <p className="text-sm font-semibold text-gray-900">All Departments</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {sessions.filter((s) => s.targetType === 'department').length} evaluation
              {sessions.length !== 1 ? 's' : ''}
            </p>
          </button>
          {departments.length === 0 ? (
            <p className="col-span-full text-sm text-gray-500 py-2">
              No departments set up yet — add one from the department picker when creating a department evaluation.
            </p>
          ) : (
            departments.map((d) => {
              const count = sessions.filter((s) => s.targetType === 'department' && s.evaluateeName === d).length;
              const active = deptFilter === d;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    if (active) { setDeptFilter(null); closeForm(); } else { openDepartmentEval(d); }
                  }}
                  className={`rounded-xl border p-3 text-left transition-colors ${
                    active ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white hover:border-blue-200'
                  }`}
                >
                  <Building2 className={`h-5 w-5 mb-2 ${active ? 'text-blue-600' : 'text-gray-400'}`} />
                  <p className="text-sm font-semibold text-gray-900">{d}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{count} evaluation{count !== 1 ? 's' : ''}</p>
                </button>
              );
            })
          )}
        </div>
      )}

      {showForm && !selected && (
        <div className="mb-6">
          <EvaluationForm
            key={formKey}
            companyId={companyId}
            evaluatorId={userProfile?.id ?? ''}
            evaluatorName={userProfile?.fullName ?? ''}
            targetType={newEvalTarget}
            initialRole={newEvalTarget === 'individual' ? roleFilter ?? undefined : undefined}
            initialDepartment={newEvalTarget === 'department' ? deptFilter ?? undefined : undefined}
            existing={editingSession ?? undefined}
            onSubmit={handleSubmit}
            onSaveDraft={handleSaveDraft}
            onCancel={closeForm}
          />
        </div>
      )}

      {showTemplateBuilder && (
        <EvaluationTemplateBuilder onClose={() => setShowTemplateBuilder(false)} />
      )}

      {/* Evaluation Detail Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/50 p-4 overflow-y-auto">
          <div className="my-4 w-full max-w-2xl rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-slate-900">{selected.evaluateeName}</h2>
                <p className="text-sm text-slate-500">
                  {evaluateeSubtitle(selected)}{selected.evaluateeJobTitle ? ` · ${selected.evaluateeJobTitle}` : ''}
                  {' · '}
                  <span className={selected.status === 'submitted' ? 'text-emerald-600' : 'text-amber-600'}>
                    {selected.status === 'submitted' ? 'Completed' : 'Ongoing (Draft)'}
                  </span>
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => downloadEvaluationPdf(selected)}
                  title="Download PDF"
                  className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-blue-600"
                >
                  <Download className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => { setSelected(null); setPositionNote(''); setActionError(null); }} className="text-slate-400 hover:text-slate-700 p-2">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="p-5 space-y-5">
              <div className="flex items-center gap-4">
                <div className={`rounded-lg border px-5 py-3 text-center ${scoreBg(selected.overallScore)}`}>
                  <p className={`text-3xl font-bold ${scoreColor(selected.overallScore)}`}>{selected.overallScore}%</p>
                  <p className="text-xs text-gray-500 mt-0.5">Overall Score</p>
                </div>
                <div className="flex-1 text-sm text-gray-600 space-y-1">
                  <p><span className="font-medium">Date:</span> {selected.evaluationDate}</p>
                  <p><span className="font-medium">Evaluator:</span> {selected.evaluatorName}</p>
                  {selected.evaluateeEmployeeId && <p><span className="font-medium">Employee ID:</span> {selected.evaluateeEmployeeId}</p>}
                  {selected.templateName && <p><span className="font-medium">Form:</span> {selected.templateName} (custom)</p>}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-800">Criteria Scores</p>
                {selected.criteria.map((c) => (
                  <div key={c.criterionId} className="flex items-center justify-between border-b border-gray-100 pb-2 last:border-0">
                    <span className="text-sm text-gray-700">{c.label}</span>
                    <div className="text-right">
                      <span className={`text-sm font-semibold ${c.score ? (c.score >= 4 ? 'text-emerald-600' : c.score >= 3 ? 'text-blue-600' : 'text-red-600') : 'text-gray-400'}`}>
                        {c.score ? `${c.score}/5` : ''}
                      </span>
                      {c.comments && <p className="text-xs text-gray-400 max-w-xs truncate">{c.comments}</p>}
                    </div>
                  </div>
                ))}
              </div>

              {selected.overallComments && (
                <div>
                  <p className="text-sm font-semibold text-gray-800 mb-1">Comments</p>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{selected.overallComments}</p>
                </div>
              )}
              {selected.developmentPlan && (
                <div>
                  <p className="text-sm font-semibold text-gray-800 mb-1">Development Plan</p>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{selected.developmentPlan}</p>
                </div>
              )}
              {selected.attachments.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-gray-800 mb-2">Attachments</p>
                  <div className="space-y-1">
                    {selected.attachments.map((a) => (
                      <a key={a.id} href={a.url} target="_blank" rel="noopener noreferrer" className="block text-sm text-blue-600 hover:underline truncate">
                        {a.name}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Post-evaluation actions (PM-124) */}
              {selected.status === 'submitted' && (
                <div className="rounded-lg border border-gray-200 p-4 space-y-3">
                  <p className="text-sm font-semibold text-gray-800">Actions on Final Mark</p>
                  <div className="flex flex-wrap gap-2">
                    {canAssignTraining && (
                      <button
                        type="button"
                        onClick={() => void handleAssignTraining()}
                        disabled={actionBusy !== null}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-60"
                      >
                        <GraduationCap className="h-3.5 w-3.5" /> Assign Training
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      value={positionNote}
                      onChange={(e) => setPositionNote(e.target.value)}
                      placeholder="New position / job title…"
                      className="flex-1 min-w-[180px] min-h-9 rounded-lg border border-gray-200 px-3 text-xs focus:border-blue-400 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => void handlePositionAction('position_upgraded')}
                      disabled={actionBusy !== null}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                    >
                      <ArrowUpCircle className="h-3.5 w-3.5" /> Upgrade
                    </button>
                    <button
                      type="button"
                      onClick={() => void handlePositionAction('position_degraded')}
                      disabled={actionBusy !== null}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
                    >
                      <ArrowDownCircle className="h-3.5 w-3.5" /> Degrade
                    </button>
                  </div>
                  {actionError && <p className="text-xs text-red-600">{actionError}</p>}

                  {selected.actionLog.length > 0 && (
                    <div className="pt-2 border-t border-gray-100 space-y-1.5">
                      {selected.actionLog.map((a) => (
                        <div key={a.id} className="flex items-start gap-2 text-xs text-gray-500">
                          <Clock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                          <span><span className="font-medium text-gray-700">{ACTION_LABEL[a.type]}</span> — {a.note} ({a.actorName})</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Recent Evaluations */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-bold text-gray-900">Recent Evaluations</h2>
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg w-fit">
          {([
            { id: 'submitted' as const, label: 'Completed' },
            { id: 'draft' as const, label: 'Ongoing' },
          ]).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                statusFilter === tab.id ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label} ({sessions.filter((s) => s.status === tab.id && matchesView(s)).length})
            </button>
          ))}
        </div>
      </div>

      {loadError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Failed to load evaluations: {loadError}
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[200px]">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
        </div>
      ) : filteredSessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[300px] text-center">
          <ClipboardList className="w-12 h-12 text-gray-300 mb-3" />
          <p className="font-medium text-gray-700">No {statusFilter === 'submitted' ? 'completed' : 'ongoing'} evaluations</p>
          <p className="text-sm text-gray-500 mt-1">
            {statusFilter === 'submitted' ? 'Submitted evaluations will appear here.' : 'Evaluations saved as drafts will appear here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSessions.map((session) => (
            <button
              key={session.id}
              type="button"
              onClick={() => handleRowClick(session)}
              className="w-full rounded-xl border border-gray-200 bg-white p-4 text-left hover:border-blue-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-700 shrink-0">
                    {(session.evaluateeName?.[0] ?? '?').toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{session.evaluateeName}</p>
                    <p className="text-sm text-gray-500 truncate">
                      {evaluateeSubtitle(session)}
                      {session.evaluateeJobTitle ? ` · ${session.evaluateeJobTitle}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Calendar className="w-3.5 h-3.5" />
                    {session.evaluationDate}
                  </div>
                  <div className={`flex items-center gap-1 text-sm font-bold ${scoreColor(session.overallScore)}`}>
                    <TrendingUp className="w-4 h-4" />
                    {session.overallScore}%
                  </div>
                  {session.attachments.length > 0 && (
                    <span className="text-xs text-gray-400">{session.attachments.length} file{session.attachments.length !== 1 ? 's' : ''}</span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
