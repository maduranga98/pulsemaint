import { useState } from 'react';
import type { WorkOrder } from '../../types/workOrder';
import { useRequestWOExtension } from '../../hooks/useWOExtension';

interface Props {
  workOrder: WorkOrder;
  onClose: () => void;
  onRequested?: () => void;
}

function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function WOExtensionRequestModal({ workOrder, onClose, onRequested }: Props) {
  const { requestExtension, loading } = useRequestWOExtension();
  const defaultNewDue = new Date(Math.max(Date.now(), workOrder.dueDate?.toDate?.().getTime() ?? Date.now()));
  defaultNewDue.setDate(defaultNewDue.getDate() + 1);

  const [newDueDate, setNewDueDate] = useState(toLocalInputValue(defaultNewDue));
  const [reason, setReason] = useState('');

  async function handleSubmit() {
    if (!newDueDate || !reason.trim()) return;
    const ok = await requestExtension(workOrder, {
      reason,
      requestedDueDate: new Date(newDueDate),
    });
    if (ok) {
      onRequested?.();
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl">
        <h3 className="text-lg font-bold text-gray-900">Request Due-Date Extension</h3>
        <p className="mt-1 text-sm text-gray-600">
          {workOrder.woNumber} · {workOrder.machineName} is overdue. Ask your supervisor / plant manager /
          admin to push the due date out.
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
              Requested new due date &amp; time
            </label>
            <input
              type="datetime-local"
              value={newDueDate}
              onChange={(e) => setNewDueDate(e.target.value)}
              className="w-full rounded-lg border border-gray-300 p-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
              Reason
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Why the job can't finish by the current due date…"
              className="w-full rounded-lg border border-gray-300 p-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-gray-200 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || !reason.trim() || !newDueDate}
            className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Sending…' : 'Send Request'}
          </button>
        </div>
      </div>
    </div>
  );
}
