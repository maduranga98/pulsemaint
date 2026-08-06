import { useState, useEffect } from 'react';
import {
  ClipboardList, Settings2,
  HardHat, Wrench, ShieldCheck, Building2, GraduationCap as CapIcon, Users, Layers,
  UserCog, ShieldAlert,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useDepartments } from '@/hooks/useDepartments';
import EvaluationForm, { type FormData } from '../components/EvaluationForm';
import EvaluationTemplateBuilder from '../components/EvaluationTemplateBuilder';
import { fetchEvaluations, subscribeEvaluations, submitEvaluation, saveDraftEvaluation } from '../services/evaluation.service';
import { downloadEvaluationPdf } from '../utils/evaluationPdf';
import type { EvaluationSession, EvaluationRole, EvaluationTargetType } from '../types/evaluation.types';
import { EVALUATION_ROLE_LABELS } from '../types/evaluation.types';

const CAN_MANAGE_TEMPLATES_ROLES = ['plant_manager', 'admin', 'hr_officer'];

type ViewMode = 'role' | 'department' | 'completed';

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
  const userProfile = useAuthStore((s) => s.userProfile);
  const companyId = userProfile?.companyId ?? '';
  const role = userProfile?.role;
  const canManageTemplates = !!role && CAN_MANAGE_TEMPLATES_ROLES.includes(role);
  // Plant managers don't evaluate (or get listed as evaluatees in) the
  // "Plant Manager" category — no self-evaluation for that role.
  const visibleRoleOrder = role === 'plant_manager' ? ROLE_ORDER.filter((r) => r !== 'plant_manager') : ROLE_ORDER;
  const { departments } = useDepartments(companyId);

  const [sessions, setSessions] = useState<EvaluationSession[]>([]);
  const [, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newEvalTarget, setNewEvalTarget] = useState<EvaluationTargetType>('individual');
  const [showTemplateBuilder, setShowTemplateBuilder] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('role');
  const [roleFilter, setRoleFilter] = useState<EvaluationRole | null>(null);
  const [deptFilter, setDeptFilter] = useState<string | null>(null);
  const [viewingSession, setViewingSession] = useState<EvaluationSession | null>(null);

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
      actionLog: [],
      evaluationDate: data.evaluationDate,
    };
  }

  async function handleSubmit(data: FormData) {
    await submitEvaluation({ ...buildSessionPayload(data), status: 'submitted' });
    setShowForm(false);
    void load();
  }

  async function handleSaveDraft(data: FormData) {
    await saveDraftEvaluation({ ...buildSessionPayload(data), status: 'draft' });
    setShowForm(false);
    void load();
  }

  const completedSessions = sessions
    .filter((s) => s.status === 'submitted')
    .sort((a, b) => (b.submittedAt?.toMillis?.() ?? 0) - (a.submittedAt?.toMillis?.() ?? 0));

  const [formKey, setFormKey] = useState(0);

  function closeForm() {
    setShowForm(false);
  }

  function openIndividualEval(r: EvaluationRole) {
    setRoleFilter(r);
    setNewEvalTarget('individual');
    setShowForm(true);
    setFormKey((k) => k + 1);
  }

  function openDepartmentEval(d: string) {
    setDeptFilter(d);
    setNewEvalTarget('department');
    setShowForm(true);
    setFormKey((k) => k + 1);
  }

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

      {loadError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Failed to load evaluations: {loadError}
        </div>
      )}

      {/* Category view toggle */}
      <div className="mb-3 flex items-center gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {([
          { id: 'role' as const, label: 'By Role' },
          { id: 'department' as const, label: 'By Department' },
          { id: 'completed' as const, label: 'Completed' },
        ]).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => { setViewMode(tab.id); setViewingSession(null); closeForm(); }}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              viewMode === tab.id ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Categories */}
      {viewMode === 'completed' ? (
        <div className="mb-6 space-y-3">
          {completedSessions.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">No completed evaluations yet.</p>
          ) : (
            <div className="rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden bg-white">
              {completedSessions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setViewingSession(s)}
                  className={`w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gray-50 ${
                    viewingSession?.id === s.id ? 'bg-blue-50' : ''
                  }`}
                >
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{s.evaluateeName}</p>
                    <p className="text-xs text-gray-500">
                      {(s.targetType ?? 'individual') === 'department' ? 'Department' : EVALUATION_ROLE_LABELS[s.evaluateeRole]}
                      {' · '}{s.evaluationDate}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-blue-700">{s.overallScore}%</span>
                </button>
              ))}
            </div>
          )}

          {viewingSession && (
            <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-gray-900">{viewingSession.evaluateeName}</h2>
                  <p className="text-xs text-gray-500">
                    {(viewingSession.targetType ?? 'individual') === 'department'
                      ? 'Department'
                      : EVALUATION_ROLE_LABELS[viewingSession.evaluateeRole]}
                    {' · '}{viewingSession.evaluationDate}
                    {' · '}Evaluated by {viewingSession.evaluatorName}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setViewingSession(null)}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Close
                </button>
              </div>

              <div className="rounded-lg bg-gray-50 p-4 text-center">
                <p className="text-xs font-medium text-gray-500">Overall Score</p>
                <p className="text-3xl font-bold text-blue-700">{viewingSession.overallScore}%</p>
              </div>

              <div className="space-y-2">
                {viewingSession.criteria.map((c) => (
                  <div key={c.criterionId} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">{c.label}</span>
                    <span className="font-semibold text-gray-900">{c.score ?? '—'}/5</span>
                  </div>
                ))}
              </div>

              {viewingSession.overallComments && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Overall Comments</h3>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{viewingSession.overallComments}</p>
                </div>
              )}

              {viewingSession.developmentPlan && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Development Plan</h3>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{viewingSession.developmentPlan}</p>
                </div>
              )}

              {viewingSession.attachments.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Attachments</h3>
                  <ul className="space-y-1">
                    {viewingSession.attachments.map((a) => (
                      <li key={a.id}>
                        <a href={a.url} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline">
                          {a.name}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex justify-end pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => downloadEvaluationPdf(viewingSession)}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Export PDF
                </button>
              </div>
            </div>
          )}
        </div>
      ) : viewMode === 'role' ? (
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

      {showForm && (
        <div className="mb-6">
          <EvaluationForm
            key={formKey}
            companyId={companyId}
            evaluatorId={userProfile?.id ?? ''}
            evaluatorName={userProfile?.fullName ?? ''}
            targetType={newEvalTarget}
            initialRole={newEvalTarget === 'individual' ? roleFilter ?? undefined : undefined}
            initialDepartment={newEvalTarget === 'department' ? deptFilter ?? undefined : undefined}
            onSubmit={handleSubmit}
            onSaveDraft={handleSaveDraft}
            onCancel={closeForm}
          />
        </div>
      )}

      {showTemplateBuilder && (
        <EvaluationTemplateBuilder onClose={() => setShowTemplateBuilder(false)} />
      )}
    </div>
  );
}
