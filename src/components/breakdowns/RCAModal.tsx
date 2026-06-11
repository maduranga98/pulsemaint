import { useState } from 'react';
import { X, ChevronRight, ChevronLeft, Save, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '../../store/authStore';
import { useRCA } from '../../hooks/useRCA';
import type { Breakdown } from '../../types/breakdown';
import type { WhyEntry } from '../../types/rca';

interface RCAModalProps {
  breakdown: Breakdown;
  onClose: () => void;
  onSaved: (rcaId: string, completed: boolean) => void;
}

const WHY_QUESTIONS: string[] = [
  'Why did this problem occur?',
  'Why did that happen?',
  'Why did that cause it?',
  'Why was that condition present?',
  'What is the underlying systemic reason?',
];

export function RCAModal({ breakdown, onClose, onSaved }: RCAModalProps) {
  const user = useAuthStore((s) => s.user);
  const userProfile = useAuthStore((s) => s.userProfile);

  const siteId = userProfile?.siteIds?.[0] || userProfile?.companyId || '';

  const { rca, saveRCA } = useRCA({
    breakdownId: breakdown.id,
    machineId: breakdown.machineId,
    siteId,
  });

  const [step, setStep] = useState(0); // 0=Problem, 1=5Whys, 2=Actions
  const [saving, setSaving] = useState(false);

  // Step 0: Problem
  const [problem, setProblem] = useState(rca?.problem ?? breakdown.description ?? '');

  // Step 1: 5 Whys + Root Cause
  const [whys, setWhys] = useState<string[]>(
    rca?.whys?.map((w) => w.answer) ?? ['', '', '', '', ''],
  );
  const [rootCause, setRootCause] = useState(rca?.rootCause ?? '');

  // Step 2: Actions
  const [correctiveAction, setCorrectiveAction] = useState(rca?.correctiveAction ?? '');
  const [createWO, setCreateWO] = useState(false);
  const [pmUpdate, setPmUpdate] = useState(rca?.linkedPmUpdate ?? '');

  function buildWhyEntries(): WhyEntry[] {
    return WHY_QUESTIONS.map((q, i) => ({
      question: q,
      answer: whys[i] ?? '',
    }));
  }

  async function handleSave(complete: boolean) {
    if (!user || !userProfile) return;
    if (complete) {
      if (whys[0].trim() === '') {
        toast.error('Please answer at least the first Why before completing the RCA.');
        return;
      }
      if (rootCause.trim() === '') {
        toast.error('Root cause is required to complete the RCA.');
        return;
      }
    }
    setSaving(true);
    try {
      const rcaId = await saveRCA(
        {
          problem,
          whys: buildWhyEntries(),
          rootCause,
          correctiveAction: correctiveAction.trim() || undefined,
          linkedPmUpdate: pmUpdate.trim() || undefined,
          status: complete ? 'completed' : 'open',
        },
        user.uid,
        userProfile.fullName,
      );
      toast.success(complete ? 'RCA completed.' : 'RCA draft saved.');
      onSaved(rcaId, complete);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save RCA.');
    } finally {
      setSaving(false);
    }
  }

  const STEPS = ['Problem', '5 Whys & Root Cause', 'Actions'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">5-Why Root Cause Analysis</h2>
            <p className="text-xs text-gray-500">{breakdown.ticketNumber} · {breakdown.machineName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-0 px-6 pt-4 pb-2">
          {STEPS.map((label, idx) => (
            <div key={idx} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors ${
                    idx === step
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : idx < step
                      ? 'border-emerald-500 bg-emerald-500 text-white'
                      : 'border-gray-300 bg-white text-gray-400'
                  }`}
                >
                  {idx < step ? '✓' : idx + 1}
                </div>
                <span
                  className={`text-xs mt-1 whitespace-nowrap ${
                    idx === step ? 'text-blue-600 font-medium' : 'text-gray-400'
                  }`}
                >
                  {label}
                </span>
              </div>
              {idx < STEPS.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 mb-4 ${
                    idx < step ? 'bg-emerald-500' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Step 0: Problem Statement */}
          {step === 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-900">Describe the problem</h3>
              <p className="text-xs text-gray-500">
                Provide a clear, factual statement of what happened. Avoid assumptions or causes at this stage.
              </p>
              <textarea
                value={problem}
                onChange={(e) => setProblem(e.target.value)}
                rows={6}
                placeholder="e.g., Machine X stopped producing at 14:00 on June 11, causing 3 hours of downtime."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          )}

          {/* Step 1: 5 Whys + Root Cause */}
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-900">5 Whys Analysis</h3>
              <p className="text-xs text-gray-500">
                Answer each "Why" based on the previous answer. At least Why 1 is required to complete.
              </p>
              <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-700">
                <span className="font-medium">Problem: </span>{problem || '(not specified)'}
              </div>
              {WHY_QUESTIONS.map((q, idx) => (
                <div key={idx} className="space-y-1">
                  <label className="block text-xs font-semibold text-gray-600">
                    Why {idx + 1}: {q}
                  </label>
                  <textarea
                    value={whys[idx]}
                    onChange={(e) => {
                      const next = [...whys];
                      next[idx] = e.target.value;
                      setWhys(next);
                    }}
                    rows={2}
                    placeholder={`Why ${idx + 1} answer…`}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              ))}
              <div className="space-y-1 pt-2 border-t border-gray-100">
                <label className="block text-xs font-semibold text-gray-900">
                  Root Cause <span className="text-red-500">*</span>
                </label>
                <p className="text-xs text-gray-500">
                  Based on your 5-Why analysis, what is the true underlying root cause?
                </p>
                <textarea
                  value={rootCause}
                  onChange={(e) => setRootCause(e.target.value)}
                  rows={3}
                  placeholder="The root cause is…"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
          )}

          {/* Step 2: Actions */}
          {step === 2 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-900">Corrective Actions</h3>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-gray-600">
                  Corrective Action (optional)
                </label>
                <textarea
                  value={correctiveAction}
                  onChange={(e) => setCorrectiveAction(e.target.value)}
                  rows={3}
                  placeholder="Describe the corrective action to prevent recurrence…"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              {correctiveAction.trim() && (
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={createWO}
                    onChange={(e) => setCreateWO(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600"
                  />
                  Create a Work Order for this corrective action
                </label>
              )}

              <div className="space-y-1 pt-2 border-t border-gray-100">
                <label className="block text-xs font-semibold text-gray-600">
                  PM Schedule Update (optional)
                </label>
                <p className="text-xs text-gray-500">
                  Does this finding require a change to the preventive maintenance schedule?
                </p>
                <textarea
                  value={pmUpdate}
                  onChange={(e) => setPmUpdate(e.target.value)}
                  rows={2}
                  placeholder="e.g., Increase lubrication frequency on Machine X from monthly to bi-weekly."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              {/* RCA Summary */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                <p className="font-medium text-gray-700">Summary</p>
                <div>
                  <span className="text-gray-500 text-xs">Root Cause: </span>
                  <span className="text-gray-800">{rootCause || '—'}</span>
                </div>
                {correctiveAction && (
                  <div>
                    <span className="text-gray-500 text-xs">Corrective Action: </span>
                    <span className="text-gray-800">{correctiveAction}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={step === 0 ? onClose : () => setStep((s) => s - 1)}
            className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-50"
          >
            {step === 0 ? 'Cancel' : (
              <span className="flex items-center gap-1"><ChevronLeft className="w-4 h-4" />Back</span>
            )}
          </button>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleSave(false)}
              disabled={saving}
              className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-50 flex items-center gap-1"
            >
              <Save className="w-4 h-4" />
              Save Draft
            </button>

            {step < 2 ? (
              <button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                disabled={step === 0 && !problem.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleSave(true)}
                disabled={saving || !rootCause.trim() || !whys[0].trim()}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1"
              >
                <CheckCircle className="w-4 h-4" />
                {saving ? 'Saving…' : 'Complete RCA'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
