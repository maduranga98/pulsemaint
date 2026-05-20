import type { RequestItem } from '@/types/inventory';
import { AvailabilityIndicator } from './AvailabilityIndicator';

interface RequestItemsTableProps {
  items: RequestItem[];
  showCost?: boolean;
}

const APPROVAL_THRESHOLD_LKR = 50000;

export function RequestItemsTable({ items, showCost = false }: RequestItemsTableProps) {
  const subtotal = items.reduce((sum, item) => sum + item.unitCost * item.quantityRequested, 0);
  const allAvailable = items.every((item) => item.availableAtRequest >= item.quantityRequested);

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
          <tr>
            <th className="px-4 py-3 text-left">Part</th>
            <th className="px-4 py-3 text-left">Category / Criticality</th>
            <th className="px-4 py-3 text-right">Qty Req.</th>
            <th className="px-4 py-3 text-right">Avail. Stock</th>
            {showCost && <th className="px-4 py-3 text-right">Unit Cost</th>}
            {showCost && <th className="px-4 py-3 text-right">Line Total</th>}
            <th className="px-4 py-3 text-left">Availability</th>
            <th className="px-4 py-3 text-left">Notes</th>
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
                    Critical
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                    Standard
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
              <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{item.notes || '—'}</td>
            </tr>
          ))}
        </tbody>
        {showCost && (
          <tfoot className="bg-gray-50 border-t border-gray-200">
            <tr>
              <td colSpan={4} className="px-4 py-3 text-sm text-gray-600 font-medium">
                Subtotal ({items.length} item{items.length !== 1 ? 's' : ''})
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
                  ? '✓ Auto-approval eligible: All items in stock and within threshold'
                  : `✗ Auto-approval not eligible: ${!allAvailable ? 'Some items unavailable. ' : ''}${subtotal > APPROVAL_THRESHOLD_LKR ? `Cost exceeds LKR ${APPROVAL_THRESHOLD_LKR.toLocaleString()} threshold.` : ''}`}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
