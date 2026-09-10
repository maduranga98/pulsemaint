import { Plus, Trash2, AlertTriangle } from 'lucide-react';
import { nanoid } from 'nanoid';
import { useTranslation } from 'react-i18next';
import {
  getFindingKindLabel,
  ALL_FINDING_KINDS,
  type AuditFinding,
  type FindingKind,
} from '../types/audit.types';

interface Props {
  findings: AuditFinding[];
  onChange: (next: AuditFinding[]) => void;
  /** Which finding-type buttons to show; defaults to all 4 for backward compat with templates that predate this field. */
  allowedKinds?: FindingKind[];
}

/**
 * Captures losses / breakdowns / safety / maintenance findings — every finding
 * always prompts for a reason and a corrective solution.
 */
export function FindingsSection({ findings, onChange, allowedKinds = ALL_FINDING_KINDS }: Props) {
  const { t } = useTranslation();
  const add = (kind: FindingKind) =>
    onChange([...findings, { id: nanoid(), kind, description: '', reason: '', solution: '' }]);

  const update = (id: string, patch: Partial<AuditFinding>) =>
    onChange(findings.map((f) => (f.id === id ? { ...f, ...patch } : f)));

  const remove = (id: string) => onChange(findings.filter((f) => f.id !== id));

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3">
        {allowedKinds.map((kind) => (
          <button
            key={kind}
            type="button"
            onClick={() => add(kind)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-amber-900/30 hover:bg-amber-900/50 border border-amber-700/50 text-amber-200 rounded-lg"
          >
            <Plus className="h-3.5 w-3.5" /> {getFindingKindLabel(kind, t)}
          </button>
        ))}
      </div>

      {findings.length === 0 ? (
        <p className="inline-flex items-center gap-1.5 text-xs text-slate-500">
          <AlertTriangle className="h-3.5 w-3.5" />
          {t('common.audit.findings.empty', 'Add any losses, breakdowns, safety or maintenance issues found.')}
        </p>
      ) : (
        <div className="space-y-3">
          {findings.map((f) => (
            <div key={f.id} className="p-3 bg-slate-900 border border-slate-700 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="px-2 py-0.5 text-xs font-semibold bg-amber-900/40 border border-amber-700/50 text-amber-200 rounded">
                  {getFindingKindLabel(f.kind, t)}
                </span>
                <button
                  type="button"
                  onClick={() => remove(f.id)}
                  className="text-slate-500 hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-2">
                <input
                  value={f.description}
                  onChange={(e) => update(f.id, { description: e.target.value })}
                  placeholder={t('common.audit.findings.descriptionPlaceholder', 'What happened? (description)')}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <textarea
                    value={f.reason}
                    onChange={(e) => update(f.id, { reason: e.target.value })}
                    placeholder={t('common.audit.findings.reasonPlaceholder', 'Reason / root cause')}
                    rows={2}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none resize-none"
                  />
                  <textarea
                    value={f.solution}
                    onChange={(e) => update(f.id, { solution: e.target.value })}
                    placeholder={t('common.audit.findings.solutionPlaceholder', 'Solution / corrective action taken')}
                    rows={2}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none resize-none"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
