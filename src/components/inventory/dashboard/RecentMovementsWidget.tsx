import type { StockMovement } from '@/types/inventory';
import { StockMovementIcon } from '@/components/inventory/shared/StockMovementIcon';

interface Props {
  movements: StockMovement[];
}

function formatTime(ts: { seconds: number } | null | undefined): string {
  if (!ts) return '';
  const d = new Date(ts.seconds * 1000);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) +
    ' ' +
    d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export function RecentMovementsWidget({ movements }: Props) {
  const items = movements.slice(0, 20);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="px-4 py-3 border-b border-gray-100">
        <h2 className="font-semibold text-gray-900">Recent Stock Movements</h2>
      </div>

      {items.length === 0 ? (
        <div className="px-4 py-8 text-center text-gray-400 text-sm">No recent movements</div>
      ) : (
        <div className="divide-y divide-gray-100">
          {items.map((m) => {
            const isPositive = m.quantityChange > 0;
            return (
              <div key={m.id} className="px-4 py-3 flex items-center gap-3">
                <div className="shrink-0">
                  <StockMovementIcon type={m.movementType} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{m.partName}</p>
                  <p className="text-xs text-gray-500 truncate">by {m.performedByName}</p>
                </div>
                <div className="text-right shrink-0">
                  <p
                    className={`text-sm font-bold ${
                      isPositive ? 'text-green-600' : 'text-red-500'
                    }`}
                  >
                    {isPositive ? '+' : ''}{m.quantityChange} pcs
                  </p>
                  <p className="text-xs text-gray-400">{formatTime(m.performedAt)}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
