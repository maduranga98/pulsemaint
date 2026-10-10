import { useTranslation } from 'react-i18next';
import type { RequestItem } from '@/types/inventory';
import { AvailabilityIndicator } from './AvailabilityIndicator';

interface RequestItemsTableProps {
  items: RequestItem[];
  showCost?: boolean;
}

const APPROVAL_THRESHOLD_LKR = 50000;

export function RequestItemsTable({ items, showCost = false }: RequestItemsTableProps) {
  const { t } = useTranslation();
  const subtotal = items.reduce((sum, item) => sum + item.unitCost * item.quantityRequested, 0);
  const allAvailable = items.every((item) => item.availableAtRequest >= item.quantityRequested);

  const reasons =
    (!allAvailable ? t('common.inventory.requests.itemsTable.someUnavailable') : '') +
    (subtotal > APPROVAL_THRESHOLD_LKR
      ? t('common.inventory.requests.itemsTable.costExceedsThreshold', { threshold: APPROVAL_THRESHOLD_LKR.toLocaleString() })
      : '');

  const writtenOffNote = (item: RequestItem) =>
    item.isWrittenOff ? (
      <div className="mt-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
        {t('common.inventory.requests.itemsTable.writtenOff', {
          name: item.writeOffByName || '',
          reason: item.writeOffReason || '',
        })}
      </div>
    ) : null;

  return (
    <>
    <div className="space-y-3 md:hidden">
      {items.map((item) => (
        <div key={item.id} className="rounded-lg border border-gray-200 bg-white p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-medium text-gray-900">{item.partName}</p>
              <p className="text-xs text-gray-500 break-all">{item.partNumber}</p>
            </div>
            <span
              className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${item.isCritical ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}
            >
              {item.isCritical ? t('common.inventory.requests.itemsTable.critical') : t('common.inventory.requests.itemsTable.standard')}
            </span>
          </div>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
            <dt className="text-gray-500">{t('common.inventory.requests.itemsTable.columns.qtyRequested')}</dt>
            <dd className="text-right text-gray-900">{item.quantityRequested} {item.unit}</dd>
            <dt className="text-gray-500">{t('common.inventory.requests.itemsTable.columns.availStock')}</dt>
            <dd className="text-right text-gray-900">{item.availableAtRequest}</dd>
            {showCost && (
              <>
                <dt className="text-gray-500">{t('common.inventory.requests.itemsTable.columns.unitCost')}</dt>
                <dd className="text-right text-gray-900">LKR {item.unitCost.toLocaleString()}</dd>
                <dt className="text-gray-500">{t('common.inventory.requests.itemsTable.columns.lineTotal')}</dt>
                <dd className="text-right font-medium text-gray-900">LKR {(item.unitCost * item.quantityRequested).toLocaleString()}</dd>
              </>
            )}
          </dl>
          <AvailabilityIndicator available={item.availableAtRequest} requested={item.quantityRequested} />
          {item.notes && <p className="text-xs text-gray-500">{item.notes}</p>}
          {writtenOffNote(item)}
        </div>
      ))}
      {showCost && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 font-medium">{t('common.inventory.requests.itemsTable.subtotal', { count: items.length })}</span>
            <span className="font-bold text-gray-900">LKR {subtotal.toLocaleString()}</span>
          </div>
          <p className={`rounded px-2 py-1 text-xs ${allAvailable && subtotal <= APPROVAL_THRESHOLD_LKR ? 'text-green-700 bg-green-50' : 'text-amber-700 bg-amber-50'}`}>
            {allAvailable && subtotal <= APPROVAL_THRESHOLD_LKR
              ? t('common.inventory.requests.itemsTable.autoApprovalEligible')
              : t('common.inventory.requests.itemsTable.autoApprovalNotEligible', { reasons })}
          </p>
        </div>
      )}
    </div>
    <div className="hidden md:block overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
          <tr>
            <th className="px-4 py-3 text-left">{t('common.inventory.requests.itemsTable.columns.part')}</th>
            <th className="px-4 py-3 text-left">{t('common.inventory.requests.itemsTable.columns.categoryCriticality')}</th>
            <th className="px-4 py-3 text-right">{t('common.inventory.requests.itemsTable.columns.qtyRequested')}</th>
            <th className="px-4 py-3 text-right">{t('common.inventory.requests.itemsTable.columns.availStock')}</th>
            {showCost && <th className="px-4 py-3 text-right">{t('common.inventory.requests.itemsTable.columns.unitCost')}</th>}
            {showCost && <th className="px-4 py-3 text-right">{t('common.inventory.requests.itemsTable.columns.lineTotal')}</th>}
            <th className="px-4 py-3 text-left">{t('common.inventory.requests.itemsTable.columns.availability')}</th>
            <th className="px-4 py-3 text-left">{t('common.inventory.requests.itemsTable.columns.notes')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {items.map((item) => (
            <tr key={item.id} className="hover:bg-gray-50">
              <td className="px-4 py-3">
                <div className="font-medium text-gray-900">{item.partName}</div>
                <div className="text-gray-500 text-xs">{item.partNumber}</div>
              </td>
              <td className="px-4 py-3">
                {item.isCritical ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                    {t('common.inventory.requests.itemsTable.critical')}
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                    {t('common.inventory.requests.itemsTable.standard')}
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-right">
                {item.quantityRequested} {item.unit}
              </td>
              <td className="px-4 py-3 text-right text-gray-700">{item.availableAtRequest}</td>
              {showCost && (
                <td className="px-4 py-3 text-right text-gray-700">
                  LKR {item.unitCost.toLocaleString()}
                </td>
              )}
              {showCost && (
                <td className="px-4 py-3 text-right font-medium text-gray-900">
                  LKR {(item.unitCost * item.quantityRequested).toLocaleString()}
                </td>
              )}
              <td className="px-4 py-3">
                <AvailabilityIndicator
                  available={item.availableAtRequest}
                  requested={item.quantityRequested}
                />
              </td>
              <td className="px-4 py-3 text-gray-500 max-w-xs truncate">
                {item.notes || ''}
                {writtenOffNote(item)}
              </td>
            </tr>
          ))}
        </tbody>
        {showCost && (
          <tfoot className="bg-gray-50 border-t border-gray-200">
            <tr>
              <td colSpan={4} className="px-4 py-3 text-sm text-gray-600 font-medium">
                {t('common.inventory.requests.itemsTable.subtotal', { count: items.length })}
              </td>
              <td className="px-4 py-3" />
              <td className="px-4 py-3 text-right font-bold text-gray-900">
                LKR {subtotal.toLocaleString()}
              </td>
              <td colSpan={2} />
            </tr>
            <tr>
              <td
                colSpan={8}
                className={`px-4 py-2 text-xs ${allAvailable && subtotal <= APPROVAL_THRESHOLD_LKR ? 'text-green-700 bg-green-50' : 'text-amber-700 bg-amber-50'}`}
              >
                {allAvailable && subtotal <= APPROVAL_THRESHOLD_LKR
                  ? t('common.inventory.requests.itemsTable.autoApprovalEligible')
                  : t('common.inventory.requests.itemsTable.autoApprovalNotEligible', { reasons })}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
    </>
  );
}
