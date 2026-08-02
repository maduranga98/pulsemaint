import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, XCircle } from 'lucide-react';
import type { PartReturn } from '@/types/inventory';

interface Props {
  partReturn: PartReturn;
  onConfirm: (partReturn: PartReturn) => Promise<void>;
  onReject: (partReturn: PartReturn, reason: string) => Promise<void>;
}

export function PartReturnQueueRow({ partReturn, onConfirm, onReject }: Props) {
  const [busy, setBusy] = useState<'confirm' | 'reject' | null>(null);
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
        </div>
        <div className="flex flex-col gap-2 items-end shrink-0">
          <div className="flex gap-2">
            <button
              disabled={!!busy}
              onClick={async () => {
                setBusy('confirm');
                try {
                  await onConfirm(partReturn);
                } finally {
                  setBusy(null);
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-700 disabled:opacity-50"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              {busy === 'confirm' ? 'Confirming…' : 'Mark as Returned'}
            </button>
            <button
              disabled={!!busy}
              onClick={() => setRejecting((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-300 text-red-600 text-xs font-semibold hover:bg-red-50 disabled:opacity-50"
            >
              <XCircle className="w-3.5 h-3.5" />
              Reject
            </button>
          </div>
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
      </div>
    </div>
  );
}
