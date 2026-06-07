import { useState, useRef } from 'react';
import { Paperclip, X, FileText, Image, Video, ChevronDown } from 'lucide-react';
import type {
  EvaluationRole,
  EvaluationCriterion,
  EvaluationCriterionResult,
  EvaluationAttachment,
  EvaluationCriterionScore,
} from '../types/evaluation.types';
import {
  EVALUATION_ROLE_LABELS,
  ROLE_CRITERIA,
} from '../types/evaluation.types';
import { uploadEvaluationAttachment } from '../services/evaluation.service';

interface EvaluationFormProps {
  companyId: string;
  evaluatorId: string;
  evaluatorName: string;
  onSubmit: (data: FormData) => Promise<void>;
  onCancel?: () => void;
}

export interface FormData {
  evaluateeName: string;
  evaluateeRole: EvaluationRole;
  evaluateeJobTitle: string;
  evaluateeEmployeeId: string;
  evaluateeCustomRole: string;
  criteria: EvaluationCriterionResult[];
  overallScore: number;
  overallComments: string;
  developmentPlan: string;
  attachments: EvaluationAttachment[];
  evaluationDate: string;
}

const SCORE_LABELS: Record<EvaluationCriterionScore, string> = {
  1: '1 – Unsatisfactory',
  2: '2 – Needs Improvement',
  3: '3 – Meets Expectations',
  4: '4 – Exceeds Expectations',
  5: '5 – Outstanding',
};

function computeWeightedScore(
  criteria: EvaluationCriterion[],
  results: EvaluationCriterionResult[],
): number {
  let totalWeight = 0;
  let weightedSum = 0;
  for (const c of criteria) {
    const r = results.find((res) => res.criterionId === c.id);
    if (r?.score) {
      weightedSum += (r.score / 5) * 100 * c.weight;
      totalWeight += c.weight;
    }
  }
  if (totalWeight === 0) return 0;
  return Math.round(weightedSum / totalWeight);
}

function AttachmentIcon({ type }: { type: EvaluationAttachment['type'] }) {
  if (type === 'image') return <Image className="w-4 h-4 text-blue-500" />;
  if (type === 'video') return <Video className="w-4 h-4 text-purple-500" />;
  return <FileText className="w-4 h-4 text-gray-500" />;
}

export default function EvaluationForm({
  companyId,
  evaluatorId,
  evaluatorName,
  onSubmit,
  onCancel,
}: EvaluationFormProps) {
  const [step, setStep] = useState<'info' | 'criteria' | 'summary'>('info');
  const [evaluateeName, setEvaluateeName] = useState('');
  const [evaluateeRole, setEvaluateeRole] = useState<EvaluationRole>('technician');
  const [evaluateeJobTitle, setEvaluateeJobTitle] = useState('');
  const [evaluateeEmployeeId, setEvaluateeEmployeeId] = useState('');
  const [evaluateeCustomRole, setEvaluateeCustomRole] = useState('');
  const [evaluationDate, setEvaluationDate] = useState(new Date().toISOString().slice(0, 10));
  const [criteriaResults, setCriteriaResults] = useState<EvaluationCriterionResult[]>([]);
  const [overallComments, setOverallComments] = useState('');
  const [developmentPlan, setDevelopmentPlan] = useState('');
  const [attachments, setAttachments] = useState<EvaluationAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const criteria = ROLE_CRITERIA[evaluateeRole];

  function initCriteria(role: EvaluationRole) {
    const roleCriteria = ROLE_CRITERIA[role];
    setCriteriaResults(
      roleCriteria.map((c) => ({
        criterionId: c.id,
        label: c.label,
        score: null,
        comments: '',
      })),
    );
  }

  function handleRoleChange(role: EvaluationRole) {
    setEvaluateeRole(role);
    initCriteria(role);
  }

  function updateResult(criterionId: string, patch: Partial<EvaluationCriterionResult>) {
    setCriteriaResults((prev) =>
      prev.map((r) => (r.criterionId === criterionId ? { ...r, ...patch } : r)),
    );
  }

  const overallScore = computeWeightedScore(
    criteria,
    criteriaResults.length === 0
      ? criteria.map((c) => ({ criterionId: c.id, label: c.label, score: null, comments: '' }))
      : criteriaResults,
  );

  async function handleFileUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    const tempId = `eval_${Date.now()}`;
    try {
      const newAttachments: EvaluationAttachment[] = [];
      for (const file of Array.from(files)) {
        const attachment = await uploadEvaluationAttachment(
          companyId,
          tempId,
          file,
          (pct) => setUploadProgress((prev) => ({ ...prev, [file.name]: pct })),
        );
        newAttachments.push(attachment);
      }
      setAttachments((prev) => [...prev, ...newAttachments]);
    } catch (err) {
      setError('Failed to upload attachment.');
    } finally {
      setUploading(false);
      setUploadProgress({});
    }
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  async function handleSubmit() {
    setError(null);
    if (!evaluateeName.trim()) { setError('Evaluatee name is required.'); return; }
    const allScored = criteriaResults.every((r) => r.score !== null);
    if (!allScored) { setError('Please score all criteria before submitting.'); return; }
    setSaving(true);
    try {
      const results =
        criteriaResults.length > 0
          ? criteriaResults
          : criteria.map((c) => ({ criterionId: c.id, label: c.label, score: null, comments: '' }));
      await onSubmit({
        evaluateeName: evaluateeName.trim(),
        evaluateeRole,
        evaluateeJobTitle: evaluateeJobTitle.trim(),
        evaluateeEmployeeId: evaluateeEmployeeId.trim(),
        evaluateeCustomRole: evaluateeCustomRole.trim(),
        criteria: results,
        overallScore,
        overallComments: overallComments.trim(),
        developmentPlan: developmentPlan.trim(),
        attachments,
        evaluationDate,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit evaluation.');
    } finally {
      setSaving(false);
    }
  }

  const scoreColor =
    overallScore >= 80
      ? 'text-emerald-600'
      : overallScore >= 60
        ? 'text-blue-600'
        : overallScore >= 40
          ? 'text-amber-600'
          : 'text-red-600';

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Progress Steps */}
      <div className="flex border-b border-gray-100">
        {(['info', 'criteria', 'summary'] as const).map((s, idx) => (
          <button
            key={s}
            type="button"
            onClick={() => setStep(s)}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              step === s
                ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {idx + 1}. {s === 'info' ? 'Employee Info' : s === 'criteria' ? 'Scoring' : 'Summary'}
          </button>
        ))}
      </div>

      <div className="p-6 space-y-5">
        {/* Step 1: Employee Info */}
        {step === 'info' && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Employee Name *</label>
                <input
                  value={evaluateeName}
                  onChange={(e) => setEvaluateeName(e.target.value)}
                  placeholder="Full name"
                  className="w-full min-h-11 rounded-lg border border-gray-200 px-3 text-sm focus:border-blue-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Employee ID</label>
                <input
                  value={evaluateeEmployeeId}
                  onChange={(e) => setEvaluateeEmployeeId(e.target.value)}
                  placeholder="e.g. EMP-001"
                  className="w-full min-h-11 rounded-lg border border-gray-200 px-3 text-sm focus:border-blue-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
                <select
                  value={evaluateeRole}
                  onChange={(e) => handleRoleChange(e.target.value as EvaluationRole)}
                  className="w-full min-h-11 rounded-lg border border-gray-200 px-3 text-sm focus:border-blue-400 focus:outline-none"
                >
                  {(Object.keys(EVALUATION_ROLE_LABELS) as EvaluationRole[]).map((r) => (
                    <option key={r} value={r}>{EVALUATION_ROLE_LABELS[r]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Job Title</label>
                <input
                  value={evaluateeJobTitle}
                  onChange={(e) => setEvaluateeJobTitle(e.target.value)}
                  placeholder="e.g. Senior Technician"
                  className="w-full min-h-11 rounded-lg border border-gray-200 px-3 text-sm focus:border-blue-400 focus:outline-none"
                />
              </div>
              {evaluateeRole === 'other' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Custom Role Name</label>
                  <input
                    value={evaluateeCustomRole}
                    onChange={(e) => setEvaluateeCustomRole(e.target.value)}
                    placeholder="e.g. QC Inspector, Electrician"
                    className="w-full min-h-11 rounded-lg border border-gray-200 px-3 text-sm focus:border-blue-400 focus:outline-none"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Evaluation Date</label>
                <input
                  type="date"
                  value={evaluationDate}
                  onChange={(e) => setEvaluationDate(e.target.value)}
                  className="w-full min-h-11 rounded-lg border border-gray-200 px-3 text-sm focus:border-blue-400 focus:outline-none"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={() => { initCriteria(evaluateeRole); setStep('criteria'); }}
              disabled={!evaluateeName.trim()}
              className="mt-2 min-h-11 px-6 rounded-lg bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Next: Scoring →
            </button>
          </div>
        )}

        {/* Step 2: Scoring */}
        {step === 'criteria' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Evaluating <span className="font-semibold text-gray-800">{evaluateeName}</span> as{' '}
                <span className="font-semibold text-gray-800">{EVALUATION_ROLE_LABELS[evaluateeRole]}</span>
              </p>
              {overallScore > 0 && (
                <span className={`text-lg font-bold ${scoreColor}`}>{overallScore}%</span>
              )}
            </div>

            {criteria.map((c) => {
              const result = criteriaResults.find((r) => r.criterionId === c.id);
              return (
                <div key={c.id} className="rounded-lg border border-gray-100 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{c.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{c.description}</p>
                    </div>
                    <span className="text-xs text-gray-400 shrink-0">Weight: {c.weight}%</span>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {([1, 2, 3, 4, 5] as EvaluationCriterionScore[]).map((score) => (
                      <button
                        key={score}
                        type="button"
                        onClick={() => updateResult(c.id, { score, label: c.label })}
                        className={`flex-1 min-w-[2.5rem] py-2 rounded-lg text-sm font-semibold border transition-colors ${
                          result?.score === score
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-blue-300'
                        }`}
                        title={SCORE_LABELS[score]}
                      >
                        {score}
                      </button>
                    ))}
                  </div>
                  {result?.score && (
                    <p className="text-xs text-blue-600">{SCORE_LABELS[result.score]}</p>
                  )}
                  <textarea
                    value={result?.comments ?? ''}
                    onChange={(e) => updateResult(c.id, { comments: e.target.value })}
                    placeholder="Optional comments…"
                    rows={2}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm resize-none focus:border-blue-400 focus:outline-none"
                  />
                </div>
              );
            })}

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setStep('info')} className="min-h-11 px-4 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">
                ← Back
              </button>
              <button
                type="button"
                onClick={() => setStep('summary')}
                className="min-h-11 px-6 rounded-lg bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Next: Summary →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Summary & Submit */}
        {step === 'summary' && (
          <div className="space-y-5">
            {/* Score display */}
            <div className="rounded-xl bg-gray-50 p-5 text-center">
              <p className="text-sm text-gray-500 mb-1">Overall Score</p>
              <p className={`text-5xl font-bold ${scoreColor}`}>{overallScore}%</p>
              <p className="text-sm text-gray-500 mt-1">
                {overallScore >= 80 ? 'Outstanding' : overallScore >= 60 ? 'Satisfactory' : overallScore >= 40 ? 'Needs Improvement' : 'Unsatisfactory'}
              </p>
            </div>

            {/* Criteria summary */}
            <div className="space-y-2">
              {criteria.map((c) => {
                const r = criteriaResults.find((res) => res.criterionId === c.id);
                return (
                  <div key={c.id} className="flex items-center justify-between gap-3 py-1.5 border-b border-gray-100 last:border-0">
                    <span className="text-sm text-gray-700">{c.label}</span>
                    <span className={`text-sm font-semibold ${r?.score ? (r.score >= 4 ? 'text-emerald-600' : r.score >= 3 ? 'text-blue-600' : 'text-red-600') : 'text-gray-400'}`}>
                      {r?.score ? `${r.score}/5` : '—'}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Overall comments */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Overall Comments</label>
              <textarea
                value={overallComments}
                onChange={(e) => setOverallComments(e.target.value)}
                placeholder="Overall performance summary…"
                rows={3}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm resize-none focus:border-blue-400 focus:outline-none"
              />
            </div>

            {/* Development plan */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Development Plan</label>
              <textarea
                value={developmentPlan}
                onChange={(e) => setDevelopmentPlan(e.target.value)}
                placeholder="Recommended development actions, training, or goals…"
                rows={3}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm resize-none focus:border-blue-400 focus:outline-none"
              />
            </div>

            {/* Attachments */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Attachments</label>
              <p className="text-xs text-gray-500 mb-3">Upload supporting evidence: documents (PDF/DOCX), images, or videos.</p>
              {attachments.length > 0 && (
                <div className="space-y-2 mb-3">
                  {attachments.map((a) => (
                    <div key={a.id} className="flex items-center gap-3 rounded-lg border border-gray-100 px-3 py-2">
                      <AttachmentIcon type={a.type} />
                      <a href={a.url} target="_blank" rel="noopener noreferrer" className="flex-1 text-sm text-blue-600 hover:underline truncate">
                        {a.name}
                      </a>
                      <span className="text-xs text-gray-400">{(a.size / 1024).toFixed(0)} KB</span>
                      <button type="button" onClick={() => removeAttachment(a.id)} className="text-gray-400 hover:text-red-500">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {Object.keys(uploadProgress).length > 0 && (
                <div className="space-y-1 mb-3">
                  {Object.entries(uploadProgress).map(([name, pct]) => (
                    <div key={name} className="text-xs text-gray-500">
                      {name}: {Math.round(pct)}%
                      <div className="h-1 bg-gray-200 rounded mt-0.5">
                        <div className="h-1 bg-blue-500 rounded" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2 rounded-lg border border-dashed border-gray-300 px-4 py-3 text-sm text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors disabled:opacity-50"
              >
                <Paperclip className="w-4 h-4" />
                {uploading ? 'Uploading…' : 'Add attachment'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.mp4,.mov,.webm"
                className="hidden"
                onChange={(e) => void handleFileUpload(e.target.files)}
              />
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
            )}

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setStep('criteria')} className="min-h-11 px-4 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">
                ← Back
              </button>
              {onCancel && (
                <button type="button" onClick={onCancel} className="min-h-11 px-4 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">
                  Cancel
                </button>
              )}
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={saving || uploading}
                className="min-h-11 px-6 rounded-lg bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {saving ? 'Submitting…' : 'Submit Evaluation'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
