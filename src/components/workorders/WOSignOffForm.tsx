import { useMemo, useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Lock, Star } from 'lucide-react';
import type { WorkOrder, WOSignOffOutcome } from '../../types/workOrder';
import { useSignOff } from '../../hooks/useSignOff';
import { useAuthStore } from '../../store/authStore';
import { formatLkr } from '../../lib/contractors/invoiceCalculator';
import { toast } from 'sonner';

const RATING_DIMENSIONS = [
  { key: 'speedScore', label: 'Speed' },
  { key: 'qualityScore', label: 'Quality' },
  { key: 'professionalismScore', label: 'Professionalism' },
  { key: 'communicationScore', label: 'Communication' },
] as const;

type RatingKey = (typeof RATING_DIMENSIONS)[number]['key'];

function StarRow({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          className="p-0.5"
        >
          <Star className={`h-5 w-5 ${n <= value ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} />
        </button>
      ))}
    </div>
  );
}

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
  const userProfile = useAuthStore((s) => s.userProfile);
  const [outcome, setOutcome] = useState<WOSignOffOutcome>('complete');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');

  // Contractor work orders capture the contractor's own cost and a rating for
  // the job at sign-off — the two things the contractor's history is judged on.
  const isContractorWO = workOrder.woType === 'CONTRACTOR';
  const [projectCost, setProjectCost] = useState(
    workOrder.projectCost != null ? String(workOrder.projectCost) : '',
  );
  const [scores, setScores] = useState<Record<RatingKey, number>>({
    speedScore: workOrder.contractorRating?.speedScore ?? 0,
    qualityScore: workOrder.contractorRating?.qualityScore ?? 0,
    professionalismScore: workOrder.contractorRating?.professionalismScore ?? 0,
    communicationScore: workOrder.contractorRating?.communicationScore ?? 0,
  });

  const partsCost = useMemo(
    () => Number((workOrder.partsUsed ?? []).reduce((sum, p) => sum + (p.totalCost ?? 0), 0).toFixed(2)),
    [workOrder.partsUsed],
  );
  const parsedProjectCost = useMemo(() => {
    const n = projectCost.trim() ? Number(projectCost.replace(/,/g, '')) : 0;
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }, [projectCost]);
  const totalCost = Number((partsCost + parsedProjectCost).toFixed(2));
  const overallRating = useMemo(() => {
    const values = RATING_DIMENSIONS.map((d) => scores[d.key]);
    return values.every(Boolean)
      ? Number((values.reduce((sum, v) => sum + v, 0) / values.length).toFixed(2))
      : 0;
  }, [scores]);

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
    if (isContractorWO) {
      if (projectCost.trim() && !Number.isFinite(Number(projectCost.replace(/,/g, '')))) {
        toast.error('Enter a valid project cost.');
        return;
      }
      if (overallRating === 0) {
        toast.error('Rate all four areas before signing off this contractor job.');
        return;
      }
    }

    const ok = await signOff(workOrder.id, workOrder.siteId, {
      outcome,
      outcomeReason: needsReason ? reason.trim() : null,
      notes,
      projectCost: isContractorWO ? parsedProjectCost : null,
      contractorRating: isContractorWO
        ? {
            ...scores,
            overallScore: overallRating,
            ratedBy: userProfile?.id ?? '',
            ratedByName: userProfile?.fullName ?? '',
            ratedAt: null,
          }
        : null,
    });
    if (ok) onDone?.();
  }

  return (
    <div className="space-y-4">
      {/* Contractor jobs: total cost and a rating, both required to close. */}
      {isContractorWO && (
        <>
          <div className="rounded-lg border border-gray-200 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Total cost</p>
            <p className="mt-0.5 text-xs text-gray-400">
              Used-parts cost from this work order plus the contractor's project cost.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Used Parts Cost (auto)</label>
                <p className="flex h-10 items-center rounded-md border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700">
                  {formatLkr(partsCost)}
                </p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Project Cost</label>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-500">LKR</span>
                  <input
                    value={projectCost}
                    onChange={(e) => setProjectCost(e.target.value)}
                    inputMode="decimal"
                    placeholder="0.00"
                    className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm"
                  />
                </div>
              </div>
            </div>
            <div className="mt-3 rounded-md bg-gray-50 p-3">
              <p className="text-xs text-gray-500">
                Used parts {formatLkr(partsCost)} + project {formatLkr(parsedProjectCost)}
              </p>
              <p className="text-lg font-bold text-gray-900">{formatLkr(totalCost)}</p>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Contractor rating</p>
            <p className="mt-0.5 text-xs text-gray-400">
              Rate all four areas — required to sign off, and shown in this contractor's job history.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {RATING_DIMENSIONS.map((d) => (
                <div key={d.key} className="rounded-md border border-gray-200 p-2.5">
                  <p className="text-sm font-medium text-gray-800">{d.label}</p>
                  <div className="mt-1.5">
                    <StarRow
                      value={scores[d.key]}
                      onChange={(v) => setScores((prev) => ({ ...prev, [d.key]: v }))}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-md bg-gray-50 p-3 text-center">
              <p className="text-xs text-gray-500">Overall score</p>
              <p className="text-2xl font-bold text-gray-900">
                {overallRating ? overallRating.toFixed(1) : '-'}
              </p>
            </div>
          </div>
        </>
      )}

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
