import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, XCircle } from 'lucide-react';
import type { PartReturn } from '@/types/inventory';

type Condition = 'good' | 'damaged' | 'wrong_item';

interface Props {
  partReturn: PartReturn;
  onConfirm?: (partReturn: PartReturn, condition: Condition, notes: string) => Promise<void>;
  onReject?: (partReturn: PartReturn, reason: string) => Promise<void>;
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  pending: { label: 'Returning', className: 'bg-purple-100 text-purple-700' },
  returned: { label: 'Returned', className: 'bg-green-100 text-green-700' },
  rejected: { label: 'Rejected', className: 'bg-red-100 text-red-700' },
  cancelled: { label: 'Cancelled', className: 'bg-gray-100 text-gray-500' },
};

const CONDITION_OPTIONS: { value: Condition; label: string }[] = [
  { value: 'good', label: 'Good — back to stock' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'wrong_item', label: 'Wrong item' },
];

const CONDITION_LABEL: Record<string, string> = {
  good: 'Good',
  damaged: 'Damaged',
  wrong_item: 'Wrong item',
};

export function PartReturnQueueRow({ partReturn, onConfirm, onReject }: Props) {
  const [busy, setBusy] = useState<'confirm' | 'reject' | null>(null);
  const [receiving, setReceiving] = useState(false);
  const [condition, setCondition] = useState<Condition>('good');
  const [receiveNotes, setReceiveNotes] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-2">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="font-medium text-gray-900">{partReturn.partName}</p>
          <p className="text-xs text-gray-500 font-mono">{partReturn.partNumber}</p>
          <p className="text-sm text-gray-600 mt-1">
            {partReturn.quantity} {partReturn.unit} — requested by{' '}
            <strong>{partReturn.requestedByName}</strong>
          </p>
          <p className="text-xs text-gray-500 mt-1">
            From{' '}
            <Link to={`/app/inventory/requests/${partReturn.partsRequestId}`} className="text-blue-600 hover:underline">
              {partReturn.requestNumber}
            </Link>
            {partReturn.workOrderNumber && <> · WO {partReturn.workOrderNumber}</>}
            {partReturn.machineName && <> · {partReturn.machineName}</>}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Requested {partReturn.requestedAt?.toDate?.().toLocaleString?.() ?? ''}
          </p>
          {partReturn.status !== 'pending' && (
            <p className="text-xs text-gray-500 mt-1">
              {partReturn.storeKeeperConfirmedByName && (
                <>By <strong>{partReturn.storeKeeperConfirmedByName}</strong>{' '}</>
              )}
              {partReturn.storeKeeperConfirmedAt?.toDate?.().toLocaleString?.() ?? ''}
              {partReturn.status === 'returned' && partReturn.condition && (
                <> — Condition: {CONDITION_LABEL[partReturn.condition] ?? partReturn.condition}</>
              )}
              {partReturn.notes && <> — {partReturn.notes}</>}
            </p>
          )}
        </div>
        {partReturn.status === 'pending' && onConfirm && onReject ? (
          <div className="flex flex-col gap-2 items-end shrink-0 w-full sm:w-auto">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_BADGE.pending.className}`}>
              {STATUS_BADGE.pending.label}
            </span>
            <div className="flex gap-2">
              <button
                disabled={!!busy}
                onClick={() => { setReceiving((v) => !v); setRejecting(false); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-700 disabled:opacity-50"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                Returned
              </button>
              <button
                disabled={!!busy}
                onClick={() => { setRejecting((v) => !v); setReceiving(false); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-300 text-red-600 text-xs font-semibold hover:bg-red-50 disabled:opacity-50"
              >
                <XCircle className="w-3.5 h-3.5" />
                Reject
              </button>
            </div>
            {receiving && (
              <div className="w-full sm:w-72 bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2">
                <label className="block text-xs font-medium text-gray-600">Condition received</label>
                <select
                  value={condition}
                  onChange={(e) => setCondition(e.target.value as Condition)}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs"
                >
                  {CONDITION_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={receiveNotes}
                  onChange={(e) => setReceiveNotes(e.target.value)}
                  placeholder="Notes (optional)"
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs"
                />
                <button
                  disabled={!!busy}
                  onClick={async () => {
                    setBusy('confirm');
                    try {
                      await onConfirm(partReturn, condition, receiveNotes.trim());
                      setReceiving(false);
                    } finally {
                      setBusy(null);
                    }
                  }}
                  className="w-full px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-700 disabled:opacity-50"
                >
                  {busy === 'confirm' ? 'Confirming…' : 'Confirm Received'}
                </button>
              </div>
            )}
            {rejecting && (
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Reason for dispute"
                  className="border border-gray-300 rounded px-2 py-1 text-xs"
                />
                <button
                  disabled={!!busy || !reason.trim()}
                  onClick={async () => {
                    setBusy('reject');
                    try {
                      await onReject(partReturn, reason.trim());
                      setRejecting(false);
                    } finally {
                      setBusy(null);
                    }
                  }}
                  className="px-2 py-1 rounded bg-red-600 text-white text-xs font-semibold disabled:opacity-50"
                >
                  {busy === 'reject' ? 'Rejecting…' : 'Confirm Reject'}
                </button>
              </div>
            )}
          </div>
        ) : (
          <span
            className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
              STATUS_BADGE[partReturn.status]?.className ?? 'bg-gray-100 text-gray-600'
            }`}
          >
            {STATUS_BADGE[partReturn.status]?.label ?? partReturn.status}
          </span>
        )}
      </div>
    </div>
  );
}
