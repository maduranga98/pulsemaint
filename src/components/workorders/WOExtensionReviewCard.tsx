import { useState } from 'react';
import type { WOExtensionRequest } from '../../types/workOrder';
import { useReviewWOExtension } from '../../hooks/useWOExtension';

interface Props {
  request: WOExtensionRequest;
  onDone?: () => void;
  /** Compact mode drops the machine/WO header — used when already inside a
   *  WO's own detail panel where that context is obvious. */
  compact?: boolean;
}

function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function WOExtensionReviewCard({ request, onDone, compact = false }: Props) {
  const { reviewExtension, loading } = useReviewWOExtension();
  const [editing, setEditing] = useState(false);
  const [editedDate, setEditedDate] = useState(
    toLocalInputValue(request.requestedDueDate.toDate()),
  );
  const [reviewNote, setReviewNote] = useState('');

  async function handleApprove() {
    const ok = await reviewExtension(request, {
      approve: true,
      newDueDate: editing ? new Date(editedDate) : undefined,
      reviewNote,
    });
    if (ok) onDone?.();
  }

  async function handleReject() {
    const ok = await reviewExtension(request, { approve: false, reviewNote });
    if (ok) onDone?.();
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
      {!compact && (
        <p className="text-sm font-semibold text-gray-900">
          {request.woNumber} · {request.machineName}
        </p>
      )}
      <p className="text-xs text-gray-600">
        Requested by <span className="font-medium">{request.requestedByName}</span> ·{' '}
        {request.requestedAt?.toDate?.().toLocaleString?.() ?? ''}
      </p>
      <p className="text-sm text-gray-800 italic">"{request.reason}"</p>
      <p className="text-xs text-gray-600">
        Current due: {request.previousDueDate?.toDate?.().toLocaleString?.() ?? ''} → Requested:{' '}
        <span className="font-semibold text-amber-700">
          {request.requestedDueDate?.toDate?.().toLocaleString?.() ?? ''}
        </span>
      </p>

      {editing && (
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
            Edit approved due date &amp; time
          </label>
          <input
            type="datetime-local"
            value={editedDate}
            onChange={(e) => setEditedDate(e.target.value)}
            className="w-full rounded-lg border border-gray-300 p-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
      )}

      <textarea
        value={reviewNote}
        onChange={(e) => setReviewNote(e.target.value)}
        rows={2}
        placeholder="Optional note for this decision"
        className="w-full rounded-lg border border-gray-300 p-2 text-xs focus:border-blue-500 focus:outline-none"
      />

      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          onClick={handleApprove}
          disabled={loading}
          className="flex-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {editing ? 'Approve with edited date' : 'Accept'}
        </button>
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            disabled={loading}
            className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            Edit date &amp; approve
          </button>
        )}
        <button
          type="button"
          onClick={handleReject}
          disabled={loading}
          className="flex-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
        >
          Reject
        </button>
      </div>
    </div>
  );
}
