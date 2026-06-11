import { useState } from 'react';
import { X, Search } from 'lucide-react';
import type { Breakdown } from '../../types/breakdown';
import type { Rca, RcaPayload, RcaWhy } from '../../types/rca';
import { useRca } from '../../hooks/useRca';

interface RCAModalProps {
  breakdown: Breakdown;
  onClose: () => void;
  /** Called after a successful save (with the final status) so the caller can
   *  proceed with closing the breakdown once an RCA exists. */
  onSaved?: (rca: Rca | null, status: 'open' | 'completed') => void;
}

const EMPTY_WHYS: RcaWhy[] = Array.from({ length: 5 }, () => ({ question: '', answer: '' }));

export function RCAModal({ breakdown, onClose, onSaved }: RCAModalProps) {
  const { rca, saving, saveRca } = useRca(breakdown.id);

  const [problem, setProblem] = useState(rca?.problem ?? breakdown.description ?? '');
  const [whys, setWhys] = useState<RcaWhy[]>(
    rca?.whys?.length ? padWhys(rca.whys) : EMPTY_WHYS,
  );
  const [rootCause, setRootCause] = useState(rca?.rootCause ?? '');
  const [correctiveAction, setCorrectiveAction] = useState(rca?.correctiveAction ?? '');
  const [createCorrectiveWO, setCreateCorrectiveWO] = useState(false);

  function padWhys(input: RcaWhy[]): RcaWhy[] {
    const out = [...input];
    while (out.length < 5) out.push({ question: '', answer: '' });
    return out.slice(0, 5);
  }

  function setWhy(idx: number, field: keyof RcaWhy, value: string) {
    setWhys((prev) => prev.map((w, i) => (i === idx ? { ...w, [field]: value } : w)));
  }

  // "At least started" = problem statement filled. Required to satisfy the close gate.
  const isStarted = problem.trim().length > 0;
  // "Completed" requires a root cause as well.
  const canComplete = isStarted && rootCause.trim().length > 0;

  async function handleSave(status: 'open' | 'completed') {
    const payload: RcaPayload = {
      breakdownId: breakdown.id,
      breakdownTicketNumber: breakdown.ticketNumber,
      machineId: breakdown.machineId,
      machineName: breakdown.machineName,
      severity: breakdown.severity,
      problem: problem.trim(),
      whys: whys.map((w) => ({ question: w.question.trim(), answer: w.answer.trim() })),
      rootCause: rootCause.trim(),
      correctiveAction: correctiveAction.trim() || undefined,
      status,
      createCorrectiveWorkOrder: createCorrectiveWO,
    };
    const saved = await saveRca(payload, breakdown);
    if (saved !== null) {
      onSaved?.(saved, status);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 sticky top-0 bg-white">
          <div className="flex items-center gap-2">
            <Search className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="text-lg font-semibold text-slate-900">5-Why Root Cause Analysis</h3>
              <p className="text-xs text-slate-500">
                {breakdown.ticketNumber} • {breakdown.machineName} •{' '}
                <span className="capitalize">{breakdown.severity} severity</span>
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Problem statement */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Problem Statement <span className="text-red-500">*</span>
            </label>
            <textarea
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              rows={2}
              placeholder="What exactly happened?"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            />
          </div>

          {/* Five why rows */}
          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-700">The Five Whys</p>
            {whys.map((w, idx) => (
              <div key={idx} className="rounded-lg border border-slate-200 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="flex-shrink-0 h-6 w-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <input
                    type="text"
                    value={w.question}
                    onChange={(e) => setWhy(idx, 'question', e.target.value)}
                    placeholder={idx === 0 ? 'Why did this happen?' : 'Why did that happen?'}
                    className="flex-1 px-2 py-1.5 border border-slate-200 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div className="flex items-center gap-2 pl-8">
                  <span className="text-xs font-medium text-slate-400 w-14">Because</span>
                  <input
                    type="text"
                    value={w.answer}
                    onChange={(e) => setWhy(idx, 'answer', e.target.value)}
                    placeholder="…"
                    className="flex-1 px-2 py-1.5 border border-slate-200 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Root cause */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Root Cause {' '}
              <span className="text-slate-400 text-xs font-normal">(required to complete)</span>
            </label>
            <textarea
              value={rootCause}
              onChange={(e) => setRootCause(e.target.value)}
              rows={2}
              placeholder="The underlying root cause identified through the whys…"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            />
          </div>

          {/* Corrective action */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Corrective Action <span className="text-slate-400 text-xs font-normal">(optional)</span>
            </label>
            <textarea
              value={correctiveAction}
              onChange={(e) => setCorrectiveAction(e.target.value)}
              rows={2}
              placeholder="Action to prevent recurrence…"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            />
            {!rca?.linkedWOId && (
              <label className="flex items-center gap-2 mt-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={createCorrectiveWO}
                  onChange={(e) => setCreateCorrectiveWO(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                Create a corrective-action Work Order from this RCA
              </label>
            )}
            {rca?.linkedWOId && (
              <p className="mt-2 text-xs text-emerald-600">
                Linked corrective Work Order already created.
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-3 border-t border-slate-200 px-6 py-4 sticky bottom-0 bg-white">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 border border-slate-200 bg-white text-slate-700 font-medium rounded-lg hover:bg-slate-50 text-sm"
          >
            Cancel
          </button>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => handleSave('open')}
            disabled={saving || !isStarted}
            className="px-4 py-2 border border-blue-200 bg-blue-50 text-blue-700 font-medium rounded-lg hover:bg-blue-100 disabled:opacity-50 text-sm"
          >
            {saving ? 'Saving…' : 'Save Draft'}
          </button>
          <button
            type="button"
            onClick={() => handleSave('completed')}
            disabled={saving || !canComplete}
            className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
          >
            {saving ? 'Saving…' : 'Complete RCA'}
          </button>
        </div>
      </div>
    </div>
  );
}
