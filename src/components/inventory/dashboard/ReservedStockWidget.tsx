import { useNavigate } from 'react-router-dom';
import type { PartsRequest } from '@/types/inventory';

interface Props {
  requests: PartsRequest[];
}

function formatTimestamp(ts: { seconds: number } | null | undefined): string {
  if (!ts) return '—';
  const d = new Date(ts.seconds * 1000);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) +
    ', ' +
    d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export function ReservedStockWidget({ requests }: Props) {
  const navigate = useNavigate();

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="px-4 py-3 border-b border-gray-100">
        <h2 className="font-semibold text-gray-900">Parts Reserved — Awaiting Issue</h2>
      </div>

      {requests.length === 0 ? (
        <div className="px-4 py-8 text-center text-gray-400 text-sm">
          No parts currently reserved
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {requests.map((r) => {
            const partsSummary = r.items
              .slice(0, 2)
              .map((i) => i.partName)
              .join(', ');
            const extra = r.items.length - 2;

            return (
              <div key={r.id} className="px-4 py-3 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-blue-700 font-semibold">
                      {r.requestNumber}
                    </span>
                    {r.workOrderNumber && (
                      <span className="text-sm text-gray-600">· {r.workOrderNumber}</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-700 mt-0.5 truncate">
                    {partsSummary}
                    {extra > 0 && (
                      <span className="text-gray-400"> +{extra} more</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Reserved: {formatTimestamp(r.reservedAt)}
                  </p>
                </div>
                <button
                  onClick={() => navigate(`/app/inventory/issue/${r.id}`)}
                  className="shrink-0 px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-700 transition-colors"
                >
                  Issue Now
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
