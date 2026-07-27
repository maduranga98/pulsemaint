import { useState } from 'react';
import { Plus, Trash2, Save, Loader2, GripVertical } from 'lucide-react';
import { nanoid } from 'nanoid';
import {
  ANSWER_TYPE_LABELS,
  FINDING_KIND_LABELS,
  type AnswerType,
  type AuditTemplate,
  type AuditTask,
  type FindingKind,
} from '../types/audit.types';
import { saveTemplate, createCustomCategory } from '../services/audit.service';

interface Props {
  plantId: string;
  /** Edit-existing-template mode. Omit and pass `createNew` to build a brand-new category+form instead. */
  template?: AuditTemplate;
  /** Create-new-category mode: renders a "Category name" field and creates a new AuditTemplate on save. */
  createNew?: boolean;
  onSaved: (template: AuditTemplate) => void;
  onClose: () => void;
}

/** Lets users customize the checklist tasks and answer types per category, or build a brand-new custom category from scratch. */
export function AuditTaskConfigurator({ plantId, template, createNew = false, onSaved, onClose }: Props) {
  const [name, setName] = useState(template?.name ?? '');
  const [tasks, setTasks] = useState<AuditTask[]>(template?.tasks ?? []);
  // Custom categories are filled in manually (Department/Location free text, no
  // machine/contractor/inventory/work-order picker) — the 'departments' scope
  // already renders that manual-only form in AuditSessionForm.
  const [enabledFindingKinds, setEnabledFindingKinds] = useState<FindingKind[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleFindingKind = (kind: FindingKind) =>
    setEnabledFindingKinds((prev) =>
      prev.includes(kind) ? prev.filter((k) => k !== kind) : [...prev, kind],
    );

  const addTask = () =>
    setTasks([...tasks, { id: nanoid(), text: '', answerType: 'yes_no', critical: false }]);

  const update = (id: string, patch: Partial<AuditTask>) =>
    setTasks(tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  const remove = (id: string) => setTasks(tasks.filter((t) => t.id !== id));

  const handleSave = async () => {
    setError(null);
    const cleanTasks = tasks.filter((t) => t.text.trim());
    if (createNew) {
      if (!name.trim()) {
        setError('Give the new category a name.');
        return;
      }
      if (cleanTasks.length === 0) {
        setError('Add at least one task/question.');
        return;
      }
    }
    setSaving(true);
    try {
      if (createNew) {
        const created = await createCustomCategory(plantId, name, cleanTasks, 'departments', enabledFindingKinds);
        onSaved(created);
        return;
      }
      if (!template) return;
      await saveTemplate(plantId, {
        id: template.id,
        category: template.category,
        name: name.trim() || template.name,
        tasks: cleanTasks,
        plantId,
        isDefault: false, // editing makes it a customized template
        updatedAt: null,
      });
      onSaved({ ...template, name: name.trim() || template.name, tasks: cleanTasks });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-semibold text-slate-400 mb-1">
          {createNew ? 'Category / form name' : 'Template name'}
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={createNew ? 'e.g. Warehouse Safety Audit' : undefined}
          className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
        />
      </div>

      {createNew && (
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1.5">
            Finding types allowed
          </label>
          <p className="mb-1.5 text-[11px] text-slate-500">
            None are enabled by default — check off which finding types this form should offer.
          </p>
          <div className="flex flex-wrap gap-3">
            {(Object.keys(FINDING_KIND_LABELS) as FindingKind[]).map((kind) => (
              <label key={kind} className="flex items-center gap-1.5 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={enabledFindingKinds.includes(kind)}
                  onChange={() => toggleFindingKind(kind)}
                  className="accent-blue-500"
                />
                {FINDING_KIND_LABELS[kind]}
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        {tasks.map((task, i) => (
          <div key={task.id} className="flex items-start gap-2 p-2 bg-slate-900 border border-slate-700 rounded-lg">
            <GripVertical className="h-4 w-4 text-slate-600 mt-2.5 shrink-0" />
            <div className="flex-1 space-y-2">
              <input
                value={task.text}
                onChange={(e) => update(task.id, { text: e.target.value })}
                placeholder={`Task ${i + 1} — question / check`}
                className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
              />
              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={task.answerType}
                  onChange={(e) => update(task.id, { answerType: e.target.value as AnswerType })}
                  className="px-2 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:border-blue-500 focus:outline-none"
                >
                  {(Object.keys(ANSWER_TYPE_LABELS) as AnswerType[]).map((at) => (
                    <option key={at} value={at}>{ANSWER_TYPE_LABELS[at]}</option>
                  ))}
                </select>
                <label className="flex items-center gap-1.5 text-xs text-slate-400">
                  <input
                    type="checkbox"
                    checked={task.critical}
                    onChange={(e) => update(task.id, { critical: e.target.checked })}
                    className="accent-blue-500"
                  />
                  Critical (failure requires reason &amp; solution)
                </label>
              </div>
            </div>
            <button
              type="button"
              onClick={() => remove(task.id)}
              className="text-slate-500 hover:text-red-400 mt-2"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addTask}
        className="inline-flex items-center gap-1.5 px-3 py-2 text-sm bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-lg"
      >
        <Plus className="h-4 w-4" /> Add Task
      </button>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {createNew ? 'Create Category' : 'Save Configuration'}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm text-slate-300 hover:text-white"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
