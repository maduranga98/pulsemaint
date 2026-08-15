import { useState } from 'react';
import type { Timestamp } from 'firebase/firestore';
import { CheckCircle, XCircle } from 'lucide-react';
import type { PartsRequest, PartReturn, PartReturnStatus, RequestStatus } from '@/types/inventory';
import { usePartReturnActions } from '@/hooks/inventory/usePartReturnActions';
import { RequestPriorityBadge } from './RequestPriorityBadge';
import { CostDisplay } from '@/components/inventory/shared/CostDisplay';

const ROLE_LABELS: Record<string, string> = {
  store_keeper: 'Store Keeper',
  supervisor: 'Supervisor',
  plant_manager: 'Plant Manager',
  admin: 'Admin',
};

export interface ReturnInfo {
  status: PartReturnStatus;
  at: Timestamp | null;
  byName: string | null;
  byRole?: string | null;
  /** The full return record — only set when status is 'pending', so a
   *  manager/store keeper can act on it directly from this column. */
  pendingReturn?: PartReturn | null;
}

interface Props {
  request: PartsRequest;
  returnInfo?: ReturnInfo | null;
  onReview: () => void;
  /** Whether this viewer is allowed to confirm/reject a pending return
   *  (store keeper, supervisor, plant manager, admin). */
  canManageReturns?: boolean;
  /** False on the Pending Return tab, where every row is already Completed
   *  and the Status column would just repeat that. */
  showStatus?: boolean;
}

const RETURN_BADGE: Record<PartReturnStatus, { label: string; className: string }> = {
  pending: { label: 'Returning', className: 'bg-purple-100 text-purple-700' },
  returned: { label: 'Return Confirmed', className: 'bg-green-100 text-green-700' },
  rejected: { label: 'Return Rejected', className: 'bg-red-100 text-red-700' },
  cancelled: { label: 'Return Cancelled', className: 'bg-gray-100 text-gray-500' },
};

function actorLabel(byName: string | null | undefined, byRole: string | null | undefined): string {
  if (!byName) return '';
  const role = byRole ? ROLE_LABELS[byRole] ?? byRole : null;
  return role ? `${byName} (${role})` : byName;
}

export function ReturnCell({
  returnInfo,
  hasPendingReturn,
  canManageReturns = false,
}: {
  returnInfo?: ReturnInfo | null;
  hasPendingReturn: boolean;
  canManageReturns?: boolean;
}) {
  const { confirmReturn, rejectReturn } = usePartReturnActions();
  const [busy, setBusy] = useState<'confirm' | 'reject' | null>(null);

  if (!returnInfo) {
    if (!hasPendingReturn) return <span className="text-gray-300">—</span>;
    return <span className="text-xs text-gray-400">Not yet requested</span>;
  }

  const cfg = RETURN_BADGE[returnInfo.status];

  // A manager/store keeper acting directly from this list — the same
  // confirm/reject action the dedicated Parts Returns queue offers,
  // reached without leaving this page. The action taken (who, decision) is
  // what's shown here once resolved — not the requester who returned it.
  if (returnInfo.status === 'pending' && canManageReturns && returnInfo.pendingReturn) {
    const partReturn = returnInfo.pendingReturn;
    return (
      <div className="flex items-center gap-1.5">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.className}`}>
          {cfg.label}
        </span>
        <button
          type="button"
          disabled={!!busy}
          onClick={async () => {
            setBusy('confirm');
            try {
              await confirmReturn(partReturn, 'good', '');
            } finally {
              setBusy(null);
            }
          }}
          title="Confirm received in good condition — updates stock automatically"
          className="flex items-center gap-1 px-2 py-1 rounded text-green-700 bg-green-50 hover:bg-green-100 text-xs font-semibold disabled:opacity-50"
        >
          <CheckCircle className="w-3.5 h-3.5" />
          {busy === 'confirm' ? 'Confirming…' : 'Returned'}
        </button>
        <button
          type="button"
          disabled={!!busy}
          onClick={async () => {
            const reason = window.prompt('Reason for rejecting this return?');
            if (!reason?.trim()) return;
            setBusy('reject');
            try {
              await rejectReturn(partReturn, reason.trim());
            } finally {
              setBusy(null);
            }
          }}
          title="Reject this return"
          className="p-1 rounded text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          <XCircle className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div>
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.className}`}>
        {cfg.label}
      </span>
      <p className="text-xs text-gray-400 mt-0.5">
        {returnInfo.status === 'pending'
          ? returnInfo.byName && <>Requested by {returnInfo.byName} · </>
          : returnInfo.byName && <>{actorLabel(returnInfo.byName, returnInfo.byRole)} · </>}
        {returnInfo.at?.toDate?.().toLocaleString?.() ?? ''}
      </p>
    </div>
  );
}

function formatAge(ts: { seconds: number } | null | undefined): { label: string; isOld: boolean } {
  if (!ts) return { label: '', isOld: false };
  const diffMs = Date.now() - ts.seconds * 1000;
  const diffH = diffMs / 3600000;
  const diffD = diffMs / 86400000;
  if (diffH < 1) return { label: 'Just now', isOld: false };
  if (diffH < 24) return { label: `${Math.floor(diffH)}h ago`, isOld: false };
  return { label: `${Math.floor(diffD)}d ago`, isOld: true };
}

const STATUS_BADGE: Record<RequestStatus, { label: string; className: string }> = {
  pending_storekeeper: { label: 'To Review', className: 'bg-amber-100 text-amber-700' },
  pending_supervisor: { label: 'Awaiting Supervisor', className: 'bg-blue-100 text-blue-700' },
  approved: { label: 'Parts to Collect', className: 'bg-indigo-100 text-indigo-700' },
  partially_approved: { label: 'Parts to Collect', className: 'bg-indigo-100 text-indigo-700' },
  rejected: { label: 'Rejected', className: 'bg-red-100 text-red-700' },
  parts_reserved: { label: 'Parts to Collect', className: 'bg-indigo-100 text-indigo-700' },
  issued: { label: 'Completed', className: 'bg-green-100 text-green-700' },
  completed: { label: 'Completed', className: 'bg-gray-100 text-gray-600' },
  cancelled: { label: 'Not Collected', className: 'bg-gray-100 text-gray-400' },
};

export function RequestQueueRow({ request, returnInfo, onReview, canManageReturns = false, showStatus = true }: Props) {
  const age = formatAge(request.requestedAt);
  const statusCfg = STATUS_BADGE[request.status] ?? { label: request.status, className: 'bg-gray-100 text-gray-600' };
  const firstPart = request.items[0]?.partName ?? '';
  const extraParts = request.items.length - 1;
  const hasPendingReturn = request.items.some((i) => i.isReturnable && !i.isReturned);

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3 text-sm font-mono text-blue-700 whitespace-nowrap">
        {request.requestNumber}
      </td>
      <td className="px-4 py-3 text-sm whitespace-nowrap">
        <span className="font-semibold text-gray-900">{request.workOrderNumber ?? ''}</span>
        {request.workOrderType && (
          <span className="ml-1.5 text-xs text-gray-500">{request.workOrderType}</span>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
        {request.requestedByName}
      </td>
      <td className="px-4 py-3 text-sm text-gray-700">
        <span>{firstPart}</span>
        {extraParts > 0 && (
          <span className="text-xs text-gray-400 ml-1">+{extraParts} more</span>
        )}
        <span className="ml-1.5 text-xs text-gray-400">({request.items.length})</span>
      </td>
      <td className="px-4 py-3 text-sm whitespace-nowrap">
        <CostDisplay amount={request.totalEstimatedCost} />
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <RequestPriorityBadge priority={request.priorityLevel} isUrgent={request.isUrgent} />
      </td>
      {showStatus && (
        <td className="px-4 py-3 whitespace-nowrap">
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${statusCfg.className}`}
          >
            {statusCfg.label}
          </span>
        </td>
      )}
      <td className="px-4 py-3 whitespace-nowrap">
        <ReturnCell returnInfo={returnInfo} hasPendingReturn={hasPendingReturn} canManageReturns={canManageReturns} />
      </td>
      <td className={`px-4 py-3 text-sm whitespace-nowrap ${age.isOld ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
        {age.label}
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <button
          onClick={onReview}
          className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors"
        >
          Review
        </button>
      </td>
    </tr>
  );
}
