import { useState, useMemo } from 'react';
import { Download, ChevronDown, ChevronRight } from 'lucide-react';
import { useStockMovements, type UseStockMovementsOptions } from '@/hooks/inventory/useStockMovements';
import { StockMovementBadge } from '@/components/inventory/shared/StockMovementBadge';
import type { MovementType, StockMovement } from '@/types/inventory';

import { useTranslation } from 'react-i18next';
const MOVEMENT_TYPES: MovementType[] = [
  'issue', 'return', 'receive', 'adjustment', 'reserve', 'unreserve',
  'import_create', 'import_update', 'transfer_out', 'transfer_in',
];

function formatDateTime(ts: StockMovement['performedAt']): string {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date((ts as unknown as { seconds: number }).seconds * 1000);
  return d.toLocaleString();
}

export function StockMovementLogPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<MovementType[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const options: UseStockMovementsOptions = {
    movementType: selectedTypes.length === 1 ? selectedTypes[0] : undefined,
    startDate: startDate ? new Date(startDate) : undefined,
    endDate: endDate ? new Date(endDate) : undefined,
    pageSize: 100,
  };

  const { movements, loading, error } = useStockMovements(options);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return movements.filter((m) => {
      if (q) {
        const match =
          m.partName.toLowerCase().includes(q) ||
          m.partNumber.toLowerCase().includes(q) ||
          m.performedByName.toLowerCase().includes(q);
        if (!match) return false;
      }
      if (selectedTypes.length > 1 && !selectedTypes.includes(m.movementType)) return false;
      return true;
    });
  }, [movements, search, selectedTypes]);

  function toggleType(mt: MovementType) {
    setSelectedTypes((prev) =>
      prev.includes(mt) ? prev.filter((x) => x !== mt) : [...prev, mt]
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('common.inventory.movementLogPage.stockMovementLog')}</h1>
          <p className="text-gray-500 text-sm mt-0.5">{t('common.inventory.movementLogPage.completeAuditTrailReadOnly')}</p>
        </div>
        <button
          onClick={() => console.log('[StockMovementLog] Export placeholder')}
          className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-xl transition-colors"
        >
          <Download className="w-4 h-4" />
          {t('common.inventory.movementLogPage.exportToExcel')}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('common.inventory.movementLogPage.searchByPartOrPerson')}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-56"
        />
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Movement type multiselect */}
      <div className="flex flex-wrap gap-2">
        {MOVEMENT_TYPES.map((mt) => (
          <button
            key={mt}
            onClick={() => toggleType(mt)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors
              ${selectedTypes.includes(mt)
                ? 'border-blue-600 bg-blue-600 text-white'
                : 'border-gray-300 bg-white text-gray-600 hover:border-blue-400'}
            `}
          >
            {t(`common.inventory.enums.movementType.${mt}`, { defaultValue: mt.replace(/_/g, ' ') })}
          </button>
        ))}
        {selectedTypes.length > 0 && (
          <button
            onClick={() => setSelectedTypes([])}
            className="px-3 py-1.5 rounded-full text-xs font-medium text-gray-400 hover:text-red-500"
          >
            {t('common.inventory.movementLogPage.clear')}
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((k) => (
            <div key={k} className="h-12 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {/* Desktop table */}
      {!loading && (
        <>
          <div className="hidden md:block overflow-x-auto border border-gray-200 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">{t('common.inventory.movementLogPage.dateTime')}</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">{t('common.inventory.movementLogPage.part')}</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">{t('common.inventory.movementLogPage.type')}</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">{t('common.inventory.movementLogPage.change')}</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">{t('common.inventory.movementLogPage.beforeAfter')}</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">{t('common.inventory.movementLogPage.reference')}</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">{t('common.inventory.movementLogPage.by')}</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">{t('common.inventory.movementLogPage.notes')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((m) => {
                  const positive = m.quantityChange > 0;
                  const isExpanded = expandedId === m.id;
                  return (
                    <>
                      <tr
                        key={m.id}
                        className="hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => setExpandedId(isExpanded ? null : m.id)}
                      >
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDateTime(m.performedAt)}</td>
                        <td className="px-4 py-3">
                          <p className="font-mono text-xs text-gray-500">{m.partNumber}</p>
                          <p className="text-gray-900 font-medium truncate max-w-[160px]">{m.partName}</p>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <StockMovementBadge type={m.movementType} />
                        </td>
                        <td className="px-4 py-3">
                          <span className={`font-bold ${positive ? 'text-green-700' : 'text-red-600'}`}>
                            {positive ? '+' : ''}{m.quantityChange}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                          {m.quantityBefore} → {m.quantityAfter}
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-xs font-mono whitespace-nowrap">
                          {m.referenceId ? m.referenceId.slice(0, 8) + '…' : ''}
                        </td>
                        <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{m.performedByName || ''}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs max-w-[200px] truncate">
                          {m.notes || ''}
                          <span className="ml-1">{isExpanded ? <ChevronDown className="inline w-3 h-3" /> : <ChevronRight className="inline w-3 h-3" />}</span>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${m.id}-expanded`} className="bg-blue-50/30">
                          <td colSpan={8} className="px-6 py-3 text-sm text-gray-700">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              <div>
                                <p className="text-xs text-gray-500">{t('common.inventory.movementLogPage.referenceType')}</p>
                                <p className="font-medium">{m.referenceType}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500">{t('common.inventory.movementLogPage.workOrder')}</p>
                                <p className="font-medium">{m.workOrderNumber || ''}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500">{t('common.inventory.movementLogPage.unitCostAtTime')}</p>
                                <p className="font-medium">LKR {m.unitCostAtTime.toLocaleString()}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500">{t('common.inventory.movementLogPage.costImpact')}</p>
                                <p className="font-medium">LKR {m.totalCostImpact.toLocaleString()}</p>
                              </div>
                              <div className="col-span-2 sm:col-span-4">
                                <p className="text-xs text-gray-500">{t('common.inventory.movementLogPage.notes')}</p>
                                <p>{m.notes || ''}</p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
            {filtered.length === 0 && !loading && (
              <div className="text-center py-12 text-gray-400">
                <p className="text-base font-medium">{t('common.inventory.movementLogPage.noMovementsFound')}</p>
                <p className="text-sm mt-1">{t('common.inventory.movementLogPage.tryAdjustingYourSearchOr')}</p>
              </div>
            )}
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.map((m) => {
              const positive = m.quantityChange > 0;
              return (
                <div key={m.id} className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-mono text-xs text-gray-500">{m.partNumber}</p>
                      <p className="font-semibold text-gray-900">{m.partName}</p>
                    </div>
                    <StockMovementBadge type={m.movementType} />
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className={`font-bold text-base ${positive ? 'text-green-700' : 'text-red-600'}`}>
                      {positive ? '+' : ''}{m.quantityChange}
                    </span>
                    <span className="text-gray-500">{m.quantityBefore} → {m.quantityAfter}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>{m.performedByName || ''}</span>
                    <span>{formatDateTime(m.performedAt)}</span>
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="text-center py-12 text-gray-400">{t('common.inventory.movementLogPage.noMovementsFound2')}</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
export default StockMovementLogPage;
