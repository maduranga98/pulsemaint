import { useState, useEffect } from 'react';
import { Plus, X, ClipboardList, User, Calendar, TrendingUp } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import EvaluationForm, { type FormData } from '../components/EvaluationForm';
import { fetchEvaluations, submitEvaluation } from '../services/evaluation.service';
import type { EvaluationSession } from '../types/evaluation.types';
import { EVALUATION_ROLE_LABELS } from '../types/evaluation.types';

export default function EvaluationsPage() {
  const userProfile = useAuthStore((s) => s.userProfile);
  const companyId = userProfile?.companyId ?? '';

  const [sessions, setSessions] = useState<EvaluationSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<EvaluationSession | null>(null);

  async function load() {
    if (!companyId) return;
    try {
      setSessions(await fetchEvaluations(companyId));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [companyId]);

  async function handleSubmit(data: FormData) {
    await submitEvaluation({
      companyId,
      evaluateeId: '',
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
      status: 'submitted',
      evaluationDate: data.evaluationDate,
    });
    setShowForm(false);
    void load();
  }

  const scoreColor = (score: number) =>
    score >= 80 ? 'text-emerald-600' : score >= 60 ? 'text-blue-600' : score >= 40 ? 'text-amber-600' : 'text-red-600';
  const scoreBg = (score: number) =>
    score >= 80 ? 'bg-emerald-50 border-emerald-200' : score >= 60 ? 'bg-blue-50 border-blue-200' : score >= 40 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200';

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Performance Evaluations</h1>
          <p className="text-sm text-slate-500 mt-0.5">Conduct formal performance assessments for all roles.</p>
        </div>
        <button
          type="button"
          onClick={() => { setShowForm(true); setSelected(null); }}
          className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          New Evaluation
        </button>
      </div>

      {showForm && !selected && (
        <div className="mb-6">
          <EvaluationForm
            companyId={companyId}
            evaluatorId={userProfile?.id ?? ''}
            evaluatorName={userProfile?.fullName ?? ''}
            onSubmit={handleSubmit}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      {/* Evaluation Detail Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/50 p-4 overflow-y-auto">
          <div className="my-4 w-full max-w-2xl rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-slate-900">{selected.evaluateeName}</h2>
                <p className="text-sm text-slate-500">{EVALUATION_ROLE_LABELS[selected.evaluateeRole]}{selected.evaluateeJobTitle ? ` · ${selected.evaluateeJobTitle}` : ''}</p>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-700">
                <X className="h-5 w-5" />
              </button>
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
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-800">Criteria Scores</p>
                {selected.criteria.map((c) => (
                  <div key={c.criterionId} className="flex items-center justify-between border-b border-gray-100 pb-2 last:border-0">
                    <span className="text-sm text-gray-700">{c.label}</span>
                    <div className="text-right">
                      <span className={`text-sm font-semibold ${c.score ? (c.score >= 4 ? 'text-emerald-600' : c.score >= 3 ? 'text-blue-600' : 'text-red-600') : 'text-gray-400'}`}>
                        {c.score ? `${c.score}/5` : '—'}
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
            </div>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[200px]">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[300px] text-center">
          <ClipboardList className="w-12 h-12 text-gray-300 mb-3" />
          <p className="font-medium text-gray-700">No evaluations yet</p>
          <p className="text-sm text-gray-500 mt-1">Create the first performance evaluation above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => (
            <button
              key={session.id}
              type="button"
              onClick={() => setSelected(session)}
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
                      {EVALUATION_ROLE_LABELS[session.evaluateeRole]}
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
