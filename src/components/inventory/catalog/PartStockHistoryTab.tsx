import { useState } from 'react';
import { useStockMovements } from '@/hooks/inventory/useStockMovements';
import { StockMovementIcon } from '@/components/inventory/shared/StockMovementIcon';
import { StockMovementBadge } from '@/components/inventory/shared/StockMovementBadge';
import type { MovementType } from '@/types/inventory';
import { formatDistanceToNow } from '@/lib/dateUtils';
import { ChevronDown } from 'lucide-react';

interface PartStockHistoryTabProps {
  partId: string;
}

type AnyMovementType = MovementType | '';

function tsToDate(ts: unknown): Date | null {
  if (!ts) return null;
  if (typeof (ts as { toDate?: () => Date }).toDate === 'function') {
    return (ts as { toDate: () => Date }).toDate();
  }
  if (typeof (ts as { seconds?: number }).seconds === 'number') {
    return new Date((ts as { seconds: number }).seconds * 1000);
  }
  return null;
}

const MOVEMENT_TYPES: { value: MovementType; label: string }[] = [
  { value: 'issue', label: 'Issue' },
  { value: 'return', label: 'Return' },
  { value: 'receive', label: 'Receive' },
  { value: 'adjustment', label: 'Adjustment' },
  { value: 'reserve', label: 'Reserve' },
  { value: 'unreserve', label: 'Unreserve' },
  { value: 'transfer_out', label: 'Transfer Out' },
  { value: 'transfer_in', label: 'Transfer In' },
];

export function PartStockHistoryTab({ partId }: PartStockHistoryTabProps) {
  const [movementType, setMovementType] = useState<AnyMovementType>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const { movements, loading, error } = useStockMovements({
    partId,
    movementType: movementType || undefined,
    startDate: startDate ? new Date(startDate) : undefined,
    endDate: endDate ? new Date(endDate + 'T23:59:59') : undefined,
  });

  // Stats
  const totalReceived = movements.filter((m) => m.movementType === 'receive').reduce((s, m) => s + m.quantityChange, 0);
  const totalIssued = movements.filter((m) => m.movementType === 'issue').reduce((s, m) => s + Math.abs(m.quantityChange), 0);
  const totalAdjustments = movements.filter((m) => m.movementType === 'adjustment').length;
  const netChange = movements.reduce((s, m) => s + m.quantityChange, 0);

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Received', value: totalReceived, color: 'text-green-700' },
          { label: 'Total Issued', value: totalIssued, color: 'text-red-700' },
          { label: 'Adjustments', value: totalAdjustments, color: 'text-amber-700' },
          { label: 'Net Change', value: netChange >= 0 ? `+${netChange}` : netChange, color: netChange >= 0 ? 'text-green-700' : 'text-red-700' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white border border-gray-200 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500">{stat.label}</p>
            <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative">
          <select
            value={movementType}
            onChange={(e) => setMovementType(e.target.value as AnyMovementType)}
            className="appearance-none border border-gray-300 rounded-lg pl-3 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">All Types</option>
            {MOVEMENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        </div>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="From"
        />
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="To"
        />
      </div>

      {/* Timeline */}
      {loading && (
        <div className="text-center py-8 text-sm text-gray-500">Loading movements…</div>
      )}
      {error && (
        <div className="text-center py-8 text-sm text-red-600">{error}</div>
      )}
      {!loading && !error && movements.length === 0 && (
        <div className="text-center py-8 text-sm text-gray-500">No stock movements found.</div>
      )}

      <div className="space-y-2">
        {movements.map((m) => {
          const date = tsToDate(m.performedAt);
          const isPositive = m.quantityChange > 0;

          return (
            <div key={m.id} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0">
                  <StockMovementIcon type={m.movementType} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <StockMovementBadge type={m.movementType} />
                    <span className={`text-sm font-semibold ${isPositive ? 'text-green-700' : 'text-red-600'}`}>
                      {isPositive ? '+' : ''}{m.quantityChange}
                    </span>
                    <span className="text-xs text-gray-500">
                      {m.quantityBefore} → {m.quantityAfter}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                    <span>By: <span className="font-medium text-gray-700">{m.performedByName}</span></span>
                    {date && <span>{formatDistanceToNow(date)}</span>}
                    {m.referenceId && m.referenceType !== 'manual_adjustment' && (
                      <span>Ref: <span className="font-mono text-blue-600">{m.referenceId.slice(0, 8)}</span></span>
                    )}
                    {m.workOrderNumber && (
                      <span>WO: <span className="font-medium text-gray-700">{m.workOrderNumber}</span></span>
                    )}
                  </div>
                  {m.notes && (
                    <p className="text-xs text-gray-600 mt-1 bg-gray-50 rounded px-2 py-1">{m.notes}</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
