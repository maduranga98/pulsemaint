import { useEffect, useState } from 'react';
import { Plus, Trash2, X, Pencil, ClipboardList } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import {
  fetchEvaluationTemplates,
  saveEvaluationTemplate,
  deleteEvaluationTemplate,
} from '../services/evaluation.service';
import {
  EVALUATION_ROLE_LABELS,
  ROLE_CRITERIA,
  type EvaluationCriterion,
  type EvaluationRole,
  type EvaluationTemplate,
} from '../types/evaluation.types';

const ROLE_OPTIONS: { value: EvaluationRole | 'custom'; label: string }[] = [
  ...(Object.keys(EVALUATION_ROLE_LABELS) as EvaluationRole[]).map((r) => ({ value: r, label: EVALUATION_ROLE_LABELS[r] })),
  { value: 'custom', label: 'Custom (no specific role)' },
];

function emptyCriterion(): EvaluationCriterion {
  return { id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, label: '', description: '', weight: 10 };
}

interface Props {
  onClose: () => void;
}

export default function EvaluationTemplateBuilder({ onClose }: Props) {
  const userProfile = useAuthStore((s) => s.userProfile);
  const companyId = userProfile?.companyId ?? '';
  // Matches the firestore.rules delete rule for evaluation_templates — admin only.
  const canDelete = userProfile?.role === 'admin';

  const [templates, setTemplates] = useState<EvaluationTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<EvaluationTemplate | null>(null);
  const [showEditor, setShowEditor] = useState(false);

  const [name, setName] = useState('');
  const [role, setRole] = useState<EvaluationRole | 'custom'>('custom');
  const [criteria, setCriteria] = useState<EvaluationCriterion[]>([emptyCriterion()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!companyId) return;
    setLoading(true);
    try {
      setTemplates(await fetchEvaluationTemplates(companyId));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [companyId]);

  function startNew() {
    setEditing(null);
    setName('');
    setRole('custom');
    setCriteria([emptyCriterion()]);
    setError(null);
    setShowEditor(true);
  }

  function startEdit(t: EvaluationTemplate) {
    setEditing(t);
    setName(t.name);
    setRole(t.role);
    setCriteria(t.criteria?.length ? t.criteria : [emptyCriterion()]);
    setError(null);
    setShowEditor(true);
  }

  /** Opens the editor pre-filled with a role's built-in sample criteria. */
  function startFromSample(sampleRole: EvaluationRole) {
    setEditing(null);
    setName(`${EVALUATION_ROLE_LABELS[sampleRole]} Evaluation`);
    setRole(sampleRole);
    setCriteria(ROLE_CRITERIA[sampleRole].map((c) => ({ ...c })));
    setError(null);
    setShowEditor(true);
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this evaluation template?')) return;
    await deleteEvaluationTemplate(id);
    void load();
  }

  function updateCriterion(id: string, patch: Partial<EvaluationCriterion>) {
    setCriteria((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  function removeCriterion(id: string) {
    setCriteria((prev) => prev.filter((c) => c.id !== id));
  }

  const totalWeight = criteria.reduce((s, c) => s + (Number(c.weight) || 0), 0);

  async function handleSave() {
    setError(null);
    if (!name.trim()) { setError('Template name is required.'); return; }
    const cleanCriteria = criteria
      .map((c) => ({ ...c, label: c.label.trim(), description: c.description.trim() }))
      .filter((c) => c.label);
    if (cleanCriteria.length === 0) { setError('Add at least one criterion.'); return; }
    setSaving(true);
    try {
      await saveEvaluationTemplate({
        id: editing?.id,
        companyId,
        name: name.trim(),
        role,
        criteria: cleanCriteria,
        createdBy: userProfile?.id ?? '',
        createdByName: userProfile?.fullName ?? '',
      });
      setShowEditor(false);
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save template.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/50 p-4 overflow-y-auto">
      <div className="my-4 w-full max-w-2xl rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Custom Evaluation Form Builder</h2>
            <p className="text-sm text-slate-500">Create custom scoring criteria for roles or ad-hoc evaluations.</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        {!showEditor ? (
          <div className="p-5 space-y-4">
            <button
              type="button"
              onClick={startNew}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" /> New Custom Template
            </button>

            {/* Built-in role-based sample templates — one per role, never
                tied to a person. "Customize" copies it into the editor. */}
            <div>
              <p className="mb-2 text-sm font-semibold text-gray-700">Role-Based Sample Templates</p>
              <div className="space-y-2">
                {(Object.keys(EVALUATION_ROLE_LABELS) as EvaluationRole[]).map((r) => (
                  <div key={r} className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate">{EVALUATION_ROLE_LABELS[r]} Evaluation (Sample)</p>
                      <p className="text-xs text-gray-500">{EVALUATION_ROLE_LABELS[r]} · {ROLE_CRITERIA[r].length} criteria · built-in</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => startFromSample(r)}
                      className="shrink-0 rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                    >
                      Customize
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-sm font-semibold text-gray-700">Custom Templates</p>
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-600 border-t-transparent" />
              </div>
            ) : templates.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-center text-gray-400">
                <ClipboardList className="w-10 h-10 mb-2" />
                <p className="text-sm">No custom templates yet.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {templates.map((t) => (
                  <div key={t.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate">{t.name}</p>
                      <p className="text-xs text-gray-500">
                        {t.role === 'custom' ? 'Custom' : (EVALUATION_ROLE_LABELS[t.role] ?? t.role)} · {(t.criteria ?? []).length} criteria
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button type="button" onClick={() => startEdit(t)} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-blue-600">
                        <Pencil className="w-4 h-4" />
                      </button>
                      {canDelete && (
                        <button type="button" onClick={() => void handleDelete(t.id)} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-red-600">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Template Name *</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. QC Inspector Evaluation"
                  className="w-full min-h-11 rounded-lg border border-gray-200 px-3 text-sm focus:border-blue-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Applies to Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as EvaluationRole | 'custom')}
                  className="w-full min-h-11 rounded-lg border border-gray-200 px-3 text-sm focus:border-blue-400 focus:outline-none"
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">Criteria</label>
                <span className={`text-xs font-medium ${totalWeight === 100 ? 'text-emerald-600' : 'text-amber-600'}`}>
                  Total weight: {totalWeight}% {totalWeight !== 100 && '(should sum to 100%)'}
                </span>
              </div>
              <div className="space-y-3">
                {criteria.map((c) => (
                  <div key={c.id} className="rounded-lg border border-gray-100 p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <input
                        value={c.label}
                        onChange={(e) => updateCriterion(c.id, { label: e.target.value })}
                        placeholder="Criterion label"
                        className="flex-1 min-h-10 rounded-lg border border-gray-200 px-3 text-sm focus:border-blue-400 focus:outline-none"
                      />
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={c.weight}
                        onChange={(e) => updateCriterion(c.id, { weight: Number(e.target.value) })}
                        className="w-20 min-h-10 rounded-lg border border-gray-200 px-2 text-sm text-center focus:border-blue-400 focus:outline-none"
                      />
                      <span className="flex items-center text-xs text-gray-400 shrink-0">%</span>
                      <button
                        type="button"
                        onClick={() => removeCriterion(c.id)}
                        className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-red-600 shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <textarea
                      value={c.description}
                      onChange={(e) => updateCriterion(c.id, { description: e.target.value })}
                      placeholder="Description shown to the evaluator (optional)"
                      rows={2}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm resize-none focus:border-blue-400 focus:outline-none"
                    />
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setCriteria((prev) => [...prev, emptyCriterion()])}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-600 hover:border-blue-400 hover:text-blue-600"
              >
                <Plus className="w-4 h-4" /> Add Criterion
              </button>
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
            )}

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowEditor(false)} className="min-h-11 px-4 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">
                ← Back
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="min-h-11 px-6 rounded-lg bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Template'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
