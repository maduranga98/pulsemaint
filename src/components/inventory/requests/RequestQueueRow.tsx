import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Timestamp } from 'firebase/firestore';
import { CheckCircle, XCircle } from 'lucide-react';
import type { PartsRequest, PartReturn, PartReturnStatus, RequestStatus } from '@/types/inventory';
import { usePartReturnActions } from '@/hooks/inventory/usePartReturnActions';
import { RequestPriorityBadge } from './RequestPriorityBadge';
import { CostDisplay } from '@/components/inventory/shared/CostDisplay';

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

const RETURN_BADGE_CLASSNAME: Record<PartReturnStatus, string> = {
  pending: 'bg-purple-100 text-purple-700',
  returned: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

function actorLabel(
  byName: string | null | undefined,
  byRole: string | null | undefined,
  roleLabel: (role: string) => string,
): string {
  if (!byName) return '';
  const role = byRole ? roleLabel(byRole) : null;
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
  const { t } = useTranslation();
  const { confirmReturn, rejectReturn } = usePartReturnActions();
  const [busy, setBusy] = useState<'confirm' | 'reject' | null>(null);

  const roleLabel = (role: string) => t(`common.inventory.requests.roleLabels.${role}`, { defaultValue: role });

  if (!returnInfo) {
    if (!hasPendingReturn) return <span className="text-gray-300">—</span>;
    return <span className="text-xs text-gray-400">{t('common.inventory.requests.reviewPanel.notYetRequested')}</span>;
  }

  const label = t(`common.inventory.requests.returnBadges.${returnInfo.status}`);
  const className = RETURN_BADGE_CLASSNAME[returnInfo.status];

  // A manager/store keeper acting directly from this list — the same
  // confirm/reject action the dedicated Parts Returns queue offers,
  // reached without leaving this page. The action taken (who, decision) is
  // what's shown here once resolved — not the requester who returned it.
  if (returnInfo.status === 'pending' && canManageReturns && returnInfo.pendingReturn) {
    const partReturn = returnInfo.pendingReturn;
    return (
      <div className="flex items-center gap-1.5">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${className}`}>
          {label}
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
          title={t('common.inventory.requests.reviewPanel.confirmReceivedTitle')}
          className="flex items-center gap-1 px-2 py-1 rounded text-green-700 bg-green-50 hover:bg-green-100 text-xs font-semibold disabled:opacity-50"
        >
          <CheckCircle className="w-3.5 h-3.5" />
          {busy === 'confirm' ? t('common.inventory.requests.reviewPanel.confirming') : t('common.inventory.requests.reviewPanel.returnedButton')}
        </button>
        <button
          type="button"
          disabled={!!busy}
          onClick={async () => {
            const reason = window.prompt(t('common.inventory.requests.reviewPanel.rejectReturnPrompt'));
            if (!reason?.trim()) return;
            setBusy('reject');
            try {
              await rejectReturn(partReturn, reason.trim());
            } finally {
              setBusy(null);
            }
          }}
          title={t('common.inventory.requests.reviewPanel.rejectReturnTitle')}
          className="p-1 rounded text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          <XCircle className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div>
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${className}`}>
        {label}
      </span>
      <p className="text-xs text-gray-400 mt-0.5">
        {returnInfo.status === 'pending'
          ? returnInfo.byName && (
              <>{t('common.inventory.requests.reviewPanel.requestedByActor', { name: returnInfo.byName })}</>
            )
          : returnInfo.byName && <>{actorLabel(returnInfo.byName, returnInfo.byRole, roleLabel)} · </>}
        {returnInfo.at?.toDate?.().toLocaleString?.() ?? ''}
      </p>
    </div>
  );
}

function useFormatAge() {
  const { t } = useTranslation();
  return (ts: { seconds: number } | null | undefined): { label: string; isOld: boolean } => {
    if (!ts) return { label: '', isOld: false };
    const diffMs = Date.now() - ts.seconds * 1000;
    const diffH = diffMs / 3600000;
    const diffD = diffMs / 86400000;
    if (diffH < 1) return { label: t('common.inventory.requests.queue.justNow'), isOld: false };
    if (diffH < 24) return { label: t('common.inventory.requests.queue.hoursAgo', { count: Math.floor(diffH) }), isOld: false };
    return { label: t('common.inventory.requests.queue.daysAgo', { count: Math.floor(diffD) }), isOld: true };
  };
}

export function RequestQueueRow({ request, returnInfo, onReview, canManageReturns = false, showStatus = true }: Props) {
  const { t } = useTranslation();
  const formatAge = useFormatAge();
  const age = formatAge(request.requestedAt);
  const statusLabel = t(`common.inventory.requests.statusLabels.${request.status}`, { defaultValue: request.status });
  const statusClassName = ({
    pending_storekeeper: 'bg-amber-100 text-amber-700',
    pending_supervisor: 'bg-blue-100 text-blue-700',
    approved: 'bg-indigo-100 text-indigo-700',
    partially_approved: 'bg-indigo-100 text-indigo-700',
    rejected: 'bg-red-100 text-red-700',
    parts_reserved: 'bg-indigo-100 text-indigo-700',
    issued: 'bg-green-100 text-green-700',
    completed: 'bg-gray-100 text-gray-600',
    cancelled: 'bg-gray-100 text-gray-400',
  } as Record<RequestStatus, string>)[request.status] ?? 'bg-gray-100 text-gray-600';
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
          <span className="text-xs text-gray-400 ml-1">{t('common.inventory.requests.queue.moreCount', { count: extraParts })}</span>
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
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${statusClassName}`}
          >
            {statusLabel}
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
          {t('common.inventory.requests.queue.reviewButton')}
        </button>
      </td>
    </tr>
  );
}
