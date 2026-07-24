import { useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Lock } from 'lucide-react';
import type { WorkOrder, WOSignOffOutcome } from '../../types/workOrder';
import { useSignOff } from '../../hooks/useSignOff';
import { toast } from 'sonner';

interface Props {
  workOrder: WorkOrder;
  /** Called after a successful sign-off & close. */
  onDone?: () => void;
  onCancel?: () => void;
}

const OUTCOMES: {
  value: WOSignOffOutcome;
  label: string;
  hint: string;
  icon: typeof CheckCircle2;
  active: string;
}[] = [
  {
    value: 'complete',
    label: 'Complete',
    hint: 'Work finished and verified',
    icon: CheckCircle2,
    active: 'border-emerald-500 bg-emerald-50 text-emerald-700',
  },
  {
    value: 'not_complete',
    label: 'Not complete',
    hint: 'Work could not be finished',
    icon: AlertTriangle,
    active: 'border-amber-500 bg-amber-50 text-amber-700',
  },
  {
    value: 'failed',
    label: 'Failed',
    hint: 'Repair attempt failed',
    icon: XCircle,
    active: 'border-red-500 bg-red-50 text-red-700',
  },
];

// Terminal sign-off form: the supervisor/manager records the closing outcome
// (with a mandatory reason when it isn't a clean completion), an optional note,
// then signs off and closes the work order in one irreversible action. The
// person who signs off/closes is recorded automatically — no signature.
export function WOSignOffForm({ workOrder, onDone, onCancel }: Props) {
  const { signOff, loading } = useSignOff();
  const [outcome, setOutcome] = useState<WOSignOffOutcome>('complete');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');

  const needsReason = outcome === 'not_complete' || outcome === 'failed';

  async function handleSignOff() {
    if (needsReason && !reason.trim()) {
      toast.error(
        outcome === 'failed'
          ? 'Please add a reason for the failure.'
          : 'Please add a reason why the work is not complete.',
      );
      return;
    }
    const ok = await signOff(workOrder.id, workOrder.siteId, {
      outcome,
      outcomeReason: needsReason ? reason.trim() : null,
      notes,
    });
    if (ok) onDone?.();
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
          Completion outcome
        </label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {OUTCOMES.map((o) => {
            const selected = outcome === o.value;
            const Icon = o.icon;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => setOutcome(o.value)}
                className={`flex flex-col items-start gap-1 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                  selected ? o.active : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }`}
              >
                <span className="flex items-center gap-1.5 text-sm font-semibold">
                  <Icon className="h-4 w-4" /> {o.label}
                </span>
                <span className="text-[11px] leading-tight opacity-80">{o.hint}</span>
              </button>
            );
          })}
        </div>
      </div>

      {needsReason && (
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
            Reason *
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder={
              outcome === 'failed'
                ? 'Explain why the repair failed…'
                : 'Explain why the work could not be completed…'
            }
            className="w-full rounded-lg border border-gray-300 p-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
      )}

      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
          Sign-off note (optional)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Add any closing remarks…"
          className="w-full rounded-lg border border-gray-300 p-2 text-sm focus:border-blue-500 focus:outline-none"
        />
      </div>

      <div className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
        <Lock className="mr-1 inline h-3.5 w-3.5 -mt-0.5" />
        Signing off records you as the approver and closes this work order. This
        action cannot be reversed.
      </div>

      <div className="flex gap-2 border-t border-gray-200 pt-4">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border border-gray-300 px-4 py-2.5 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          onClick={handleSignOff}
          disabled={loading}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          <CheckCircle2 className="h-4 w-4" />
          {loading ? 'Signing off…' : 'Sign off & Close'}
        </button>
      </div>
    </div>
  );
}
